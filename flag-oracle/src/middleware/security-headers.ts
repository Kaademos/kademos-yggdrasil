import { Request, Response, NextFunction } from 'express';

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "object-src 'none'; base-uri 'none'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}
