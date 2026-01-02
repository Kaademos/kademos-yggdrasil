import { createClient } from 'redis';
import { IFlagRepository } from './flag-repository';
import { FileBasedFlagRepository } from './flag-repository';
import { RedisFlagRepository } from './redis-flag-repository';

export interface RepositoryConfig {
  redisUrl?: string;
  dataPath: string;
}

export class RepositoryFactory {
  static create(config: RepositoryConfig): IFlagRepository {
    if (config.redisUrl) {
      try {
        const redisClient = createClient({ url: config.redisUrl });
        const fallback = new FileBasedFlagRepository(config.dataPath);
        return new RedisFlagRepository(redisClient, fallback);
      } catch (error) {
        console.warn('Failed to create Redis client, falling back to file-based storage:', error);
        return new FileBasedFlagRepository(config.dataPath);
      }
    }
    return new FileBasedFlagRepository(config.dataPath);
  }
}
