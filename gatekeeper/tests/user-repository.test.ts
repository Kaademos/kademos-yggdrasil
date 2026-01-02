import { InMemoryUserRepository } from '../src/repositories/user-repository';

describe('InMemoryUserRepository', () => {
  let repository: InMemoryUserRepository;

  beforeEach(async () => {
    repository = new InMemoryUserRepository(4, false); // Use low rounds for faster tests, disable auto-seed
    await repository.clear();
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const user = await repository.create('testuser', 'password123');

      expect(user.id).toBeTruthy();
      expect(user.username).toBe('testuser');
      expect(user.passwordHash).toBeTruthy();
      expect(user.passwordHash).not.toBe('password123');
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should throw error for duplicate username', async () => {
      await repository.create('testuser', 'password123');

      await expect(
        repository.create('testuser', 'password456')
      ).rejects.toThrow('Username already exists');
    });

    it('should throw error for empty username', async () => {
      await expect(repository.create('', 'password123')).rejects.toThrow(
        'Username is required'
      );
    });

    it('should throw error for short password', async () => {
      await expect(repository.create('testuser', 'short')).rejects.toThrow(
        'Password must be at least 8 characters'
      );
    });

    it('should trim whitespace from username', async () => {
      const user = await repository.create('  testuser  ', 'password123');
      expect(user.username).toBe('testuser');
    });
  });

  describe('findByUsername', () => {
    it('should find user by username', async () => {
      const created = await repository.create('testuser', 'password123');
      const found = await repository.findByUsername('testuser');

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.username).toBe('testuser');
    });

    it('should be case-insensitive', async () => {
      await repository.create('TestUser', 'password123');
      const found = await repository.findByUsername('testuser');

      expect(found).toBeTruthy();
      expect(found?.username).toBe('TestUser');
    });

    it('should return null for non-existent user', async () => {
      const found = await repository.findByUsername('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const created = await repository.create('testuser', 'password123');
      const found = await repository.findById(created.id);

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.username).toBe('testuser');
    });

    it('should return null for non-existent id', async () => {
      const found = await repository.findById('nonexistent-id');
      expect(found).toBeNull();
    });
  });

  describe('count', () => {
    it('should return correct count of users', async () => {
      expect(await repository.count()).toBe(0);

      await repository.create('user1', 'password123');
      expect(await repository.count()).toBe(1);

      await repository.create('user2', 'password123');
      expect(await repository.count()).toBe(2);
    });
  });
});
