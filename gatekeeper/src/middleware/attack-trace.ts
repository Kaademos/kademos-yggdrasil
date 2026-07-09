import { Request, Response, NextFunction } from 'express';
import { attackTraceLogger } from '../services/attack-trace-logger';

/**
 * Middleware to capture attack traces for authentication and authorization events
 */
export const captureAttackTrace = (req: Request, res: Response, next: NextFunction) => {
  // Store original json function
  const originalJson = res.json.bind(res);

  // Override json to capture response
  res.json = function (body: any): Response {
    // Check if this is an authentication-related endpoint
    if (req.path.includes('/auth') || req.path.includes('/login')) {
      const isSuccess = res.statusCode >= 200 && res.statusCode < 300;

      if (req.method === 'POST' && req.body?.username) {
        // Log authentication attempt asynchronously
        attackTraceLogger
          .logAuthAttempt({
            username: req.body.username,
            success: isSuccess,
            ip: req.ip || req.connection.remoteAddress || 'unknown',
            reason: isSuccess ? undefined : body.error || body.message,
          })
          .catch((err) => console.error('Failed to log auth trace:', err));
      }
    }

    // Check if this is a flag submission
    if (req.path.includes('/flag') && req.method === 'POST') {
      const isSuccess = res.statusCode >= 200 && res.statusCode < 300;

      if (req.body?.flag) {
        const userId = (req.session as any)?.userId || 'anonymous';

        // Log flag submission asynchronously
        attackTraceLogger
          .logFlagSubmission({
            userId,
            flag: req.body.flag,
            realm: body.realm || 'unknown',
            success: isSuccess,
            unlockedRealm: body.unlockedRealm,
            ip: req.ip || req.connection.remoteAddress || 'unknown',
          })
          .catch((err) => console.error('Failed to log flag trace:', err));
      }
    }

    // Call original json
    return originalJson(body);
  };

  next();
};
