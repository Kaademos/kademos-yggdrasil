/**
 * Config Unit Tests
 * 
 * Tests configuration loading from environment variables.
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

  it('should load default configuration', () => {
    const config = loadConfig();
    
    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe('development');
    expect(config.realmName).toBe('template');
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
});
