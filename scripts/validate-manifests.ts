#!/usr/bin/env ts-node
/**
 * Manifest Validation Script
 * 
 * Validates all realm vulnerability manifests for:
 * - JSON schema compliance
 * - CVSS score validation
 * - CWE reference validation
 * - Endpoint accuracy
 */

import * as fs from 'fs';
import * as path from 'path';

interface ManifestVuln {
  cwe?: string;
  cvss?: {
    version: string;
    score: number;
    vector: string;
  };
  endpoints?: Array<{
    method: string;
    path: string;
    vulnerable: boolean;
  }>;
}

interface Manifest {
  realm: string;
  level: number;
  owasp: string;
  vulnerabilities?: ManifestVuln[];
}

const REALMS = [
  'niflheim', 'helheim', 'svartalfheim', 'jotunheim', 'muspelheim',
  'nidavellir', 'vanaheim', 'midgard', 'alfheim', 'asgard'
];

let errors = 0;
let warnings = 0;

function validateCVSS(score: number, vector: string): boolean {
  if (score < 0 || score > 10) {
    console.error(`   ❌ Invalid CVSS score: ${score} (must be 0-10)`);
    return false;
  }
  
  if (!vector.startsWith('CVSS:3.')) {
    console.error(`   ❌ Invalid CVSS vector format: ${vector}`);
    return false;
  }
  
  return true;
}

function validateCWE(cwe: string): boolean {
  if (!cwe.match(/^CWE-\d+$/)) {
    console.error(`   ❌ Invalid CWE format: ${cwe} (expected CWE-XXX)`);
    return false;
  }
  return true;
}

function validateEndpoint(endpoint: any): boolean {
  const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  
  if (!endpoint.method || !validMethods.includes(endpoint.method)) {
    console.error(`   ❌ Invalid HTTP method: ${endpoint.method}`);
    return false;
  }
  
  if (!endpoint.path || !endpoint.path.startsWith('/')) {
    console.error(`   ❌ Invalid endpoint path: ${endpoint.path}`);
    return false;
  }
  
  if (typeof endpoint.vulnerable !== 'boolean') {
    console.error(`   ❌ Missing or invalid 'vulnerable' flag for ${endpoint.path}`);
    return false;
  }
  
  return true;
}

function validateManifest(realm: string): boolean {
  const manifestPath = path.join(__dirname, '..', 'realms', realm, 'manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ ${realm.toUpperCase()}: Manifest not found`);
    errors++;
    return false;
  }
  
  try {
    const content = fs.readFileSync(manifestPath, 'utf-8');
    const manifest: Manifest = JSON.parse(content);
    
    console.log(`\n📋 Validating ${realm.toUpperCase()}...`);
    
    // Validate required fields
    if (!manifest.realm || manifest.realm.toUpperCase() !== realm.toUpperCase()) {
      console.error(`   ❌ Realm name mismatch: ${manifest.realm} vs ${realm}`);
      errors++;
    }
    
    if (!manifest.level || manifest.level < 1 || manifest.level > 10) {
      console.error(`   ❌ Invalid level: ${manifest.level}`);
      errors++;
    }
    
    if (!manifest.owasp || !manifest.owasp.match(/^A\d{2}:\d{4}$/)) {
      console.error(`   ❌ Invalid OWASP format: ${manifest.owasp}`);
      errors++;
    }
    
    // Validate vulnerabilities
    if (!manifest.vulnerabilities || manifest.vulnerabilities.length === 0) {
      console.error(`   ❌ No vulnerabilities defined`);
      errors++;
    } else {
      for (const vuln of manifest.vulnerabilities) {
        if (vuln.cwe && !validateCWE(vuln.cwe)) {
          errors++;
        }
        
        if (vuln.cvss) {
          if (!validateCVSS(vuln.cvss.score, vuln.cvss.vector)) {
            errors++;
          }
        }
        
        if (vuln.endpoints) {
          for (const endpoint of vuln.endpoints) {
            if (!validateEndpoint(endpoint)) {
              errors++;
            }
          }
        }
      }
    }
    
    console.log(`   ✅ ${realm.toUpperCase()} manifest valid`);
    return true;
    
  } catch (error: any) {
    console.error(`❌ ${realm.toUpperCase()}: JSON parse error - ${error.message}`);
    errors++;
    return false;
  }
}

function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   Yggdrasil Manifest Validation Tool          ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');
  
  for (const realm of REALMS) {
    validateManifest(realm);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('Summary:');
  console.log(`  Total realms: ${REALMS.length}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Warnings: ${warnings}`);
  
  if (errors > 0) {
    console.log('\n❌ Validation failed with errors');
    process.exit(1);
  } else {
    console.log('\n✅ All manifests valid!');
    process.exit(0);
  }
}

main();
