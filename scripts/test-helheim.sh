#!/bin/bash
#
# Helheim Realm Integration Test
# Tests the A09:2025 Logging & Alerting Failures vulnerability
#
# The flag is not stored anywhere. It is emitted inside an alert, and only after
# the alert pipeline has been repaired at all three broken stages. This script
# walks that path and asserts the flag is unreachable at every earlier step.
#

set -e

echo "🧪 Testing Helheim Realm (A09:2025 - Logging & Alerting Failures)"
echo "=================================================================="

GATEKEEPER_URL="${GATEKEEPER_URL:-http://localhost:8080}"
REALM_PATH="/realms/helheim"
BASE="$GATEKEEPER_URL$REALM_PATH"

# Diagnostic credential leaked by Niflheim's crash report (admin:IceBound2025)
AUTH_HEADER="Authorization: Basic YWRtaW46SWNlQm91bmQyMDI1"
JSON_HEADER="Content-Type: application/json"

GREEN='\033[0;32m'
RED='\033[0;31m'
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

assert_not_contains() {
  local haystack="$1"
  local needle="$2"
  local description="$3"

  if echo "$haystack" | grep -q "$needle"; then
    echo -e "${RED}✗${NC} $description"
    ((TESTS_FAILED++))
  else
    echo -e "${GREEN}✓${NC} $description"
    ((TESTS_PASSED++))
  fi
}

echo ""
echo "Step 1: Verify realm is accessible"
echo "-----------------------------------"

HEALTH_RESPONSE=$(curl -s "$BASE/health")
assert_contains "$HEALTH_RESPONSE" "helheim" "Health check returns helheim realm"

echo ""
echo "Step 2: SOC console is credential-gated"
echo "----------------------------------------"

UNAUTH_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/soc/rules")
assert_contains "$UNAUTH_STATUS" "401" "Unauthenticated SOC access rejected"

AUTH_STATUS=$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH_HEADER" "$BASE/api/soc/rules")
assert_contains "$AUTH_STATUS" "200" "Niflheim diagnostic credential accepted"

echo ""
echo "Step 3: The Niflheim correlation chain resolves"
echo "------------------------------------------------"

CORRELATION_LOG=$(curl -s -H "$AUTH_HEADER" "$BASE/admin/logs?file=niflheim_correlation.log")
assert_contains "$CORRELATION_LOG" "a7f3c1d8" "Correlation log exists and carries the incident ID"
assert_contains "$CORRELATION_LOG" "10.13.37.42" "Correlation log names the attacker host"
assert_contains "$CORRELATION_LOG" "NO ALERT GENERATED" "Correlation log records the alerting failure"
assert_not_contains "$CORRELATION_LOG" "YGGDRASIL{" "Flag is NOT present in the log archive"

echo ""
echo "Step 4: Health endpoint reports a green light it cannot justify"
echo "----------------------------------------------------------------"

HEALTH_SOC=$(curl -s -H "$AUTH_HEADER" "$BASE/api/soc/pipeline/health")
assert_contains "$HEALTH_SOC" "operational" "Alerting reported operational"
assert_contains "$HEALTH_SOC" "lastSelfTest" "No delivery self-test has ever run"

echo ""
echo "Step 5: Shipped pipeline delivers nothing"
echo "------------------------------------------"

REPLAY_BROKEN=$(curl -s -X POST -H "$AUTH_HEADER" "$BASE/api/soc/pipeline/replay")
assert_contains "$REPLAY_BROKEN" '"delivered":0' "Zero alerts delivered in shipped state"
assert_not_contains "$REPLAY_BROKEN" "YGGDRASIL{" "Flag NOT released while the pipeline is broken"

echo ""
echo "Step 6: Control-plane changes leave no audit trail"
echo "---------------------------------------------------"

AUDIT=$(curl -s -H "$AUTH_HEADER" "$BASE/api/soc/audit")
assert_contains "$AUDIT" '"total":0' "Audit trail is empty (CWE-778)"

echo ""
echo "Step 7: Repair stage 1 — enable the dormant correlation rule"
echo "-------------------------------------------------------------"

RULE_PATCH=$(curl -s -X PATCH -H "$AUTH_HEADER" -H "$JSON_HEADER" \
  -d '{"enabled": true}' "$BASE/api/soc/rules/HEL-R007")
assert_contains "$RULE_PATCH" '"enabled":true' "HEL-R007 enabled"

REPLAY_RULE_ONLY=$(curl -s -X POST -H "$AUTH_HEADER" "$BASE/api/soc/pipeline/replay")
assert_contains "$REPLAY_RULE_ONLY" '"delivered":0' "Still nothing delivered — one fix is not enough"
assert_not_contains "$REPLAY_RULE_ONLY" "YGGDRASIL{" "Flag still NOT released"

echo ""
echo "Step 8: Repair stages 2 and 3 — severity floor and alert sink"
echo "---------------------------------------------------------------"

CONFIG_PUT=$(curl -s -X PUT -H "$AUTH_HEADER" -H "$JSON_HEADER" \
  -d '{"minSeverity": "HIGH", "sink": "soc-queue"}' "$BASE/api/soc/pipeline/config")
assert_contains "$CONFIG_PUT" "soc-queue" "Alert sink repointed to a live collector"

echo ""
echo "Step 9: Replay — the alert delivers the incident record"
echo "--------------------------------------------------------"

REPLAY_FIXED=$(curl -s -X POST -H "$AUTH_HEADER" "$BASE/api/soc/pipeline/replay")
assert_contains "$REPLAY_FIXED" "HEL-R007" "Correlation alert fired"
assert_contains "$REPLAY_FIXED" "a7f3c1d8" "Alert carries the correlation ID"
assert_contains "$REPLAY_FIXED" "YGGDRASIL{" "Alert payload contains the flag"

FLAG=$(echo "$REPLAY_FIXED" | grep -oP 'YGGDRASIL\{[^}]+\}' | head -1)

if [ -z "$FLAG" ]; then
  echo -e "${RED}✗${NC} Failed to extract flag"
  ((TESTS_FAILED++))
  exit 1
else
  echo -e "${GREEN}✓${NC} Flag extracted: $FLAG"
  ((TESTS_PASSED++))
fi

echo ""
echo "Step 10: Validate flag format"
echo "------------------------------"

if echo "$FLAG" | grep -qP '^YGGDRASIL\{HELHEIM:[a-f0-9-]+\}$'; then
  echo -e "${GREEN}✓${NC} Flag format valid"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗${NC} Invalid flag format: $FLAG"
  ((TESTS_FAILED++))
fi

echo ""
echo "Step 11: Retired log drop explains itself"
echo "------------------------------------------"

TEMP_LOGS_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/temp_logs/error.log")
assert_contains "$TEMP_LOGS_STATUS" "410" "Legacy /temp_logs returns 410 Gone"

echo ""
echo "Step 12: Memorial forum still works"
echo "------------------------------------"

VALID_RESPONSE=$(curl -s -X POST -H "$JSON_HEADER" \
  -d '{"name":"Test","message":"Test memorial"}' "$BASE/api/memorial")
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
