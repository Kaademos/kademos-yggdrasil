/**
 * Realm Configuration Module
 * 
 * Centralizes all environment-based configuration.
 * This pattern supports dependency injection and testability.
 */

export interface RealmConfig {
  port: number;
  flag: string;
  realmName: string;
  nodeEnv: string;
}

export function loadConfig(): RealmConfig {
  const port = parseInt(process.env.PORT || '3000', 10);
  const flag = process.env.FLAG || 'YGGDRASIL{REALM:00000000-0000-0000-0000-000000000000}';
  const realmName = process.env.REALM_NAME || 'template';
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Validate port range
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT configuration: ${process.env.PORT}`);
  }

  // Validate flag format
  if (!flag.match(/^YGGDRASIL\{[A-Z]+:[a-f0-9-]+\}$/i)) {
    console.warn(`Warning: FLAG does not match expected format: ${flag}`);
  }

  return {
    port,
    flag,
    realmName,
    nodeEnv,
  };
}
