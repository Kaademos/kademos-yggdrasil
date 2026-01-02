/**
 * Frontend types for Realm data
 * Matches backend RealmMetadata structure
 */

export interface RealmTheme {
  primaryColor: string;
  image: string;
  category: string;
}

export interface Realm {
  name: string;
  displayName: string;
  description: string;
  order: number;
  locked: boolean;
  theme: RealmTheme;
}

export interface RealmsResponse {
  realms: Realm[];
}
