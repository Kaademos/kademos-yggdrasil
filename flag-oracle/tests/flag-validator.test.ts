import { FlagValidator } from '../src/services/flag-validator';

describe('FlagValidator', () => {
  let validator: FlagValidator;

  beforeEach(() => {
    validator = new FlagValidator();
  });

  describe('validate', () => {
    it('should accept valid flag format', () => {
      const result = validator.validate(
        'YGGDRASIL{SAMPLE:00000000-0000-0000-0000-000000000000}'
      );
      expect(result.valid).toBe(true);
      expect(result.realm).toBe('SAMPLE');
      expect(result.uuid).toBe('00000000-0000-0000-0000-000000000000');
    });

    it('should accept valid flag with different realm', () => {
      const result = validator.validate(
        'YGGDRASIL{NIFLHEIM:12345678-1234-1234-1234-123456789abc}'
      );
      expect(result.valid).toBe(true);
      expect(result.realm).toBe('NIFLHEIM');
      expect(result.uuid).toBe('12345678-1234-1234-1234-123456789abc');
    });

    it('should reject flag with invalid format', () => {
      const result = validator.validate('INVALID_FLAG');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject flag without realm', () => {
      const result = validator.validate(
        'YGGDRASIL{00000000-0000-0000-0000-000000000000}'
      );
      expect(result.valid).toBe(false);
    });

    it('should reject flag with invalid UUID', () => {
      const result = validator.validate('YGGDRASIL{SAMPLE:invalid-uuid}');
      expect(result.valid).toBe(false);
    });

    it('should reject empty string', () => {
      const result = validator.validate('');
      expect(result.valid).toBe(false);
    });

    it('should reject non-string input', () => {
      const result = validator.validate(null as any);
      expect(result.valid).toBe(false);
    });

    it('should normalize realm to uppercase', () => {
      const result = validator.validate(
        'YGGDRASIL{sample:00000000-0000-0000-0000-000000000000}'
      );
      expect(result.valid).toBe(true);
      expect(result.realm).toBe('SAMPLE');
    });

    it('should normalize UUID to lowercase', () => {
      const result = validator.validate(
        'YGGDRASIL{SAMPLE:AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}'
      );
      expect(result.valid).toBe(true);
      expect(result.uuid).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    });
  });
});
