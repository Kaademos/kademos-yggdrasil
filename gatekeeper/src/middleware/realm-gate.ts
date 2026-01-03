import { Request, Response, NextFunction } from 'express';
import { ProgressionService } from '../services/progression-service';
import { Logger } from '../services/logger';

export function createRealmGate(progressionService: ProgressionService) {
  return (realmName: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Use logged-in user ID if available, otherwise use session ID for anonymous users
        const progressionId = req.user?.id || req.sessionID;

        if (!progressionId) {
          return res.status(500).json({
            status: 'error',
            message: 'Session not initialized',
          });
        }

        const canAccess = await progressionService.canAccessRealm(progressionId, realmName);

        if (!canAccess) {
          const ip = req.ip || 'unknown';
          Logger.logAccessDenied(progressionId, realmName, ip);

          return res.status(403).json({
            status: 'error',
            message: 'Realm locked. Complete previous realm first.',
            realm: realmName,
          });
        }

        next();
      } catch (error) {
        Logger.logError('Error in realm gate middleware', { error, realmName });
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    };
  };
}
