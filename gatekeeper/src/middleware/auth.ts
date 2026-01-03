import { Request, Response, NextFunction } from 'express';
import { IUserRepository } from '../repositories/user-repository';
import { Logger } from '../services/logger';

export function createAuthMiddleware(userRepository: IUserRepository) {
  return {
    // Require admin authentication (for enterprise/observability features)
    requireAdmin: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.session?.userId;

        if (!userId) {
          Logger.logInfo('Unauthorized admin access attempt', {
            path: req.path,
            ip: req.ip || 'unknown',
          });

          return res.status(401).json({
            status: 'error',
            message: 'Admin authentication required',
          });
        }

        const user = await userRepository.findById(userId);
        if (!user) {
          req.session.destroy(() => {});
          return res.status(401).json({
            status: 'error',
            message: 'Admin authentication required',
          });
        }

        req.user = user;
        next();
      } catch (error) {
        Logger.logError('Error in admin auth middleware', { error });
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
        });
      }
    },

    // Keep requireAuth for backward compatibility but it now just ensures session exists
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

    // Ensure session exists for anonymous users (creates one if needed)
    ensureSession: async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Session is automatically created by express-session
        // Just ensure we have a session ID to track progression
        if (!req.session) {
          return res.status(500).json({
            status: 'error',
            message: 'Session initialization failed',
          });
        }

        // If user is logged in, attach user object
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

    optionalAuth: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.session?.userId;

        if (userId) {
          const user = await userRepository.findById(userId);
          if (user) {
            req.user = user;
          } else {
            req.session.destroy(() => {});
          }
        }

        next();
      } catch (error) {
        Logger.logError('Error in optional auth middleware', { error });
        next();
      }
    },
  };
}
