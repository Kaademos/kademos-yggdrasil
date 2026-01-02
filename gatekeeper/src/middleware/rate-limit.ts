import { Request, Response, NextFunction } from 'express';
import { AuthRateLimiter } from '../services/auth-rate-limiter';
import { Logger } from '../services/logger';

export function createRateLimitMiddleware(rateLimiter: AuthRateLimiter) {
  return (keyPrefix: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || 'unknown';
      const key = `${keyPrefix}:${ip}`;

      const result = rateLimiter.checkLimit(key);

      if (!result.allowed) {
        Logger.logRateLimitExceeded(ip, req.path, result.retryAfter!);

        res.setHeader('Retry-After', result.retryAfter!.toString());
        return res.status(429).json({
          status: 'error',
          message: 'Too many requests. Please try again later.',
          retryAfter: result.retryAfter,
        });
      }

      next();
    };
  };
}
