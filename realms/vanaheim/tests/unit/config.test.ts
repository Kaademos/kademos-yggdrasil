/**
 * Config Unit Tests
 */

import { loadConfig } from '../../src/config';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load default config when no env vars set', () => {
    delete process.env.PORT;
    delete process.env.FLAG;
    delete process.env.REALM_NAME;
    delete process.env.NODE_ENV;
    delete process.env.TOKEN_SEED_MULTIPLIER;
    delete process.env.MAX_TOKEN_HISTORY;

    const config = loadConfig();

    expect(config.port).toBe(3000);
    expect(config.realmName).toBe('vanaheim');
    expect(config.nodeEnv).toBe('development');
    expect(config.tokenSeedMultiplier).toBe(1000);
    expect(config.maxTokenHistory).toBe(50);
  });

  it('should load config from environment variables', () => {
    process.env.PORT = '4000';
    process.env.FLAG = 'YGGDRASIL{VANAHEIM:test-uuid}';
    process.env.REALM_NAME = 'test-realm';
    process.env.NODE_ENV = 'production';
    process.env.TOKEN_SEED_MULTIPLIER = '2000';
    process.env.MAX_TOKEN_HISTORY = '100';

    const config = loadConfig();

    expect(config.port).toBe(4000);
    expect(config.flag).toBe('YGGDRASIL{VANAHEIM:test-uuid}');
    expect(config.realmName).toBe('test-realm');
    expect(config.nodeEnv).toBe('production');
    expect(config.tokenSeedMultiplier).toBe(2000);
    expect(config.maxTokenHistory).toBe(100);
  });

  it('should throw error for invalid port', () => {
    process.env.PORT = 'invalid';
    expect(() => loadConfig()).toThrow('Invalid PORT configuration');
  });

  it('should throw error for out-of-range port', () => {
    process.env.PORT = '70000';
    expect(() => loadConfig()).toThrow('Invalid PORT configuration');
  });
});
