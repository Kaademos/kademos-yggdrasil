import { injectable, inject } from 'tsyringe';
import { FlagValidator } from './flag-validator';
import {
  IFlagRepository,
  LeaderboardEntry,
  UserProgression,
  EarnedAchievement,
  countHintsRevealed,
} from '../repositories/flag-repository';
import { ProgressionValidator } from './progression-validator';
import { ScoringService } from './scoring-service';
import { HintService } from './hint-service';
import { DiscordBroadcaster } from './discord-broadcaster';
import { AchievementService } from './achievement-service';

/** Number of scored (non-SAMPLE) realms that constitutes full platform completion. */
const TOTAL_SCORED_REALMS = 10;

export interface ValidationResult {
  status: 'success' | 'error' | 'invalid';
  message: string;
  unlocked?: string;
  realm?: string;
  points?: number;
  score?: number;
  achievements?: EarnedAchievement[];
}

export interface HintView {
  order: number;
  revealed: boolean;
  text?: string;
}

export interface RealmHintsResult {
  realm: string;
  basePoints: number;
  hintsRevealed: number;
  totalHints: number;
  potentialPoints: number;
  hints: HintView[];
}

export interface RevealHintResult {
  status: 'ok' | 'error';
  message?: string;
  order?: number;
  text?: string;
  hintsRevealed?: number;
  potentialPoints?: number;
}

@injectable()
export class ProgressionService {
  private readonly scoringService: ScoringService;
  private readonly hintService: HintService;
  private readonly broadcaster?: DiscordBroadcaster;
  private readonly achievementService: AchievementService;

  constructor(
    @inject('IFlagRepository') private repository: IFlagRepository,
    @inject(FlagValidator) private validator: FlagValidator,
    @inject(ProgressionValidator) private progressionValidator?: ProgressionValidator,
    scoringService?: ScoringService,
    hintService?: HintService,
    broadcaster?: DiscordBroadcaster,
    achievementService?: AchievementService
  ) {
    this.scoringService = scoringService ?? new ScoringService();
    this.hintService = hintService ?? new HintService();
    this.broadcaster = broadcaster;
    this.achievementService = achievementService ?? new AchievementService(this.repository);
  }

  /**
   * Broadcast a capture (and first-blood / full-completion) to Discord, best-effort.
   * Only runs when a webhook is configured; never throws into the validation path.
   * The first-blood signal is resolved once in the capture path and passed in, so it
   * is available to achievements regardless of whether Discord is enabled.
   */
  private async broadcastCapture(
    userId: string,
    realm: string,
    points: number,
    score: number,
    firstBlood: boolean
  ) {
    if (!this.broadcaster?.isEnabled()) return;
    try {
      void this.broadcaster.flagCaptured({ userId, realm, points, score, firstBlood });

      const progression = await this.repository.getProgression(userId);
      const scoredCompleted = new Set(
        (progression?.completions ?? [])
          .map((c) => c.realm.toUpperCase())
          .filter((r) => r !== 'SAMPLE')
      ).size;
      if (scoredCompleted >= TOTAL_SCORED_REALMS) {
        void this.broadcaster.fullCompletion({ userId });
      }
    } catch (err) {
      console.warn('[ProgressionService] Discord broadcast skipped:', (err as Error).message);
    }
  }

  /** Hints revealed for a realm by this user (drives the scoring penalty). */
  private hintsUsedForRealm(progression: UserProgression | null, realm: string): number {
    if (!progression) return 0;
    return countHintsRevealed(progression, realm.toUpperCase());
  }

  async validateFlag(userId: string, flag: string): Promise<ValidationResult> {
    if (!userId || typeof userId !== 'string') {
      return {
        status: 'error',
        message: 'Invalid userId',
      };
    }

    const validationResult = this.validator.validate(flag);
    if (!validationResult.valid) {
      return {
        status: 'invalid',
        message: validationResult.error || 'Invalid flag format',
      };
    }

    const validFlags = await this.repository.getValidFlags();
    const matchingFlag = validFlags.find(
      (f) => f.realm === validationResult.realm && f.flag === flag
    );

    if (!matchingFlag) {
      return {
        status: 'invalid',
        message: 'Flag not found',
      };
    }

    const progression = await this.repository.getProgression(userId);
    const unlockedRealms = progression?.unlockedRealms || [];

    if (this.progressionValidator) {
      if (!this.progressionValidator.canAccessRealm(matchingFlag.realm, unlockedRealms)) {
        return {
          status: 'error',
          message: 'Previous realm must be completed first',
        };
      }
    }

    if (progression && progression.flags.includes(flag)) {
      return {
        status: 'success',
        message: 'Flag already submitted',
        realm: matchingFlag.realm,
        unlocked: matchingFlag.nextRealm,
        score: progression.score,
      };
    }

    // First capture of this realm: award points (less any hint penalty).
    const hintsUsed = this.hintsUsedForRealm(progression, matchingFlag.realm);
    const points = this.scoringService.computePoints(matchingFlag.realm, hintsUsed);

    await this.repository.updateProgression(userId, matchingFlag.realm, flag, {
      points,
      hintsUsed,
    });

    const previousScore = progression?.score ?? 0;
    const newScore = previousScore + points;

    // Global single-writer first-blood signal — resolved once, before broadcast/awards.
    const firstBlood = await this.repository.recordRealmCapture(matchingFlag.realm);

    // Evaluate achievements on capture (award timestamp is meaningful; reads stay cheap).
    let earnedAchievements: EarnedAchievement[] = [];
    try {
      earnedAchievements = await this.achievementService.onCapture(
        userId,
        matchingFlag.realm,
        firstBlood
      );
    } catch (err) {
      console.warn(
        '[ProgressionService] Achievement evaluation skipped:',
        (err as Error).message
      );
    }

    await this.broadcastCapture(userId, matchingFlag.realm, points, newScore, firstBlood);

    return {
      status: 'success',
      message: 'Flag accepted',
      realm: matchingFlag.realm,
      unlocked: matchingFlag.nextRealm,
      points,
      score: newScore,
      achievements: earnedAchievements,
    };
  }

  async getProgression(userId: string) {
    if (!userId || typeof userId !== 'string') {
      return null;
    }
    return this.repository.getProgression(userId);
  }

  async getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
    return this.repository.getLeaderboard(limit);
  }

  /**
   * Hint state for a realm and user: which hints exist, which this user has revealed
   * (with text), and what the realm is currently worth given the penalty so far.
   * Returns null if the realm has no hints / is unknown.
   */
  async getHints(userId: string, realm: string): Promise<RealmHintsResult | null> {
    const realmHints = this.hintService.getRealmHints(realm);
    if (realmHints.length === 0) {
      return null;
    }

    const normalisedRealm = realm.toUpperCase();
    const progression = await this.repository.getProgression(userId);
    const revealedOrders = new Set(
      (progression?.hintsRevealed ?? [])
        .filter((h) => h.realm === normalisedRealm)
        .map((h) => h.order)
    );

    return {
      realm: normalisedRealm,
      basePoints: this.scoringService.getBasePoints(normalisedRealm),
      hintsRevealed: revealedOrders.size,
      totalHints: realmHints.length,
      potentialPoints: this.scoringService.computePoints(normalisedRealm, revealedOrders.size),
      hints: realmHints.map((h) => ({
        order: h.order,
        revealed: revealedOrders.has(h.order),
        text: revealedOrders.has(h.order) ? h.text : undefined,
      })),
    };
  }

  /**
   * Reveal a hint. Always permitted (hints never block progression); revealing simply
   * records the reveal so the eventual capture award is reduced. Idempotent.
   */
  async revealHint(userId: string, realm: string, order: number): Promise<RevealHintResult> {
    if (!userId || typeof userId !== 'string') {
      return { status: 'error', message: 'Invalid userId' };
    }

    const hint = this.hintService.getHint(realm, order);
    if (!hint) {
      return { status: 'error', message: 'Hint not found' };
    }

    const normalisedRealm = realm.toUpperCase();
    const progression = await this.repository.revealHint(userId, normalisedRealm, order);
    const hintsRevealed = countHintsRevealed(progression, normalisedRealm);

    return {
      status: 'ok',
      order: hint.order,
      text: hint.text,
      hintsRevealed,
      potentialPoints: this.scoringService.computePoints(normalisedRealm, hintsRevealed),
    };
  }
}