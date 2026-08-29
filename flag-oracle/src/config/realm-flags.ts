import type { FlagData } from '../repositories/flag-repository';
import { REALM_ORDER } from './realm-order';

/**
 * Environment variable carrying a realm's flag. The sample realm predates the
 * `<REALM>_FLAG` convention and keeps its original name.
 */
export function flagEnvKey(realmName: string): string {
  return realmName === 'SAMPLE' ? 'SAMPLE_REALM_FLAG' : `${realmName}_FLAG`;
}

export interface RealmFlagLoadResult {
  flags: FlagData[];
  /** Env keys for realms in REALM_ORDER that have no flag configured. */
  missing: string[];
}

/**
 * Build the valid-flag set from the environment, ordered by the canonical realm
 * progression so `nextRealm` always matches REALM_ORDER.
 *
 * Flags are deployment secrets: they are generated per install by `make setup`
 * and must never be committed. This module is the single source of truth for
 * which flags the Oracle will accept — there are deliberately no defaults, so a
 * deployment that forgets to configure a realm fails closed (that realm's flag
 * is simply never valid) rather than silently accepting a public value.
 */
export function loadRealmFlags(env: NodeJS.ProcessEnv = process.env): RealmFlagLoadResult {
  const flags: FlagData[] = [];
  const missing: string[] = [];

  for (const realm of REALM_ORDER) {
    const key = flagEnvKey(realm.name);
    const value = env[key]?.trim();

    if (!value) {
      missing.push(key);
      continue;
    }

    flags.push({
      realm: realm.name,
      flag: value,
      ...(realm.nextRealm ? { nextRealm: realm.nextRealm } : {}),
    });
  }

  return { flags, missing };
}
