/**
 * AchievementService Unit Tests
 *
 * Covers every predicate in the declarative table, the on-capture path, the
 * backfill routine, and the two properties the design depends on:
 *
 *   - awards are idempotent (re-running never double-awards)
 *   - no achievement can be earned from a client-supplied value
 */

import 'reflect-metadata';
import {
  ACHIEVEMENTS,
  AchievementContext,
  AchievementService,
  RAGNAROK_WINDOW_MS,
  SWIFT_WINDOW_MS,
  TOTAL_SCORED_REALMS,
  getAchievementDefinition,
} from '../src/services/achievement-service';
import {
  EarnedAchievement,
  IFlagRepository,
  RealmCompletion,
  UserProgression,
  applyAchievements,
  emptyProgression,
} from '../src/repositories/flag-repository';

const T0 = Date.parse('2026-03-01T10:00:00.000Z');

/** All ten scored realms, in ascent order. */
const ASCENT = [
  'NIFLHEIM',
  'HELHEIM',
  'SVARTALFHEIM',
  'JOTUNHEIM',
  'MUSPELHEIM',
  'NIDAVELLIR',
  'VANAHEIM',
  'MIDGARD',
  'ALFHEIM',
  'ASGARD',
];

function completion(
  realm: string,
  offsetMs: number,
  hintsUsed = 0
): RealmCompletion {
  return {
    realm,
    points: 100,
    hintsUsed,
    completedAt: new Date(T0 + offsetMs).toISOString(),
  };
}

/** A full ascent where each realm is captured `gapMs` after the previous one. */
function fullAscent(gapMs: number, hintsUsed = 0): RealmCompletion[] {
  return ASCENT.map((r, i) => completion(r, i * gapMs, hintsUsed));
}

function ctx(over: Partial<AchievementContext> = {}): AchievementContext {
  return {
    completions: [],
    captured: '',
    isFirstBlood: false,
    now: new Date(T0).toISOString(),
    ...over,
  };
}

function idsOf(earned: EarnedAchievement[]): string[] {
  return earned.map((e) => e.id).sort();
}

/** In-memory repository exercising the real `applyAchievements` de-dup logic. */
class FakeRepo implements Partial<IFlagRepository> {
  progressions = new Map<string, UserProgression>();

  seed(userId: string, completions: RealmCompletion[]): UserProgression {
    const p = emptyProgression(userId);
    p.completions = completions;
    this.progressions.set(userId, p);
    return p;
  }

  async getProgression(userId: string): Promise<UserProgression | null> {
    return this.progressions.get(userId) ?? null;
  }

  async getAllProgressions(): Promise<UserProgression[]> {
    return [...this.progressions.values()];
  }

  async awardAchievements(
    userId: string,
    earned: EarnedAchievement[]
  ): Promise<EarnedAchievement[]> {
    const p = this.progressions.get(userId);
    if (!p) return [];
    return applyAchievements(p, earned);
  }
}

function serviceWith(repo: FakeRepo): AchievementService {
  return new AchievementService(repo as unknown as IFlagRepository);
}

describe('achievement table', () => {
  it('has unique ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exposes every definition by id with display metadata', () => {
    for (const def of ACHIEVEMENTS) {
      const found = getAchievementDefinition(def.id);
      expect(found).toBeDefined();
      expect(found!.name.length).toBeGreaterThan(0);
      expect(found!.description.length).toBeGreaterThan(0);
      expect(['realm', 'global']).toContain(found!.scope);
    }
  });

  it('returns undefined for an unknown id', () => {
    expect(getAchievementDefinition('NOPE')).toBeUndefined();
  });

  it('expects ten scored realms, matching the ascent', () => {
    expect(TOTAL_SCORED_REALMS).toBe(ASCENT.length);
  });
});

describe('SWIFT', () => {
  it('is earned when a realm falls inside the window after the previous capture', () => {
    const completions = [completion('NIFLHEIM', 0), completion('HELHEIM', SWIFT_WINDOW_MS - 1000)];
    const earned = AchievementService.evaluate(ctx({ completions, captured: 'HELHEIM' }));
    expect(idsOf(earned)).toContain('SWIFT');
  });

  it('is not earned when the capture falls outside the window', () => {
    const completions = [completion('NIFLHEIM', 0), completion('HELHEIM', SWIFT_WINDOW_MS + 1000)];
    const earned = AchievementService.evaluate(ctx({ completions, captured: 'HELHEIM' }));
    expect(idsOf(earned)).not.toContain('SWIFT');
  });

  it('is not earnable on the entry realm, which has no unlocking capture', () => {
    const completions = [completion('NIFLHEIM', 0)];
    const earned = AchievementService.evaluate(ctx({ completions, captured: 'NIFLHEIM' }));
    expect(idsOf(earned)).not.toContain('SWIFT');
  });

  it('measures against the previous capture, which is the unlock event', () => {
    // Slow first realm, fast second: only the second earns Swift.
    const completions = [
      completion('NIFLHEIM', 0),
      completion('HELHEIM', 5 * 60 * 60 * 1000),
      completion('SVARTALFHEIM', 5 * 60 * 60 * 1000 + 60_000),
    ];
    expect(
      idsOf(AchievementService.evaluate(ctx({ completions, captured: 'HELHEIM' })))
    ).not.toContain('SWIFT');
    expect(
      idsOf(AchievementService.evaluate(ctx({ completions, captured: 'SVARTALFHEIM' })))
    ).toContain('SWIFT');
  });
});

describe('UNAIDED', () => {
  it('is earned for a capture using zero hints', () => {
    const completions = [completion('NIFLHEIM', 0, 0)];
    const earned = AchievementService.evaluate(ctx({ completions, captured: 'NIFLHEIM' }));
    expect(idsOf(earned)).toContain('UNAIDED');
  });

  it('is withheld when any hint was used', () => {
    const completions = [completion('NIFLHEIM', 0, 1)];
    const earned = AchievementService.evaluate(ctx({ completions, captured: 'NIFLHEIM' }));
    expect(idsOf(earned)).not.toContain('UNAIDED');
  });
});

describe('FIRST_BLOOD', () => {
  it('is earned only when the repository reports the global first capture', () => {
    const completions = [completion('NIFLHEIM', 0)];

    const yes = AchievementService.evaluate(
      ctx({ completions, captured: 'NIFLHEIM', isFirstBlood: true })
    );
    const no = AchievementService.evaluate(
      ctx({ completions, captured: 'NIFLHEIM', isFirstBlood: false })
    );

    expect(idsOf(yes)).toContain('FIRST_BLOOD');
    expect(idsOf(no)).not.toContain('FIRST_BLOOD');
  });
});

describe('ASCENDANT', () => {
  it('requires all ten scored realms', () => {
    const nine = fullAscent(60_000).slice(0, 9);
    expect(idsOf(AchievementService.evaluate(ctx({ completions: nine })))).not.toContain(
      'ASCENDANT'
    );

    const ten = fullAscent(60_000);
    expect(idsOf(AchievementService.evaluate(ctx({ completions: ten })))).toContain('ASCENDANT');
  });

  it('does not count duplicate captures of the same realm', () => {
    const dupes = Array.from({ length: 12 }, (_, i) => completion('NIFLHEIM', i * 1000));
    expect(idsOf(AchievementService.evaluate(ctx({ completions: dupes })))).not.toContain(
      'ASCENDANT'
    );
  });

  it('does not count the SAMPLE warm-up realm toward the total', () => {
    const ninePlusSample = [...fullAscent(60_000).slice(0, 9), completion('SAMPLE', 999_000)];
    expect(
      idsOf(AchievementService.evaluate(ctx({ completions: ninePlusSample })))
    ).not.toContain('ASCENDANT');
  });
});

describe('RAGNAROK_RUN', () => {
  it('is earned when the whole ascent fits inside the window', () => {
    const fast = fullAscent(Math.floor(RAGNAROK_WINDOW_MS / (ASCENT.length * 2)));
    expect(idsOf(AchievementService.evaluate(ctx({ completions: fast })))).toContain(
      'RAGNAROK_RUN'
    );
  });

  it('is withheld when the ascent takes longer than the window', () => {
    const slow = fullAscent(RAGNAROK_WINDOW_MS);
    expect(idsOf(AchievementService.evaluate(ctx({ completions: slow })))).not.toContain(
      'RAGNAROK_RUN'
    );
  });

  it('requires a complete ascent', () => {
    const partial = fullAscent(1000).slice(0, 5);
    expect(idsOf(AchievementService.evaluate(ctx({ completions: partial })))).not.toContain(
      'RAGNAROK_RUN'
    );
  });
});

describe('SIGHTLESS', () => {
  it('is earned for a full ascent with zero hints throughout', () => {
    expect(
      idsOf(AchievementService.evaluate(ctx({ completions: fullAscent(60_000, 0) })))
    ).toContain('SIGHTLESS');
  });

  it('is withheld when a single hint was used anywhere', () => {
    const completions = fullAscent(60_000, 0);
    completions[4] = completion(completions[4].realm, 4 * 60_000, 1);
    expect(idsOf(AchievementService.evaluate(ctx({ completions })))).not.toContain('SIGHTLESS');
  });
});

describe('evaluate() scope filter', () => {
  const completions = fullAscent(60_000);

  it('restricted to realm scope returns only realm-scoped markers', () => {
    const earned = AchievementService.evaluate(
      ctx({ completions, captured: 'HELHEIM', isFirstBlood: true }),
      'realm'
    );
    expect(earned.every((e) => getAchievementDefinition(e.id)!.scope === 'realm')).toBe(true);
    expect(earned.every((e) => e.realm === 'HELHEIM')).toBe(true);
  });

  it('restricted to global scope returns only global markers, with no realm set', () => {
    const earned = AchievementService.evaluate(ctx({ completions }), 'global');
    expect(earned.every((e) => getAchievementDefinition(e.id)!.scope === 'global')).toBe(true);
    expect(earned.every((e) => e.realm === undefined)).toBe(true);
  });

  it('stamps every marker with the context timestamp', () => {
    const now = new Date(T0 + 12345).toISOString();
    const earned = AchievementService.evaluate(ctx({ completions, captured: 'HELHEIM', now }));
    expect(earned.every((e) => e.awardedAt === now)).toBe(true);
  });
});

describe('applyAchievements idempotency', () => {
  it('never awards the same (id, realm) pair twice', () => {
    const p = emptyProgression('u1');
    const marker: EarnedAchievement = {
      id: 'UNAIDED',
      awardedAt: new Date(T0).toISOString(),
      realm: 'NIFLHEIM',
    };

    expect(applyAchievements(p, [marker])).toHaveLength(1);
    expect(applyAchievements(p, [marker])).toHaveLength(0);
    expect(p.achievements).toHaveLength(1);
  });

  it('treats the same id on different realms as distinct', () => {
    const p = emptyProgression('u1');
    const at = new Date(T0).toISOString();

    applyAchievements(p, [{ id: 'UNAIDED', awardedAt: at, realm: 'NIFLHEIM' }]);
    const added = applyAchievements(p, [{ id: 'UNAIDED', awardedAt: at, realm: 'HELHEIM' }]);

    expect(added).toHaveLength(1);
    expect(p.achievements).toHaveLength(2);
  });

  it('de-duplicates within a single batch', () => {
    const p = emptyProgression('u1');
    const at = new Date(T0).toISOString();
    const added = applyAchievements(p, [
      { id: 'ASCENDANT', awardedAt: at },
      { id: 'ASCENDANT', awardedAt: at },
    ]);

    expect(added).toHaveLength(1);
  });
});

describe('onCapture', () => {
  it('persists newly earned markers and returns them', async () => {
    const repo = new FakeRepo();
    repo.seed('u1', [completion('NIFLHEIM', 0, 0)]);

    const earned = await serviceWith(repo).onCapture('u1', 'NIFLHEIM', true);

    expect(idsOf(earned)).toEqual(['FIRST_BLOOD', 'UNAIDED']);
    expect(repo.progressions.get('u1')!.achievements).toHaveLength(2);
  });

  it('is idempotent across repeated captures of the same realm', async () => {
    const repo = new FakeRepo();
    repo.seed('u1', [completion('NIFLHEIM', 0, 0)]);
    const svc = serviceWith(repo);

    await svc.onCapture('u1', 'NIFLHEIM', true);
    const second = await svc.onCapture('u1', 'NIFLHEIM', true);

    expect(second).toHaveLength(0);
    expect(repo.progressions.get('u1')!.achievements).toHaveLength(2);
  });

  it('accepts a lower-case realm name', async () => {
    const repo = new FakeRepo();
    repo.seed('u1', [completion('NIFLHEIM', 0, 0)]);

    const earned = await serviceWith(repo).onCapture('u1', 'niflheim', false);
    expect(idsOf(earned)).toContain('UNAIDED');
    expect(earned.every((e) => e.realm === undefined || e.realm === 'NIFLHEIM')).toBe(true);
  });

  it('returns nothing for an unknown user', async () => {
    const repo = new FakeRepo();
    expect(await serviceWith(repo).onCapture('ghost', 'NIFLHEIM', false)).toEqual([]);
  });

  it('sets awardedAt server-side, ignoring anything the caller could supply', async () => {
    const repo = new FakeRepo();
    repo.seed('u1', [completion('NIFLHEIM', 0, 0)]);

    const before = Date.now();
    const earned = await serviceWith(repo).onCapture('u1', 'NIFLHEIM', false);
    const stamped = Date.parse(earned[0].awardedAt);

    // Server clock, not the historical completedAt embedded in the fixture.
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).not.toBe(T0);
  });
});

describe('backfillAll', () => {
  it('awards historical markers and reports what it did', async () => {
    const repo = new FakeRepo();
    repo.seed('u1', fullAscent(60_000, 0));

    const summary = await serviceWith(repo).backfillAll();

    expect(summary.usersUpdated).toBe(1);
    expect(summary.awarded).toBeGreaterThan(0);

    const ids = new Set(repo.progressions.get('u1')!.achievements.map((a) => a.id));
    expect(ids).toContain('ASCENDANT');
    expect(ids).toContain('SIGHTLESS');
    expect(ids).toContain('RAGNAROK_RUN');
  });

  it('dates realm-scoped awards to that realm\'s own completion, not to now', async () => {
    const repo = new FakeRepo();
    const completions = fullAscent(60_000, 0);
    repo.seed('u1', completions);

    await serviceWith(repo).backfillAll();

    const unaidedForHelheim = repo.progressions
      .get('u1')!
      .achievements.find((a) => a.id === 'UNAIDED' && a.realm === 'HELHEIM');

    expect(unaidedForHelheim).toBeDefined();
    expect(unaidedForHelheim!.awardedAt).toBe(
      completions.find((c) => c.realm === 'HELHEIM')!.completedAt
    );
  });

  it('assigns first blood per realm to the earliest capturing user', async () => {
    const repo = new FakeRepo();
    repo.seed('early', [completion('NIFLHEIM', 0)]);
    repo.seed('late', [completion('NIFLHEIM', 60_000)]);

    await serviceWith(repo).backfillAll();

    const has = (u: string) =>
      repo.progressions.get(u)!.achievements.some((a) => a.id === 'FIRST_BLOOD');

    expect(has('early')).toBe(true);
    expect(has('late')).toBe(false);
  });

  it('is safe to run twice — the second pass awards nothing', async () => {
    const repo = new FakeRepo();
    repo.seed('u1', fullAscent(60_000, 0));
    const svc = serviceWith(repo);

    const first = await svc.backfillAll();
    const second = await svc.backfillAll();

    expect(first.awarded).toBeGreaterThan(0);
    expect(second.awarded).toBe(0);
    expect(second.usersUpdated).toBe(0);
  });

  it('skips users with no scored completions', async () => {
    const repo = new FakeRepo();
    repo.seed('sample-only', [completion('SAMPLE', 0)]);
    repo.seed('empty', []);

    const summary = await serviceWith(repo).backfillAll();

    expect(summary.usersUpdated).toBe(0);
    expect(summary.awarded).toBe(0);
  });

  it('handles an empty store', async () => {
    expect(await serviceWith(new FakeRepo()).backfillAll()).toEqual({
      usersUpdated: 0,
      awarded: 0,
    });
  });
});
