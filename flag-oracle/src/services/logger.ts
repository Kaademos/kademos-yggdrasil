import { logger as winstonLogger, sanitizeForLogging } from '../utils/logger';

export class Logger {
  private extractRealm(flag: string): string {
    const match = flag.match(/YGGDRASIL\{([A-Z_]+):/i);
    return match ? match[1].toUpperCase() : 'UNKNOWN';
  }

  logValidationAttempt(userId: string, flag: string, success: boolean, ip: string): void {
    const logEntry = {
      event: 'flag_validation',
      userId,
      realm: this.extractRealm(flag),
      success,
      ip,
    };

    if (success) {
      winstonLogger.info('Flag validation successful', logEntry);
    } else {
      winstonLogger.warn('Flag validation failed', logEntry);
    }

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        ...logEntry,
      })
    );
  }

  logRateLimitExceeded(ip: string, path: string): void {
    const logEntry = {
      event: 'rate_limit_exceeded',
      ip,
      path,
      severity: 'warning',
    };

    winstonLogger.warn('Rate limit exceeded', logEntry);
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        ...logEntry,
      })
    );
  }

  logProgressionUpdate(userId: string, realm: string): void {
    const logEntry = {
      event: 'progression_update',
      userId,
      realm,
    };

    winstonLogger.info('Progression updated', logEntry);
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        ...logEntry,
      })
    );
  }

  logError(error: Error, context?: Record<string, unknown>): void {
    const sanitizedContext = sanitizeForLogging(context || {});
    winstonLogger.error(error.message, {
      stack: error.stack,
      ...sanitizedContext,
    });

    const logEntry = {
      timestamp: new Date().toISOString(),
      event: 'error',
      message: error.message,
      stack: error.stack,
      severity: 'error',
      ...context,
    };
    console.error(JSON.stringify(logEntry));
  }

  logInfo(message: string, context?: Record<string, unknown>): void {
    winstonLogger.info(message, context);

    const logEntry = {
      timestamp: new Date().toISOString(),
      event: 'info',
      message,
      ...context,
    };
    console.log(JSON.stringify(logEntry));
  }
}
