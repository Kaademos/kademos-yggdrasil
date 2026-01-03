/**
 * Niflheim Config Unit Tests
 */

import { loadConfig } from '../../src/config';

describe('Niflheim Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load default Niflheim configuration', () => {
      // NODE_ENV defaults to 'test' during jest runs
      const config = loadConfig();
      
      expect(config.port).toBe(3000);
      expect(['development', 'test']).toContain(config.nodeEnv);
      expect(config.realmName).toBe('niflheim');
      expect(config.flag).toContain('YGGDRASIL{NIFLHEIM:');
    });

    it('should load custom port from environment', () => {
      process.env.PORT = '8080';
      
      const config = loadConfig();
      
      expect(config.port).toBe(8080);
    });

    it('should load custom flag from environment', () => {
      const testFlag = 'YGGDRASIL{NIFLHEIM:12345678-1234-1234-1234-123456789abc}';
      process.env.FLAG = testFlag;
      
      const config = loadConfig();
      
      expect(config.flag).toBe(testFlag);
    });

    it('should load custom realm name', () => {
      process.env.REALM_NAME = 'test-niflheim';
      
      const config = loadConfig();
      
      expect(config.realmName).toBe('test-niflheim');
    });

    it('should throw error for invalid port', () => {
      process.env.PORT = 'invalid';
      
      expect(() => loadConfig()).toThrow('Invalid PORT configuration');
    });

    it('should throw error for port out of range (too high)', () => {
      process.env.PORT = '70000';
      
      expect(() => loadConfig()).toThrow('Invalid PORT configuration');
    });

    it('should throw error for port out of range (too low)', () => {
      process.env.PORT = '-1';
      
      expect(() => loadConfig()).toThrow('Invalid PORT configuration');
    });

    it('should accept valid port at lower boundary', () => {
      process.env.PORT = '1';
      
      const config = loadConfig();
      
      expect(config.port).toBe(1);
    });

    it('should accept valid port at upper boundary', () => {
      process.env.PORT = '65535';
      
      const config = loadConfig();
      
      expect(config.port).toBe(65535);
    });
  });
});
