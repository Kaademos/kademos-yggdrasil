import { Request, Response, NextFunction } from 'express';
import { logger, sanitizeForLogging } from '../utils/logger';

interface RequestLog {
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  userId?: string;
  query?: any;
  body?: any;
}

interface ResponseLog {
  statusCode: number;
  responseTime: number;
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  const requestLog: RequestLog = {
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
  };

  if (req.session?.userId) {
    requestLog.userId = req.session.userId;
  }

  if (Object.keys(req.query).length > 0) {
    requestLog.query = sanitizeForLogging(req.query);
  }

  if (req.body && Object.keys(req.body).length > 0) {
    requestLog.body = sanitizeForLogging(req.body);
  }

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const responseLog: ResponseLog = {
      statusCode: res.statusCode,
      responseTime,
    };

    const logData = { ...requestLog, ...responseLog };

    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
};

export const securityEventLogger = {
  loginSuccess: (userId: string, ip: string) => {
    logger.info('Login successful', {
      event: 'login_success',
      userId,
      ip,
    });
  },

  loginFailure: (username: string, ip: string, reason: string) => {
    logger.warn('Login failed', {
      event: 'login_failure',
      username,
      ip,
      reason,
    });
  },

  logout: (userId: string, ip: string) => {
    logger.info('User logged out', {
      event: 'logout',
      userId,
      ip,
    });
  },

  flagSubmission: (userId: string, flag: string, result: string, unlockedRealm?: string) => {
    logger.info('Flag submission', {
      event: 'flag_submission',
      userId,
      flag: flag.substring(0, 20) + '...',
      result,
      unlockedRealm,
    });
  },

  forbiddenAccess: (
    userId: string | undefined,
    realm: string,
    userLevel: number,
    requiredLevel: number
  ) => {
    logger.warn('Forbidden realm access attempt', {
      event: 'forbidden_access',
      userId: userId || 'anonymous',
      realm,
      userLevel,
      requiredLevel,
    });
  },

  rateLimitHit: (ip: string, endpoint: string) => {
    logger.warn('Rate limit exceeded', {
      event: 'rate_limit_hit',
      ip,
      endpoint,
    });
  },

  sessionCreated: (userId: string, ip: string) => {
    logger.info('Session created', {
      event: 'session_created',
      userId,
      ip,
    });
  },

  sessionDestroyed: (userId: string) => {
    logger.info('Session destroyed', {
      event: 'session_destroyed',
      userId,
    });
  },
};
