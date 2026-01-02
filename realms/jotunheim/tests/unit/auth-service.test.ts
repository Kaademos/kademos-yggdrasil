/**
 * AuthService Unit Tests
 */

import { AuthService } from '../../src/services/auth-service';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('validateCredentials', () => {
    it('should return user for valid credentials', () => {
      const user = authService.validateCredentials('admin', 'icethrone2024');
      
      expect(user).not.toBeNull();
      expect(user?.username).toBe('admin');
      expect(user?.role).toBe('admin');
    });

    it('should return null for invalid username', () => {
      const user = authService.validateCredentials('nonexistent', 'password');
      
      expect(user).toBeNull();
    });

    it('should return null for invalid password', () => {
      const user = authService.validateCredentials('admin', 'wrongpassword');
      
      expect(user).toBeNull();
    });

    it('should validate multiple user accounts', () => {
      const user1 = authService.validateCredentials('giantguard', 'frostwall123');
      const user2 = authService.validateCredentials('visitor', 'visitor');
      
      expect(user1).not.toBeNull();
      expect(user1?.role).toBe('user');
      expect(user2).not.toBeNull();
      expect(user2?.role).toBe('guest');
    });
  });

  describe('isAuthenticated', () => {
    it('should return true for authenticated session', () => {
      const session = { isAuthenticated: true };
      
      expect(authService.isAuthenticated(session)).toBe(true);
    });

    it('should return false for unauthenticated session', () => {
      const session = { isAuthenticated: false };
      
      expect(authService.isAuthenticated(session)).toBe(false);
    });

    it('should return false for session without auth flag', () => {
      const session = {};
      
      expect(authService.isAuthenticated(session)).toBe(false);
    });

    it('should return false for null session', () => {
      expect(authService.isAuthenticated(null)).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true for authenticated admin', () => {
      const session = { isAuthenticated: true, role: 'admin' };
      
      expect(authService.isAdmin(session)).toBe(true);
    });

    it('should return false for authenticated non-admin', () => {
      const session = { isAuthenticated: true, role: 'user' };
      
      expect(authService.isAdmin(session)).toBe(false);
    });

    it('should return false for unauthenticated admin role', () => {
      const session = { isAuthenticated: false, role: 'admin' };
      
      expect(authService.isAdmin(session)).toBe(false);
    });
  });

  describe('getUserHints', () => {
    it('should return array of usernames', () => {
      const hints = authService.getUserHints();
      
      expect(Array.isArray(hints)).toBe(true);
      expect(hints.length).toBeGreaterThan(0);
      expect(hints).toContain('admin');
      expect(hints).toContain('giantguard');
      expect(hints).toContain('visitor');
    });
  });
});
