/**
 * Manifest Validator Tests
 *
 * Two things are checked here:
 *   1. `scripts/validate-manifests.ts` runs clean against the real manifests.
 *   2. The manifests themselves hold the invariants the platform depends on —
 *      ten realms, unique names and levels, full A01–A10 coverage, and
 *      well-formed CWE / CVSS / endpoint data.
 *
 * These assertions run against the actual manifests on disk rather than against
 * inline literals, so they fail when a realm is edited incorrectly.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

const REPO_ROOT = path.join(__dirname, '../..');
const REALMS_DIR = path.join(REPO_ROOT, 'realms');
const VALIDATOR = path.join(REPO_ROOT, 'scripts/validate-manifests.ts');
const TS_NODE = path.join(REPO_ROOT, 'flag-oracle/node_modules/.bin/ts-node');

const VALID_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

interface Manifest {
  realm: string;
  level: number;
  owasp: string;
  title: string;
  vulnerabilities: Array<{
    id: string;
    type: string;
    cwe: string;
    cvss: { version: string; score: number; vector: string };
    endpoints: Array<{ method: string; path: string; vulnerable: boolean }>;
  }>;
  flags: unknown;
  metadata: unknown;
}

/** Every realm manifest on disk, with the realm directory it came from. */
function loadManifests(): Array<{ dir: string; manifest: Manifest }> {
  return fs
    .readdirSync(REALMS_DIR)
    .map((dir) => ({ dir, file: path.join(REALMS_DIR, dir, 'manifest.json') }))
    .filter(({ file }) => fs.existsSync(file))
    .map(({ dir, file }) => ({
      dir,
      manifest: JSON.parse(fs.readFileSync(file, 'utf-8')) as Manifest,
    }));
}

const entries = loadManifests();
const manifests = entries.map((e) => e.manifest);

test.describe('Manifest validator script', () => {
  test('is present', () => {
    expect(fs.existsSync(VALIDATOR)).toBe(true);
  });

  test('validates every real manifest without error', () => {
    // ts-node lives in flag-oracle; skip rather than fail on a clone without deps.
    test.skip(!fs.existsSync(TS_NODE), 'flag-oracle dependencies not installed');

    // Throws on a non-zero exit, which is exactly the failure we want surfaced.
    const output = execFileSync(
      TS_NODE,
      [
        '--compiler-options',
        '{"module":"node16","moduleResolution":"node16","esModuleInterop":true,"types":["node"]}',
        VALIDATOR,
      ],
      { cwd: REPO_ROOT, encoding: 'utf-8', stdio: 'pipe' }
    );

    expect(output).toContain('All manifests valid');
  });
});

test.describe('Realm coverage', () => {
  test('there are exactly ten realm manifests', () => {
    expect(manifests).toHaveLength(10);
  });

  test('realm names are unique', () => {
    const names = manifests.map((m) => m.realm);
    expect(new Set(names).size).toBe(names.length);
  });

  test('levels are unique and span 1 to 10', () => {
    const levels = manifests.map((m) => m.level).sort((a, b) => a - b);
    expect(new Set(levels).size).toBe(levels.length);
    expect(levels[0]).toBe(1);
    expect(levels[levels.length - 1]).toBe(10);
  });

  test('all ten OWASP 2025 categories are covered exactly once', () => {
    const expected = Array.from(
      { length: 10 },
      (_, i) => `A${String(i + 1).padStart(2, '0')}:2025`
    );
    const actual = manifests.map((m) => m.owasp).sort();
    expect(actual).toEqual(expected.sort());
  });

  test('the manifest realm name matches its directory', () => {
    for (const { dir, manifest } of entries) {
      expect(manifest.realm.toLowerCase()).toBe(dir.toLowerCase());
    }
  });
});

test.describe('Manifest structure', () => {
  test('every manifest carries the required top-level fields', () => {
    const required = [
      'realm',
      'level',
      'owasp',
      'title',
      'vulnerabilities',
      'flags',
      'metadata',
    ] as const;

    for (const { dir, manifest } of entries) {
      for (const field of required) {
        expect(manifest[field], `${dir}.${field}`).toBeDefined();
      }
    }
  });

  test('every realm name is upper-case alphabetic', () => {
    for (const m of manifests) {
      expect(m.realm).toMatch(/^[A-Z]+$/);
    }
  });

  test('every level is between 1 and 10', () => {
    for (const m of manifests) {
      expect(m.level).toBeGreaterThanOrEqual(1);
      expect(m.level).toBeLessThanOrEqual(10);
    }
  });

  test('every OWASP identifier is well-formed', () => {
    for (const m of manifests) {
      expect(m.owasp).toMatch(/^A\d{2}:\d{4}$/);
    }
  });

  test('every vulnerability carries the required fields', () => {
    for (const { dir, manifest } of entries) {
      expect(manifest.vulnerabilities.length, `${dir} has no vulnerabilities`).toBeGreaterThan(0);

      for (const vuln of manifest.vulnerabilities) {
        for (const field of ['id', 'type', 'cwe', 'cvss', 'endpoints'] as const) {
          expect(vuln[field], `${dir}/${vuln.id}.${field}`).toBeDefined();
        }
      }
    }
  });
});

test.describe('CWE and CVSS data', () => {
  test('every CWE identifier is well-formed', () => {
    for (const { dir, manifest } of entries) {
      for (const vuln of manifest.vulnerabilities) {
        expect(vuln.cwe, `${dir}/${vuln.id}`).toMatch(/^CWE-\d+$/);
      }
    }
  });

  test('every CVSS score is within 0-10', () => {
    for (const { dir, manifest } of entries) {
      for (const vuln of manifest.vulnerabilities) {
        expect(vuln.cvss.score, `${dir}/${vuln.id}`).toBeGreaterThanOrEqual(0);
        expect(vuln.cvss.score, `${dir}/${vuln.id}`).toBeLessThanOrEqual(10);
      }
    }
  });

  test('every CVSS vector declares a 3.x version', () => {
    for (const { dir, manifest } of entries) {
      for (const vuln of manifest.vulnerabilities) {
        expect(vuln.cvss.vector, `${dir}/${vuln.id}`).toMatch(/^CVSS:3\./);
        expect(vuln.cvss.version, `${dir}/${vuln.id}`).toMatch(/^3\./);
      }
    }
  });
});

test.describe('Declared endpoints', () => {
  test('every endpoint uses a supported HTTP method', () => {
    for (const { dir, manifest } of entries) {
      for (const vuln of manifest.vulnerabilities) {
        for (const ep of vuln.endpoints) {
          expect(VALID_METHODS, `${dir}/${vuln.id} ${ep.path}`).toContain(ep.method);
        }
      }
    }
  });

  test('every endpoint path is absolute', () => {
    for (const { dir, manifest } of entries) {
      for (const vuln of manifest.vulnerabilities) {
        for (const ep of vuln.endpoints) {
          expect(ep.path, `${dir}/${vuln.id}`).toMatch(/^\//);
        }
      }
    }
  });

  test('every endpoint marks its vulnerable flag as a boolean', () => {
    for (const { dir, manifest } of entries) {
      for (const vuln of manifest.vulnerabilities) {
        for (const ep of vuln.endpoints) {
          expect(typeof ep.vulnerable, `${dir}/${vuln.id} ${ep.path}`).toBe('boolean');
        }
      }
    }
  });

  test('every vulnerability declares at least one vulnerable endpoint', () => {
    for (const { dir, manifest } of entries) {
      for (const vuln of manifest.vulnerabilities) {
        const vulnerable = vuln.endpoints.filter((e) => e.vulnerable);
        expect(vulnerable.length, `${dir}/${vuln.id}`).toBeGreaterThan(0);
      }
    }
  });
});
