/**
 * Manifest Accuracy Integration Tests
 * 
 * Validates that vulnerability manifests accurately describe the actual
 * vulnerable endpoints in each realm.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const REALMS_DIR = path.join(__dirname, '../../realms');

interface Manifest {
  realm: string;
  level: number;
  vulnerabilities: Array<{
    id: string;
    type: string;
    cwe: string;
    endpoints: Array<{
      method: string;
      path: string;
      vulnerable: boolean;
      description?: string;
    }>;
    scanner_test_cases?: Array<{
      name: string;
      request: {
        method: string;
        path: string;
        body?: any;
        headers?: Record<string, string>;
      };
      expected_response: {
        status?: number;
        status_one_of?: number[];
        body_contains?: string[];
        notes?: string;
      };
    }>;
  }>;
}

// Load all manifests
function loadManifests(): Manifest[] {
  const manifests: Manifest[] = [];
  const realmDirs = fs.readdirSync(REALMS_DIR);
  
  for (const realmDir of realmDirs) {
    const manifestPath = path.join(REALMS_DIR, realmDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(content) as Manifest;
        manifests.push(manifest);
      } catch (error) {
        console.warn(`Warning: Could not load manifest for ${realmDir}:`, error);
      }
    }
  }
  
  return manifests.sort((a, b) => b.level - a.level); // Sort by level descending
}

const manifests = loadManifests();

test.describe('Manifest Endpoint Accuracy', () => {
  
  test('should load all 10 realm manifests', () => {
    expect(manifests.length).toBe(10);
    
    const expectedRealms = [
      'NIFLHEIM', 'HELHEIM', 'SVARTALFHEIM', 'JOTUNHEIM', 'MUSPELHEIM',
      'NIDAVELLIR', 'VANAHEIM', 'MIDGARD', 'ALFHEIM', 'ASGARD'
    ];
    
    const loadedRealms = manifests.map(m => m.realm);
    for (const realm of expectedRealms) {
      expect(loadedRealms).toContain(realm);
    }
  });
  
  for (const manifest of manifests) {
    test.describe(`${manifest.realm} (Level ${manifest.level})`, () => {
      
      test('should have at least one vulnerability documented', () => {
        expect(manifest.vulnerabilities.length).toBeGreaterThan(0);
      });
      
      test('should have vulnerable endpoints documented', () => {
        let hasVulnerableEndpoint = false;
        
        for (const vuln of manifest.vulnerabilities) {
          if (vuln.endpoints && vuln.endpoints.length > 0) {
            for (const endpoint of vuln.endpoints) {
              if (endpoint.vulnerable) {
                hasVulnerableEndpoint = true;
                break;
              }
            }
          }
        }
        
        expect(hasVulnerableEndpoint).toBe(true);
      });
      
      // Test each vulnerability's endpoints
      for (const vuln of manifest.vulnerabilities) {
        test.describe(`Vulnerability: ${vuln.id} (${vuln.cwe})`, () => {
          
          for (const endpoint of vuln.endpoints || []) {
            if (!endpoint.vulnerable) continue; // Skip safe endpoints
            
            test(`${endpoint.method} ${endpoint.path} should be accessible`, async ({ request }) => {
              const url = `${BASE_URL}/realms/${manifest.realm.toLowerCase()}${endpoint.path}`;
              
              try {
                let response;
                if (endpoint.method === 'GET') {
                  response = await request.get(url);
                } else if (endpoint.method === 'POST') {
                  response = await request.post(url, {
                    data: {},
                    failOnStatusCode: false
                  });
                } else {
                  // Other methods
                  response = await request.fetch(url, {
                    method: endpoint.method,
                    failOnStatusCode: false
                  });
                }
                
                // Endpoint should exist (not 404)
                expect(response.status()).not.toBe(404);
                
              } catch (error) {
                // If endpoint doesn't exist at all, that's a manifest error
                throw new Error(`Endpoint ${endpoint.method} ${endpoint.path} does not exist but is marked as vulnerable in manifest`);
              }
            });
          }
        });
      }
    });
  }
});

test.describe('Manifest Scanner Test Cases', () => {
  
  for (const manifest of manifests) {
    for (const vuln of manifest.vulnerabilities) {
      if (!vuln.scanner_test_cases || vuln.scanner_test_cases.length === 0) {
        continue;
      }
      
      test.describe(`${manifest.realm} - ${vuln.id}`, () => {
        
        for (const testCase of vuln.scanner_test_cases) {
          test(`Scanner test: ${testCase.name}`, async ({ request }) => {
            const { method, path: testPath, body, headers } = testCase.request;
            const expected = testCase.expected_response;
            
            // Build full URL
            const url = testPath.startsWith('http') 
              ? testPath 
              : `${BASE_URL}/realms/${manifest.realm.toLowerCase()}${testPath}`;
            
            // Make request
            let response;
            try {
              if (method === 'GET') {
                response = await request.get(url, {
                  headers,
                  failOnStatusCode: false
                });
              } else if (method === 'POST') {
                response = await request.post(url, {
                  data: body,
                  headers,
                  failOnStatusCode: false
                });
              } else {
                response = await request.fetch(url, {
                  method,
                  body: body ? JSON.stringify(body) : undefined,
                  headers: {
                    'Content-Type': 'application/json',
                    ...headers
                  },
                  failOnStatusCode: false
                });
              }
              
              // Validate response
              if (expected.status) {
                expect(response.status()).toBe(expected.status);
              }
              
              if (expected.status_one_of) {
                expect(expected.status_one_of).toContain(response.status());
              }
              
              if (expected.body_contains) {
                const body = await response.text();
                for (const text of expected.body_contains) {
                  expect(body).toContain(text);
                }
              }
              
            } catch (error) {
              console.error(`Test case failed: ${testCase.name}`);
              console.error(`URL: ${url}`);
              console.error(`Error: ${error}`);
              throw error;
            }
          });
        }
      });
    }
  }
});

test.describe('Manifest Data Quality', () => {
  
  test('all manifests should have valid CWE IDs', () => {
    const cwePattern = /^CWE-\d+$/;
    
    for (const manifest of manifests) {
      for (const vuln of manifest.vulnerabilities) {
        expect(vuln.cwe).toMatch(cwePattern);
      }
    }
  });
  
  test('all manifests should have CVSS scores', () => {
    for (const manifest of manifests) {
      for (const vuln of manifest.vulnerabilities) {
        const cvss = (vuln as any).cvss;
        expect(cvss).toBeDefined();
        expect(cvss.score).toBeGreaterThanOrEqual(0);
        expect(cvss.score).toBeLessThanOrEqual(10);
        expect(cvss.version).toBeDefined();
      }
    }
  });
  
  test('all vulnerable endpoints should have method and path', () => {
    for (const manifest of manifests) {
      for (const vuln of manifest.vulnerabilities) {
        for (const endpoint of vuln.endpoints || []) {
          if (endpoint.vulnerable) {
            expect(endpoint.method).toBeDefined();
            expect(endpoint.path).toBeDefined();
            expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).toContain(endpoint.method);
            expect(endpoint.path).toMatch(/^\//); // Should start with /
          }
        }
      }
    }
  });
  
  test('scanner test cases should have valid structure', () => {
    for (const manifest of manifests) {
      for (const vuln of manifest.vulnerabilities) {
        if (!vuln.scanner_test_cases) continue;
        
        for (const testCase of vuln.scanner_test_cases) {
          expect(testCase.name).toBeDefined();
          expect(testCase.request).toBeDefined();
          expect(testCase.request.method).toBeDefined();
          expect(testCase.request.path).toBeDefined();
          expect(testCase.expected_response).toBeDefined();
        }
      }
    }
  });
});

test.describe('Realm Accessibility', () => {
  
  for (const manifest of manifests) {
    test(`${manifest.realm} realm should be accessible`, async ({ request }) => {
      const url = `${BASE_URL}/realms/${manifest.realm.toLowerCase()}/`;
      
      const response = await request.get(url, {
        failOnStatusCode: false
      });
      
      // Realm should exist (200) or require authentication (401/403)
      expect([200, 401, 403]).toContain(response.status());
    });
  }
});

test.describe('Manifest Coverage Statistics', () => {
  
  test('should provide coverage report', () => {
    const stats = {
      total_manifests: manifests.length,
      total_vulnerabilities: 0,
      total_endpoints: 0,
      vulnerable_endpoints: 0,
      test_cases: 0,
      cwes_covered: new Set<string>(),
      owasp_categories: new Set<string>()
    };
    
    for (const manifest of manifests) {
      stats.total_vulnerabilities += manifest.vulnerabilities.length;
      stats.owasp_categories.add((manifest as any).owasp);
      
      for (const vuln of manifest.vulnerabilities) {
        stats.cwes_covered.add(vuln.cwe);
        stats.total_endpoints += vuln.endpoints?.length || 0;
        stats.vulnerable_endpoints += vuln.endpoints?.filter(e => e.vulnerable).length || 0;
        stats.test_cases += vuln.scanner_test_cases?.length || 0;
      }
    }
    
    console.log('\n📊 Manifest Coverage Statistics:');
    console.log(`   Total Manifests: ${stats.total_manifests}`);
    console.log(`   Total Vulnerabilities: ${stats.total_vulnerabilities}`);
    console.log(`   Vulnerable Endpoints: ${stats.vulnerable_endpoints}/${stats.total_endpoints}`);
    console.log(`   Scanner Test Cases: ${stats.test_cases}`);
    console.log(`   Unique CWEs: ${stats.cwes_covered.size}`);
    console.log(`   OWASP Categories: ${stats.owasp_categories.size}`);
    
    // Assertions
    expect(stats.total_manifests).toBe(10);
    expect(stats.total_vulnerabilities).toBeGreaterThanOrEqual(10);
    expect(stats.vulnerable_endpoints).toBeGreaterThan(0);
    expect(stats.cwes_covered.size).toBeGreaterThanOrEqual(10);
    expect(stats.owasp_categories.size).toBe(10); // A01-A10
  });
});
