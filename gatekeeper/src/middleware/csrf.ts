import csrf from 'csurf';
import { Request, Response, NextFunction } from 'express';

// Note: csurf is deprecated but still functional for M2
// Future: Replace with alternative CSRF solution (e.g., custom tokens, double-submit cookies)

export const csrfProtection = csrf({
  cookie: false, // Use session-based tokens
});

export function csrfTokenHandler(req: Request, res: Response) {
  if (!req.csrfToken) {
    return res.status(500).json({
      status: 'error',
      message: 'CSRF token generation failed',
    });
  }

  res.json({
    csrfToken: req.csrfToken(),
  });
}

export function csrfErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      status: 'error',
      message: 'Invalid CSRF token',
    });
  }
  next(err);
}
