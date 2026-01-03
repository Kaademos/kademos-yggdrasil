/**
 * Configuration Unit Tests
 */

import { loadConfig } from '../../src/config';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load default configuration', () => {
      const config = loadConfig();
      
      expect(config.port).toBe(3000);
      expect(config.realmName).toBe('jotunheim');
      expect(['development', 'test']).toContain(config.nodeEnv);
      expect(config.flag).toContain('YGGDRASIL{');
      expect(config.sessionSecret).toBeDefined();
    });

    it('should parse custom port from environment', () => {
      process.env.PORT = '8080';
      const config = loadConfig();
      
      expect(config.port).toBe(8080);
    });

    it('should throw error on invalid port', () => {
      process.env.PORT = 'invalid';
      
      expect(() => loadConfig()).toThrow('Invalid PORT configuration');
    });

    it('should throw error on out of range port', () => {
      process.env.PORT = '70000';
      
      expect(() => loadConfig()).toThrow('Invalid PORT configuration');
    });

    it('should load custom flag from environment', () => {
      const customFlag = 'YGGDRASIL{JOTUNHEIM:test-flag-uuid}';
      process.env.FLAG = customFlag;
      
      const config = loadConfig();
      expect(config.flag).toBe(customFlag);
    });

    it('should load custom session secret from environment', () => {
      const customSecret = 'my-super-secret-session-key-12345678';
      process.env.SESSION_SECRET = customSecret;
      
      const config = loadConfig();
      expect(config.sessionSecret).toBe(customSecret);
    });

    it('should warn on invalid flag format', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      process.env.FLAG = 'invalid-flag-format';
      
      loadConfig();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('does not match expected format')
      );
      
      consoleWarnSpy.mockRestore();
    });

    it('should warn on weak session secret', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      process.env.SESSION_SECRET = 'short';
      
      loadConfig();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SESSION_SECRET is weak')
      );
      
      consoleWarnSpy.mockRestore();
    });
  });
});
