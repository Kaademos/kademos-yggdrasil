/**
 * Auth Service Unit Tests
 * Tests for AuthService functionality
 */

import { AuthService } from '../../src/services/auth-service';
import { TokenService } from '../../src/services/token-service';

describe('AuthService', () => {
  let tokenService: TokenService;
  let authService: AuthService;

  beforeEach(() => {
    tokenService = new TokenService(10, 1000);
    authService = new AuthService(tokenService);
  });

  describe('authenticateWithToken', () => {
    it('should return null for invalid token', () => {
      const user = authService.authenticateWithToken('INVALID-TOKEN');
      expect(user).toBeNull();
    });

    it('should return admin user for valid token', () => {
      const token = tokenService.generateToken('merchant1');
      const user = authService.authenticateWithToken(token.value);
      
      expect(user).not.toBeNull();
      expect(user?.userId).toBe('admin');
      expect(user?.role).toBe('admin');
      expect(user?.authenticated).toBe(true);
    });

    it('should store session for valid authentication', () => {
      const token = tokenService.generateToken('merchant1');
      authService.authenticateWithToken(token.value);
      
      const storedUser = authService.getUserByToken(token.value);
      expect(storedUser).not.toBeNull();
      expect(storedUser?.role).toBe('admin');
    });
  });

  describe('getUserByToken', () => {
    it('should return null for non-existent token', () => {
      const user = authService.getUserByToken('NONEXISTENT');
      expect(user).toBeNull();
    });

    it('should return user for existing session', () => {
      const token = tokenService.generateToken('merchant1');
      authService.authenticateWithToken(token.value);
      
      const user = authService.getUserByToken(token.value);
      expect(user?.userId).toBe('admin');
    });
  });

  describe('createGuestUser', () => {
    it('should create a guest user with correct properties', () => {
      const user = authService.createGuestUser('guest123');
      
      expect(user.userId).toBe('guest123');
      expect(user.role).toBe('guest');
      expect(user.authenticated).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true for authenticated admin', () => {
      const adminUser = { userId: 'admin', role: 'admin' as const, authenticated: true };
      expect(authService.isAdmin(adminUser)).toBe(true);
    });

    it('should return false for guest', () => {
      const guestUser = { userId: 'guest', role: 'guest' as const, authenticated: false };
      expect(authService.isAdmin(guestUser)).toBe(false);
    });

    it('should return false for unauthenticated admin', () => {
      const unauthUser = { userId: 'admin', role: 'admin' as const, authenticated: false };
      expect(authService.isAdmin(unauthUser)).toBe(false);
    });
  });

  describe('logout', () => {
    it('should remove session', () => {
      const token = tokenService.generateToken('merchant1');
      authService.authenticateWithToken(token.value);
      
      authService.logout(token.value);
      
      const user = authService.getUserByToken(token.value);
      expect(user).toBeNull();
    });
  });
});
