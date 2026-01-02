/**
 * Unit Tests: SsrfFilter
 * Tests SSRF filtering and bypass detection
 */

import { SsrfFilter } from '../../src/services/ssrf-filter';

describe('SsrfFilter', () => {
  let filter: SsrfFilter;

  beforeEach(() => {
    filter = new SsrfFilter();
  });

  describe('Basic Blocking', () => {
    test('should block localhost', () => {
      const result = filter.isBlocked('http://localhost:9090/metadata/secrets');
      
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('localhost');
    });

    test('should block 127.0.0.1', () => {
      const result = filter.isBlocked('http://127.0.0.1:9090/metadata/secrets');
      
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('127.0.0.1');
    });

    test('should block 0.0.0.0', () => {
      const result = filter.isBlocked('http://0.0.0.0:9090');
      
      expect(result.blocked).toBe(true);
    });

    test('should block ::1 (IPv6 localhost)', () => {
      const result = filter.isBlocked('http://[::1]:9090');
      
      expect(result.blocked).toBe(true);
    });

    test('should block AWS IMDS', () => {
      const result = filter.isBlocked('http://169.254.169.254/latest/meta-data');
      
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('169.254.169.254');
    });

    test('should block 10.0.0.0/8 range', () => {
      const result = filter.isBlocked('http://10.0.0.5:9090');
      
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('Private IP');
    });

    test('should block 192.168.0.0/16 range', () => {
      const result = filter.isBlocked('http://192.168.1.1:9090');
      
      expect(result.blocked).toBe(true);
    });

    test('should block 172.16.0.0/12 range', () => {
      const result = filter.isBlocked('http://172.16.0.1:9090');
      
      expect(result.blocked).toBe(true);
    });

    test('should allow external URLs', () => {
      const result = filter.isBlocked('http://example.com');
      
      expect(result.blocked).toBe(false);
    });

    test('should allow HTTPS URLs', () => {
      const result = filter.isBlocked('https://api.github.com');
      
      expect(result.blocked).toBe(false);
    });
  });

  describe('Bypass Techniques (VULNERABLE)', () => {
    test('BYPASS 1: IPv6-mapped IPv4 should bypass filter', () => {
      // [::ffff:127.0.0.1] is IPv6 notation for 127.0.0.1
      const result = filter.isBlocked('http://[::ffff:127.0.0.1]:9090/metadata/secrets');
      
      // VULNERABLE: Filter doesn't recognize this notation
      expect(result.blocked).toBe(false);
    });

    test('BYPASS 2: Decimal IP should bypass filter', () => {
      // 127.0.0.1 = (127*16777216) + 1 = 2130706433
      const result = filter.isBlocked('http://2130706433:9090/metadata/secrets');
      
      // VULNERABLE: Filter only checks string patterns
      expect(result.blocked).toBe(false);
    });

    test('BYPASS 3: Octal IP should bypass filter', () => {
      // 0177.0.0.1 is octal notation for 127.0.0.1
      const result = filter.isBlocked('http://0177.0.0.1:9090/metadata/secrets');
      
      // VULNERABLE: Filter doesn't recognize octal notation
      expect(result.blocked).toBe(false);
    });

    test('BYPASS 4: Hexadecimal IP should bypass filter', () => {
      // 0x7f.0x0.0x0.0x1 is hex notation for 127.0.0.1
      const result = filter.isBlocked('http://0x7f.0x0.0x0.0x1:9090/metadata/secrets');
      
      // VULNERABLE: Filter doesn't recognize hex notation
      expect(result.blocked).toBe(false);
    });

    test('BYPASS 5: Mixed hex/decimal should bypass filter', () => {
      // 0x7f.0.0.1 mixes hex and decimal
      const result = filter.isBlocked('http://0x7f.0.0.1:9090/metadata/secrets');
      
      // VULNERABLE: Filter doesn't parse mixed notation
      expect(result.blocked).toBe(false);
    });

    test('BYPASS 6: DNS alias (localtest.me) should bypass filter', () => {
      // localtest.me resolves to 127.0.0.1 but isn't in blocklist
      const result = filter.isBlocked('http://localtest.me:9090/metadata/secrets');
      
      // VULNERABLE: Filter doesn't resolve DNS
      expect(result.blocked).toBe(false);
    });

    test('BYPASS 7: Subdomain trick should bypass filter', () => {
      // localhost.evil.com doesn't match "localhost" exact string
      const result = filter.isBlocked('http://localhost.evil.com:9090/metadata/secrets');
      
      // VULNERABLE: Filter checks exact hostname match
      expect(result.blocked).toBe(false);
    });
  });

  describe('getBypassHints', () => {
    test('should return bypass hints', () => {
      const hints = filter.getBypassHints();
      
      expect(Array.isArray(hints)).toBe(true);
      expect(hints.length).toBeGreaterThan(0);
      expect(hints.some(h => h.includes('IPv6'))).toBe(true);
      expect(hints.some(h => h.includes('decimal'))).toBe(true);
    });

    test('bypass hints should be provided when URL is blocked', () => {
      const result = filter.isBlocked('http://localhost:9090');
      
      expect(result.blocked).toBe(true);
      expect(result.bypassHints).toBeDefined();
      expect(result.bypassHints!.length).toBeGreaterThan(0);
    });
  });

  describe('testBypass', () => {
    test('should test IPv6 bypass', () => {
      const result = filter.testBypass('ipv6');
      
      expect(result.technique).toBe('ipv6');
      expect(result.url).toContain('::ffff:127.0.0.1');
      expect(result.blocked).toBe(false); // Bypass works
      expect(result.description).toBeDefined();
    });

    test('should test decimal bypass', () => {
      const result = filter.testBypass('decimal');
      
      expect(result.technique).toBe('decimal');
      expect(result.url).toContain('2130706433');
      expect(result.blocked).toBe(false);
    });

    test('should test octal bypass', () => {
      const result = filter.testBypass('octal');
      
      expect(result.url).toContain('0177.0.0.1');
      expect(result.blocked).toBe(false);
    });

    test('should test hex bypass', () => {
      const result = filter.testBypass('hex');
      
      expect(result.url).toContain('0x7f');
      expect(result.blocked).toBe(false);
    });

    test('should test DNS bypass', () => {
      const result = filter.testBypass('dns');
      
      expect(result.url).toContain('localtest.me');
      expect(result.blocked).toBe(false);
    });

    test('direct localhost access should be blocked', () => {
      const result = filter.testBypass('direct', 'localhost');
      
      expect(result.blocked).toBe(true);
    });
  });

  describe('getAllBypasses', () => {
    test('should return all bypass techniques', () => {
      const bypasses = filter.getAllBypasses(9090);
      
      expect(Array.isArray(bypasses)).toBe(true);
      expect(bypasses.length).toBeGreaterThan(5);
      
      // Check that bypass techniques are not blocked
      const workingBypasses = bypasses.filter(b => !b.blocked);
      expect(workingBypasses.length).toBeGreaterThan(0);
    });

    test('each bypass should have required fields', () => {
      const bypasses = filter.getAllBypasses();
      
      bypasses.forEach(bypass => {
        expect(bypass).toHaveProperty('technique');
        expect(bypass).toHaveProperty('url');
        expect(bypass).toHaveProperty('blocked');
        expect(bypass).toHaveProperty('description');
      });
    });
  });

  describe('getBlocklist', () => {
    test('should return blocklist information', () => {
      const blocklist = filter.getBlocklist();
      
      expect(blocklist).toHaveProperty('hosts');
      expect(blocklist).toHaveProperty('prefixes');
      expect(Array.isArray(blocklist.hosts)).toBe(true);
      expect(Array.isArray(blocklist.prefixes)).toBe(true);
    });

    test('blocklist should contain localhost', () => {
      const blocklist = filter.getBlocklist();
      
      expect(blocklist.hosts).toContain('localhost');
      expect(blocklist.hosts).toContain('127.0.0.1');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid URLs', () => {
      const result = filter.isBlocked('not-a-valid-url');
      
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('Invalid URL');
    });

    test('should handle URLs without protocol', () => {
      const result = filter.isBlocked('localhost:9090');
      
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('Invalid URL');
    });

    test('should handle empty strings', () => {
      const result = filter.isBlocked('');
      
      expect(result.blocked).toBe(true);
    });
  });
});
