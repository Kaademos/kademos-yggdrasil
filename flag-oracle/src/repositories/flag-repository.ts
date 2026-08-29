import * as fs from 'fs/promises';
import * as path from 'path';
import { injectable, inject } from 'tsyringe';
import { loadRealmFlags } from '../config/realm-flags';

export interface RealmCompletion {
  realm: string;
  points: number;
  hintsUsed: number;
  completedAt: string;
}

export interface RevealedHint {
  realm: string;
  order: number;
  revealedAt: string;
}

export interface EarnedAchievement {
  id: string; // stable achievement id, e.g. 'SWIFT'
  awardedAt: string; // server-set ISO timestamp
  realm?: string; // set for realm-scoped achievements; absent for global ones
}

export interface UserProgression {
  userId: string;
  unlockedRealms: string[];
  flags: string[];
  score: number;
  completions: RealmCompletion[];
  hintsRevealed: RevealedHint[];
  achievements: EarnedAchievement[];
  lastUpdated: string;
}

export interface FlagData {
  realm: string;
  flag: string;
  nextRealm?: string;
}

export interface LeaderboardEntry {
  userId: string;
  score: number;
  realmsCompleted: number;
  rank: number;
}

/**
 * Extra fields persisted when recording a realm completion (scoring).
 * Optional so existing callers/mocks that only pass (userId, realm, flag) remain valid.
 */
export interface CompletionDetails {
  points: number;
  hintsUsed: number;
}

export interface IFlagRepository {
  getProgression(userId: string): Promise<UserProgression | null>;
  updateProgression(
    userId: string,
    realm: string,
    flag: string,
    completion?: CompletionDetails
  ): Promise<void>;
  revealHint(userId: string, realm: string, order: number): Promise<UserProgression>;
  getValidFlags(): Promise<FlagData[]>;
  getLeaderboard(limit?: number): Promise<LeaderboardEntry[]>;
  /**
   * Atomically record that a realm has been captured by someone, globally.
   * Returns true only the first time any user captures that realm (for first-blood events).
   */
  recordRealmCapture(realm: string): Promise<boolean>;
  /** Append earned achievements to a user; returns the newly-added ones. */
  awardAchievements(userId: string, earned: EarnedAchievement[]): Promise<EarnedAchievement[]>;
  /** Every stored progression (needed for the backfill routine). */
  getAllProgressions(): Promise<UserProgression[]>;
}

/** Build a fresh, fully-initialised progression record. */
export function emptyProgression(userId: string): UserProgression {
  return {
    userId,
    unlockedRealms: [],
    flags: [],
    score: 0,
    completions: [],
    hintsRevealed: [],
    achievements: [],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Normalise older/partial progression records (pre-scoring) so callers always
 * receive a complete shape.
 */
export function normaliseProgression(
  userId: string,
  raw: Partial<UserProgression> | null | undefined
): UserProgression {
  const base = emptyProgression(userId);
  if (!raw) return base;
  return {
    userId: raw.userId || userId,
    unlockedRealms: raw.unlockedRealms || [],
    flags: raw.flags || [],
    score: typeof raw.score === 'number' ? raw.score : 0,
    completions: raw.completions || [],
    hintsRevealed: raw.hintsRevealed || [],
    achievements: raw.achievements || [],
    lastUpdated: raw.lastUpdated || base.lastUpdated,
  };
}

/** Count distinct hints this user has revealed for a realm. */
export function countHintsRevealed(progression: UserProgression, realm: string): number {
  return progression.hintsRevealed.filter((h) => h.realm === realm).length;
}

/**
 * Record a hint reveal in place. Returns true if newly revealed, false if the user
 * had already revealed that hint (idempotent — never charged twice).
 */
export function applyHintReveal(
  progression: UserProgression,
  realm: string,
  order: number
): boolean {
  const already = progression.hintsRevealed.some((h) => h.realm === realm && h.order === order);
  if (already) {
    return false;
  }
  progression.hintsRevealed.push({ realm, order, revealedAt: new Date().toISOString() });
  progression.lastUpdated = new Date().toISOString();
  return true;
}

/**
 * Append newly-earned achievements in place, de-duplicated by (id, realm).
 * Returns only the ones actually added (idempotent — never awarded twice).
 */
export function applyAchievements(
  progression: UserProgression,
  earned: EarnedAchievement[]
): EarnedAchievement[] {
  const already = (a: EarnedAchievement) =>
    progression.achievements.some((x) => x.id === a.id && (x.realm ?? null) === (a.realm ?? null));
  const seen = new Set<string>();
  const added: EarnedAchievement[] = [];
  for (const a of earned) {
    const key = `${a.id}::${a.realm ?? ''}`;
    if (already(a) || seen.has(key)) continue;
    seen.add(key);
    progression.achievements.push(a);
    added.push(a);
  }
  if (added.length > 0) {
    progression.lastUpdated = new Date().toISOString();
  }
  return added;
}

/**
 * Apply a realm capture to a progression record in place, including scoring.
 * Returns true if this was a new capture (state changed), false if idempotent.
 */
export function applyCapture(
  progression: UserProgression,
  realm: string,
  flag: string,
  completion?: CompletionDetails
): boolean {
  const alreadyCaptured = progression.flags.includes(flag);
  if (alreadyCaptured) {
    return false;
  }

  if (!progression.unlockedRealms.includes(realm)) {
    progression.unlockedRealms.push(realm);
  }
  progression.flags.push(flag);

  const points = completion?.points ?? 0;
  progression.score += points;
  progression.completions.push({
    realm,
    points,
    hintsUsed: completion?.hintsUsed ?? 0,
    completedAt: new Date().toISOString(),
  });
  progression.lastUpdated = new Date().toISOString();
  return true;
}

/**
 * File-based progression/flag store. Default persistence; also used as the durable
 * fallback behind the Redis repository.
 */
export class FileBasedFlagRepository implements IFlagRepository {
  private progressionFile: string;
  private flagsFile: string;
  private capturedRealmsFile: string;

  constructor(private dataPath: string = './data') {
    this.progressionFile = path.join(this.dataPath, 'progression.json');
    this.flagsFile = path.join(this.dataPath, 'flags.json');
    this.capturedRealmsFile = path.join(this.dataPath, 'captured-realms.json');
  }

  async recordRealmCapture(realm: string): Promise<boolean> {
    await this.ensureDataDirectory();
    const key = realm.toUpperCase();

    let captured: string[] = [];
    try {
      captured = JSON.parse(await fs.readFile(this.capturedRealmsFile, 'utf-8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    if (captured.includes(key)) {
      return false;
    }

    captured.push(key);
    const tempFile = `${this.capturedRealmsFile}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(captured, null, 2), 'utf-8');
    await fs.rename(tempFile, this.capturedRealmsFile);
    return true;
  }

  async ensureDataDirectory(): Promise<void> {
    try {
      await fs.access(this.dataPath);
    } catch {
      await fs.mkdir(this.dataPath, { recursive: true });
    }
  }

  private async readAllProgressions(): Promise<Record<string, UserProgression>> {
    try {
      const data = await fs.readFile(this.progressionFile, 'utf-8');
      const raw: Record<string, Partial<UserProgression>> = JSON.parse(data);
      const result: Record<string, UserProgression> = {};
      for (const [userId, value] of Object.entries(raw)) {
        result[userId] = normaliseProgression(userId, value);
      }
      return result;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  async getProgression(userId: string): Promise<UserProgression | null> {
    await this.ensureDataDirectory();
    const progressions = await this.readAllProgressions();
    return progressions[userId] || null;
  }

  async updateProgression(
    userId: string,
    realm: string,
    flag: string,
    completion?: CompletionDetails
  ): Promise<void> {
    await this.ensureDataDirectory();

    const progressions = await this.readAllProgressions();
    const existing = progressions[userId] || emptyProgression(userId);

    applyCapture(existing, realm, flag, completion);
    progressions[userId] = existing;

    const tempFile = `${this.progressionFile}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(progressions, null, 2), 'utf-8');
    await fs.rename(tempFile, this.progressionFile);
  }

  async revealHint(userId: string, realm: string, order: number): Promise<UserProgression> {
    await this.ensureDataDirectory();

    const progressions = await this.readAllProgressions();
    const existing = progressions[userId] || emptyProgression(userId);

    applyHintReveal(existing, realm, order);
    progressions[userId] = existing;

    const tempFile = `${this.progressionFile}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(progressions, null, 2), 'utf-8');
    await fs.rename(tempFile, this.progressionFile);
    return existing;
  }

  async awardAchievements(
    userId: string,
    earned: EarnedAchievement[]
  ): Promise<EarnedAchievement[]> {
    if (earned.length === 0) return [];
    await this.ensureDataDirectory();

    const progressions = await this.readAllProgressions();
    const existing = progressions[userId] || emptyProgression(userId);

    const added = applyAchievements(existing, earned);
    if (added.length === 0) return [];

    progressions[userId] = existing;
    const tempFile = `${this.progressionFile}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(progressions, null, 2), 'utf-8');
    await fs.rename(tempFile, this.progressionFile);
    return added;
  }

  async getAllProgressions(): Promise<UserProgression[]> {
    await this.ensureDataDirectory();
    const progressions = await this.readAllProgressions();
    return Object.values(progressions);
  }

  async getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
    await this.ensureDataDirectory();
    const progressions = await this.readAllProgressions();

    return Object.values(progressions)
      .sort((a, b) => b.score - a.score || a.lastUpdated.localeCompare(b.lastUpdated))
      .slice(0, limit)
      .map((p, index) => ({
        userId: p.userId,
        score: p.score,
        realmsCompleted: p.completions.length,
        rank: index + 1,
      }));
  }

  async getValidFlags(): Promise<FlagData[]> {
    // Environment is the source of truth. Flags are per-deployment secrets
    // generated by `make setup`; there are no built-in defaults, so a realm with
    // no configured flag simply has no valid flag and fails closed.
    const { flags, missing } = loadRealmFlags();

    if (flags.length > 0) {
      if (missing.length > 0) {
        console.warn(
          `[FlagRepository] No flag configured for: ${missing.join(', ')}. ` +
            'Those realms cannot be captured. Run `make setup` to generate a full set.'
        );
      }
      return flags;
    }

    // Backwards compatibility: deployments that predate env-sourced flags may
    // have a hand-written flags.json in their data volume.
    await this.ensureDataDirectory();
    try {
      const data = await fs.readFile(this.flagsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(
          'No realm flags configured. Set <REALM>_FLAG environment variables ' +
            '(run `make setup` to generate them) or provide a flags.json in DATA_PATH.'
        );
      }
      throw error;
    }
  }
}

/**
 * DI-friendly wrapper that resolves the data path from the injected Config.
 * Equivalent to FileBasedFlagRepository; kept so the container can construct the
 * file store without a string token.
 */
@injectable()
export class FlagRepository extends FileBasedFlagRepository {
  constructor(@inject('Config') config: { dataPath?: string }) {
    super(config.dataPath || './data');
  }
}
