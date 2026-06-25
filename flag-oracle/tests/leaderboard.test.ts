import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { FileBasedFlagRepository } from '../src/repositories/flag-repository';

describe('FileBasedFlagRepository — scoring & leaderboard', () => {
  let dataPath: string;
  let repo: FileBasedFlagRepository;

  beforeEach(async () => {
    dataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'ygg-lb-'));
    repo = new FileBasedFlagRepository(dataPath);
  });

  afterEach(async () => {
    await fs.rm(dataPath, { recursive: true, force: true });
  });

  it('accumulates score and records completions', async () => {
    await repo.updateProgression('alice', 'NIFLHEIM', 'flagA', { points: 100, hintsUsed: 0 });
    await repo.updateProgression('alice', 'HELHEIM', 'flagB', { points: 200, hintsUsed: 1 });

    const progression = await repo.getProgression('alice');
    expect(progression).not.toBeNull();
    expect(progression!.score).toBe(300);
    expect(progression!.completions).toHaveLength(2);
    expect(progression!.completions[1]).toMatchObject({
      realm: 'HELHEIM',
      points: 200,
      hintsUsed: 1,
    });
  });

  it('is idempotent — resubmitting a flag does not double-score', async () => {
    await repo.updateProgression('bob', 'NIFLHEIM', 'flagA', { points: 100, hintsUsed: 0 });
    await repo.updateProgression('bob', 'NIFLHEIM', 'flagA', { points: 100, hintsUsed: 0 });

    const progression = await repo.getProgression('bob');
    expect(progression!.score).toBe(100);
    expect(progression!.completions).toHaveLength(1);
  });

  it('ranks users by score descending', async () => {
    await repo.updateProgression('alice', 'NIFLHEIM', 'a1', { points: 100, hintsUsed: 0 });
    await repo.updateProgression('carol', 'NIFLHEIM', 'c1', { points: 100, hintsUsed: 0 });
    await repo.updateProgression('carol', 'HELHEIM', 'c2', { points: 200, hintsUsed: 0 });
    await repo.updateProgression('bob', 'NIFLHEIM', 'b1', { points: 50, hintsUsed: 0 });

    const board = await repo.getLeaderboard();

    expect(board.map((e) => e.userId)).toEqual(['carol', 'alice', 'bob']);
    expect(board[0]).toMatchObject({ userId: 'carol', score: 300, realmsCompleted: 2, rank: 1 });
    expect(board[1]).toMatchObject({ rank: 2 });
    expect(board[2]).toMatchObject({ rank: 3 });
  });

  it('respects the limit', async () => {
    await repo.updateProgression('a', 'NIFLHEIM', 'a1', { points: 30, hintsUsed: 0 });
    await repo.updateProgression('b', 'NIFLHEIM', 'b1', { points: 20, hintsUsed: 0 });
    await repo.updateProgression('c', 'NIFLHEIM', 'c1', { points: 10, hintsUsed: 0 });

    const board = await repo.getLeaderboard(2);
    expect(board).toHaveLength(2);
    expect(board.map((e) => e.userId)).toEqual(['a', 'b']);
  });

  it('returns an empty board when there are no users', async () => {
    expect(await repo.getLeaderboard()).toEqual([]);
  });
});
