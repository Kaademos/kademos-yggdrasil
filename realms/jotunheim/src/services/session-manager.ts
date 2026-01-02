/**
 * Session Manager - Jotunheim
 * 
 * OWASP A07:2025 - Authentication Failures
 * VULNERABLE: Accepts client-provided session IDs (Session Fixation)
 * 
 * SPOILER: This service intentionally allows session fixation attacks
 * EXPLOIT: Set your own session ID, trick admin into logging in with it, then reuse it
 */

import crypto from 'crypto';

export interface SessionData {
  id: string;
  username: string;
  role: string;
  createdAt: number;
  lastAccessedAt: number;
  fixedByClient?: boolean; // Track if session ID was provided by client
}

export class SessionManager {
  private sessions: Map<string, SessionData> = new Map();
  private readonly SESSION_TIMEOUT = 3600000; // 1 hour

  /**
   * VULNERABLE: Create session with optional client-provided ID
   * 
   * SPOILER: This is the core vulnerability - accepting external session IDs
   * EXPLOIT: Attacker can fix a session ID, then have victim login with that ID
   */
  createSession(username: string, role: string, clientProvidedId?: string): SessionData {
    // VULNERABLE: Use client-provided ID if available
    const sessionId = clientProvidedId || this.generateSessionId();
    
    const now = Date.now();
    const session: SessionData = {
      id: sessionId,
      username,
      role,
      createdAt: now,
      lastAccessedAt: now,
      fixedByClient: Boolean(clientProvidedId), // Track for debugging
    };

    // VULNERABLE: No regeneration - reuses the same ID even if it existed before
    this.sessions.set(sessionId, session);
    
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (Date.now() - session.lastAccessedAt > this.SESSION_TIMEOUT) {
      this.sessions.delete(sessionId);
      return null;
    }

    // Update last accessed time
    session.lastAccessedAt = Date.now();
    return session;
  }

  /**
   * Update session role (privilege escalation)
   * 
   * VULNERABLE: Updates role without regenerating session ID
   * This is a key part of the session fixation vulnerability
   */
  updateSessionRole(sessionId: string, newRole: string): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return false;
    }

    // VULNERABLE: Role updated but session ID not regenerated
    // This allows attacker to gain elevated privileges on their fixed session
    session.role = newRole;
    session.lastAccessedAt = Date.now();
    
    return true;
  }

  /**
   * Delete session (logout)
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get all active sessions (for debugging/inspection)
   * 
   * VULNERABLE: Exposes session details including IDs
   */
  getAllSessions(): SessionData[] {
    const now = Date.now();
    const activeSessions: SessionData[] = [];

    // Clean expired sessions and collect active ones
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastAccessedAt > this.SESSION_TIMEOUT) {
        this.sessions.delete(id);
      } else {
        activeSessions.push(session);
      }
    }

    return activeSessions;
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Generate random session ID (when not provided by client)
   */
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate session ID format (basic check)
   */
  isValidSessionIdFormat(sessionId: string): boolean {
    // Accept hex strings of reasonable length (32-64 chars)
    return /^[a-f0-9]{32,64}$/i.test(sessionId);
  }
}
