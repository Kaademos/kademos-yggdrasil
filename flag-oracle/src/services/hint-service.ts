import { injectable } from 'tsyringe';
import { REALM_HINTS, RealmHint } from '../config/hints-data.generated';

/**
 * HintService — serves progressive hint content sourced from realm manifests
 * (bundled at build time via scripts/sync-hints.ts into hints-data.generated.ts).
 */
@injectable()
export class HintService {
  /** All hints for a realm, ordered. Empty if the realm has none / is unknown. */
  getRealmHints(realm: string): RealmHint[] {
    return REALM_HINTS[realm.toUpperCase()] ?? [];
  }

  hasRealm(realm: string): boolean {
    return this.getRealmHints(realm).length > 0;
  }

  /** A specific hint by order, or undefined if it doesn't exist. */
  getHint(realm: string, order: number): RealmHint | undefined {
    return this.getRealmHints(realm).find((h) => h.order === order);
  }

  totalHints(realm: string): number {
    return this.getRealmHints(realm).length;
  }
}
