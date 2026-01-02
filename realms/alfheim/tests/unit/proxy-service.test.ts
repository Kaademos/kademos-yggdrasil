/**
 * Unit tests for ProxyService
 */

import { ProxyService } from '../../src/services/proxy-service';

describe('ProxyService', () => {
  let proxyService: ProxyService;

  beforeEach(() => {
    proxyService = new ProxyService();
  });

  describe('URL Testing', () => {
    it('should block localhost URLs', () => {
      const blockedUrls = [
        'http://localhost/api',
        'http://localhost:8080/test',
        'https://localhost/secure',
      ];

      blockedUrls.forEach(url => {
        expect(proxyService.testUrl(url)).toBe(true);
      });
    });

    it('should block 127.0.0.1 URLs', () => {
      const blockedUrls = [
        'http://127.0.0.1/api',
        'http://127.0.0.1:3000/test',
        'https://127.0.0.1/secure',
      ];

      blockedUrls.forEach(url => {
        expect(proxyService.testUrl(url)).toBe(true);
      });
    });

    it('should block metadata service IP', () => {
      const blockedUrls = [
        'http://169.254.169.254/latest/meta-data',
        'http://169.254.169.254:80/api',
      ];

      blockedUrls.forEach(url => {
        expect(proxyService.testUrl(url)).toBe(true);
      });
    });

    it('should block private IP ranges', () => {
      const blockedUrls = [
        'http://10.0.0.1/api',
        'http://172.16.0.1/test',
        'http://192.168.1.1/admin',
      ];

      blockedUrls.forEach(url => {
        expect(proxyService.testUrl(url)).toBe(true);
      });
    });

    it('should allow public URLs', () => {
      const allowedUrls = [
        'http://example.com/api',
        'https://www.google.com',
        'http://8.8.8.8/test',
      ];

      allowedUrls.forEach(url => {
        expect(proxyService.testUrl(url)).toBe(false);
      });
    });
  });

  describe('Bypass Techniques', () => {
    it('should provide bypass hints', () => {
      const hints = proxyService.getBypassHints();

      expect(typeof hints).toBe('object');
      expect(Object.keys(hints).length).toBeGreaterThan(0);
      
      const keys = Object.keys(hints);
      expect(keys).toContain('IPv6 notation');
      expect(keys).toContain('Hex encoding');
      expect(keys).toContain('Octal encoding');
    });

    it('should document multiple bypass techniques', () => {
      const hints = proxyService.getBypassHints();

      expect(Object.keys(hints).length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Blocklist', () => {
    it('should return blocklist patterns', () => {
      const blocklist = proxyService.getBlocklist();

      expect(Array.isArray(blocklist)).toBe(true);
      expect(blocklist.length).toBeGreaterThan(0);
      expect(blocklist).toContain('localhost');
      expect(blocklist).toContain('127.0.0.1');
      expect(blocklist).toContain('169.254.169.254');
    });

    it('should include private IP ranges', () => {
      const blocklist = proxyService.getBlocklist();

      expect(blocklist.some(b => b.includes('10.'))).toBe(true);
      expect(blocklist.some(b => b.includes('172.16'))).toBe(true);
      expect(blocklist.some(b => b.includes('192.168'))).toBe(true);
    });
  });

  describe('URL Fetching', () => {
    it('should reject blocked URLs', async () => {
      const result = await proxyService.fetchUrl({
        url: 'http://localhost/api',
        method: 'GET',
        headers: {},
        timeout: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('restricted');
    });

    it('should handle invalid URLs', async () => {
      const result = await proxyService.fetchUrl({
        url: 'not-a-valid-url',
        method: 'GET',
        headers: {},
        timeout: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should support different HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE'];

      for (const method of methods) {
        const result = await proxyService.fetchUrl({
          url: 'http://httpbin.org/status/200',
          method,
          headers: {},
          timeout: 5000,
        });

        // Should not crash or throw
        expect(result).toBeDefined();
      }
    });
  });

  describe('SSRF Vulnerability', () => {
    it('should be vulnerable to IPv6 bypass', () => {
      // VULNERABLE: Simple string matching doesn't catch IPv6 notation
      const ipv6Url = 'http://[::ffff:169.254.169.254]/api/imds/token';
      
      // This should be blocked but isn't (vulnerability)
      const isBlocked = proxyService.testUrl(ipv6Url);
      
      // The service is intentionally vulnerable
      expect(isBlocked).toBe(false);
    });

    it('should be vulnerable to hex encoding bypass (node blocks it)', () => {
      // NOTE: Node.js URL parser normalizes hex automatically
      const hexUrl = 'http://0x7f.0x0.0x0.0x1/api';
      
      const isBlocked = proxyService.testUrl(hexUrl);
      
      // Node's URL parser blocks this automatically
      expect(isBlocked).toBe(true);
    });

    it('should be vulnerable to octal encoding bypass (node blocks it)', () => {
      // NOTE: Node.js URL parser normalizes octal automatically
      const octalUrl = 'http://0177.0.0.1/api';
      
      const isBlocked = proxyService.testUrl(octalUrl);
      
      // Node's URL parser blocks this automatically
      expect(isBlocked).toBe(true);
    });

    it('should be vulnerable to integer IP bypass (node blocks it)', () => {
      // NOTE: Node.js URL parser normalizes integer IPs automatically
      const intUrl = 'http://2130706433/api'; // 127.0.0.1 as integer
      
      const isBlocked = proxyService.testUrl(intUrl);
      
      // Node's URL parser blocks this automatically
      expect(isBlocked).toBe(true);
    });
  });

  describe('Educational Features', () => {
    it('should document vulnerability for learning', () => {
      const hints = proxyService.getBypassHints();
      const keys = Object.keys(hints);

      const hasEducationalContent = keys.some(k => 
        k.toLowerCase().includes('bypass') ||
        k.toLowerCase().includes('encoding') ||
        k.toLowerCase().includes('notation')
      );

      expect(hasEducationalContent).toBe(true);
    });

    it('should provide working examples', () => {
      const hints = proxyService.getBypassHints();
      const values = Object.values(hints);

      values.forEach((value: string) => {
        expect(value).toMatch(/^http/);
        expect(value.length).toBeGreaterThan(10);
      });
    });
  });
});
