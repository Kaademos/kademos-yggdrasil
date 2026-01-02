import { RedisFlagRepository } from '../src/repositories/redis-flag-repository';
import { FileBasedFlagRepository } from '../src/repositories/flag-repository';

const mockRedisClient = {
  connect: jest.fn(),
  quit: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  multi: jest.fn(() => ({
    set: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  })),
};

describe('RedisFlagRepository', () => {
  let repository: RedisFlagRepository;
  let mockFallback: jest.Mocked<FileBasedFlagRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFallback = {
      getProgression: jest.fn(),
      updateProgression: jest.fn(),
      getValidFlags: jest.fn(),
    } as any;
    repository = new RedisFlagRepository(mockRedisClient as any, mockFallback);
  });

  describe('getProgression', () => {
    it('should return parsed progression from Redis', async () => {
      const mockProgression = {
        userId: 'user1',
        unlockedRealms: ['NIFLHEIM'],
        flags: ['YGGDRASIL{NIFLHEIM:uuid}'],
        lastUpdated: '2025-12-04T00:00:00.000Z',
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockProgression));

      const result = await repository.getProgression('user1');

      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.get).toHaveBeenCalledWith('progression:user1');
      expect(result).toEqual(mockProgression);
    });

    it('should return null when user not found', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await repository.getProgression('user1');

      expect(result).toBeNull();
    });

    it('should fall back to file repository on Redis error', async () => {
      const mockProgression = {
        userId: 'user1',
        unlockedRealms: [],
        flags: [],
        lastUpdated: '2025-12-04T00:00:00.000Z',
      };

      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));
      mockFallback.getProgression.mockResolvedValue(mockProgression);

      const result = await repository.getProgression('user1');

      expect(mockFallback.getProgression).toHaveBeenCalledWith('user1');
      expect(result).toEqual(mockProgression);
    });
  });

  describe('updateProgression', () => {
    it('should update progression in Redis with TTL', async () => {
      const mockMulti = {
        set: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.multi.mockReturnValue(mockMulti as any);

      await repository.updateProgression('user1', 'NIFLHEIM', 'YGGDRASIL{NIFLHEIM:uuid}');

      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(mockMulti.set).toHaveBeenCalled();
      expect(mockMulti.expire).toHaveBeenCalledWith('progression:user1', 86400 * 30);
      expect(mockMulti.exec).toHaveBeenCalled();
    });

    it('should fall back to file repository on Redis error', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Redis connection failed'));

      await repository.updateProgression('user1', 'NIFLHEIM', 'YGGDRASIL{NIFLHEIM:uuid}');

      expect(mockFallback.updateProgression).toHaveBeenCalledWith(
        'user1',
        'NIFLHEIM',
        'YGGDRASIL{NIFLHEIM:uuid}'
      );
    });
  });

  describe('getValidFlags', () => {
    it('should fall back to file repository on Redis error', async () => {
      const mockFlags = [
        { realm: 'NIFLHEIM', flag: 'YGGDRASIL{NIFLHEIM:uuid}', nextRealm: 'HELHEIM' },
      ];

      mockRedisClient.connect.mockRejectedValueOnce(new Error('Redis connection failed'));
      mockFallback.getValidFlags.mockResolvedValue(mockFlags);

      const result = await repository.getValidFlags();

      expect(mockFallback.getValidFlags).toHaveBeenCalled();
      expect(result).toEqual(mockFlags);
    });
  });
});
