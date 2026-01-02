/**
 * Jotunheim Configuration Module
 * 
 * Centralizes all environment-based configuration.
 * This pattern supports dependency injection and testability.
 */

export interface RealmConfig {
  port: number;
  flag: string;
  realmName: string;
  nodeEnv: string;
  sessionSecret: string;
}

export function loadConfig(): RealmConfig {
  const port = parseInt(process.env.PORT || '3000', 10);
  const flag = process.env.FLAG || 'YGGDRASIL{JOTUNHEIM:00000000-0000-0000-0000-000000000000}';
  const realmName = process.env.REALM_NAME || 'jotunheim';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const sessionSecret = process.env.SESSION_SECRET || 'dev-jotunheim-secret-change-in-prod';

  // Validate port range
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT configuration: ${process.env.PORT}`);
  }

  // Validate flag format
  if (!flag.match(/^YGGDRASIL\{[A-Z]+:[a-f0-9-]+\}$/i)) {
    console.warn(`Warning: FLAG does not match expected format: ${flag}`);
  }

  // Warn about weak session secret
  if (sessionSecret.length < 32) {
    console.warn('[Jotunheim] Warning: SESSION_SECRET is weak. Use a strong secret in production!');
  }

  return {
    port,
    flag,
    realmName,
    nodeEnv,
    sessionSecret,
  };
}
