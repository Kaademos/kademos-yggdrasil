/**
 * Authentication Service
 * 
 * Manages user authentication logic.
 * For CTF purposes, uses hardcoded users.
 */

export interface User {
  username: string;
  password: string;
  role: string;
}

// Hardcoded users for CTF
const USERS: User[] = [
  { username: 'giantguard', password: 'frostwall123', role: 'user' },
  { username: 'admin', password: 'icethrone2024', role: 'admin' },
  { username: 'visitor', password: 'visitor', role: 'guest' },
];

export class AuthService {
  /**
   * Validate user credentials
   */
  validateCredentials(username: string, password: string): User | null {
    const user = USERS.find(
      (u) => u.username === username && u.password === password
    );
    return user || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(session: { isAuthenticated?: boolean } | undefined): boolean {
    return Boolean(session && session.isAuthenticated === true);
  }

  /**
   * Check if user has admin role
   */
  isAdmin(session: { isAuthenticated?: boolean; role?: string } | undefined): boolean {
    return this.isAuthenticated(session) && session?.role === 'admin';
  }

  /**
   * Get all usernames (for hint purposes)
   */
  getUserHints(): string[] {
    return USERS.map((u) => u.username);
  }
}
