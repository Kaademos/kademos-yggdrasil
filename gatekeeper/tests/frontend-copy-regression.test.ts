/**
 * Regression tests for landing page copy.
 *
 * The platform has TEN realms (OWASP Top 10:2025); "Nine Realms" copy shipped
 * in several components and was fixed. These scans keep it from coming back
 * and pin the identity/branding strings the redesign introduced.
 */
import * as fs from 'fs';
import * as path from 'path';

const FRONTEND_SRC = path.resolve(__dirname, '../frontend/src');

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    return /\.(tsx?|css|html)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe('landing page copy regressions', () => {
  const files = collectSourceFiles(FRONTEND_SRC);

  it('finds frontend source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('never refers to "Nine Realms" — the platform has ten', () => {
    const offenders = files.filter((f) => /nine\s+realms/i.test(fs.readFileSync(f, 'utf-8')));
    expect(offenders.map((f) => path.relative(FRONTEND_SRC, f))).toEqual([]);
  });

  it('Hero carries the OWASP Top 10 • 2025 badge', () => {
    const hero = fs.readFileSync(path.join(FRONTEND_SRC, 'components/Hero.tsx'), 'utf-8');
    expect(hero).toMatch(/OWASP Top 10 • 2025/);
  });

  it('Hero uses the World Tree hero artwork', () => {
    const hero = fs.readFileSync(path.join(FRONTEND_SRC, 'components/Hero.tsx'), 'utf-8');
    expect(hero).toContain('/assets/yggdrasil-hero.webp');
  });

  it('RealmMap uses the World Tree map backdrop', () => {
    const map = fs.readFileSync(path.join(FRONTEND_SRC, 'components/RealmMap.tsx'), 'utf-8');
    expect(map).toContain('/assets/yggdrasil-map.webp');
  });
});
