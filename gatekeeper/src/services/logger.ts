import { logger as winstonLogger, sanitizeForLogging } from '../utils/logger';

export interface LogContext {
  [key: string]: unknown;
}

export class Logger {
  private static formatLog(event: string, context: LogContext): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      ...context,
    });
  }

  static logLoginAttempt(username: string, success: boolean, ip: string): void {
    const context = {
      event: 'login_attempt',
      username,
      success,
      ip,
    };

    if (success) {
      winstonLogger.info('Login successful', context);
    } else {
      winstonLogger.warn('Login failed', context);
    }

    console.log(this.formatLog('login_attempt', context));
  }

  static logLogout(userId: string, sessionId: string): void {
    const context = {
      event: 'logout',
      userId,
      sessionId: sessionId.substring(0, 8) + '...',
    };

    winstonLogger.info('User logged out', context);
    console.log(this.formatLog('logout', { userId, sessionId }));
  }

  static logRateLimitExceeded(ip: string, path: string, retryAfter: number): void {
    const context = {
      event: 'rate_limit_exceeded',
      ip,
      path,
      retryAfter,
      severity: 'warning',
    };

    winstonLogger.warn('Rate limit exceeded', context);
    console.log(this.formatLog('rate_limit_exceeded', context));
  }

  static logAccessDenied(userId: string, realmName: string, ip: string): void {
    const context = {
      event: 'access_denied',
      userId,
      realmName,
      ip,
      severity: 'warning',
    };

    winstonLogger.warn('Access denied to realm', context);
    console.log(this.formatLog('access_denied', context));
  }

  static logError(message: string, context: LogContext = {}): void {
    const sanitizedContext = sanitizeForLogging(context);
    winstonLogger.error(message, {
      ...sanitizedContext,
      severity: 'error',
    });
    console.error(
      this.formatLog('error', {
        message,
        ...context,
        severity: 'error',
      })
    );
  }

  static logInfo(message: string, context: LogContext = {}): void {
    winstonLogger.info(message, context);
    console.info(
      this.formatLog('info', {
        message,
        ...context,
      })
    );
  }
}
