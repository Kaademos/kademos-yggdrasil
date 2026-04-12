#!/bin/bash
#
# Generate Manifest Unit Tests for All Realms
#
# Creates per-realm manifest.test.ts files based on a template
#

set -e

echo "📝 Generating Manifest Unit Tests"
echo "=================================="
echo ""

REALMS=(niflheim helheim svartalfheim jotunheim muspelheim nidavellir vanaheim midgard alfheim asgard)
TEMPLATE_REALM="niflheim"
TEMPLATE_FILE="realms/$TEMPLATE_REALM/tests/unit/manifest.test.ts"

if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "❌ Template file not found: $TEMPLATE_FILE"
    exit 1
fi

echo "✅ Using template: $TEMPLATE_FILE"
echo ""

GENERATED=0
SKIPPED=0

for realm in "${REALMS[@]}"; do
    # Skip template realm
    if [ "$realm" = "$TEMPLATE_REALM" ]; then
        echo "⏭️  Skipping $realm (template)"
        ((SKIPPED++))
        continue
    fi
    
    # Create test directory if it doesn't exist
    TEST_DIR="realms/$realm/tests/unit"
    mkdir -p "$TEST_DIR"
    
    TEST_FILE="$TEST_DIR/manifest.test.ts"
    
    # Check if test already exists
    if [ -f "$TEST_FILE" ]; then
        echo "⏭️  $realm - test exists, skipping"
        ((SKIPPED++))
        continue
    fi
    
    # Load manifest to get details
    MANIFEST_FILE="realms/$realm/manifest.json"
    if [ ! -f "$MANIFEST_FILE" ]; then
        echo "❌ $realm - manifest not found"
        continue
    fi
    
    # Extract realm details using jq
    if command -v jq &> /dev/null; then
        REALM_NAME=$(jq -r '.realm' "$MANIFEST_FILE")
        REALM_LEVEL=$(jq -r '.level' "$MANIFEST_FILE")
        REALM_OWASP=$(jq -r '.owasp' "$MANIFEST_FILE")
        REALM_TITLE=$(jq -r '.title' "$MANIFEST_FILE")
        PRIMARY_CWE=$(jq -r '.vulnerabilities[0].cwe' "$MANIFEST_FILE")
        VULN_TYPE=$(jq -r '.vulnerabilities[0].type' "$MANIFEST_FILE")
        UNLOCK_REALM=$(jq -r '.realm_chaining.unlocks // "COMPLETE"' "$MANIFEST_FILE")
    else
        echo "⚠️  jq not found - using realm name as is"
        REALM_NAME=$(echo "$realm" | tr '[:lower:]' '[:upper:]')
        REALM_LEVEL="unknown"
        REALM_OWASP="unknown"
        REALM_TITLE="unknown"
        PRIMARY_CWE="CWE-XXX"
        VULN_TYPE="unknown"
        UNLOCK_REALM="unknown"
    fi
    
    # Generate test file by replacing template values
    cat > "$TEST_FILE" <<EOF
/**
 * $REALM_NAME Manifest Unit Tests
 * 
 * Validates that the manifest accurately describes $REALM_NAME's vulnerabilities
 */

import * as fs from 'fs';
import * as path from 'path';

describe('$REALM_NAME Manifest', () => {
  let manifest: any;
  
  beforeAll(() => {
    const manifestPath = path.join(__dirname, '../../manifest.json');
    const content = fs.readFileSync(manifestPath, 'utf-8');
    manifest = JSON.parse(content);
  });
  
  describe('Basic Structure', () => {
    it('should have correct realm name', () => {
      expect(manifest.realm).toBe('$REALM_NAME');
    });
    
    it('should have correct level', () => {
      expect(manifest.level).toBe($REALM_LEVEL);
    });
    
    it('should have correct OWASP category', () => {
      expect(manifest.owasp).toBe('$REALM_OWASP');
    });
    
    it('should have title', () => {
      expect(manifest.title).toBe('$REALM_TITLE');
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
    
    it('should document primary vulnerability ($PRIMARY_CWE)', () => {
      const vuln = manifest.vulnerabilities.find((v: any) => v.cwe === '$PRIMARY_CWE');
      expect(vuln).toBeDefined();
      expect(vuln.type).toBeDefined();
    });
    
    it('should have CVSS scores', () => {
      for (const vuln of manifest.vulnerabilities) {
        expect(vuln.cvss).toBeDefined();
        expect(vuln.cvss.score).toBeGreaterThanOrEqual(0);
        expect(vuln.cvss.score).toBeLessThanOrEqual(10);
        expect(vuln.cvss.version).toBe('3.1');
      }
    });
    
    it('should have valid CVSS vectors', () => {
      for (const vuln of manifest.vulnerabilities) {
        expect(vuln.cvss.vector).toMatch(/^CVSS:3\.1\//);
      }
    });
  });
  
  describe('Endpoints Documentation', () => {
    it('should have vulnerable endpoints documented', () => {
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
    
    it('should have valid HTTP methods', () => {
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      
      for (const vuln of manifest.vulnerabilities) {
        for (const endpoint of vuln.endpoints || []) {
          expect(validMethods).toContain(endpoint.method);
        }
      }
    });
    
    it('should have valid paths', () => {
      for (const vuln of manifest.vulnerabilities) {
        for (const endpoint of vuln.endpoints || []) {
          expect(endpoint.path).toMatch(/^\//);
        }
      }
    });
  });
  
  describe('Exploit Documentation', () => {
    it('should document exploit steps', () => {
      const vuln = manifest.vulnerabilities[0];
      expect(vuln.exploit_steps).toBeDefined();
      expect(vuln.exploit_steps.length).toBeGreaterThan(0);
    });
    
    it('should document exploit indicators', () => {
      const vuln = manifest.vulnerabilities[0];
      expect(vuln.exploit_indicators).toBeDefined();
      expect(vuln.exploit_indicators.length).toBeGreaterThan(0);
    });
    
    it('should document remediation', () => {
      const vuln = manifest.vulnerabilities[0];
      expect(vuln.remediation).toBeDefined();
      expect(vuln.remediation.length).toBeGreaterThan(50);
    });
  });
  
  describe('Scanner Test Cases', () => {
    it('should have scanner test cases', () => {
      let hasTestCases = false;
      
      for (const vuln of manifest.vulnerabilities) {
        if (vuln.scanner_test_cases && vuln.scanner_test_cases.length > 0) {
          hasTestCases = true;
          break;
        }
      }
      
      expect(hasTestCases).toBe(true);
    });
    
    it('test cases should have valid structure', () => {
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
    });
  });
  
  describe('Flag Information', () => {
    it('should document flag format', () => {
      expect(manifest.flags).toBeDefined();
      expect(manifest.flags.format).toMatch(/YGGDRASIL\\\\{$REALM_NAME/);
    });
    
    it('should document flag location', () => {
      expect(manifest.flags.location).toBeDefined();
    });
    
    it('should document retrieval method', () => {
      expect(manifest.flags.retrieval_method).toBeDefined();
    });
  });
  
  describe('Learning Objectives', () => {
    it('should have learning objectives', () => {
      expect(manifest.learning_objectives).toBeDefined();
      expect(manifest.learning_objectives.length).toBeGreaterThan(0);
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
    it('should have realm chaining info', () => {
      expect(manifest.realm_chaining).toBeDefined();
      expect(manifest.realm_chaining.unlocks).toBe('$UNLOCK_REALM');
    });
  });
});
EOF
    
    echo "✅ $realm - generated test"
    ((GENERATED++))
done

echo ""
echo "=================================="
echo "📊 Summary:"
echo "   Generated: $GENERATED tests"
echo "   Skipped: $SKIPPED tests"
echo "   Total: $((GENERATED + SKIPPED)) realms"
echo ""

if [ $GENERATED -gt 0 ]; then
    echo "✅ Manifest tests generated successfully!"
    echo ""
    echo "Run tests with:"
    echo "  cd realms/<realm> && npm test -- manifest.test.ts"
    echo ""
else
    echo "ℹ️  No new tests generated (all exist)"
fi
