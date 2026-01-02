import { InputSanitizer } from '../src/utils/input-sanitizer';

describe('InputSanitizer', () => {
  describe('sanitizeUserId', () => {
    it('should accept valid userIds', () => {
      expect(InputSanitizer.sanitizeUserId('user123')).toBe('user123');
      expect(InputSanitizer.sanitizeUserId('test-user')).toBe('test-user');
      expect(InputSanitizer.sanitizeUserId('user_123')).toBe('user_123');
      expect(InputSanitizer.sanitizeUserId('ABC123xyz')).toBe('ABC123xyz');
    });

    it('should trim whitespace', () => {
      expect(InputSanitizer.sanitizeUserId('  user123  ')).toBe('user123');
      expect(InputSanitizer.sanitizeUserId('\ttest-user\n')).toBe('test-user');
    });

    it('should reject null or undefined', () => {
      expect(InputSanitizer.sanitizeUserId(null)).toBeNull();
      expect(InputSanitizer.sanitizeUserId(undefined)).toBeNull();
    });

    it('should reject non-string inputs', () => {
      expect(InputSanitizer.sanitizeUserId(123)).toBeNull();
      expect(InputSanitizer.sanitizeUserId({})).toBeNull();
      expect(InputSanitizer.sanitizeUserId([])).toBeNull();
      expect(InputSanitizer.sanitizeUserId(true)).toBeNull();
    });

    it('should reject empty strings', () => {
      expect(InputSanitizer.sanitizeUserId('')).toBeNull();
      expect(InputSanitizer.sanitizeUserId('   ')).toBeNull();
    });

    it('should reject strings that are too long', () => {
      const tooLong = 'a'.repeat(129);
      expect(InputSanitizer.sanitizeUserId(tooLong)).toBeNull();
    });

    it('should reject special characters', () => {
      expect(InputSanitizer.sanitizeUserId('user@email.com')).toBeNull();
      expect(InputSanitizer.sanitizeUserId("user'; DROP TABLE users--")).toBeNull();
      expect(InputSanitizer.sanitizeUserId('user<script>')).toBeNull();
      expect(InputSanitizer.sanitizeUserId('user!@#$')).toBeNull();
    });

    it('should accept maximum length userId', () => {
      const maxLength = 'a'.repeat(128);
      expect(InputSanitizer.sanitizeUserId(maxLength)).toBe(maxLength);
    });
  });

  describe('sanitizeFlag', () => {
    it('should accept valid flags', () => {
      const flag = 'YGGDRASIL{NIFLHEIM:abc-123}';
      expect(InputSanitizer.sanitizeFlag(flag)).toBe(flag);
    });

    it('should trim whitespace', () => {
      const flag = 'YGGDRASIL{NIFLHEIM:abc-123}';
      expect(InputSanitizer.sanitizeFlag(`  ${flag}  `)).toBe(flag);
    });

    it('should reject null or undefined', () => {
      expect(InputSanitizer.sanitizeFlag(null)).toBeNull();
      expect(InputSanitizer.sanitizeFlag(undefined)).toBeNull();
    });

    it('should reject non-string inputs', () => {
      expect(InputSanitizer.sanitizeFlag(123)).toBeNull();
      expect(InputSanitizer.sanitizeFlag({})).toBeNull();
      expect(InputSanitizer.sanitizeFlag([])).toBeNull();
    });

    it('should reject strings that are too long', () => {
      const tooLong = 'a'.repeat(101);
      expect(InputSanitizer.sanitizeFlag(tooLong)).toBeNull();
    });

    it('should accept maximum length flag', () => {
      const maxLength = 'a'.repeat(100);
      expect(InputSanitizer.sanitizeFlag(maxLength)).toBe(maxLength);
    });
  });
});
