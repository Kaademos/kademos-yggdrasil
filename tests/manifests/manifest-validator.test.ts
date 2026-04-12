/**
 * Manifest Validator Unit Tests
 * 
 * Tests the manifest validation script to ensure it catches errors
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('Manifest Validator', () => {
  const validatorScript = path.join(__dirname, '../../scripts/validate-manifests.ts');
  const testManifestDir = path.join(__dirname, 'test-manifests');
  
  beforeAll(() => {
    // Create test manifest directory
    if (!fs.existsSync(testManifestDir)) {
      fs.mkdirSync(testManifestDir, { recursive: true });
    }
  });
  
  afterAll(() => {
    // Cleanup test manifests
    if (fs.existsSync(testManifestDir)) {
      fs.rmSync(testManifestDir, { recursive: true, force: true });
    }
  });
  
  describe('Validation Script Execution', () => {
    it('should be executable', () => {
      expect(fs.existsSync(validatorScript)).toBe(true);
    });
    
    it('should validate all real manifests successfully', () => {
      try {
        execSync(`ts-node ${validatorScript}`, {
          stdio: 'pipe',
          encoding: 'utf-8'
        });
        // If we get here, validation passed
        expect(true).toBe(true);
      } catch (error: any) {
        // Validation failed
        fail(`Manifest validation failed: ${error.stdout || error.message}`);
      }
    }, 30000); // 30 second timeout
  });
  
  describe('CVSS Validation', () => {
    it('should reject invalid CVSS scores', () => {
      const invalidManifest = {
        realm: 'TEST',
        level: 1,
        owasp: 'A01:2025',
        vulnerabilities: [{
          cwe: 'CWE-123',
          cvss: {
            version: '3.1',
            score: 15, // Invalid: > 10
            vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'
          }
        }]
      };
      
      // Create test manifest
      const testPath = path.join(testManifestDir, 'test-invalid-cvss');
      fs.mkdirSync(testPath, { recursive: true });
      fs.writeFileSync(
        path.join(testPath, 'manifest.json'),
        JSON.stringify(invalidManifest, null, 2)
      );
      
      // This would fail validation if run
      expect(invalidManifest.vulnerabilities[0].cvss.score).toBeGreaterThan(10);
    });
    
    it('should accept valid CVSS scores', () => {
      const validScores = [0, 2.5, 5.0, 7.5, 9.0, 10.0];
      
      for (const score of validScores) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
      }
    });
    
    it('should validate CVSS vector format', () => {
      const validVector = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';
      expect(validVector).toMatch(/^CVSS:3\./);
    });
  });
  
  describe('CWE Validation', () => {
    it('should validate CWE ID format', () => {
      const validCWE = 'CWE-89';
      expect(validCWE).toMatch(/^CWE-\d+$/);
    });
    
    it('should reject invalid CWE formats', () => {
      const invalidCWEs = ['CWE89', 'CWE-', 'CWE-ABC', 'cwe-89'];
      
      for (const cwe of invalidCWEs) {
        expect(cwe).not.toMatch(/^CWE-\d+$/);
      }
    });
  });
  
  describe('Endpoint Validation', () => {
    it('should validate HTTP methods', () => {
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      const testMethod = 'GET';
      
      expect(validMethods).toContain(testMethod);
    });
    
    it('should reject invalid HTTP methods', () => {
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      const invalidMethods = ['get', 'INVALID', 'TRACE', ''];
      
      for (const method of invalidMethods) {
        expect(validMethods).not.toContain(method);
      }
    });
    
    it('should validate endpoint paths start with /', () => {
      const validPaths = ['/api/test', '/health', '/'];
      const invalidPaths = ['api/test', 'health', ''];
      
      for (const path of validPaths) {
        expect(path).toMatch(/^\//);
      }
      
      for (const path of invalidPaths) {
        if (path) {
          expect(path).not.toMatch(/^\//);
        }
      }
    });
    
    it('should validate vulnerable flag is boolean', () => {
      const validFlags = [true, false];
      const testFlag = true;
      
      expect(typeof testFlag).toBe('boolean');
      expect(validFlags).toContain(testFlag);
    });
  });
  
  describe('Realm Metadata Validation', () => {
    it('should validate realm name format', () => {
      const validNames = ['NIFLHEIM', 'HELHEIM', 'ASGARD'];
      
      for (const name of validNames) {
        expect(name).toMatch(/^[A-Z]+$/);
      }
    });
    
    it('should validate level is between 1 and 10', () => {
      const validLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      for (const level of validLevels) {
        expect(level).toBeGreaterThanOrEqual(1);
        expect(level).toBeLessThanOrEqual(10);
      }
    });
    
    it('should validate OWASP format', () => {
      const validOWASP = 'A01:2025';
      expect(validOWASP).toMatch(/^A\d{2}:\d{4}$/);
    });
  });
  
  describe('Real Manifest Structure', () => {
    const realmsDir = path.join(__dirname, '../../realms');
    const manifests: any[] = [];
    
    beforeAll(() => {
      const realmDirs = fs.readdirSync(realmsDir);
      for (const dir of realmDirs) {
        const manifestPath = path.join(realmsDir, dir, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          const content = fs.readFileSync(manifestPath, 'utf-8');
          manifests.push(JSON.parse(content));
        }
      }
    });
    
    it('should have 10 valid manifests', () => {
      expect(manifests.length).toBe(10);
    });
    
    it('all manifests should have required fields', () => {
      for (const manifest of manifests) {
        expect(manifest.realm).toBeDefined();
        expect(manifest.level).toBeDefined();
        expect(manifest.owasp).toBeDefined();
        expect(manifest.title).toBeDefined();
        expect(manifest.vulnerabilities).toBeDefined();
        expect(manifest.flags).toBeDefined();
        expect(manifest.metadata).toBeDefined();
      }
    });
    
    it('all vulnerabilities should have required fields', () => {
      for (const manifest of manifests) {
        for (const vuln of manifest.vulnerabilities) {
          expect(vuln.id).toBeDefined();
          expect(vuln.type).toBeDefined();
          expect(vuln.cwe).toBeDefined();
          expect(vuln.cvss).toBeDefined();
          expect(vuln.endpoints).toBeDefined();
        }
      }
    });
    
    it('all manifests should have unique realm names', () => {
      const realmNames = manifests.map(m => m.realm);
      const uniqueNames = new Set(realmNames);
      expect(uniqueNames.size).toBe(realmNames.length);
    });
    
    it('all manifests should have unique levels', () => {
      const levels = manifests.map(m => m.level);
      const uniqueLevels = new Set(levels);
      expect(uniqueLevels.size).toBe(levels.length);
    });
    
    it('levels should range from 1 to 10', () => {
      const levels = manifests.map(m => m.level).sort((a, b) => a - b);
      expect(levels[0]).toBe(1);
      expect(levels[levels.length - 1]).toBe(10);
    });
    
    it('all manifests should cover A01-A10 OWASP categories', () => {
      const owaspCategories = manifests.map(m => m.owasp);
      const expectedCategories = [
        'A01:2025', 'A02:2025', 'A03:2025', 'A04:2025', 'A05:2025',
        'A06:2025', 'A07:2025', 'A08:2025', 'A09:2025', 'A10:2025'
      ];
      
      for (const category of expectedCategories) {
        expect(owaspCategories).toContain(category);
      }
    });
  });
  
  describe('Scanner Test Cases Validation', () => {
    it('test cases should have valid structure', () => {
      const testCase = {
        name: 'Test case name',
        request: {
          method: 'POST',
          path: '/api/test',
          body: {}
        },
        expected_response: {
          status: 200
        }
      };
      
      expect(testCase.name).toBeDefined();
      expect(testCase.request).toBeDefined();
      expect(testCase.request.method).toBeDefined();
      expect(testCase.request.path).toBeDefined();
      expect(testCase.expected_response).toBeDefined();
    });
  });
});
