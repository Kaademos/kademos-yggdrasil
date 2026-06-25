import { Request, Response, NextFunction } from 'express';
import { IUserRepository } from '../repositories/user-repository';
import { Logger } from '../services/logger';

export function createAuthMiddleware(userRepository: IUserRepository) {
  return {
    // Strict authentication: requires a logged-in user backed by a valid account.
    // Responds 401 (and clears any stale session) when the requester is not authenticated.
    // Used for account-scoped actions (logout, CSRF token). Anonymous realm play uses ensureSession.
    requireAuth: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.session?.userId;

        if (!userId) {
          Logger.logInfo('Unauthorized access attempt', {
            path: req.path,
            ip: req.ip || 'unknown',
          });

          return res.status(401).json({
            status: 'error',
            message: 'Authentication required',
          });
        }

        const user = await userRepository.findById(userId);
        if (!user) {
          req.session.destroy(() => {});
          return res.status(401).json({
            status: 'error',
            message: 'Authentication required',
          });
        }

        req.user = user;
        next();
      } catch (error) {
        Logger.logError('Error in auth middleware', { error });
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    },

    // Anonymous-friendly: requires a session to exist (for progression tracking via
    // sessionID), and attaches req.user when the session belongs to a logged-in account.
    // Never rejects unauthenticated requests — used for realm access and flag submission.
    ensureSession: async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.session) {
          return res.status(500).json({
            status: 'error',
            message: 'Session initialization failed',
          });
        }

        if (req.session.userId) {
          const user = await userRepository.findById(req.session.userId);
          if (user) {
            req.user = user;
          }
        }

        next();
      } catch (error) {
        Logger.logError('Error in session middleware', { error });
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    },
  };
}
