import { createClient } from 'redis';
import {
  IFlagRepository,
  UserProgression,
  FlagData,
  LeaderboardEntry,
  CompletionDetails,
  EarnedAchievement,
  FileBasedFlagRepository,
  emptyProgression,
  normaliseProgression,
  applyCapture,
  applyHintReveal,
  applyAchievements,
} from './flag-repository';

type RedisClient = ReturnType<typeof createClient>;

const PROGRESSION_TTL_SECONDS = 86400 * 30;
const LEADERBOARD_KEY = 'leaderboard';
const CAPTURED_REALMS_KEY = 'captured_realms';

/**
 * Redis-backed progression store (primary persistence when REDIS_URL is set).
 *
 * Progression is stored per user as JSON; the global leaderboard is maintained as a
 * sorted set (score → userId) so ranking is O(log n) without scanning every user.
 * A FileBasedFlagRepository fallback keeps the service usable if Redis is unreachable.
 */
export class RedisFlagRepository implements IFlagRepository {
  private connected = false;

  constructor(
    private redisClient: RedisClient,
    private fallbackRepo?: FileBasedFlagRepository
  ) {}

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.redisClient.connect();
      this.connected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.redisClient.quit();
      this.connected = false;
    }
  }
  async awardAchievements(
    userId: string,
    earned: EarnedAchievement[]
  ): Promise<EarnedAchievement[]> {
    if (earned.length === 0) return [];
    try {
      await this.connect();
      const existing = (await this.getProgression(userId)) || emptyProgression(userId);
      const added = applyAchievements(existing, earned);
      if (added.length === 0) return [];

      // Achievements don't change score, so the leaderboard ZSET is untouched.
      const multi = this.redisClient.multi();
      multi.set(`progression:${userId}`, JSON.stringify(existing));
      multi.expire(`progression:${userId}`, PROGRESSION_TTL_SECONDS);
      await multi.exec();
      return added;
    } catch (error) {
      if (this.fallbackRepo) {
        return this.fallbackRepo.awardAchievements(userId, earned);
      }
      throw error;
    }
  }

  async getAllProgressions(): Promise<UserProgression[]> {
    try {
      await this.connect();
      // Every scoring capture zAdds the user, so the leaderboard ZSET is the user index.
      const userIds = await this.redisClient.zRange(LEADERBOARD_KEY, 0, -1);
      const out: UserProgression[] = [];
      for (const userId of userIds) {
        const p = await this.getProgression(userId);
        if (p) out.push(p);
      }
      return out;
    } catch (error) {
      if (this.fallbackRepo) {
        return this.fallbackRepo.getAllProgressions();
      }
      throw error;
    }
  }

  async getProgression(userId: string): Promise<UserProgression | null> {
    try {
      await this.connect();
      const data = await this.redisClient.get(`progression:${userId}`);
      return data ? normaliseProgression(userId, JSON.parse(data)) : null;
    } catch (error) {
      if (this.fallbackRepo) {
        return this.fallbackRepo.getProgression(userId);
      }
      throw error;
    }
  }

  async updateProgression(
    userId: string,
    realm: string,
    flag: string,
    completion?: CompletionDetails
  ): Promise<void> {
    try {
      await this.connect();

      const existing = (await this.getProgression(userId)) || emptyProgression(userId);
      applyCapture(existing, realm, flag, completion);

      const multi = this.redisClient.multi();
      multi.set(`progression:${userId}`, JSON.stringify(existing));
      multi.expire(`progression:${userId}`, PROGRESSION_TTL_SECONDS);
      multi.zAdd(LEADERBOARD_KEY, { score: existing.score, value: userId });
      await multi.exec();
    } catch (error) {
      if (this.fallbackRepo) {
        await this.fallbackRepo.updateProgression(userId, realm, flag, completion);
        return;
      }
      throw error;
    }
  }

  async revealHint(userId: string, realm: string, order: number): Promise<UserProgression> {
    try {
      await this.connect();

      const existing = (await this.getProgression(userId)) || emptyProgression(userId);
      applyHintReveal(existing, realm, order);

      // Revealing a hint does not change score, so the leaderboard ZSET is untouched here.
      const multi = this.redisClient.multi();
      multi.set(`progression:${userId}`, JSON.stringify(existing));
      multi.expire(`progression:${userId}`, PROGRESSION_TTL_SECONDS);
      await multi.exec();

      return existing;
    } catch (error) {
      if (this.fallbackRepo) {
        return this.fallbackRepo.revealHint(userId, realm, order);
      }
      throw error;
    }
  }

  async getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
    try {
      await this.connect();
      const ranked = await this.redisClient.zRangeWithScores(LEADERBOARD_KEY, 0, limit - 1, {
        REV: true,
      });

      const entries: LeaderboardEntry[] = [];
      for (let i = 0; i < ranked.length; i++) {
        const { value: userId, score } = ranked[i];
        const progression = await this.getProgression(userId);
        entries.push({
          userId,
          score,
          realmsCompleted: progression?.completions.length ?? 0,
          rank: i + 1,
        });
      }
      return entries;
    } catch (error) {
      if (this.fallbackRepo) {
        return this.fallbackRepo.getLeaderboard(limit);
      }
      throw error;
    }
  }

  async recordRealmCapture(realm: string): Promise<boolean> {
    try {
      await this.connect();
      // SADD returns the number of NEW members added: 1 = first-ever capture of this realm.
      const added = await this.redisClient.sAdd(CAPTURED_REALMS_KEY, realm.toUpperCase());
      return added === 1;
    } catch (error) {
      if (this.fallbackRepo) {
        return this.fallbackRepo.recordRealmCapture(realm);
      }
      throw error;
    }
  }

  async getValidFlags(): Promise<FlagData[]> {
    try {
      await this.connect();
      const cached = await this.redisClient.get('valid_flags');
      if (cached) {
        return JSON.parse(cached);
      }

      const flags = this.fallbackRepo ? await this.fallbackRepo.getValidFlags() : [];

      if (flags.length > 0) {
        await this.redisClient.set('valid_flags', JSON.stringify(flags), { EX: 3600 });
      }

      return flags;
    } catch (error) {
      if (this.fallbackRepo) {
        return this.fallbackRepo.getValidFlags();
      }
      throw error;
    }
  }
}
