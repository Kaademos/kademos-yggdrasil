/**
 * Authentication Routes - VULNERABLE TO SESSION FIXATION
 * 
 * OWASP A07:2025 - Authentication Failures
 * SPOILER: Accepts client-provided session IDs enabling session fixation attacks
 */

import { Router, Request, Response } from 'express';
import { RealmConfig } from '../config';
import { AuthService } from '../services/auth-service';
import { SessionManager } from '../services/session-manager';

export function createAuthRouter(
  config: RealmConfig,
  authService: AuthService,
  sessionManager: SessionManager
): Router {
  const router = Router();

  /**
   * POST /api/login
   * 
   * VULNERABLE: Accepts client-provided session ID (Session Fixation)
   * 
   * EXPLOIT:
   * 1. Attacker provides custom sessionId in request body
   * 2. System uses that ID instead of generating new one
   * 3. Admin logs in with the fixed session
   * 4. Attacker reuses the session ID to gain admin access
   */
  router.post('/api/login', (req: Request, res: Response) => {
    const { username, password, sessionId: clientSessionId } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password required',
      });
    }

    // Validate credentials
    const user = authService.validateCredentials(username, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        hint: 'Try usernames: giantguard, admin, visitor',
      });
    }

    // VULNERABLE: Accept client-provided session ID
    let fixedSessionId: string | undefined;
    if (clientSessionId && sessionManager.isValidSessionIdFormat(clientSessionId)) {
      fixedSessionId = clientSessionId;
    }

    // Create session (potentially with client-provided ID)
    const session = sessionManager.createSession(user.username, user.role, fixedSessionId);

    // Store session ID in express-session for middleware compatibility
    req.session.sessionId = session.id;
    req.session.isAuthenticated = true;
    req.session.username = user.username;
    req.session.role = user.role;

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        username: user.username,
        role: user.role,
      },
      sessionId: session.id, // VULNERABLE: Exposes session ID
      warning: session.fixedByClient ? '⚠️ Session ID was provided by client' : undefined,
    });
  });

  /**
   * POST /api/logout
   * Destroy session
   */
  router.post('/api/logout', (req: Request, res: Response) => {
    const sessionId = req.session.sessionId;

    // Delete from custom session manager
    if (sessionId) {
      sessionManager.deleteSession(sessionId);
    }

    // Destroy express-session
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: 'Logout failed',
        });
      }

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    });
  });

  /**
   * GET /api/session
   * Get current session info
   */
  router.get('/api/session', (req: Request, res: Response) => {
    if (!authService.isAuthenticated(req.session)) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    res.json({
      success: true,
      session: {
        sessionId: req.session.sessionId, // VULNERABLE: Exposes session ID
        username: req.session.username,
        role: req.session.role,
        authenticated: true,
      },
    });
  });

  /**
   * GET /api/users/hints
   * Provides username hints
   */
  router.get('/api/users/hints', (_req: Request, res: Response) => {
    const hints = authService.getUserHints();
    res.json({
      success: true,
      hints,
    });
  });

  /**
   * GET /debug/session-info
   * 
   * VULNERABLE: Debug endpoint that exposes session details
   * 
   * SPOILER: Reveals that session IDs are accepted from client
   * EXPLOIT: Use this to understand the session fixation vulnerability
   */
  router.get('/debug/session-info', (req: Request, res: Response) => {
    const sessionId = req.session.sessionId;
    
    if (!sessionId) {
      return res.json({
        success: true,
        authenticated: false,
        hint: 'Session IDs are accepted from client during login',
        vulnerability: 'Session Fixation (A07:2025)',
        exploitation: 'Provide a sessionId parameter when calling /api/login',
      });
    }

    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
      return res.json({
        success: true,
        authenticated: false,
        message: 'Session not found or expired',
      });
    }

    // VULNERABLE: Expose internal session state
    res.json({
      success: true,
      session: {
        id: session.id,
        username: session.username,
        role: session.role,
        createdAt: new Date(session.createdAt).toISOString(),
        lastAccessedAt: new Date(session.lastAccessedAt).toISOString(),
        fixedByClient: session.fixedByClient,
      },
      warning: '⚠️ This endpoint exposes internal session state',
      hint: 'Session IDs can be provided during login via "sessionId" parameter in request body',
    });
  });

  /**
   * GET /debug/all-sessions
   * 
   * VULNERABLE: Lists all active sessions
   * 
   * SPOILER: Shows admin sessions and their IDs
   * EXPLOIT: Can see which sessions belong to admin users
   */
  router.get('/debug/all-sessions', (req: Request, res: Response) => {
    const sessions = sessionManager.getAllSessions();

    res.json({
      success: true,
      count: sessions.length,
      sessions: sessions.map(s => ({
        id: s.id.substring(0, 16) + '...', // Partial exposure for realism
        username: s.username,
        role: s.role,
        fixedByClient: s.fixedByClient,
        createdAt: new Date(s.createdAt).toISOString(),
      })),
      warning: '⚠️ This endpoint should not be exposed in production',
      hint: 'Active admin sessions can be hijacked if their full session IDs are known',
    });
  });

  return router;
}
