import { injectable, inject } from 'tsyringe';
import {
  IFlagRepository,
  RealmCompletion,
  EarnedAchievement,
} from '../repositories/flag-repository';

/**
 * AchievementService — derives named, earned markers from a user's RealmCompletion
 * history and persists them on the UserProgression.
 *
 * Design goals (see docs/issues — achievements):
 *  - Definitions are DECLARATIVE: a table of predicates over the completion history,
 *    so adding an achievement is a data change, not new branching logic.
 *  - Evaluated ON CAPTURE (not on read) so the award timestamp is meaningful and the
 *    leaderboard stays a cheap read.
 *  - No achievement can be earned from a client-supplied value: every input below is
 *    server-derived — `completedAt` is server-set, `hintsUsed` is server-counted, and
 *    the first-blood flag is the global, single-writer signal from the repository.
 */

/** Realm that is a no-score warm-up and is excluded from every achievement. */
const SAMPLE_REALM = 'SAMPLE';
/** Number of scored realms that constitutes a full ascent. */
export const TOTAL_SCORED_REALMS = 10;

/**
 * Tunable thresholds, calibrated against the per-realm time estimates in
 * `docs/instructor/README.md` (30–90 min per realm, 8–10 hours for a full ascent).
 * Both are deliberately set so the badge means "notably faster than expected"
 * rather than "finished at all".
 */

/**
 * Swift: a realm captured within this window of the capture that unlocked it.
 * Progression is linear, so the previous capture *is* the unlock event. Well
 * under the 30-minute low end of the documented per-realm estimate.
 */
export const SWIFT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Ragnarök Run: full ascent inside this window — 25% faster than the 8-hour low
 * end of the documented estimate for all ten realms.
 */
export const RAGNAROK_WINDOW_MS = 6 * 60 * 60 * 1000;

export type AchievementScope = 'realm' | 'global';

/**
 * Context handed to every predicate. `completions` is the user's full history
 * (including the just-captured realm). `captured` is the realm just captured
 * (upper-cased) during on-capture evaluation, or the realm being re-evaluated during
 * backfill. `isFirstBlood` is the authoritative global signal for `captured`.
 */
export interface AchievementContext {
  completions: RealmCompletion[];
  captured: string;
  isFirstBlood: boolean;
  now: string;
}

/**
 * A predicate returns the marker payload when earned, or null when not. Realm-scoped
 * definitions return `{ realm }`; global ones return `{}`.
 */
export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  scope: AchievementScope;
  earn(ctx: AchievementContext): { realm?: string } | null;
}

/** Scored completions only, sorted oldest-first by server timestamp. */
function scoredSorted(completions: RealmCompletion[]): RealmCompletion[] {
  return completions
    .filter((c) => c.realm.toUpperCase() !== SAMPLE_REALM)
    .slice()
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

function distinctScoredRealms(completions: RealmCompletion[]): Set<string> {
  return new Set(scoredSorted(completions).map((c) => c.realm.toUpperCase()));
}

/**
 * The declarative achievement table. Add an achievement by adding a row.
 */
export const ACHIEVEMENTS: AchievementDefinition[] = [
  // ---- Speed --------------------------------------------------------------
  {
    id: 'SWIFT',
    name: 'Swift',
    description: 'Captured a realm within the target window of unlocking it.',
    scope: 'realm',
    earn(ctx) {
      const cap = ctx.captured.toUpperCase();
      if (!cap || cap === SAMPLE_REALM) return null;
      const sorted = scoredSorted(ctx.completions);
      const idx = sorted.findIndex((c) => c.realm.toUpperCase() === cap);
      // idx <= 0 → this is the player's first scored capture; "unlock time" is unknown,
      // so Swift is not earnable on the entry realm (see issue: deltas between captures).
      if (idx <= 0) return null;
      const delta = Date.parse(sorted[idx].completedAt) - Date.parse(sorted[idx - 1].completedAt);
      return delta >= 0 && delta <= SWIFT_WINDOW_MS ? { realm: cap } : null;
    },
  },
  {
    id: 'RAGNAROK_RUN',
    name: 'Ragnarök Run',
    description: 'Completed the full ascent inside the target window.',
    scope: 'global',
    earn(ctx) {
      const scored = scoredSorted(ctx.completions);
      if (distinctScoredRealms(ctx.completions).size < TOTAL_SCORED_REALMS) return null;
      const span =
        Date.parse(scored[scored.length - 1].completedAt) - Date.parse(scored[0].completedAt);
      return span >= 0 && span <= RAGNAROK_WINDOW_MS ? {} : null;
    },
  },

  // ---- Skill --------------------------------------------------------------
  {
    id: 'UNAIDED',
    name: 'Unaided',
    description: 'Captured a realm using zero hints.',
    scope: 'realm',
    earn(ctx) {
      const cap = ctx.captured.toUpperCase();
      if (!cap || cap === SAMPLE_REALM) return null;
      const c = ctx.completions.find((x) => x.realm.toUpperCase() === cap);
      return c && c.hintsUsed === 0 ? { realm: cap } : null;
    },
  },
  {
    id: 'SIGHTLESS',
    name: 'Sightless',
    description: 'Completed the full ascent using zero hints.',
    scope: 'global',
    earn(ctx) {
      const scored = scoredSorted(ctx.completions);
      if (distinctScoredRealms(ctx.completions).size < TOTAL_SCORED_REALMS) return null;
      return scored.every((c) => c.hintsUsed === 0) ? {} : null;
    },
  },

  // ---- Progress -----------------------------------------------------------
  {
    id: 'FIRST_BLOOD',
    name: 'First Blood',
    description: 'First player to capture a given realm.',
    scope: 'realm',
    earn(ctx) {
      const cap = ctx.captured.toUpperCase();
      if (!cap || cap === SAMPLE_REALM) return null;
      // Reuses the repository's global single-writer capture signal; never re-derived here.
      return ctx.isFirstBlood ? { realm: cap } : null;
    },
  },
  {
    id: 'ASCENDANT',
    name: 'Ascendant',
    description: 'Captured all ten realms.',
    scope: 'global',
    earn(ctx) {
      return distinctScoredRealms(ctx.completions).size >= TOTAL_SCORED_REALMS ? {} : null;
    },
  },
];

/** Look up a definition by id (used by consumers that want the display name/description). */
export function getAchievementDefinition(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

@injectable()
export class AchievementService {
  constructor(@inject('IFlagRepository') private repository: IFlagRepository) {}

  /**
   * Pure evaluation: given a context, return the markers earned. `scope` optionally
   * restricts to realm- or global-scoped definitions (used by backfill to attach
   * historically-meaningful timestamps to each). No persistence, no side effects.
   */
  static evaluate(ctx: AchievementContext, scope?: AchievementScope): EarnedAchievement[] {
    const out: EarnedAchievement[] = [];
    for (const def of ACHIEVEMENTS) {
      if (scope && def.scope !== scope) continue;
      const res = def.earn(ctx);
      if (res) {
        out.push({
          id: def.id,
          awardedAt: ctx.now,
          ...(res.realm ? { realm: res.realm } : {}),
        });
      }
    }
    return out;
  }

  /**
   * Evaluate and persist achievements for a single capture. Returns only the markers
   * that were newly awarded (the repository de-duplicates against what's already held).
   */
  async onCapture(
    userId: string,
    capturedRealm: string,
    isFirstBlood: boolean
  ): Promise<EarnedAchievement[]> {
    const progression = await this.repository.getProgression(userId);
    if (!progression) return [];

    const candidates = AchievementService.evaluate({
      completions: progression.completions,
      captured: capturedRealm.toUpperCase(),
      isFirstBlood,
      now: new Date().toISOString(),
    });

    if (candidates.length === 0) return [];
    return this.repository.awardAchievements(userId, candidates);
  }

  /**
   * Backfill achievements for every existing progression record. Derives the
   * first-blood owner per realm from the earliest `completedAt` across all users
   * (the live single-writer signal only records THAT a realm was taken, not by whom).
   *
   * Award timestamps are set to the triggering completion's own `completedAt` for
   * realm-scoped achievements, and to the last scored completion for global ones, so
   * backfilled awards line up with when the player actually earned them.
   */
  async backfillAll(): Promise<{ usersUpdated: number; awarded: number }> {
    const all = await this.repository.getAllProgressions();

    const firstBloodOwner = new Map<string, string>();
    const earliestAt = new Map<string, number>();
    for (const p of all) {
      for (const c of p.completions) {
        const realm = c.realm.toUpperCase();
        if (realm === SAMPLE_REALM) continue;
        const t = Date.parse(c.completedAt);
        if (!earliestAt.has(realm) || t < (earliestAt.get(realm) as number)) {
          earliestAt.set(realm, t);
          firstBloodOwner.set(realm, p.userId);
        }
      }
    }

    let usersUpdated = 0;
    let awarded = 0;

    for (const p of all) {
      const scored = scoredSorted(p.completions);
      if (scored.length === 0) continue;

      const candidates: EarnedAchievement[] = [];

      // Realm-scoped: attach each award to that realm's own completion time.
      for (const c of scored) {
        const realm = c.realm.toUpperCase();
        candidates.push(
          ...AchievementService.evaluate(
            {
              completions: p.completions,
              captured: realm,
              isFirstBlood: firstBloodOwner.get(realm) === p.userId,
              now: c.completedAt,
            },
            'realm'
          )
        );
      }

      // Global: evaluate once, dated to the final scored completion.
      candidates.push(
        ...AchievementService.evaluate(
          {
            completions: p.completions,
            captured: '',
            isFirstBlood: false,
            now: scored[scored.length - 1].completedAt,
          },
          'global'
        )
      );

      const added = await this.repository.awardAchievements(p.userId, candidates);
      if (added.length > 0) {
        usersUpdated++;
        awarded += added.length;
      }
    }

    return { usersUpdated, awarded };
  }
}
