import { Request, Response, NextFunction } from 'express';
import { ProgressionService } from '../services/progression-service';
import { Logger } from '../services/logger';

export function createRealmGate(progressionService: ProgressionService) {
  return (realmName: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            status: 'error',
            message: 'Authentication required',
          });
        }

        const canAccess = await progressionService.canAccessRealm(req.user.id, realmName);

        if (!canAccess) {
          const ip = req.ip || 'unknown';
          Logger.logAccessDenied(req.user.id, realmName, ip);

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
