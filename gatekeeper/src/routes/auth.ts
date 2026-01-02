import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth-service';
import { Logger } from '../services/logger';
import { toPublicUser } from '../models/user';
import { AuthRateLimiter } from '../services/auth-rate-limiter';
import { createRateLimitMiddleware } from '../middleware/rate-limit';
import { csrfProtection, csrfTokenHandler, csrfErrorHandler } from '../middleware/csrf';

export function createAuthRoutes(
  authService: AuthService,
  authRateLimiter: AuthRateLimiter,
  requireAuth: any
): Router {
  const router = Router();
  const rateLimitMiddleware = createRateLimitMiddleware(authRateLimiter);

  // Login endpoint with rate limiting
  router.post('/login', rateLimitMiddleware('login'), async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      const ip = req.ip || 'unknown';

      // Validate inputs
      if (!username || !password) {
        Logger.logLoginAttempt(username || 'unknown', false, ip);
        return res.status(400).json({
          status: 'error',
          message: 'Username and password are required',
        });
      }

      // Authenticate
      const user = await authService.authenticate(username, password);

      if (!user) {
        Logger.logLoginAttempt(username, false, ip);
        return res.status(401).json({
          status: 'error',
          message: 'Invalid username or password',
        });
      }

      // Regenerate session to prevent fixation attacks
      req.session.regenerate((err) => {
        if (err) {
          Logger.logError('Session regeneration failed', { error: err });
          return res.status(500).json({
            status: 'error',
            message: 'Internal server error',
          });
        }

        // Store user in session
        req.session.userId = user.id;
        req.session.username = user.username;

        Logger.logLoginAttempt(username, true, ip);

        res.status(200).json({
          status: 'success',
          message: 'Login successful',
          user: toPublicUser(user),
        });
      });
    } catch (error) {
      Logger.logError('Login error', { error });
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
  });

  // Logout endpoint with CSRF protection
  router.post('/logout', requireAuth, csrfProtection, (req: Request, res: Response) => {
    try {
      const userId = req.user?.id || 'unknown';
      const sessionId = req.sessionID || 'unknown';

      req.session.destroy((err) => {
        if (err) {
          Logger.logError('Session destruction failed', { error: err });
          return res.status(500).json({
            status: 'error',
            message: 'Logout failed',
          });
        }

        Logger.logLogout(userId, sessionId);

        res.status(200).json({
          status: 'success',
          message: 'Logout successful',
        });
      });
    } catch (error) {
      Logger.logError('Logout error', { error });
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
  });

  // Auth status endpoint (optional auth)
  router.get('/auth/status', (req: Request, res: Response) => {
    const authenticated = !!req.session?.userId;
    const user = req.user ? toPublicUser(req.user) : undefined;

    res.status(200).json({
      authenticated,
      user,
    });
  });

  // CSRF token endpoint (requires auth)
  router.get('/csrf-token', requireAuth, csrfProtection, csrfTokenHandler);

  return router;
}

export { csrfErrorHandler };
