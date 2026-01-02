import { RealmConfig, getRealmByName, getPreviousRealm } from '../config/realm-order';

export class ProgressionValidator {
  constructor(private realmOrder: RealmConfig[]) {}

  canAccessRealm(realm: string, unlockedRealms: string[]): boolean {
    const targetRealm = getRealmByName(realm);
    if (!targetRealm) {
      return false;
    }

    if (targetRealm.order === 11) {
      return true;
    }

    const previousRealm = getPreviousRealm(realm);
    if (!previousRealm) {
      return false;
    }

    return unlockedRealms.includes(previousRealm.name);
  }

  getNextRealm(currentRealm: string): string | undefined {
    const realm = getRealmByName(currentRealm);
    return realm?.nextRealm;
  }

  isValidRealm(realm: string): boolean {
    return getRealmByName(realm) !== undefined;
  }
}
