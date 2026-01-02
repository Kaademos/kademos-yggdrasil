/**
 * Authentication Service - Vanaheim
 * 
 * Manages authentication using tokens from TokenService.
 * Grants admin access when valid token is provided.
 */

import { TokenService } from './token-service';

export interface User {
  userId: string;
  role: 'guest' | 'merchant' | 'admin';
  authenticated: boolean;
}

export class AuthService {
  private tokenService: TokenService;
  private sessions: Map<string, User> = new Map();

  constructor(tokenService: TokenService) {
    this.tokenService = tokenService;
  }

  /**
   * Authenticate with token
   * Returns admin role if token is valid
   */
  authenticateWithToken(token: string): User | null {
    if (this.tokenService.validateToken(token)) {
      const user: User = {
        userId: 'admin',
        role: 'admin',
        authenticated: true,
      };
      
      // Store session
      this.sessions.set(token, user);
      
      return user;
    }
    
    return null;
  }

  /**
   * Get user by token
   */
  getUserByToken(token: string): User | null {
    return this.sessions.get(token) || null;
  }

  /**
   * Create guest user
   */
  createGuestUser(userId: string): User {
    return {
      userId,
      role: 'guest',
      authenticated: false,
    };
  }

  /**
   * Check if user is admin
   */
  isAdmin(user: User): boolean {
    return user.role === 'admin' && user.authenticated;
  }

  /**
   * Logout
   */
  logout(token: string): void {
    this.sessions.delete(token);
  }
}
