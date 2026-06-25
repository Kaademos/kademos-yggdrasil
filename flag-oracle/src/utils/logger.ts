import winston from 'winston';

const { NODE_ENV = 'development', LOKI_URL = 'http://loki:3100' } = process.env;

const isDevelopment = NODE_ENV === 'development';

// Loki shipping is opt-in (observability stack). When disabled — the default —
// `winston-loki` is never loaded, so it doesn't add to startup cost.
const observabilityEnabled = process.env.OBSERVABILITY_ENABLED === 'true';

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
  })
);

const jsonFormat = winston.format.combine(winston.format.timestamp(), winston.format.json());

export const createLogger = (service: string) => {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: isDevelopment ? consoleFormat : jsonFormat,
      level: isDevelopment ? 'debug' : 'info',
    }),
  ];

  if (observabilityEnabled) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const LokiTransport = require('winston-loki');
    transports.push(
      new LokiTransport({
        host: LOKI_URL,
        labels: { service, environment: NODE_ENV },
        json: true,
        format: jsonFormat,
        replaceTimestamp: true,
        onConnectionError: (err: Error) => {
          console.error('Loki connection error:', err);
        },
      })
    );
  }

  return winston.createLogger({
    level: isDevelopment ? 'debug' : 'info',
    defaultMeta: { service, environment: NODE_ENV },
    transports,
  });
};

export const logger = createLogger('flag-oracle');

export const sanitizeForLogging = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'authorization', 'cookie', 'sessionId'];
  const sanitized = { ...data };

  for (const key in sanitized) {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }

  return sanitized;
};
