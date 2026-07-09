/**
 * Unit tests for realm metadata — the single source of truth for the
 * Ten Realms ascent (OWASP Top 10:2025 mapping, theming, emblems).
 *
 * These lock in three product invariants:
 * 1. Exactly ten production realms mapped 1:1 to OWASP Top 10:2025 categories.
 * 2. The "color journey": primaryColor luminance strictly increases as the
 *    player ascends from Niflheim (order 10) to Asgard (order 1).
 * 3. Every realm has a unique emblem icon and a theme image that exists on disk.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  REALMS_METADATA,
  getRealmByName,
  getProductionRealms,
  getRealmsSorted,
} from '../src/config/realms-metadata';

const FRONTEND_PUBLIC = path.resolve(__dirname, '../frontend/public');

/** WCAG relative luminance of a #rrggbb color */
function relativeLuminance(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('REALMS_METADATA structure', () => {
  const production = getProductionRealms();

  it('defines exactly ten production realms (plus the sample realm)', () => {
    expect(production).toHaveLength(10);
    expect(REALMS_METADATA).toHaveLength(11);
  });

  it('has unique realm names', () => {
    const names = REALMS_METADATA.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('assigns production realms unique orders covering 1 through 10', () => {
    const orders = production.map((r) => r.order).sort((a, b) => a - b);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('maps each realm to its canonical OWASP Top 10:2025 category', () => {
    const expected: Record<number, { name: string; category: string }> = {
      1: { name: 'asgard', category: 'A01:2025 Broken Access Control' },
      2: { name: 'alfheim', category: 'A02:2025 Security Misconfiguration' },
      3: { name: 'midgard', category: 'A03:2025 Supply Chain Failures' },
      4: { name: 'vanaheim', category: 'A04:2025 Cryptographic Failures' },
      5: { name: 'nidavellir', category: 'A05:2025 Injection' },
      6: { name: 'muspelheim', category: 'A06:2025 Insecure Design' },
      7: { name: 'jotunheim', category: 'A07:2025 Authentication Failures' },
      8: { name: 'svartalfheim', category: 'A08:2025 Software/Data Integrity' },
      9: { name: 'helheim', category: 'A09:2025 Logging & Alerting Failures' },
      10: { name: 'niflheim', category: 'A10:2025 Exceptional Conditions' },
    };

    for (const realm of production) {
      expect(realm.name).toBe(expected[realm.order].name);
      expect(realm.theme.category).toBe(expected[realm.order].category);
    }
  });

  it('gives every realm category the AXX:2025 prefix matching its order', () => {
    for (const realm of production) {
      const prefix = `A${String(realm.order).padStart(2, '0')}:2025`;
      expect(realm.theme.category.startsWith(prefix)).toBe(true);
    }
  });
});

describe('realm theming', () => {
  const production = getProductionRealms();

  it('gives every realm a valid #rrggbb primaryColor', () => {
    for (const realm of REALMS_METADATA) {
      expect(realm.theme.primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('color journey: luminance strictly increases from Niflheim (10) up to Asgard (1)', () => {
    const ascent = [...production].sort((a, b) => b.order - a.order);
    for (let i = 1; i < ascent.length; i++) {
      const prev = relativeLuminance(ascent[i - 1].theme.primaryColor);
      const curr = relativeLuminance(ascent[i].theme.primaryColor);
      expect(curr).toBeGreaterThan(prev);
    }
  });

  it('crowns Asgard with the brightest color and roots Niflheim with the darkest', () => {
    const byOrder = (o: number) => production.find((r) => r.order === o)!;
    const luminances = production.map((r) => relativeLuminance(r.theme.primaryColor));
    expect(relativeLuminance(byOrder(1).theme.primaryColor)).toBe(Math.max(...luminances));
    expect(relativeLuminance(byOrder(10).theme.primaryColor)).toBe(Math.min(...luminances));
  });

  it('gives every realm a unique non-empty emblem icon', () => {
    for (const realm of REALMS_METADATA) {
      expect(realm.theme.icon.length).toBeGreaterThan(0);
    }
    const icons = REALMS_METADATA.map((r) => r.theme.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('references a theme image that exists in the frontend public assets', () => {
    for (const realm of production) {
      const imagePath = path.join(FRONTEND_PUBLIC, realm.theme.image);
      expect(fs.existsSync(imagePath)).toBe(true);
    }
  });
});

describe('landing page artwork assets', () => {
  const MAX_ASSET_BYTES = 500 * 1024; // keep page weight sane — no raw multi-MB PNGs

  it.each(['/assets/yggdrasil-hero.webp', '/assets/yggdrasil-map.webp'])(
    '%s exists and is under 500KB',
    (assetPath) => {
      const fullPath = path.join(FRONTEND_PUBLIC, assetPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      expect(fs.statSync(fullPath).size).toBeGreaterThan(0);
      expect(fs.statSync(fullPath).size).toBeLessThan(MAX_ASSET_BYTES);
    }
  );
});

describe('helper functions', () => {
  it('getRealmByName is case-insensitive', () => {
    expect(getRealmByName('ASGARD')?.name).toBe('asgard');
    expect(getRealmByName('Niflheim')?.name).toBe('niflheim');
    expect(getRealmByName('nonexistent')).toBeUndefined();
  });

  it('getProductionRealms excludes the sample realm', () => {
    expect(getProductionRealms().some((r) => r.name === 'sample')).toBe(false);
  });

  it('getRealmsSorted orders realms by ascent by default (entry first)', () => {
    const descending = getRealmsSorted();
    expect(descending[0].order).toBeGreaterThan(descending[descending.length - 1].order);

    const ascending = getRealmsSorted(true);
    expect(ascending[0].order).toBe(1);
  });
});
