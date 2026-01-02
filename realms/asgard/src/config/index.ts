export interface RealmConfig {
  port: number;
  flag: string;
  realmName: string;
  nodeEnv: string;
  databaseUrl: string;
}

export function loadConfig(): RealmConfig {
  const port = parseInt(process.env.PORT || '3000', 10);
  const flag = process.env.FLAG || 'YGGDRASIL{ASGARD:00000000-0000-0000-0000-000000000000}';
  const realmName = process.env.REALM_NAME || 'asgard';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://hr_admin:password@asgard-db:5432/asgard';

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT configuration: ${process.env.PORT}`);
  }

  if (!flag.match(/^YGGDRASIL\{[A-Z]+:[a-f0-9-]+\}$/i)) {
    console.warn(`Warning: FLAG does not match expected format: ${flag}`);
  }

  return {
    port,
    flag,
    realmName,
    nodeEnv,
    databaseUrl,
  };
}
