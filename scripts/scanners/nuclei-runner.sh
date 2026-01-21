#!/bin/bash
#
# Nuclei Scanner Integration for Yggdrasil
# 
# Runs Nuclei vulnerability scanner against all realms and generates
# a benchmark scorecard comparing detected vs expected vulnerabilities.
#

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8080}"
OUTPUT_DIR="${OUTPUT_DIR:-./scanner-results/nuclei}"
SEVERITY="${NUCLEI_SEVERITY:-critical,high,medium}"
NUCLEI_TEMPLATES="${NUCLEI_TEMPLATES:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Yggdrasil Nuclei Scanner Benchmark                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if Nuclei is installed
if ! command -v nuclei &> /dev/null; then
    echo -e "${RED}❌ Nuclei is not installed${NC}"
    echo ""
    echo "Install Nuclei:"
    echo "  go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest"
    echo ""
    echo "Or using brew:"
    echo "  brew install nuclei"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Nuclei found:${NC} $(nuclei -version 2>&1 | head -1)"
echo ""

# Check if Yggdrasil is running
echo "🔍 Checking if Yggdrasil is running..."
if ! curl -sf "$BASE_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ Yggdrasil is not running at $BASE_URL${NC}"
    echo ""
    echo "Start Yggdrasil:"
    echo "  make up"
    echo ""
    exit 1
fi
echo -e "${GREEN}✅ Yggdrasil is running${NC}"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="$OUTPUT_DIR/nuclei-results-$TIMESTAMP.json"
REPORT_FILE="$OUTPUT_DIR/nuclei-report-$TIMESTAMP.txt"

echo "📁 Output Directory: $OUTPUT_DIR"
echo "📄 Results File: $(basename $RESULTS_FILE)"
echo ""

# Extract expected vulnerabilities from manifests
echo "📋 Extracting expected vulnerabilities from manifests..."
EXPECTED_FILE="$OUTPUT_DIR/expected-vulnerabilities.json"

if command -v jq &> /dev/null; then
    # Create a comprehensive list of expected vulnerabilities
    jq -s '[
        .[] | 
        {
            realm: .realm,
            level: .level,
            owasp: .owasp,
            vulnerabilities: [
                .vulnerabilities[] | 
                {
                    id: .id,
                    type: .type,
                    cwe: .cwe,
                    cvss_score: .cvss.score,
                    endpoints: [
                        .endpoints[] | 
                        select(.vulnerable == true) | 
                        {
                            method: .method,
                            path: .path
                        }
                    ]
                }
            ]
        }
    ]' realms/*/manifest.json > "$EXPECTED_FILE"
    
    TOTAL_EXPECTED=$(jq '[.[] | .vulnerabilities[]] | length' "$EXPECTED_FILE")
    echo -e "${BLUE}   Total expected vulnerabilities: $TOTAL_EXPECTED${NC}"
else
    echo -e "${YELLOW}   ⚠️  jq not found - skipping expected vulnerability extraction${NC}"
    TOTAL_EXPECTED="unknown"
fi
echo ""

# Scan configuration
echo "🎯 Scan Configuration:"
echo "   Target: $BASE_URL"
echo "   Severity: $SEVERITY"
if [ -n "$NUCLEI_TEMPLATES" ]; then
    echo "   Templates: $NUCLEI_TEMPLATES"
else
    echo "   Templates: Default (auto-update)"
fi
echo ""

# Run Nuclei scan
echo "🚀 Running Nuclei scan..."
echo "   This may take 2-5 minutes depending on template count"
echo ""

START_TIME=$(date +%s)

# Build Nuclei command
NUCLEI_CMD="nuclei -u $BASE_URL -severity $SEVERITY -json -o $RESULTS_FILE"

if [ -n "$NUCLEI_TEMPLATES" ]; then
    NUCLEI_CMD="$NUCLEI_CMD -t $NUCLEI_TEMPLATES"
fi

# Run scan with output
eval $NUCLEI_CMD 2>&1 | tee "$REPORT_FILE.tmp"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${GREEN}✅ Scan completed in ${DURATION}s${NC}"
echo ""

# Parse results
if [ -f "$RESULTS_FILE" ]; then
    FINDINGS_COUNT=$(wc -l < "$RESULTS_FILE" || echo "0")
    echo "📊 Scan Results:"
    echo "   Total findings: $FINDINGS_COUNT"
    
    if [ $FINDINGS_COUNT -gt 0 ] && command -v jq &> /dev/null; then
        # Count by severity
        CRITICAL=$(jq -r 'select(.info.severity=="critical")' "$RESULTS_FILE" | grep -c "template-id" || echo "0")
        HIGH=$(jq -r 'select(.info.severity=="high")' "$RESULTS_FILE" | grep -c "template-id" || echo "0")
        MEDIUM=$(jq -r 'select(.info.severity=="medium")' "$RESULTS_FILE" | grep -c "template-id" || echo "0")
        
        echo "   Critical: $CRITICAL"
        echo "   High: $HIGH"
        echo "   Medium: $MEDIUM"
        echo ""
        
        # Show detected vulnerabilities
        echo "🔍 Detected Vulnerabilities:"
        jq -r '.info.name' "$RESULTS_FILE" | sort -u | head -20 | while read -r vuln; do
            echo "   • $vuln"
        done
        
        if [ $(jq -r '.info.name' "$RESULTS_FILE" | sort -u | wc -l) -gt 20 ]; then
            echo "   ... and more (see full report)"
        fi
        echo ""
        
        # Check against expected vulnerabilities (if jq available)
        if [ -f "$EXPECTED_FILE" ] && [ "$TOTAL_EXPECTED" != "unknown" ]; then
            echo "📈 Benchmark Scorecard:"
            echo "   Expected vulnerabilities: $TOTAL_EXPECTED"
            echo "   Detected by Nuclei: $FINDINGS_COUNT"
            
            if [ $TOTAL_EXPECTED -gt 0 ]; then
                DETECTION_RATE=$(echo "scale=1; $FINDINGS_COUNT * 100 / $TOTAL_EXPECTED" | bc)
                echo "   Detection rate: ${DETECTION_RATE}%"
            fi
            echo ""
        fi
    fi
else
    echo -e "${YELLOW}⚠️  No findings or results file not created${NC}"
    echo ""
fi

# Generate detailed report
echo "📝 Generating detailed report..."

cat > "$REPORT_FILE" <<EOF
Yggdrasil Nuclei Scanner Benchmark Report
==========================================

Scan Information:
  Date: $(date)
  Target: $BASE_URL
  Duration: ${DURATION}s
  Nuclei Version: $(nuclei -version 2>&1 | head -1)
  Severity Filter: $SEVERITY

Results:
  Total Findings: $FINDINGS_COUNT
  Expected Vulnerabilities: $TOTAL_EXPECTED

Detection Summary:
EOF

if [ -f "$RESULTS_FILE" ] && [ $FINDINGS_COUNT -gt 0 ] && command -v jq &> /dev/null; then
    echo "" >> "$REPORT_FILE"
    echo "Findings by Severity:" >> "$REPORT_FILE"
    echo "  Critical: $CRITICAL" >> "$REPORT_FILE"
    echo "  High: $HIGH" >> "$REPORT_FILE"
    echo "  Medium: $MEDIUM" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    echo "Detected Vulnerability Types:" >> "$REPORT_FILE"
    jq -r '.info.name' "$RESULTS_FILE" | sort -u | while read -r vuln; do
        COUNT=$(jq -r --arg name "$vuln" 'select(.info.name==$name)' "$RESULTS_FILE" | grep -c "template-id" || echo "0")
        echo "  • $vuln ($COUNT occurrence(s))" >> "$REPORT_FILE"
    done
    
    echo "" >> "$REPORT_FILE"
    echo "Affected Endpoints:" >> "$REPORT_FILE"
    jq -r '.matched-at' "$RESULTS_FILE" | sort -u | head -50 | while read -r endpoint; do
        echo "  • $endpoint" >> "$REPORT_FILE"
    done
fi

echo "" >> "$REPORT_FILE"
echo "Files Generated:" >> "$REPORT_FILE"
echo "  Results (JSON): $RESULTS_FILE" >> "$REPORT_FILE"
echo "  Report (TXT): $REPORT_FILE" >> "$REPORT_FILE"
if [ -f "$EXPECTED_FILE" ]; then
    echo "  Expected Vulns: $EXPECTED_FILE" >> "$REPORT_FILE"
fi

rm -f "$REPORT_FILE.tmp"

echo -e "${GREEN}✅ Report generated: $REPORT_FILE${NC}"
echo ""

# Realm-specific scanning (optional)
echo "🎭 Realm-Specific Scanning:"
echo "   Run individual realm scans:"
for realm in niflheim helheim svartalfheim jotunheim muspelheim nidavellir vanaheim midgard alfheim asgard; do
    echo "   nuclei -u $BASE_URL/realms/$realm/ -severity $SEVERITY -json -o ${OUTPUT_DIR}/${realm}-results.json"
done
echo ""

# Summary
echo "════════════════════════════════════════════════════════════"
echo "🎯 Benchmark Complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Results:"
echo "  📄 JSON results: $RESULTS_FILE"
echo "  📝 Full report: $REPORT_FILE"
echo ""
echo "Next Steps:"
echo "  1. Review findings: cat $REPORT_FILE"
echo "  2. Compare with manifests: ./scripts/scanners/compare-results.py"
echo "  3. Run realm-specific scans for deeper analysis"
echo ""
echo "Documentation:"
echo "  See docs/SCANNER-BENCHMARKING.md for interpretation guide"
echo ""
