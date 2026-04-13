import { injectable, inject } from 'tsyringe';
import { ProgressionClient } from './progression-client';

interface CacheEntry {
  data: string[];
  timestamp: number;
}

@injectable()
export class ProgressionService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly cacheTTLMs: number;

  constructor(
    @inject(ProgressionClient) private progressionClient: ProgressionClient,
    @inject('Config') private config: any = { cacheTTLMs: 30000 }
  ) {
    if (typeof config === 'number') {
      this.cacheTTLMs = config;
    } else {
      this.cacheTTLMs = config?.cacheTTLMs || 30000;
    }
  }

  async canAccessRealm(userId: string, realmName: string): Promise<boolean> {
    const normalizedName = realmName.toLowerCase();

    // Sample realm and Niflheim (entry realm) are always accessible
    if (normalizedName === 'sample' || normalizedName === 'niflheim') {
      return true;
    }

    // For other realms, check progression
    const unlockedRealms = await this.getUnlockedRealms(userId);
    return unlockedRealms.includes(realmName.toUpperCase());
  }

  async getUnlockedRealms(userId: string): Promise<string[]> {
    // Check cache first
    const cached = this.cache.get(userId);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.cacheTTLMs) {
      return cached.data;
    }

    // Fetch from flag-oracle
    try {
      const progression = await this.progressionClient.getProgression(userId);
      const unlockedRealms = progression?.unlockedRealms || [];

      // Update cache
      this.cache.set(userId, {
        data: unlockedRealms,
        timestamp: now,
      });

      return unlockedRealms;
    } catch (error) {
      console.error('[ProgressionService] Error fetching progression:', error);

      // Return cached data if available, even if expired
      if (cached) {
        return cached.data;
      }

      return [];
    }
  }

  invalidateCache(userId: string): void {
    this.cache.delete(userId);
  }

  clearCache(): void {
    this.cache.clear();
  }

  // Cleanup old cache entries
  cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [userId, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.cacheTTLMs) {
        expiredKeys.push(userId);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }
  }
}
