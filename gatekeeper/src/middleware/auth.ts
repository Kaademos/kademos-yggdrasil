import { Request, Response, NextFunction } from 'express';
import { IUserRepository } from '../repositories/user-repository';
import { Logger } from '../services/logger';

export function createAuthMiddleware(userRepository: IUserRepository) {
  return {
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

        // Load user from repository
        const user = await userRepository.findById(userId);
        if (!user) {
          // Session exists but user doesn't - invalid session
          req.session.destroy(() => {
            /* ignore */
          });

          return res.status(401).json({
            status: 'error',
            message: 'Authentication required',
          });
        }

        // Attach user to request
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

    optionalAuth: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.session?.userId;

        if (userId) {
          // Try to load user
          const user = await userRepository.findById(userId);
          if (user) {
            req.user = user;
          } else {
            // Session exists but user doesn't - clean up session
            req.session.destroy(() => {
              /* ignore */
            });
          }
        }

        next();
      } catch (error) {
        Logger.logError('Error in optional auth middleware', { error });
        // Don't fail the request, just continue without user
        next();
      }
    },
  };
}
