/**
 * Shared Realm Metadata Configuration
 *
 * Single source of truth for realm information used by:
 * - Backend (routing, progression)
 * - Frontend (display, theming)
 */

export interface RealmTheme {
  primaryColor: string;
  image: string;
  category: string; // OWASP category
}

export interface RealmMetadata {
  name: string;
  displayName: string;
  description: string;
  order: number; // 10 = entry (Niflheim), 1 = final (Asgard)
  internalUrl: string;
  theme: RealmTheme;
}

/**
 * All realms in canonical order (10→1)
 */
export const REALMS_METADATA: RealmMetadata[] = [
  {
    name: 'niflheim',
    displayName: 'Niflheim',
    description: 'Cryo-Stasis Facility - Exceptional Conditions',
    order: 10,
    internalUrl: 'http://niflheim:3000',
    theme: {
      primaryColor: '#60a5fa', // blue-400
      image: '/assets/realms/niflheim.jpg',
      category: 'A10:2025 Exceptional Conditions',
    },
  },
  {
    name: 'helheim',
    displayName: 'Helheim',
    description: 'Memorial Forum - Logging & Alerting Failures',
    order: 9,
    internalUrl: 'http://helheim:3000',
    theme: {
      primaryColor: '#6b7280', // gray-500
      image: '/assets/realms/helheim.jpg',
      category: 'A09:2025 Logging & Alerting Failures',
    },
  },
  {
    name: 'svartalfheim',
    displayName: 'Svartalfheim',
    description: 'Dwarven Forge - Software/Data Integrity',
    order: 8,
    internalUrl: 'http://svartalfheim:3000',
    theme: {
      primaryColor: '#78716c', // stone-600
      image: '/assets/realms/svartalfheim.jpg',
      category: 'A08:2025 Software/Data Integrity',
    },
  },
  {
    name: 'jotunheim',
    displayName: 'Jotunheim',
    description: 'Ice Giant Stronghold - Authentication Failures',
    order: 7,
    internalUrl: 'http://jotunheim:3000',
    theme: {
      primaryColor: '#38bdf8', // sky-400
      image: '/assets/realms/jotunheim.jpg',
      category: 'A07:2025 Authentication Failures',
    },
  },
  {
    name: 'muspelheim',
    displayName: 'Muspelheim',
    description: 'Fire Realm Trading Post - Insecure Design',
    order: 6,
    internalUrl: 'http://muspelheim:3000',
    theme: {
      primaryColor: '#f97316', // orange-500
      image: '/assets/realms/muspelheim.jpg',
      category: 'A06:2025 Insecure Design',
    },
  },
  {
    name: 'nidavellir',
    displayName: 'Nidavellir',
    description: 'Mining Facility - Injection Vulnerabilities',
    order: 5,
    internalUrl: 'http://nidavellir:3000',
    theme: {
      primaryColor: '#a16207', // yellow-700
      image: '/assets/realms/nidavellir.jpg',
      category: 'A05:2025 Injection',
    },
  },
  {
    name: 'vanaheim',
    displayName: 'Vanaheim',
    description: 'Merchant Realm - Cryptographic Failures',
    order: 4,
    internalUrl: 'http://vanaheim:3000',
    theme: {
      primaryColor: '#10b981', // emerald-500
      image: '/assets/realms/vanaheim.jpg',
      category: 'A04:2025 Cryptographic Failures',
    },
  },
  {
    name: 'midgard',
    displayName: 'Midgard',
    description: 'Marketplace - Supply Chain Failures',
    order: 3,
    internalUrl: 'http://midgard:3000',
    theme: {
      primaryColor: '#a855f7', // purple-500
      image: '/assets/realms/midgard.jpg',
      category: 'A03:2025 Supply Chain Failures',
    },
  },
  {
    name: 'alfheim',
    displayName: 'Alfheim',
    description: 'Cloud Realm - Security Misconfiguration',
    order: 2,
    internalUrl: 'http://alfheim:3000',
    theme: {
      primaryColor: '#3b82f6', // blue-500
      image: '/assets/realms/alfheim.jpg',
      category: 'A02:2025 Security Misconfiguration',
    },
  },
  {
    name: 'asgard',
    displayName: 'Asgard',
    description: 'Golden Citadel - Broken Access Control',
    order: 1,
    internalUrl: 'http://asgard:3000',
    theme: {
      primaryColor: '#eab308', // yellow-500
      image: '/assets/realms/asgard.jpg',
      category: 'A01:2025 Broken Access Control',
    },
  },
  {
    name: 'sample',
    displayName: 'Sample Realm',
    description: 'Test realm for M0 validation',
    order: 11,
    internalUrl: 'http://sample-realm:3000',
    theme: {
      primaryColor: '#64748b', // slate-500
      image: '/assets/realms/sample.jpg',
      category: 'Test Realm',
    },
  },
];

/**
 * Get realm metadata by name
 */
export function getRealmByName(name: string): RealmMetadata | undefined {
  return REALMS_METADATA.find((r) => r.name.toLowerCase() === name.toLowerCase());
}

/**
 * Get all realms excluding sample (for production display)
 */
export function getProductionRealms(): RealmMetadata[] {
  return REALMS_METADATA.filter((r) => r.name !== 'sample');
}

/**
 * Get realms sorted by order
 */
export function getRealmsSorted(ascending = false): RealmMetadata[] {
  const sorted = [...REALMS_METADATA].sort((a, b) => a.order - b.order);
  return ascending ? sorted : sorted.reverse();
}
