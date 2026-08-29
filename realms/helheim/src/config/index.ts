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
  /** Basic-auth credential for the SOC console, leaked by Niflheim's crash report. */
  adminCredential: string;
  /** Upstream realm whose incident is buried in the archive. */
  correlatedRealm: string;
}

export function loadConfig(): RealmConfig {
  const port = parseInt(process.env.PORT || '3000', 10);
  const flag = process.env.FLAG;
  const realmName = process.env.REALM_NAME || 'helheim';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const adminCredential = process.env.ADMIN_CREDENTIAL || 'admin:IceBound2025';
  const correlatedRealm = process.env.CORRELATED_REALM || 'niflheim';

  // Validate port range
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT configuration: ${process.env.PORT}`);
  }

  if (!flag) {
    throw new Error(
      'FLAG is not set. Realms refuse to start without an explicitly configured flag so that ' +
        'no deployment ever runs on a value published in the repository. ' +
        'Run `make setup` to generate a flag for every realm.'
    );
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
    adminCredential,
    correlatedRealm,
  };
}
