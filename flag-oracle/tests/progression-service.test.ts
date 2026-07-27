import { ProgressionService } from '../src/services/progression-service';
import { FlagValidator } from '../src/services/flag-validator';
import {
  IFlagRepository,
  FlagData,
  UserProgression,
  LeaderboardEntry,
  CompletionDetails,
  emptyProgression,
  applyCapture,
  applyHintReveal,
} from '../src/repositories/flag-repository';

class MockFlagRepository implements IFlagRepository {
  private progressions: Map<string, UserProgression> = new Map();
  private flags: FlagData[] = [
    {
      realm: 'SAMPLE',
      flag: 'YGGDRASIL{SAMPLE:00000000-0000-0000-0000-000000000000}',
      nextRealm: 'COMPLETE',
    },
  ];

  async getProgression(userId: string): Promise<UserProgression | null> {
    return this.progressions.get(userId) || null;
  }

  async updateProgression(
    userId: string,
    realm: string,
    flag: string,
    completion?: CompletionDetails
  ): Promise<void> {
    const existing = this.progressions.get(userId) || emptyProgression(userId);
    applyCapture(existing, realm, flag, completion);
    this.progressions.set(userId, existing);
  }

  async revealHint(userId: string, realm: string, order: number): Promise<UserProgression> {
    const existing = this.progressions.get(userId) || emptyProgression(userId);
    applyHintReveal(existing, realm, order);
    this.progressions.set(userId, existing);
    return existing;
  }

  async getValidFlags(): Promise<FlagData[]> {
    return this.flags;
  }

  private captured = new Set<string>();
  async recordRealmCapture(realm: string): Promise<boolean> {
    const key = realm.toUpperCase();
    if (this.captured.has(key)) return false;
    this.captured.add(key);
    return true;
  }

  async getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
    return Array.from(this.progressions.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((p, i) => ({
        userId: p.userId,
        score: p.score,
        realmsCompleted: p.completions.length,
        rank: i + 1,
      }));
  }
  async awardAchievements(
    _userId: string,
    earned: import('../src/repositories/flag-repository').EarnedAchievement[]
  ): Promise<import('../src/repositories/flag-repository').EarnedAchievement[]> {
    return earned;
  }

  async getAllProgressions(): Promise<UserProgression[]> {
    return [];
  }
}

describe('ProgressionService', () => {
  let service: ProgressionService;
  let repository: MockFlagRepository;
  let validator: FlagValidator;

  beforeEach(() => {
    repository = new MockFlagRepository();
    validator = new FlagValidator();
    service = new ProgressionService(repository, validator);
  });

  describe('validateFlag', () => {
    it('should accept valid flag', async () => {
      const result = await service.validateFlag(
        'user1',
        'YGGDRASIL{SAMPLE:00000000-0000-0000-0000-000000000000}'
      );

      expect(result.status).toBe('success');
      expect(result.realm).toBe('SAMPLE');
      expect(result.unlocked).toBe('COMPLETE');
    });

    it('should reject invalid flag format', async () => {
      const result = await service.validateFlag('user1', 'INVALID_FLAG');

      expect(result.status).toBe('invalid');
      expect(result.message).toContain('Invalid flag format');
    });

    it('should reject unknown flag', async () => {
      const result = await service.validateFlag(
        'user1',
        'YGGDRASIL{UNKNOWN:11111111-1111-1111-1111-111111111111}'
      );

      expect(result.status).toBe('invalid');
      expect(result.message).toBe('Flag not found');
    });

    it('should handle resubmitted flag idempotently', async () => {
      const flag = 'YGGDRASIL{SAMPLE:00000000-0000-0000-0000-000000000000}';
      
      await service.validateFlag('user1', flag);
      const result = await service.validateFlag('user1', flag);

      expect(result.status).toBe('success');
      expect(result.message).toBe('Flag already submitted');
    });

    it('should reject empty userId', async () => {
      const result = await service.validateFlag(
        '',
        'YGGDRASIL{SAMPLE:00000000-0000-0000-0000-000000000000}'
      );

      expect(result.status).toBe('error');
      expect(result.message).toBe('Invalid userId');
    });

    it('should update progression on valid flag', async () => {
      await service.validateFlag(
        'user1',
        'YGGDRASIL{SAMPLE:00000000-0000-0000-0000-000000000000}'
      );

      const progression = await service.getProgression('user1');
      expect(progression).not.toBeNull();
      expect(progression!.unlockedRealms).toContain('SAMPLE');
      expect(progression!.flags).toHaveLength(1);
    });
  });

  describe('getProgression', () => {
    it('should return null for non-existent user', async () => {
      const progression = await service.getProgression('nonexistent');
      expect(progression).toBeNull();
    });

    it('should return progression for existing user', async () => {
      await service.validateFlag(
        'user1',
        'YGGDRASIL{SAMPLE:00000000-0000-0000-0000-000000000000}'
      );

      const progression = await service.getProgression('user1');
      expect(progression).not.toBeNull();
      expect(progression!.userId).toBe('user1');
    });

    it('should reject empty userId', async () => {
      const progression = await service.getProgression('');
      expect(progression).toBeNull();
    });
  });
});
