#!/bin/bash
#
# Svartalfheim Realm Integration Test
# Tests the A08:2025 Software/Data Integrity vulnerability (Insecure Deserialization)
#

set -e

echo "🧪 Testing Svartalfheim Realm (A08:2025 - Software/Data Integrity)"
echo "=================================================================="

GATEKEEPER_URL="${GATEKEEPER_URL:-http://localhost:8080}"
REALM_PATH="/realms/svartalfheim"
USER_ID="svartalfheim-test-$(date +%s)"

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
assert_contains "$HEALTH_RESPONSE" "UP" "Health check returns UP status"

echo ""
echo "Step 2: Test normal badge creation"
echo "-----------------------------------"

NORMAL_RESPONSE=$(curl -s "$GATEKEEPER_URL$REALM_PATH/" -c /tmp/cookies.txt)
assert_contains "$NORMAL_RESPONSE" "Svartalfheim" "Main page loads successfully"
assert_contains "$NORMAL_RESPONSE" "Guild Badge" "Badge display present"

echo ""
echo "Step 3: Create exploit payload"
echo "-------------------------------"

# The exploit signature (Base64 encoded)
EXPLOIT_COOKIE=$(echo -n "EXPLOIT_SIGNATURE" | base64)

if [ -z "$EXPLOIT_COOKIE" ]; then
  echo -e "${RED}✗${NC} Failed to create exploit cookie"
  ((TESTS_FAILED++))
  exit 1
else
  echo -e "${GREEN}✓${NC} Exploit payload created: $EXPLOIT_COOKIE"
  ((TESTS_PASSED++))
fi

echo ""
echo "Step 4: Send malicious cookie"
echo "------------------------------"

EXPLOIT_RESPONSE=$(curl -s "$GATEKEEPER_URL$REALM_PATH/" \
  -H "Cookie: guildBadge=$EXPLOIT_COOKIE")

if [ -z "$EXPLOIT_RESPONSE" ]; then
  echo -e "${RED}✗${NC} No response received"
  ((TESTS_FAILED++))
  exit 1
else
  echo -e "${GREEN}✓${NC} Response received from exploit"
  ((TESTS_PASSED++))
fi

echo ""
echo "Step 5: Verify exploit success"
echo "-------------------------------"

assert_contains "$EXPLOIT_RESPONSE" "EXPLOITED" "Guild name shows exploitation"
assert_contains "$EXPLOIT_RESPONSE" "Hacker" "Rank escalated to Hacker"
assert_contains "$EXPLOIT_RESPONSE" "ADMIN ACCESS GRANTED" "Admin access achieved"

echo ""
echo "Step 6: Extract flag from badge message"
echo "----------------------------------------"

assert_contains "$EXPLOIT_RESPONSE" "YGGDRASIL{" "Response contains flag"
assert_contains "$EXPLOIT_RESPONSE" "SVARTALFHEIM" "Flag contains SVARTALFHEIM"
assert_contains "$EXPLOIT_RESPONSE" "Forge compromised" "Exploit message present"

FLAG=$(echo "$EXPLOIT_RESPONSE" | grep -oP 'YGGDRASIL\{[^}]+\}' | head -1)

if [ -z "$FLAG" ]; then
  echo -e "${RED}✗${NC} Failed to extract flag"
  ((TESTS_FAILED++))
  exit 1
else
  echo -e "${GREEN}✓${NC} Flag extracted: $FLAG"
  ((TESTS_PASSED++))
fi

echo ""
echo "Step 7: Validate flag format"
echo "-----------------------------"

if echo "$FLAG" | grep -qP '^YGGDRASIL\{SVARTALFHEIM:[a-f0-9-]+\}$'; then
  echo -e "${GREEN}✓${NC} Flag format valid"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗${NC} Invalid flag format: $FLAG"
  ((TESTS_FAILED++))
fi

echo ""
echo "Step 8: Test badge forging (legitimate feature)"
echo "------------------------------------------------"

FORGE_RESPONSE=$(curl -s -X POST "$GATEKEEPER_URL$REALM_PATH/forge-badge" \
  -d "guildName=Test+Guild&rank=Master&level=50")

assert_contains "$FORGE_RESPONSE" "Test Guild" "Badge forged successfully"
assert_contains "$FORGE_RESPONSE" "Master" "Rank set correctly"

echo ""
echo "=================================================================="
echo "Test Summary"
echo "=================================================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

# Cleanup
rm -f /tmp/cookies.txt

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All Svartalfheim tests PASSED${NC}"
  echo ""
  echo "Flag captured: $FLAG"
  exit 0
else
  echo -e "${RED}❌ Some tests FAILED${NC}"
  exit 1
fi
