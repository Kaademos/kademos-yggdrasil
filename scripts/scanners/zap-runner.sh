#!/bin/bash
#
# OWASP ZAP Scanner Integration for Yggdrasil
# 
# Runs OWASP ZAP vulnerability scanner against all realms and generates
# a comprehensive security report.
#

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8080}"
OUTPUT_DIR="${OUTPUT_DIR:-./scanner-results/zap}"
SCAN_TYPE="${SCAN_TYPE:-full}" # baseline, full, or api
ZAP_IMAGE="${ZAP_IMAGE:-zaproxy/zap-stable}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Yggdrasil OWASP ZAP Scanner Benchmark                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo ""
    echo "Install Docker:"
    echo "  https://docs.docker.com/get-docker/"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Docker found:${NC} $(docker --version)"
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

# Pull latest ZAP image
echo "📥 Pulling OWASP ZAP Docker image..."
docker pull "$ZAP_IMAGE" > /dev/null 2>&1 || true
echo -e "${GREEN}✅ ZAP image ready${NC}"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$OUTPUT_DIR/zap-report-$TIMESTAMP.html"
JSON_FILE="$OUTPUT_DIR/zap-report-$TIMESTAMP.json"
XML_FILE="$OUTPUT_DIR/zap-report-$TIMESTAMP.xml"

echo "📁 Output Directory: $OUTPUT_DIR"
echo "📄 Report Files:"
echo "   HTML: $(basename $REPORT_FILE)"
echo "   JSON: $(basename $JSON_FILE)"
echo "   XML: $(basename $XML_FILE)"
echo ""

# Scan configuration
echo "🎯 Scan Configuration:"
echo "   Target: $BASE_URL"
echo "   Scan Type: $SCAN_TYPE"
echo "   ZAP Image: $ZAP_IMAGE"
echo ""

START_TIME=$(date +%s)

# Run appropriate scan based on type
case "$SCAN_TYPE" in
    baseline)
        echo "🚀 Running ZAP Baseline Scan (passive only)..."
        echo "   This is a quick scan that won't attack the application"
        echo "   Duration: ~2-3 minutes"
        echo ""
        
        docker run --rm \
            --network host \
            -v "$(pwd)/$OUTPUT_DIR":/zap/wrk/:rw \
            -t "$ZAP_IMAGE" \
            zap-baseline.py \
            -t "$BASE_URL" \
            -r "$(basename $REPORT_FILE)" \
            -J "$(basename $JSON_FILE)" \
            -x "$(basename $XML_FILE)" \
            -I \
            || echo "Scan completed with warnings (expected for vulnerable app)"
        ;;
        
    full)
        echo "🚀 Running ZAP Full Scan (active + passive)..."
        echo "   ⚠️  This will actively attack the application"
        echo "   Duration: ~10-15 minutes"
        echo ""
        
        docker run --rm \
            --network host \
            -v "$(pwd)/$OUTPUT_DIR":/zap/wrk/:rw \
            -t "$ZAP_IMAGE" \
            zap-full-scan.py \
            -t "$BASE_URL" \
            -r "$(basename $REPORT_FILE)" \
            -J "$(basename $JSON_FILE)" \
            -x "$(basename $XML_FILE)" \
            -I \
            || echo "Scan completed with findings (expected for vulnerable app)"
        ;;
        
    api)
        echo "🚀 Running ZAP API Scan..."
        echo "   This scans API endpoints specifically"
        echo "   Duration: ~5-7 minutes"
        echo ""
        
        docker run --rm \
            --network host \
            -v "$(pwd)/$OUTPUT_DIR":/zap/wrk/:rw \
            -t "$ZAP_IMAGE" \
            zap-api-scan.py \
            -t "$BASE_URL" \
            -f openapi \
            -r "$(basename $REPORT_FILE)" \
            -J "$(basename $JSON_FILE)" \
            -x "$(basename $XML_FILE)" \
            -I \
            || echo "Scan completed with findings (expected for vulnerable app)"
        ;;
        
    *)
        echo -e "${RED}❌ Invalid scan type: $SCAN_TYPE${NC}"
        echo "Valid options: baseline, full, api"
        exit 1
        ;;
esac

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${GREEN}✅ Scan completed in ${DURATION}s${NC}"
echo ""

# Parse JSON results if available
if [ -f "$OUTPUT_DIR/$(basename $JSON_FILE)" ] && command -v jq &> /dev/null; then
    JSON_PATH="$OUTPUT_DIR/$(basename $JSON_FILE)"
    
    echo "📊 Scan Results:"
    
    # Count alerts by risk level
    HIGH=$(jq '[.site[].alerts[] | select(.riskcode=="3")] | length' "$JSON_PATH" 2>/dev/null || echo "0")
    MEDIUM=$(jq '[.site[].alerts[] | select(.riskcode=="2")] | length' "$JSON_PATH" 2>/dev/null || echo "0")
    LOW=$(jq '[.site[].alerts[] | select(.riskcode=="1")] | length' "$JSON_PATH" 2>/dev/null || echo "0")
    INFO=$(jq '[.site[].alerts[] | select(.riskcode=="0")] | length' "$JSON_PATH" 2>/dev/null || echo "0")
    
    echo "   High Risk: $HIGH"
    echo "   Medium Risk: $MEDIUM"
    echo "   Low Risk: $LOW"
    echo "   Informational: $INFO"
    echo ""
    
    # Show top vulnerabilities
    echo "🔍 Top Vulnerabilities Found:"
    jq -r '.site[].alerts[] | select(.riskcode=="3" or .riskcode=="2") | .name' "$JSON_PATH" 2>/dev/null | \
        sort -u | head -15 | while read -r vuln; do
        echo "   • $vuln"
    done
    echo ""
    
    # Compare with expected vulnerabilities
    if [ -f "realms/niflheim/manifest.json" ]; then
        TOTAL_EXPECTED=$(jq -s '[.[] | .vulnerabilities[]] | length' realms/*/manifest.json 2>/dev/null || echo "unknown")
        TOTAL_FINDINGS=$((HIGH + MEDIUM))
        
        echo "📈 Benchmark Scorecard:"
        echo "   Expected vulnerabilities: $TOTAL_EXPECTED"
        echo "   High/Medium findings: $TOTAL_FINDINGS"
        
        if [ "$TOTAL_EXPECTED" != "unknown" ] && [ $TOTAL_EXPECTED -gt 0 ]; then
            DETECTION_RATE=$(echo "scale=1; $TOTAL_FINDINGS * 100 / $TOTAL_EXPECTED" | bc 2>/dev/null || echo "N/A")
            echo "   Estimated detection rate: ${DETECTION_RATE}%"
            echo "   (Note: ZAP may report multiple instances of same vulnerability)"
        fi
        echo ""
    fi
fi

# Generate summary report
SUMMARY_FILE="$OUTPUT_DIR/zap-summary-$TIMESTAMP.txt"

cat > "$SUMMARY_FILE" <<EOF
Yggdrasil OWASP ZAP Scanner Benchmark Report
=============================================

Scan Information:
  Date: $(date)
  Target: $BASE_URL
  Scan Type: $SCAN_TYPE
  Duration: ${DURATION}s
  ZAP Version: $(docker run --rm "$ZAP_IMAGE" zap.sh -version 2>/dev/null | head -1 || echo "Unknown")

Results Summary:
  High Risk: ${HIGH:-N/A}
  Medium Risk: ${MEDIUM:-N/A}
  Low Risk: ${LOW:-N/A}
  Informational: ${INFO:-N/A}

Files Generated:
  HTML Report: $REPORT_FILE
  JSON Report: $JSON_FILE
  XML Report: $XML_FILE
  Summary: $SUMMARY_FILE

To View Report:
  Browser: open $REPORT_FILE
  Command: cat $SUMMARY_FILE

Realm-Specific Scanning:
  To scan individual realms, run:
    SCAN_TYPE=full BASE_URL=http://localhost:8080/realms/niflheim ./scripts/scanners/zap-runner.sh

Documentation:
  See docs/SCANNER-BENCHMARKING.md for detailed analysis guidance
EOF

echo -e "${GREEN}✅ Summary generated: $SUMMARY_FILE${NC}"
echo ""

# Realm-specific scanning suggestions
echo "🎭 Realm-Specific Scanning:"
echo "   For deeper analysis, scan each realm individually:"
echo ""
for realm in niflheim helheim svartalfheim jotunheim muspelheim nidavellir vanaheim midgard alfheim asgard; do
    echo "   BASE_URL=$BASE_URL/realms/$realm SCAN_TYPE=full ./scripts/scanners/zap-runner.sh"
done
echo ""

# Summary
echo "════════════════════════════════════════════════════════════"
echo "🎯 ZAP Scan Complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Results:"
echo "  📄 HTML report: $REPORT_FILE"
echo "  📊 JSON data: $JSON_FILE"
echo "  📋 Summary: $SUMMARY_FILE"
echo ""
echo "View HTML Report:"
echo "  xdg-open $REPORT_FILE    # Linux"
echo "  open $REPORT_FILE        # macOS"
echo "  start $REPORT_FILE       # Windows"
echo ""
echo "Next Steps:"
echo "  1. Review HTML report for detailed findings"
echo "  2. Compare with manifests: ./scripts/scanners/compare-results.py"
echo "  3. Run realm-specific scans for individual analysis"
echo ""
echo "Documentation:"
echo "  See docs/SCANNER-BENCHMARKING.md for result interpretation"
echo ""
