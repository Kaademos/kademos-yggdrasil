/**
 * Admin Routes - VULNERABLE TO SESSION FIXATION
 * 
 * OWASP A07:2025 - Authentication Failures
 * Admin-only endpoints that can be accessed via fixed sessions
 */

import { Router, Request, Response } from 'express';
import { RealmConfig } from '../config';
import { AuthService } from '../services/auth-service';
import { SessionManager } from '../services/session-manager';

export function createAdminRouter(
  config: RealmConfig,
  authService: AuthService,
  sessionManager: SessionManager
): Router {
  const router = Router();

  /**
   * GET /api/admin/panel
   * 
   * Admin dashboard - contains the realm flag
   * 
   * VULNERABLE: Accessible if session has admin role (even if session was fixed)
   * EXPLOIT: Fix a session, trick admin into logging in, reuse session to access this
   */
  router.get('/api/admin/panel', (req: Request, res: Response) => {
    // Check authentication via session manager
    const sessionId = req.session.sessionId;
    
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        hint: 'Login first via /api/login',
      });
    }

    const session = sessionManager.getSession(sessionId);
    
    if (!session || session.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        hint: 'This endpoint requires admin role',
        currentRole: session?.role || 'none',
      });
    }

    // Admin access granted - return flag
    res.json({
      success: true,
      message: 'Welcome to Jotunheim Admin Panel',
      admin: session.username,
      realm: 'Jotunheim',
      auditLog: [
        {
          event: 'Admin login',
          timestamp: new Date(session.createdAt).toISOString(),
          sessionId: session.id,
          fixedByClient: session.fixedByClient,
        },
        {
          event: 'Flag access',
          timestamp: new Date().toISOString(),
          flag: config.flag, // VULNERABLE: Flag exposed in audit log
        },
      ],
      warning: session.fixedByClient 
        ? '⚠️ Warning: This session was created with a client-provided ID'
        : undefined,
    });
  });

  /**
   * GET /api/admin/stats
   * Admin statistics
   */
  router.get('/api/admin/stats', (req: Request, res: Response) => {
    const sessionId = req.session.sessionId;
    
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const session = sessionManager.getSession(sessionId);
    
    if (!session || session.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    // Return realm statistics
    res.json({
      success: true,
      stats: {
        realm: 'Jotunheim',
        activeSessions: sessionManager.getSessionCount(),
        vulnerability: 'A07:2025 - Authentication Failures',
        description: 'Session Fixation via client-provided session IDs',
      },
    });
  });

  return router;
}
