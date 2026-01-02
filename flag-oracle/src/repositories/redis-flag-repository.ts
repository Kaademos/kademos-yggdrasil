import { createClient } from 'redis';
import { IFlagRepository, UserProgression, FlagData } from './flag-repository';
import { FileBasedFlagRepository } from './flag-repository';

type RedisClient = ReturnType<typeof createClient>;

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

  async getProgression(userId: string): Promise<UserProgression | null> {
    try {
      await this.connect();
      const data = await this.redisClient.get(`progression:${userId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      if (this.fallbackRepo) {
        return this.fallbackRepo.getProgression(userId);
      }
      throw error;
    }
  }

  async updateProgression(userId: string, realm: string, flag: string): Promise<void> {
    try {
      await this.connect();

      const progression = (await this.getProgression(userId)) || {
        userId,
        unlockedRealms: [],
        flags: [],
        lastUpdated: new Date().toISOString(),
      };

      if (!progression.unlockedRealms.includes(realm)) {
        progression.unlockedRealms.push(realm);
      }
      if (!progression.flags.includes(flag)) {
        progression.flags.push(flag);
      }
      progression.lastUpdated = new Date().toISOString();

      const multi = this.redisClient.multi();
      multi.set(`progression:${userId}`, JSON.stringify(progression));
      multi.expire(`progression:${userId}`, 86400 * 30);
      await multi.exec();
    } catch (error) {
      if (this.fallbackRepo) {
        await this.fallbackRepo.updateProgression(userId, realm, flag);
        return;
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
