/**
 * Shared Realm Metadata Configuration
 *
 * Single source of truth for realm information used by:
 * - Backend (routing, progression)
 * - Frontend (display, theming)
 */

export interface RealmTheme {
  // Colors form the "ascent ramp": WCAG relative luminance strictly increases
  // from Niflheim (order 10, darkest) to Asgard (order 1, gold). Enforced by
  // tests/realms-metadata.test.ts — keep the invariant when changing colors.
  primaryColor: string;
  image: string;
  category: string; // OWASP category
  icon: string; // Realm emblem, reused across cards/leaderboard/realm pages
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
      primaryColor: '#1d4ed8', // blue-700 — frozen root, darkest step of the ascent
      image: '/assets/realms/niflheim.jpg',
      category: 'A10:2025 Exceptional Conditions',
      icon: '🌫️',
    },
  },
  {
    name: 'helheim',
    displayName: 'Helheim',
    description: 'Níðhöggr SOC - Logging & Alerting Failures',
    order: 9,
    internalUrl: 'http://helheim:3000',
    theme: {
      primaryColor: '#7c3aed', // violet-600 — realm of the dead
      image: '/assets/realms/helheim.jpg',
      category: 'A09:2025 Logging & Alerting Failures',
      icon: '☠️',
    },
  },
  {
    name: 'svartalfheim',
    displayName: 'Svartalfheim',
    description: 'Dwarven Forge - Software/Data Integrity',
    order: 8,
    internalUrl: 'http://svartalfheim:3000',
    theme: {
      primaryColor: '#b45309', // amber-700 — bronze of the underground forge
      image: '/assets/realms/svartalfheim.jpg',
      category: 'A08:2025 Software/Data Integrity',
      icon: '⚙️',
    },
  },
  {
    name: 'jotunheim',
    displayName: 'Jotunheim',
    description: 'Ice Giant Stronghold - Authentication Failures',
    order: 7,
    internalUrl: 'http://jotunheim:3000',
    theme: {
      primaryColor: '#0ea5e9', // sky-500 — glacial ice
      image: '/assets/realms/jotunheim.jpg',
      category: 'A07:2025 Authentication Failures',
      icon: '❄️',
    },
  },
  {
    name: 'muspelheim',
    displayName: 'Muspelheim',
    description: 'Fire Realm Trading Post - Insecure Design',
    order: 6,
    internalUrl: 'http://muspelheim:3000',
    theme: {
      primaryColor: '#fb923c', // orange-400 — fire realm
      image: '/assets/realms/muspelheim.jpg',
      category: 'A06:2025 Insecure Design',
      icon: '🔥',
    },
  },
  {
    name: 'nidavellir',
    displayName: 'Nidavellir',
    description: 'Mining Facility - Injection Vulnerabilities',
    order: 5,
    internalUrl: 'http://nidavellir:3000',
    theme: {
      primaryColor: '#f59e0b', // amber-500 — molten metal of the dwarven forge
      image: '/assets/realms/nidavellir.jpg',
      category: 'A05:2025 Injection',
      icon: '⚒️',
    },
  },
  {
    name: 'vanaheim',
    displayName: 'Vanaheim',
    description: 'Merchant Realm - Cryptographic Failures',
    order: 4,
    internalUrl: 'http://vanaheim:3000',
    theme: {
      primaryColor: '#34d399', // emerald-400 — sacred forest
      image: '/assets/realms/vanaheim.jpg',
      category: 'A04:2025 Cryptographic Failures',
      icon: '🔐',
    },
  },
  {
    name: 'midgard',
    displayName: 'Midgard',
    description: 'Marketplace - Supply Chain Failures',
    order: 3,
    internalUrl: 'http://midgard:3000',
    theme: {
      primaryColor: '#2dd4bf', // teal-400 — merchant seas of the human realm
      image: '/assets/realms/midgard.jpg',
      category: 'A03:2025 Supply Chain Failures',
      icon: '🌍',
    },
  },
  {
    name: 'alfheim',
    displayName: 'Alfheim',
    description: 'Cloud Realm - Security Misconfiguration',
    order: 2,
    internalUrl: 'http://alfheim:3000',
    theme: {
      primaryColor: '#93c5fd', // blue-300 — luminous elven sky
      image: '/assets/realms/alfheim.jpg',
      category: 'A02:2025 Security Misconfiguration',
      icon: '✨',
    },
  },
  {
    name: 'asgard',
    displayName: 'Asgard',
    description: 'Golden Citadel - Broken Access Control',
    order: 1,
    internalUrl: 'http://asgard:3000',
    theme: {
      primaryColor: '#facc15', // yellow-400 — golden citadel, brightest step
      image: '/assets/realms/asgard.jpg',
      category: 'A01:2025 Broken Access Control',
      icon: '👑',
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
      icon: '🧪',
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
