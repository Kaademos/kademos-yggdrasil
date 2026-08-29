/**
 * Config Unit Tests
 * 
 * Tests configuration loading from environment variables.
 */

import { loadConfig } from '../../src/config';

const TEST_FLAG = 'YGGDRASIL{NIDAVELLIR:11111111-1111-4111-8111-111111111111}';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Realms fail closed without a flag, so every case supplies one explicitly.
    process.env.FLAG = TEST_FLAG;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load default configuration', () => {
    const config = loadConfig();
    
    expect(config.port).toBe(3000);
    expect(['development', 'test']).toContain(config.nodeEnv);
    expect(config.realmName).toBe('nidavellir');
    expect(config.flag).toContain('YGGDRASIL{');
  });

  it('should load custom port from environment', () => {
    process.env.PORT = '8080';
    
    const config = loadConfig();
    
    expect(config.port).toBe(8080);
  });

  it('should load custom flag from environment', () => {
    const testFlag = 'YGGDRASIL{TEST:12345678-1234-1234-1234-123456789abc}';
    process.env.FLAG = testFlag;
    
    const config = loadConfig();
    
    expect(config.flag).toBe(testFlag);
  });

  it('should throw error for invalid port', () => {
    process.env.PORT = 'invalid';
    
    expect(() => loadConfig()).toThrow('Invalid PORT configuration');
  });

  it('should throw error for port out of range', () => {
    process.env.PORT = '70000';
    
    expect(() => loadConfig()).toThrow('Invalid PORT configuration');
  });

  it('should load custom realm name', () => {
    process.env.REALM_NAME = 'test-realm';
    
    const config = loadConfig();
    
    expect(config.realmName).toBe('test-realm');
  });
  describe('flag is required', () => {
    it('should throw when FLAG is not set', () => {
      delete process.env.FLAG;

      expect(() => loadConfig()).toThrow('FLAG is not set');
    });

    it('should throw when FLAG is empty', () => {
      process.env.FLAG = '';

      expect(() => loadConfig()).toThrow('FLAG is not set');
    });
  });
});
