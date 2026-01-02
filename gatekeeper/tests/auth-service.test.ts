import { AuthService } from '../src/services/auth-service';
import { InMemoryUserRepository } from '../src/repositories/user-repository';

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: InMemoryUserRepository;

  beforeEach(async () => {
    userRepository = new InMemoryUserRepository(4, false); // Use low rounds for faster tests, disable auto-seed
    await userRepository.clear();
    authService = new AuthService(userRepository, 4);
  });

  describe('authenticate', () => {
    it('should authenticate valid credentials', async () => {
      await userRepository.create('testuser', 'password123');
      const user = await authService.authenticate('testuser', 'password123');

      expect(user).toBeTruthy();
      expect(user?.username).toBe('testuser');
    });

    it('should return null for invalid password', async () => {
      await userRepository.create('testuser', 'password123');
      const user = await authService.authenticate('testuser', 'wrongpassword');

      expect(user).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      const user = await authService.authenticate(
        'nonexistent',
        'password123'
      );

      expect(user).toBeNull();
    });

    it('should be case-insensitive for username', async () => {
      await userRepository.create('TestUser', 'password123');
      const user = await authService.authenticate('testuser', 'password123');

      expect(user).toBeTruthy();
      expect(user?.username).toBe('TestUser');
    });
  });

  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      const hash = await authService.hashPassword('password123');

      expect(hash).toBeTruthy();
      expect(hash).not.toBe('password123');
      expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    });

    it('should throw error for short password', async () => {
      await expect(authService.hashPassword('short')).rejects.toThrow(
        'Password must be at least 8 characters'
      );
    });

    it('should throw error for empty password', async () => {
      await expect(authService.hashPassword('')).rejects.toThrow(
        'Password must be at least 8 characters'
      );
    });

    it('should generate different hashes for same password', async () => {
      const hash1 = await authService.hashPassword('password123');
      const hash2 = await authService.hashPassword('password123');

      expect(hash1).not.toBe(hash2); // bcrypt uses random salt
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const hash = await authService.hashPassword('password123');
      const isValid = await authService.verifyPassword('password123', hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const hash = await authService.hashPassword('password123');
      const isValid = await authService.verifyPassword('wrongpassword', hash);

      expect(isValid).toBe(false);
    });

    it('should return false for invalid hash format', async () => {
      const isValid = await authService.verifyPassword(
        'password123',
        'not-a-valid-hash'
      );

      expect(isValid).toBe(false);
    });
  });
});
