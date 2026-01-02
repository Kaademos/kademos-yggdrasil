import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load default configuration', () => {
    const config = loadConfig();

    expect(config.port).toBe(8080);
    expect(config.flagOracleUrl).toBe('http://flag-oracle:3001');
    expect(config.nodeEnv).toBeTruthy(); // Will be 'test' or 'development' depending on environment
    
    // After M7: All realms loaded from shared metadata (10 production + 1 sample)
    expect(config.realms).toHaveLength(11);
    
    // Verify sample realm exists
    const sampleRealm = config.realms.find(r => r.name === 'sample');
    expect(sampleRealm).toBeDefined();
    expect(sampleRealm?.order).toBe(11);
    expect(sampleRealm?.displayName).toBe('Sample Realm');
    expect(sampleRealm?.description).toBeTruthy();
    
    // Verify entry realm (Niflheim) exists
    const niflheim = config.realms.find(r => r.name === 'niflheim');
    expect(niflheim).toBeDefined();
    expect(niflheim?.order).toBe(10);
    expect(niflheim?.displayName).toBe('Niflheim');
    
    // Verify final realm (Asgard) exists
    const asgard = config.realms.find(r => r.name === 'asgard');
    expect(asgard).toBeDefined();
    expect(asgard?.order).toBe(1);
    expect(asgard?.displayName).toBe('Asgard');
    
    expect(config.sessionSecret).toBeTruthy();
    expect(config.sessionMaxAge).toBe(3600000);
    expect(config.bcryptRounds).toBe(10);
    expect(config.authRateLimitWindowMs).toBe(300000);
    expect(config.authRateLimitMaxRequests).toBe(5);
  });

  it('should load configuration from environment variables', () => {
    process.env.PORT = '9000';
    process.env.FLAG_ORACLE_URL = 'http://custom-oracle:4000';
    process.env.NODE_ENV = 'production';

    const config = loadConfig();

    expect(config.port).toBe(9000);
    expect(config.flagOracleUrl).toBe('http://custom-oracle:4000');
    expect(config.nodeEnv).toBe('production');
  });

  it('should throw error for invalid port', () => {
    process.env.PORT = 'invalid';

    expect(() => loadConfig()).toThrow('Invalid PORT configuration');
  });

  it('should throw error for port out of range', () => {
    process.env.PORT = '99999';

    expect(() => loadConfig()).toThrow('Invalid PORT configuration');
  });
});
