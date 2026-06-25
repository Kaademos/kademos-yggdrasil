import { injectable } from 'tsyringe';
import { getRealmBasePoints } from '../config/realm-order';

/**
 * ScoringService — computes the points awarded for a realm capture.
 *
 * Scoring is competitive but forgiving: each revealed hint deducts a slice of the
 * realm's base value, but a capture always retains at least MIN_RETAINED_FRACTION,
 * so using hints never zeroes out (or blocks) progress.
 */
@injectable()
export class ScoringService {
  /** Fraction of base value deducted per hint revealed. */
  static readonly HINT_PENALTY_FRACTION = 0.15;
  /** Minimum fraction of base value a capture always retains. */
  static readonly MIN_RETAINED_FRACTION = 0.25;

  getBasePoints(realm: string): number {
    return getRealmBasePoints(realm);
  }

  /**
   * Points for capturing `realm` given how many hints were revealed for it.
   * Result is rounded and floored at MIN_RETAINED_FRACTION of base.
   */
  computePoints(realm: string, hintsUsed = 0): number {
    const base = this.getBasePoints(realm);
    if (base === 0) {
      return 0;
    }

    const penalty = base * ScoringService.HINT_PENALTY_FRACTION * Math.max(0, hintsUsed);
    const floor = base * ScoringService.MIN_RETAINED_FRACTION;
    return Math.round(Math.max(base - penalty, floor));
  }
}
