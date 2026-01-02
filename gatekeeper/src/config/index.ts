import { RealmMetadata, REALMS_METADATA } from './realms-metadata';
import { randomBytes } from 'crypto';

export interface RealmConfig {
  name: string;
  internalUrl: string;
  order: number;
  displayName: string;
  description: string;
}

// Re-export for convenience
export { RealmMetadata, REALMS_METADATA };

export interface Config {
  port: number;
  flagOracleUrl: string;
  nodeEnv: string;
  realms: RealmConfig[];
  sessionSecret: string;
  sessionMaxAge: number;
  bcryptRounds: number;
  authRateLimitWindowMs: number;
  authRateLimitMaxRequests: number;
  allowedOrigin?: string;
  testUserPassword: string;
}

export function loadConfig(): Config {
  const port = parseInt(process.env.PORT || '8080', 10);
  const flagOracleUrl = process.env.FLAG_ORACLE_URL || 'http://flag-oracle:3001';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const sessionSecret = process.env.SESSION_SECRET || generateDefaultSecret();
  const sessionMaxAge = parseInt(process.env.SESSION_MAX_AGE_MS || '3600000', 10);
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
  const authRateLimitWindowMs = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '300000', 10);
  const authRateLimitMaxRequests = parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '5', 10);
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const testUserPassword = process.env.TEST_USER_PASSWORD || 'yggdrasil123';

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('Invalid PORT configuration');
  }

  if (!sessionSecret || sessionSecret.length < 32) {
    console.warn(
      '[Config] WARNING: Using default or weak SESSION_SECRET. Generate a strong secret for production!'
    );
  }

  // Load realm configuration from shared metadata
  const realms: RealmConfig[] = REALMS_METADATA.map((r) => ({
    name: r.name,
    internalUrl: r.internalUrl,
    order: r.order,
    displayName: r.displayName,
    description: r.description,
  }));

  return {
    port,
    flagOracleUrl,
    nodeEnv,
    realms,
    sessionSecret,
    sessionMaxAge,
    bcryptRounds,
    authRateLimitWindowMs,
    authRateLimitMaxRequests,
    allowedOrigin,
    testUserPassword,
  };
}

function generateDefaultSecret(): string {
  const secretBytes = randomBytes(32).toString('hex');
  console.warn(
    '[Config] Generated random SESSION_SECRET. This will invalidate sessions on restart!'
  );
  return secretBytes;
}
