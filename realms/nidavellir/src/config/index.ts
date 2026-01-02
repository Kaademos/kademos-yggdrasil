/**
 * Nidavellir Configuration Module
 * 
 * Centralizes all environment-based configuration.
 * This pattern supports dependency injection and testability.
 */

export interface RealmConfig {
  port: number;
  flag: string;
  realmName: string;
  nodeEnv: string;
  databaseUrl: string;
}

export function loadConfig(): RealmConfig {
  const port = parseInt(process.env.PORT || '3000', 10);
  const flag = process.env.FLAG || 'YGGDRASIL{NIDAVELLIR:00000000-0000-0000-0000-000000000000}';
  const realmName = process.env.REALM_NAME || 'nidavellir';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/nidavellir';

  // Validate port range
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT configuration: ${process.env.PORT}`);
  }

  // Validate flag format
  if (!flag.match(/^YGGDRASIL\{[A-Z]+:[a-f0-9-]+\}$/i)) {
    console.warn(`Warning: FLAG does not match expected format: ${flag}`);
  }

  // Warn if database URL looks like default
  if (databaseUrl.includes('localhost')) {
    console.warn('[Nidavellir] Warning: DATABASE_URL points to localhost - ensure database is accessible');
  }

  return {
    port,
    flag,
    realmName,
    nodeEnv,
    databaseUrl,
  };
}
