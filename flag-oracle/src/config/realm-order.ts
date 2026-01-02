export interface RealmConfig {
  order: number;
  name: string;
  nextRealm?: string;
}

export const REALM_ORDER: RealmConfig[] = [
  { order: 11, name: 'SAMPLE', nextRealm: 'NIFLHEIM' },
  { order: 10, name: 'NIFLHEIM', nextRealm: 'HELHEIM' },
  { order: 9, name: 'HELHEIM', nextRealm: 'SVARTALFHEIM' },
  { order: 8, name: 'SVARTALFHEIM', nextRealm: 'JOTUNHEIM' },
  { order: 7, name: 'JOTUNHEIM', nextRealm: 'MUSPELHEIM' },
  { order: 6, name: 'MUSPELHEIM', nextRealm: 'NIDAVELLIR' },
  { order: 5, name: 'NIDAVELLIR', nextRealm: 'VANAHEIM' },
  { order: 4, name: 'VANAHEIM', nextRealm: 'MIDGARD' },
  { order: 3, name: 'MIDGARD', nextRealm: 'ALFHEIM' },
  { order: 2, name: 'ALFHEIM', nextRealm: 'ASGARD' },
  { order: 1, name: 'ASGARD' },
];

export function getRealmByName(name: string): RealmConfig | undefined {
  return REALM_ORDER.find((r) => r.name === name);
}

export function getPreviousRealm(realmName: string): RealmConfig | undefined {
  const realm = getRealmByName(realmName);
  if (!realm) return undefined;
  return REALM_ORDER.find((r) => r.order === realm.order + 1);
}
