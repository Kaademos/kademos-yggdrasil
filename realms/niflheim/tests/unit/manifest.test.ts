/**
 * Niflheim Manifest Unit Tests
 * 
 * Validates that the manifest accurately describes Niflheim's vulnerabilities
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Niflheim Manifest', () => {
  let manifest: any;
  
  beforeAll(() => {
    const manifestPath = path.join(__dirname, '../../manifest.json');
    const content = fs.readFileSync(manifestPath, 'utf-8');
    manifest = JSON.parse(content);
  });
  
  describe('Basic Structure', () => {
    it('should have correct realm name', () => {
      expect(manifest.realm).toBe('NIFLHEIM');
    });
    
    it('should have correct level', () => {
      expect(manifest.level).toBe(10);
    });
    
    it('should have correct OWASP category', () => {
      expect(manifest.owasp).toBe('A10:2025');
    });
    
    it('should have title', () => {
      expect(manifest.title).toBe('Exceptional Conditions');
    });
    
    it('should have description', () => {
      expect(manifest.description).toBeDefined();
      expect(manifest.description.length).toBeGreaterThan(50);
    });
  });
  
  describe('Vulnerability Documentation', () => {
    it('should have at least one vulnerability', () => {
      expect(manifest.vulnerabilities).toBeDefined();
      expect(manifest.vulnerabilities.length).toBeGreaterThan(0);
    });
    
    it('should document CWE-755 (Exceptional Conditions)', () => {
      const vuln = manifest.vulnerabilities.find((v: any) => v.cwe === 'CWE-755');
      expect(vuln).toBeDefined();
      expect(vuln.type).toContain('Input Validation');
    });
    
    it('should have CVSS score in High range', () => {
      const vuln = manifest.vulnerabilities[0];
      expect(vuln.cvss).toBeDefined();
      expect(vuln.cvss.score).toBeGreaterThanOrEqual(7.0);
      expect(vuln.cvss.score).toBeLessThanOrEqual(8.0);
      expect(vuln.cvss.version).toBe('3.1');
    });
    
    it('should have valid CVSS vector', () => {
      const vuln = manifest.vulnerabilities[0];
      expect(vuln.cvss.vector).toMatch(/^CVSS:3\.1\//);
      expect(vuln.cvss.vector).toContain('AV:N'); // Network attack vector
    });
  });
  
  describe('Endpoints Documentation', () => {
    it('should document /api/regulate endpoint as vulnerable', () => {
      const vuln = manifest.vulnerabilities[0];
      const endpoint = vuln.endpoints.find((e: any) => 
        e.path === '/api/regulate' && e.method === 'POST'
      );
      
      expect(endpoint).toBeDefined();
      expect(endpoint.vulnerable).toBe(true);
    });
    
    it('should document safe endpoints', () => {
      const vuln = manifest.vulnerabilities[0];
      const safeEndpoints = vuln.endpoints.filter((e: any) => !e.vulnerable);
      
      expect(safeEndpoints.length).toBeGreaterThan(0);
      expect(safeEndpoints.some((e: any) => e.path === '/api/status')).toBe(true);
    });
    
    it('should document endpoint parameters', () => {
      const vuln = manifest.vulnerabilities[0];
      const regulate = vuln.endpoints.find((e: any) => e.path === '/api/regulate');
      
      expect(regulate.parameters).toBeDefined();
      expect(regulate.parameters.pressure).toBe('number');
      expect(regulate.parameters.temperature).toBe('number');
      expect(regulate.parameters.flowRate).toBe('number');
    });
  });
  
  describe('Exploit Documentation', () => {
    it('should document exploit steps', () => {
      const vuln = manifest.vulnerabilities[0];
      expect(vuln.exploit_steps).toBeDefined();
      expect(vuln.exploit_steps.length).toBeGreaterThan(3);
    });
    
    it('should document exploit indicators', () => {
      const vuln = manifest.vulnerabilities[0];
      expect(vuln.exploit_indicators).toBeDefined();
      expect(vuln.exploit_indicators).toContain('pressure > 10000');
      expect(vuln.exploit_indicators).toContain('temperature < -500');
      expect(vuln.exploit_indicators).toContain('flowRate > 9999');
    });
    
    it('should document remediation', () => {
      const vuln = manifest.vulnerabilities[0];
      expect(vuln.remediation).toBeDefined();
      expect(vuln.remediation).toContain('input validation');
    });
  });
  
  describe('Scanner Test Cases', () => {
    it('should have scanner test cases', () => {
      expect(manifest.scanner_test_cases).toBeDefined();
      expect(manifest.scanner_test_cases.length).toBeGreaterThan(0);
    });
    
    it('should have test case for integer overflow', () => {
      const testCase = manifest.scanner_test_cases.find((tc: any) => 
        tc.name.toLowerCase().includes('overflow')
      );
      
      expect(testCase).toBeDefined();
      expect(testCase.request.method).toBe('POST');
      expect(testCase.request.path).toBe('/api/regulate');
      expect(testCase.request.body.pressure).toBeGreaterThan(10000);
    });
    
    it('should have test case for temperature underflow', () => {
      const testCase = manifest.scanner_test_cases.find((tc: any) => 
        tc.name.toLowerCase().includes('temperature')
      );
      
      expect(testCase).toBeDefined();
      expect(testCase.request.body.temperature).toBeLessThan(-500);
    });
    
    it('should have test case for normal operation', () => {
      const testCase = manifest.scanner_test_cases.find((tc: any) => 
        tc.name.toLowerCase().includes('normal')
      );
      
      expect(testCase).toBeDefined();
      expect(testCase.expected_response.status).toBe(200);
    });
  });
  
  describe('Flag Information', () => {
    it('should document flag format', () => {
      expect(manifest.flags).toBeDefined();
      expect(manifest.flags.format).toMatch(/YGGDRASIL\\{NIFLHEIM/);
    });
    
    it('should document flag location', () => {
      expect(manifest.flags.location).toBe('crash_report_download');
    });
    
    it('should document retrieval method', () => {
      expect(manifest.flags.retrieval_method).toBeDefined();
      expect(manifest.flags.retrieval_method).toContain('crash');
    });
  });
  
  describe('Learning Objectives', () => {
    it('should have learning objectives', () => {
      expect(manifest.learning_objectives).toBeDefined();
      expect(manifest.learning_objectives.length).toBeGreaterThan(3);
    });
    
    it('should mention input validation', () => {
      const objectives = manifest.learning_objectives.join(' ');
      expect(objectives.toLowerCase()).toContain('input validation');
    });
  });
  
  describe('Metadata', () => {
    it('should have metadata', () => {
      expect(manifest.metadata).toBeDefined();
      expect(manifest.metadata.created).toBeDefined();
      expect(manifest.metadata.version).toBeDefined();
      expect(manifest.metadata.validated).toBe(true);
    });
    
    it('should have maintainer', () => {
      expect(manifest.metadata.maintainer).toBe('Project Yggdrasil');
    });
  });
  
  describe('Realm Chaining', () => {
    it('should unlock Helheim', () => {
      expect(manifest.realm_chaining).toBeDefined();
      expect(manifest.realm_chaining.unlocks).toBe('HELHEIM');
    });
    
    it('should document clues for realm chaining', () => {
      if (manifest.realm_chaining.clues_in_exploit) {
        expect(manifest.realm_chaining.clues_in_exploit.length).toBeGreaterThan(0);
        expect(manifest.realm_chaining.clues_in_exploit[0]).toContain('Helheim');
      }
    });
  });
});
