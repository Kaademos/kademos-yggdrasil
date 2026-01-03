import { ProgressionService } from '../src/services/progression-service';
import { ProgressionClient } from '../src/services/progression-client';

describe('ProgressionService', () => {
  let progressionService: ProgressionService;
  let mockProgressionClient: jest.Mocked<ProgressionClient>;

  beforeEach(() => {
    mockProgressionClient = {
      getProgression: jest.fn(),
      validateFlag: jest.fn(),
    } as any;

    progressionService = new ProgressionService(mockProgressionClient, 1000); // 1 second TTL for tests
  });

  afterEach(() => {
    progressionService.clearCache();
  });

  describe('canAccessRealm', () => {
    it('should allow access to SAMPLE realm always', async () => {
      mockProgressionClient.getProgression.mockResolvedValue({
        userId: 'user1',
        unlockedRealms: [],
        flags: [],
        lastUpdated: new Date().toISOString(),
      });

      const canAccess = await progressionService.canAccessRealm(
        'user1',
        'sample'
      );
      expect(canAccess).toBe(true);
    });

    it('should allow access to NIFLHEIM realm always (entry realm)', async () => {
      mockProgressionClient.getProgression.mockResolvedValue({
        userId: 'user1',
        unlockedRealms: [],
        flags: [],
        lastUpdated: new Date().toISOString(),
      });

      const canAccess = await progressionService.canAccessRealm(
        'user1',
        'niflheim'
      );
      expect(canAccess).toBe(true);
    });

    it('should allow anonymous session access to niflheim', async () => {
      // Simulate anonymous user with session ID
      const sessionId = 'anon-session-abc123';
      mockProgressionClient.getProgression.mockResolvedValue(null);

      const canAccess = await progressionService.canAccessRealm(
        sessionId,
        'niflheim'
      );
      expect(canAccess).toBe(true);
    });

    it('should allow access to unlocked realm', async () => {
      mockProgressionClient.getProgression.mockResolvedValue({
        userId: 'user1',
        unlockedRealms: ['SAMPLE', 'HELHEIM'],
        flags: [],
        lastUpdated: new Date().toISOString(),
      });

      const canAccess = await progressionService.canAccessRealm(
        'user1',
        'helheim'
      );
      expect(canAccess).toBe(true);
    });

    it('should deny access to locked realm', async () => {
      mockProgressionClient.getProgression.mockResolvedValue({
        userId: 'user1',
        unlockedRealms: ['SAMPLE'],
        flags: [],
        lastUpdated: new Date().toISOString(),
      });

      const canAccess = await progressionService.canAccessRealm(
        'user1',
        'helheim'
      );
      expect(canAccess).toBe(false);
    });

    it('should be case-insensitive for realm names', async () => {
      mockProgressionClient.getProgression.mockResolvedValue({
        userId: 'user1',
        unlockedRealms: ['SAMPLE', 'HELHEIM'],
        flags: [],
        lastUpdated: new Date().toISOString(),
      });

      const canAccess1 = await progressionService.canAccessRealm(
        'user1',
        'HELHEIM'
      );
      const canAccess2 = await progressionService.canAccessRealm(
        'user1',
        'helheim'
      );
      const canAccess3 = await progressionService.canAccessRealm(
        'user1',
        'Helheim'
      );

      expect(canAccess1).toBe(true);
      expect(canAccess2).toBe(true);
      expect(canAccess3).toBe(true);
    });
  });

  describe('getUnlockedRealms', () => {
    it('should fetch unlocked realms from client', async () => {
      mockProgressionClient.getProgression.mockResolvedValue({
        userId: 'user1',
        unlockedRealms: ['SAMPLE', 'HELHEIM'],
        flags: [],
        lastUpdated: new Date().toISOString(),
      });

      const realms = await progressionService.getUnlockedRealms('user1');
      expect(realms).toEqual(['SAMPLE', 'HELHEIM']);
      expect(mockProgressionClient.getProgression).toHaveBeenCalledWith('user1');
    });

    it('should return empty array for new user', async () => {
      mockProgressionClient.getProgression.mockResolvedValue(null);

      const realms = await progressionService.getUnlockedRealms('user1');
      expect(realms).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockProgressionClient.getProgression.mockRejectedValue(
        new Error('Network error')
      );

      const realms = await progressionService.getUnlockedRealms('user1');
      expect(realms).toEqual([]);
    });
  });

  describe('caching', () => {
    it('should cache progression data', async () => {
      mockProgressionClient.getProgression.mockResolvedValue({
        userId: 'user1',
        unlockedRealms: ['SAMPLE', 'HELHEIM'],
        flags: [],
        lastUpdated: new Date().toISOString(),
      });

      // First call - should hit client
      await progressionService.getUnlockedRealms('user1');
      expect(mockProgressionClient.getProgression).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await progressionService.getUnlockedRealms('user1');
      expect(mockProgressionClient.getProgression).toHaveBeenCalledTimes(1);
    });

    it('should expire cache after TTL', async () => {
      const shortTTLService = new ProgressionService(
        mockProgressionClient,
        100
      ); // 100ms TTL

      mockProgressionClient.getProgression.mockResolvedValue({
        userId: 'user1',
        unlockedRealms: ['SAMPLE'],
        flags: [],
        lastUpdated: new Date().toISOString(),
      });

      // First call
      await shortTTLService.getUnlockedRealms('user1');
      expect(mockProgressionClient.getProgression).toHaveBeenCalledTimes(1);

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should hit client again
      await shortTTLService.getUnlockedRealms('user1');
      expect(mockProgressionClient.getProgression).toHaveBeenCalledTimes(2);
    });

    it('should allow cache invalidation', async () => {
      mockProgressionClient.getProgression.mockResolvedValue({
        userId: 'user1',
        unlockedRealms: ['SAMPLE'],
        flags: [],
        lastUpdated: new Date().toISOString(),
      });

      // Cache data
      await progressionService.getUnlockedRealms('user1');
      expect(mockProgressionClient.getProgression).toHaveBeenCalledTimes(1);

      // Invalidate cache
      progressionService.invalidateCache('user1');

      // Should hit client again
      await progressionService.getUnlockedRealms('user1');
      expect(mockProgressionClient.getProgression).toHaveBeenCalledTimes(2);
    });

    it('should return stale cache on error', async () => {
      // Initial successful fetch
      mockProgressionClient.getProgression.mockResolvedValueOnce({
        userId: 'user1',
        unlockedRealms: ['SAMPLE', 'HELHEIM'],
        flags: [],
        lastUpdated: new Date().toISOString(),
      });

      await progressionService.getUnlockedRealms('user1');

      // Expire cache
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Next fetch fails
      mockProgressionClient.getProgression.mockRejectedValueOnce(
        new Error('Network error')
      );

      // Should return stale cached data
      const realms = await progressionService.getUnlockedRealms('user1');
      expect(realms).toEqual(['SAMPLE', 'HELHEIM']);
    });
  });

  describe('cache management', () => {
    it('should clear all cache', async () => {
      mockProgressionClient.getProgression.mockResolvedValue({
        userId: 'user1',
        unlockedRealms: ['SAMPLE'],
        flags: [],
        lastUpdated: new Date().toISOString(),
      });

      await progressionService.getUnlockedRealms('user1');
      progressionService.clearCache();

      // Should hit client again
      await progressionService.getUnlockedRealms('user1');
      expect(mockProgressionClient.getProgression).toHaveBeenCalledTimes(2);
    });

    it('should cleanup expired entries', async () => {
      const shortTTLService = new ProgressionService(
        mockProgressionClient,
        100
      );

      mockProgressionClient.getProgression.mockResolvedValue({
        userId: 'user1',
        unlockedRealms: ['SAMPLE'],
        flags: [],
        lastUpdated: new Date().toISOString(),
      });

      await shortTTLService.getUnlockedRealms('user1');

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Cleanup
      shortTTLService.cleanupCache();

      // Cache should be empty, so next call hits client
      await shortTTLService.getUnlockedRealms('user1');
      expect(mockProgressionClient.getProgression).toHaveBeenCalledTimes(2);
    });
  });
});
