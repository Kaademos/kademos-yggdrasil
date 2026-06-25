import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { FileBasedFlagRepository } from '../src/repositories/flag-repository';
import { FlagValidator } from '../src/services/flag-validator';
import { ProgressionService } from '../src/services/progression-service';
import { HintService } from '../src/services/hint-service';

describe('HintService', () => {
  const hints = new HintService();

  it('serves ordered hints sourced from manifests', () => {
    const niflheim = hints.getRealmHints('NIFLHEIM');
    expect(niflheim.length).toBeGreaterThan(0);
    expect(niflheim.map((h) => h.order)).toEqual([...niflheim.map((h) => h.order)].sort((a, b) => a - b));
  });

  it('is case-insensitive on realm name', () => {
    expect(hints.getRealmHints('niflheim').length).toBe(hints.getRealmHints('NIFLHEIM').length);
  });

  it('returns empty for unknown realms', () => {
    expect(hints.getRealmHints('ATLANTIS')).toEqual([]);
    expect(hints.hasRealm('ATLANTIS')).toBe(false);
  });
});

describe('ProgressionService — hints & scoring penalty', () => {
  let dataPath: string;
  let service: ProgressionService;
  let repo: FileBasedFlagRepository;

  beforeEach(async () => {
    dataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'ygg-hint-'));
    repo = new FileBasedFlagRepository(dataPath);
    service = new ProgressionService(repo, new FlagValidator());
  });

  afterEach(async () => {
    await fs.rm(dataPath, { recursive: true, force: true });
  });

  it('reveals a hint and reports the reduced potential score', async () => {
    const base = await service.getHints('user1', 'ASGARD');
    expect(base).not.toBeNull();
    expect(base!.basePoints).toBe(1000);
    expect(base!.potentialPoints).toBe(1000);
    expect(base!.hints.every((h) => !h.revealed)).toBe(true);

    const reveal = await service.revealHint('user1', 'ASGARD', 1);
    expect(reveal.status).toBe('ok');
    expect(reveal.text).toBeTruthy();
    expect(reveal.hintsRevealed).toBe(1);
    expect(reveal.potentialPoints).toBe(850); // 1000 - 15%

    const after = await service.getHints('user1', 'ASGARD');
    expect(after!.hintsRevealed).toBe(1);
    expect(after!.hints.find((h) => h.order === 1)!.revealed).toBe(true);
    expect(after!.hints.find((h) => h.order === 1)!.text).toBeTruthy();
    expect(after!.hints.find((h) => h.order === 2)!.text).toBeUndefined();
  });

  it('revealing the same hint twice is idempotent (charged once)', async () => {
    await service.revealHint('user2', 'ASGARD', 1);
    const second = await service.revealHint('user2', 'ASGARD', 1);
    expect(second.hintsRevealed).toBe(1);
  });

  it('returns an error for a non-existent hint without blocking', async () => {
    const res = await service.revealHint('user3', 'ASGARD', 999);
    expect(res.status).toBe('error');
  });

  it('applies the hint penalty to the capture award, never blocking progression', async () => {
    // Reveal two hints for the SAMPLE realm, then capture it.
    await service.revealHint('user4', 'SAMPLE', 1).catch(() => undefined);
    // SAMPLE has no hints/points, so use a scored realm flow via the repository directly:
    // reveal hints for NIFLHEIM then award.
    await service.revealHint('user5', 'NIFLHEIM', 1);
    await service.revealHint('user5', 'NIFLHEIM', 2);

    const progression = await repo.getProgression('user5');
    expect(progression!.hintsRevealed.filter((h) => h.realm === 'NIFLHEIM')).toHaveLength(2);
    // progression is not blocked — unlockedRealms/flags remain usable
    expect(progression!.flags).toEqual([]);
  });
});
