import { FlagService } from '../src/services/flag-service';

const TEST_SECRET = 'test-secret-32-characters-minimum!!';
const TEST_SECRET_SHORT = 'too-short';

describe('FlagService', () => {
  describe('constructor', () => {
    it('should require master secret', () => {
      expect(() => new FlagService({ masterSecret: '' })).toThrow(
        'Master secret must be at least 32 characters'
      );
    });

    it('should require master secret of minimum length', () => {
      expect(() => new FlagService({ masterSecret: TEST_SECRET_SHORT })).toThrow(
        'Master secret must be at least 32 characters'
      );
    });

    it('should accept valid master secret', () => {
      expect(() => new FlagService({ masterSecret: TEST_SECRET })).not.toThrow();
    });
  });

  describe('generateFlag', () => {
    let service: FlagService;

    beforeEach(() => {
      service = new FlagService({ masterSecret: TEST_SECRET });
    });

    it('should generate flag in correct format', () => {
      const flag = service.generateFlag('NIFLHEIM', 'user1');
      expect(flag).toMatch(/^YGGDRASIL\{[A-Z_]+:[a-f0-9-]{36}\}$/);
    });

    it('should normalize realm ID to uppercase', () => {
      const flag1 = service.generateFlag('niflheim', 'user1');
      const flag2 = service.generateFlag('NIFLHEIM', 'user1');
      expect(flag1).toBe(flag2);
      expect(flag1).toContain('YGGDRASIL{NIFLHEIM:');
    });

    it('should generate deterministic flags', () => {
      const flag1 = service.generateFlag('NIFLHEIM', 'user1');
      const flag2 = service.generateFlag('NIFLHEIM', 'user1');
      expect(flag1).toBe(flag2);
    });

    it('should generate unique flags per realm', () => {
      const flag1 = service.generateFlag('NIFLHEIM', 'user1');
      const flag2 = service.generateFlag('HELHEIM', 'user1');
      expect(flag1).not.toBe(flag2);
      expect(flag1).toContain('NIFLHEIM');
      expect(flag2).toContain('HELHEIM');
    });

    it('should generate unique flags per user', () => {
      const flag1 = service.generateFlag('NIFLHEIM', 'user1');
      const flag2 = service.generateFlag('NIFLHEIM', 'user2');
      expect(flag1).not.toBe(flag2);
    });

    it('should require realmId', () => {
      expect(() => service.generateFlag('', 'user1')).toThrow(
        'realmId and userId are required'
      );
    });

    it('should require userId', () => {
      expect(() => service.generateFlag('NIFLHEIM', '')).toThrow(
        'realmId and userId are required'
      );
    });

    it('should trim whitespace from inputs', () => {
      const flag1 = service.generateFlag('  NIFLHEIM  ', '  user1  ');
      const flag2 = service.generateFlag('NIFLHEIM', 'user1');
      expect(flag1).toBe(flag2);
    });

    it('should generate valid UUIDs', () => {
      const flag = service.generateFlag('NIFLHEIM', 'user1');
      const uuidPart = flag.match(/([a-f0-9-]{36})/)?.[1];
      expect(uuidPart).toBeDefined();
      
      // Verify UUID format (8-4-4-4-12)
      const parts = uuidPart!.split('-');
      expect(parts).toHaveLength(5);
      expect(parts[0]).toHaveLength(8);
      expect(parts[1]).toHaveLength(4);
      expect(parts[2]).toHaveLength(4);
      expect(parts[3]).toHaveLength(4);
      expect(parts[4]).toHaveLength(12);
    });
  });

  describe('verifyFlag', () => {
    let service: FlagService;

    beforeEach(() => {
      service = new FlagService({ masterSecret: TEST_SECRET });
    });

    it('should verify valid flags', () => {
      const flag = service.generateFlag('NIFLHEIM', 'user1');
      const result = service.verifyFlag(flag, 'user1');
      
      expect(result.valid).toBe(true);
      expect(result.realm).toBe('NIFLHEIM');
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid flags', () => {
      const result = service.verifyFlag('INVALID_FLAG', 'user1');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid flag format');
      expect(result.realm).toBeUndefined();
    });

    it('should reject tampered flags', () => {
      const flag = service.generateFlag('NIFLHEIM', 'user1');
      const tampered = flag.replace('a', 'b');
      const result = service.verifyFlag(tampered, 'user1');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not match expected value');
    });

    it('should reject flag for wrong user', () => {
      const flag = service.generateFlag('NIFLHEIM', 'user1');
      const result = service.verifyFlag(flag, 'user2');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not match expected value');
    });

    it('should require flag parameter', () => {
      const result = service.verifyFlag('', 'user1');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Flag must be a non-empty string');
    });

    it('should require userId parameter', () => {
      const flag = service.generateFlag('NIFLHEIM', 'user1');
      const result = service.verifyFlag(flag, '');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('userId must be a non-empty string');
    });

    it('should be case-insensitive for realm ID', () => {
      const flag = service.generateFlag('NIFLHEIM', 'user1');
      const lowerFlag = flag.replace('NIFLHEIM', 'niflheim');
      const result = service.verifyFlag(lowerFlag, 'user1');
      
      expect(result.valid).toBe(true);
      expect(result.realm).toBe('NIFLHEIM'); // Always returns uppercase
    });

    it('should handle malformed flag formats', () => {
      const testCases = [
        'YGGDRASIL{NIFLHEIM}',
        'YGGDRASIL{:123}',
        'YGGDRASIL{NIFLHEIM:}',
        'NIFLHEIM:123',
        'YGGDRASIL{NIFLHEIM:not-a-uuid}',
      ];

      for (const testFlag of testCases) {
        const result = service.verifyFlag(testFlag, 'user1');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid flag format');
      }
    });
  });

  describe('generateFlagsForUser', () => {
    let service: FlagService;

    beforeEach(() => {
      service = new FlagService({ masterSecret: TEST_SECRET });
    });

    it('should generate flags for multiple realms', () => {
      const realms = ['NIFLHEIM', 'HELHEIM', 'ASGARD'];
      const flags = service.generateFlagsForUser('user1', realms);
      
      expect(flags.size).toBe(3);
      expect(flags.has('NIFLHEIM')).toBe(true);
      expect(flags.has('HELHEIM')).toBe(true);
      expect(flags.has('ASGARD')).toBe(true);
    });

    it('should normalize realm IDs in map keys', () => {
      const realms = ['niflheim', 'HELHEIM'];
      const flags = service.generateFlagsForUser('user1', realms);
      
      expect(flags.has('NIFLHEIM')).toBe(true);
      expect(flags.has('HELHEIM')).toBe(true);
    });

    it('should handle empty realm list', () => {
      const flags = service.generateFlagsForUser('user1', []);
      expect(flags.size).toBe(0);
    });

    it('should skip invalid realm IDs gracefully', () => {
      const realms = ['NIFLHEIM', '', 'HELHEIM'];
      const flags = service.generateFlagsForUser('user1', realms);
      
      // Should have 2 valid flags (empty string skipped)
      expect(flags.size).toBe(2);
      expect(flags.has('NIFLHEIM')).toBe(true);
      expect(flags.has('HELHEIM')).toBe(true);
    });
  });

  describe('extractRealmId', () => {
    it('should extract realm ID from valid flag', () => {
      const flag = 'YGGDRASIL{NIFLHEIM:12345678-1234-1234-1234-123456789012}';
      const realmId = FlagService.extractRealmId(flag);
      expect(realmId).toBe('NIFLHEIM');
    });

    it('should normalize to uppercase', () => {
      const flag = 'YGGDRASIL{niflheim:12345678-1234-1234-1234-123456789012}';
      const realmId = FlagService.extractRealmId(flag);
      expect(realmId).toBe('NIFLHEIM');
    });

    it('should return null for invalid format', () => {
      const testCases = [
        'INVALID_FLAG',
        'YGGDRASIL{NIFLHEIM}',
        'YGGDRASIL{:123}',
        '',
      ];

      for (const flag of testCases) {
        expect(FlagService.extractRealmId(flag)).toBeNull();
      }
    });

    it('should work without instantiation', () => {
      // Static method should work without creating instance
      const result = FlagService.extractRealmId(
        'YGGDRASIL{ASGARD:12345678-1234-1234-1234-123456789012}'
      );
      expect(result).toBe('ASGARD');
    });
  });

  describe('different secrets produce different flags', () => {
    it('should generate different flags with different secrets', () => {
      const service1 = new FlagService({ masterSecret: 'secret-one-32-characters-minimum!!' });
      const service2 = new FlagService({ masterSecret: 'secret-two-32-characters-minimum!!' });

      const flag1 = service1.generateFlag('NIFLHEIM', 'user1');
      const flag2 = service2.generateFlag('NIFLHEIM', 'user1');

      expect(flag1).not.toBe(flag2);
    });

    it('should not verify flag generated with different secret', () => {
      const service1 = new FlagService({ masterSecret: 'secret-one-32-characters-minimum!!' });
      const service2 = new FlagService({ masterSecret: 'secret-two-32-characters-minimum!!' });

      const flag = service1.generateFlag('NIFLHEIM', 'user1');
      const result = service2.verifyFlag(flag, 'user1');

      expect(result.valid).toBe(false);
    });
  });
});
