import { Request, Response, NextFunction } from 'express';
import { RateLimiter } from '../services/rate-limiter';
import { Logger } from '../services/logger';

export function createRateLimitMiddleware(rateLimiter: RateLimiter, logger?: Logger) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown';
    const key = `${ip}:${req.path}`;
    const result = await rateLimiter.checkLimit(key);

    if (!result.allowed) {
      if (logger) {
        logger.logRateLimitExceeded(ip, req.path);
      }

      res.status(429).json({
        status: 'error',
        message: 'Too many requests',
        retryAfter: result.retryAfter,
      });
      return;
    }

    next();
  };
}
