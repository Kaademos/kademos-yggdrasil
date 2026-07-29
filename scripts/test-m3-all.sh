#!/bin/bash
#
# Milestone 3 - Complete Integration Test
# Tests all three realms (Niflheim, Helheim, Svartalfheim)
#

set -e

echo "🚀 Milestone 3 - Complete Realm Journey Test"
echo "=============================================="
echo ""

GATEKEEPER_URL="${GATEKEEPER_URL:-http://localhost:8080}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TOTAL_TESTS=0
TOTAL_PASSED=0
TOTAL_FAILED=0

run_test() {
  local test_name="$1"
  local test_script="$2"
  
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}Testing: $test_name${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo ""
  
  if bash "$test_script"; then
    echo -e "${GREEN}✅ $test_name PASSED${NC}"
    ((TOTAL_PASSED++))
  else
    echo -e "${RED}❌ $test_name FAILED${NC}"
    ((TOTAL_FAILED++))
  fi
  
  ((TOTAL_TESTS++))
}

echo "Starting M3 integration test suite..."
echo ""

# Test Realm 10: Niflheim
run_test "Realm 10 - Niflheim (A10 Exceptional Conditions)" \
  "$SCRIPT_DIR/test-niflheim.sh"

# Test Realm 9: Helheim  
run_test "Realm 9 - Helheim (A09 Logging Failures)" \
  "$SCRIPT_DIR/test-helheim.sh"

# Test Realm 8: Svartalfheim
run_test "Realm 8 - Svartalfheim (A08 Data Integrity)" \
  "$SCRIPT_DIR/test-svartalfheim.sh"

echo ""
echo "=============================================="
echo "Milestone 3 Test Summary"
echo "=============================================="
echo -e "Total Tests:  $TOTAL_TESTS"
echo -e "Passed:       ${GREEN}$TOTAL_PASSED${NC}"
echo -e "Failed:       ${RED}$TOTAL_FAILED${NC}"
echo ""

if [ $TOTAL_FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 ALL MILESTONE 3 TESTS PASSED! 🎉${NC}"
  echo ""
  echo "Realms Tested:"
  echo "  ✅ Niflheim (Realm 10) - A10:2025 Exceptional Conditions"
  echo "  ✅ Helheim (Realm 9) - A09:2025 Logging & Alerting Failures"
  echo "  ✅ Svartalfheim (Realm 8) - A08:2025 Software/Data Integrity"
  echo ""
  echo "Milestone 3 is complete and ready for deployment!"
  exit 0
else
  echo -e "${RED}⚠️  Some tests failed. Review errors above.${NC}"
  exit 1
fi
