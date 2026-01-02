export interface Config {
  port: number;
  dataPath: string;
  nodeEnv: string;
  redisUrl?: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  flagMasterSecret: string;
}

export function loadConfig(): Config {
  const port = parseInt(process.env.PORT || '3001', 10);
  const dataPath = process.env.DATA_PATH || './data';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const redisUrl = process.env.REDIS_URL;
  const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
  const rateLimitMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('Invalid PORT configuration');
  }

  if (isNaN(rateLimitWindowMs) || rateLimitWindowMs < 0) {
    throw new Error('Invalid RATE_LIMIT_WINDOW_MS configuration');
  }

  if (isNaN(rateLimitMaxRequests) || rateLimitMaxRequests < 1) {
    throw new Error('Invalid RATE_LIMIT_MAX_REQUESTS configuration');
  }

  const flagMasterSecret = process.env.FLAG_MASTER_SECRET || '';

  return {
    port,
    dataPath,
    nodeEnv,
    redisUrl,
    rateLimitWindowMs,
    rateLimitMaxRequests,
    flagMasterSecret,
  };
}
