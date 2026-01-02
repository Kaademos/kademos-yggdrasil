import { ProgressionValidator } from '../src/services/progression-validator';
import { REALM_ORDER } from '../src/config/realm-order';

describe('ProgressionValidator', () => {
  let validator: ProgressionValidator;

  beforeEach(() => {
    validator = new ProgressionValidator(REALM_ORDER);
  });

  describe('canAccessRealm', () => {
    it('should allow access to first realm (SAMPLE) without unlocks', () => {
      const result = validator.canAccessRealm('SAMPLE', []);
      expect(result).toBe(true);
    });

    it('should deny access to HELHEIM without NIFLHEIM unlocked', () => {
      const result = validator.canAccessRealm('HELHEIM', []);
      expect(result).toBe(false);
    });

    it('should allow access to HELHEIM with NIFLHEIM unlocked', () => {
      const result = validator.canAccessRealm('HELHEIM', ['NIFLHEIM']);
      expect(result).toBe(true);
    });

    it('should deny access to ASGARD without ALFHEIM unlocked', () => {
      const unlockedRealms = ['NIFLHEIM', 'HELHEIM', 'SVARTALFHEIM'];
      const result = validator.canAccessRealm('ASGARD', unlockedRealms);
      expect(result).toBe(false);
    });

    it('should allow access to ASGARD with ALFHEIM unlocked', () => {
      const unlockedRealms = [
        'NIFLHEIM',
        'HELHEIM',
        'SVARTALFHEIM',
        'JOTUNHEIM',
        'MUSPELHEIM',
        'NIDAVELLIR',
        'VANAHEIM',
        'MIDGARD',
        'ALFHEIM',
      ];
      const result = validator.canAccessRealm('ASGARD', unlockedRealms);
      expect(result).toBe(true);
    });

    it('should deny access to invalid realm name', () => {
      const result = validator.canAccessRealm('INVALID_REALM', ['NIFLHEIM']);
      expect(result).toBe(false);
    });

    it('should deny realm skip (SVARTALFHEIM without HELHEIM)', () => {
      const result = validator.canAccessRealm('SVARTALFHEIM', ['NIFLHEIM']);
      expect(result).toBe(false);
    });
  });

  describe('getNextRealm', () => {
    it('should return HELHEIM for NIFLHEIM', () => {
      const result = validator.getNextRealm('NIFLHEIM');
      expect(result).toBe('HELHEIM');
    });

    it('should return undefined for ASGARD (last realm)', () => {
      const result = validator.getNextRealm('ASGARD');
      expect(result).toBeUndefined();
    });

    it('should return undefined for invalid realm', () => {
      const result = validator.getNextRealm('INVALID_REALM');
      expect(result).toBeUndefined();
    });
  });

  describe('isValidRealm', () => {
    it('should return true for valid realms', () => {
      expect(validator.isValidRealm('NIFLHEIM')).toBe(true);
      expect(validator.isValidRealm('HELHEIM')).toBe(true);
      expect(validator.isValidRealm('ASGARD')).toBe(true);
    });

    it('should return false for invalid realms', () => {
      expect(validator.isValidRealm('INVALID_REALM')).toBe(false);
      expect(validator.isValidRealm('niflheim')).toBe(false);
      expect(validator.isValidRealm('')).toBe(false);
    });
  });
});
