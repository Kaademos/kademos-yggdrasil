import { loadRealmFlags, flagEnvKey } from '../src/config/realm-flags';
import { REALM_ORDER } from '../src/config/realm-order';

describe('realm flags', () => {
  const fullEnv = (): NodeJS.ProcessEnv => {
    const env: NodeJS.ProcessEnv = {};
    for (const realm of REALM_ORDER) {
      env[flagEnvKey(realm.name)] = `YGGDRASIL{${realm.name}:11111111-1111-4111-8111-111111111111}`;
    }
    return env;
  };

  describe('flagEnvKey', () => {
    it('uses the <REALM>_FLAG convention', () => {
      expect(flagEnvKey('NIFLHEIM')).toBe('NIFLHEIM_FLAG');
    });

    it('keeps the sample realm on its original variable name', () => {
      expect(flagEnvKey('SAMPLE')).toBe('SAMPLE_REALM_FLAG');
    });
  });

  describe('loadRealmFlags', () => {
    it('loads a flag for every realm in the progression', () => {
      const { flags, missing } = loadRealmFlags(fullEnv());

      expect(flags).toHaveLength(REALM_ORDER.length);
      expect(missing).toEqual([]);
    });

    it('carries the nextRealm chain from REALM_ORDER', () => {
      const { flags } = loadRealmFlags(fullEnv());

      const niflheim = flags.find((f) => f.realm === 'NIFLHEIM');
      expect(niflheim?.nextRealm).toBe('HELHEIM');
    });

    it('leaves nextRealm unset for the final realm', () => {
      const { flags } = loadRealmFlags(fullEnv());

      const asgard = flags.find((f) => f.realm === 'ASGARD');
      expect(asgard).toBeDefined();
      expect(asgard?.nextRealm).toBeUndefined();
    });

    // The point of env-sourced flags: an unconfigured realm has no valid flag at
    // all, rather than falling back to a value published in the repository.
    it('reports an unconfigured realm as missing rather than defaulting it', () => {
      const env = fullEnv();
      delete env.NIFLHEIM_FLAG;

      const { flags, missing } = loadRealmFlags(env);

      expect(missing).toContain('NIFLHEIM_FLAG');
      expect(flags.find((f) => f.realm === 'NIFLHEIM')).toBeUndefined();
    });

    it('treats an empty or whitespace-only flag as unconfigured', () => {
      const env = fullEnv();
      env.HELHEIM_FLAG = '';
      env.MIDGARD_FLAG = '   ';

      const { flags, missing } = loadRealmFlags(env);

      expect(missing).toEqual(expect.arrayContaining(['HELHEIM_FLAG', 'MIDGARD_FLAG']));
      expect(flags.find((f) => f.realm === 'HELHEIM')).toBeUndefined();
      expect(flags.find((f) => f.realm === 'MIDGARD')).toBeUndefined();
    });

    it('returns nothing when the environment is empty', () => {
      const { flags, missing } = loadRealmFlags({});

      expect(flags).toEqual([]);
      expect(missing).toHaveLength(REALM_ORDER.length);
    });

    it('ships no flag values of its own', () => {
      const { flags } = loadRealmFlags({ NIFLHEIM_FLAG: 'YGGDRASIL{NIFLHEIM:abc}' });

      expect(flags).toEqual([{ realm: 'NIFLHEIM', flag: 'YGGDRASIL{NIFLHEIM:abc}', nextRealm: 'HELHEIM' }]);
    });
  });
});
