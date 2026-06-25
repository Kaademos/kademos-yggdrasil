import { ScoringService } from '../src/services/scoring-service';

describe('ScoringService', () => {
  let scoring: ScoringService;

  beforeEach(() => {
    scoring = new ScoringService();
  });

  describe('getBasePoints', () => {
    it('awards more points for later (harder) realms', () => {
      expect(scoring.getBasePoints('NIFLHEIM')).toBe(100); // order 10 (entry)
      expect(scoring.getBasePoints('ASGARD')).toBe(1000); // order 1 (final)
      expect(scoring.getBasePoints('NIFLHEIM')).toBeLessThan(scoring.getBasePoints('ASGARD'));
    });

    it('awards zero for the SAMPLE warm-up realm', () => {
      expect(scoring.getBasePoints('SAMPLE')).toBe(0);
    });

    it('awards zero for unknown realms', () => {
      expect(scoring.getBasePoints('ATLANTIS')).toBe(0);
    });

    it('is case-insensitive', () => {
      expect(scoring.getBasePoints('niflheim')).toBe(100);
    });
  });

  describe('computePoints', () => {
    it('returns full base points when no hints are used', () => {
      expect(scoring.computePoints('ASGARD', 0)).toBe(1000);
      expect(scoring.computePoints('ASGARD')).toBe(1000);
    });

    it('deducts a fixed fraction per hint', () => {
      // 1000 - 0.15*1000 = 850
      expect(scoring.computePoints('ASGARD', 1)).toBe(850);
      // 1000 - 0.15*1000*2 = 700
      expect(scoring.computePoints('ASGARD', 2)).toBe(700);
    });

    it('never drops below the minimum retained fraction (25%)', () => {
      // Even with many hints, ASGARD retains at least 250.
      expect(scoring.computePoints('ASGARD', 100)).toBe(250);
    });

    it('always returns zero for zero-value realms regardless of hints', () => {
      expect(scoring.computePoints('SAMPLE', 5)).toBe(0);
    });
  });
});
