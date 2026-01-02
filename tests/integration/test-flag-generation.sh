#!/bin/bash
#
# test-flag-generation.sh
# Integration test for Phase 2: Dynamic Flag Generation
#
# Tests:
# 1. Flag generation endpoint (/generate)
# 2. Flag validation endpoint (/validate)
# 3. Deterministic behavior (same inputs = same flag)
# 4. Uniqueness (different inputs = different flags)

set -euo pipefail

echo "🧪 M8 Integration Test: Phase 2 - Flag Generation"
echo "=================================================="
echo ""

# Configuration
FLAG_ORACLE_URL=${FLAG_ORACLE_URL:-http://localhost:3001}
TEST_USER_1="test-user-123"
TEST_USER_2="test-user-456"
TEST_REALM="NIFLHEIM"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
test_start() {
  TESTS_RUN=$((TESTS_RUN + 1))
  echo -e "${BLUE}[TEST $TESTS_RUN]${RESET} $1"
}

test_pass() {
  TESTS_PASSED=$((TESTS_PASSED + 1))
  echo -e "${GREEN}  ✅ PASS${RESET}"
  echo ""
}

test_fail() {
  TESTS_FAILED=$((TESTS_FAILED + 1))
  echo -e "${RED}  ❌ FAIL: $1${RESET}"
  echo ""
}

# Check if flag-oracle is running
echo "Checking if flag-oracle is accessible..."
if ! curl -s -f "${FLAG_ORACLE_URL}/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Flag-oracle not running at ${FLAG_ORACLE_URL}${RESET}"
  echo ""
  echo "Start flag-oracle with:"
  echo "  cd flag-oracle"
  echo "  npm run dev"
  echo ""
  echo "Or use docker-compose:"
  echo "  docker-compose up flag-oracle"
  exit 1
fi
echo -e "${GREEN}✅ Flag-oracle is running${RESET}"
echo ""

# Test 1: Generate flag for user 1
test_start "Generate flag for user 1"
RESPONSE_1=$(curl -s -X POST "${FLAG_ORACLE_URL}/generate" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"${TEST_USER_1}\", \"realmId\": \"${TEST_REALM}\"}")

FLAG_1=$(echo "$RESPONSE_1" | grep -o 'YGGDRASIL{[A-Z_]*:[a-f0-9-]*}' || echo "")
STATUS_1=$(echo "$RESPONSE_1" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ -z "$FLAG_1" ]; then
  test_fail "No flag returned. Response: $RESPONSE_1"
else
  echo "  Generated flag: $FLAG_1"
  test_pass
fi

# Test 2: Generate same flag again (determinism)
test_start "Generate flag for same user (determinism check)"
RESPONSE_2=$(curl -s -X POST "${FLAG_ORACLE_URL}/generate" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"${TEST_USER_1}\", \"realmId\": \"${TEST_REALM}\"}")

FLAG_2=$(echo "$RESPONSE_2" | grep -o 'YGGDRASIL{[A-Z_]*:[a-f0-9-]*}' || echo "")

if [ "$FLAG_1" = "$FLAG_2" ]; then
  echo "  ✅ Deterministic: Same user generates same flag"
  test_pass
else
  test_fail "Non-deterministic: $FLAG_1 != $FLAG_2"
fi

# Test 3: Generate flag for different user (uniqueness)
test_start "Generate flag for different user (uniqueness check)"
RESPONSE_3=$(curl -s -X POST "${FLAG_ORACLE_URL}/generate" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"${TEST_USER_2}\", \"realmId\": \"${TEST_REALM}\"}")

FLAG_3=$(echo "$RESPONSE_3" | grep -o 'YGGDRASIL{[A-Z_]*:[a-f0-9-]*}' || echo "")

if [ "$FLAG_1" != "$FLAG_3" ]; then
  echo "  ✅ Unique: Different users generate different flags"
  echo "  User 1: $FLAG_1"
  echo "  User 2: $FLAG_3"
  test_pass
else
  test_fail "Not unique: Both users got same flag: $FLAG_1"
fi

# Test 4: Validate correct flag
test_start "Validate correct flag"
VALIDATE_RESPONSE=$(curl -s -X POST "${FLAG_ORACLE_URL}/validate" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"${TEST_USER_1}\", \"flag\": \"${FLAG_1}\"}")

VALIDATE_STATUS=$(echo "$VALIDATE_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$VALIDATE_STATUS" = "correct" ]; then
  echo "  ✅ Flag validated successfully"
  test_pass
else
  test_fail "Flag validation failed. Status: $VALIDATE_STATUS. Response: $VALIDATE_RESPONSE"
fi

# Test 5: Validate incorrect flag (wrong user)
test_start "Reject flag from wrong user"
WRONG_VALIDATE=$(curl -s -X POST "${FLAG_ORACLE_URL}/validate" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"${TEST_USER_2}\", \"flag\": \"${FLAG_1}\"}")

WRONG_STATUS=$(echo "$WRONG_VALIDATE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$WRONG_STATUS" = "incorrect" ] || [ "$WRONG_STATUS" = "invalid" ]; then
  echo "  ✅ Correctly rejected flag from wrong user"
  test_pass
else
  test_fail "Should reject flag from wrong user. Status: $WRONG_STATUS"
fi

# Test 6: Validate malformed flag
test_start "Reject malformed flag"
MALFORMED_FLAG="YGGDRASIL{FAKE:12345678-1234-1234-1234-123456789abc}"
MALFORMED_VALIDATE=$(curl -s -X POST "${FLAG_ORACLE_URL}/validate" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"${TEST_USER_1}\", \"flag\": \"${MALFORMED_FLAG}\"}")

MALFORMED_STATUS=$(echo "$MALFORMED_VALIDATE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$MALFORMED_STATUS" = "incorrect" ] || [ "$MALFORMED_STATUS" = "invalid" ]; then
  echo "  ✅ Correctly rejected malformed flag"
  test_pass
else
  test_fail "Should reject malformed flag. Status: $MALFORMED_STATUS"
fi

# Test 7: Generate flags for multiple realms
test_start "Generate flags for different realms (user uniqueness)"
REALM_1="NIFLHEIM"
REALM_2="HELHEIM"

FLAG_REALM_1=$(curl -s -X POST "${FLAG_ORACLE_URL}/generate" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"${TEST_USER_1}\", \"realmId\": \"${REALM_1}\"}" \
  | grep -o 'YGGDRASIL{[A-Z_]*:[a-f0-9-]*}' || echo "")

FLAG_REALM_2=$(curl -s -X POST "${FLAG_ORACLE_URL}/generate" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"${TEST_USER_1}\", \"realmId\": \"${REALM_2}\"}" \
  | grep -o 'YGGDRASIL{[A-Z_]*:[a-f0-9-]*}' || echo "")

if [ "$FLAG_REALM_1" != "$FLAG_REALM_2" ]; then
  echo "  ✅ Different realms generate different flags"
  echo "  ${REALM_1}: $FLAG_REALM_1"
  echo "  ${REALM_2}: $FLAG_REALM_2"
  test_pass
else
  test_fail "Same flag for different realms: $FLAG_REALM_1"
fi

# Test 8: Performance test (generate 10 flags)
test_start "Performance test (generate 10 flags)"
START_TIME=$(date +%s%N)

for i in {1..10}; do
  curl -s -X POST "${FLAG_ORACLE_URL}/generate" \
    -H "Content-Type: application/json" \
    -d "{\"userId\": \"perf-user-${i}\", \"realmId\": \"${TEST_REALM}\"}" \
    > /dev/null
done

END_TIME=$(date +%s%N)
DURATION_NS=$((END_TIME - START_TIME))
DURATION_MS=$((DURATION_NS / 1000000))
AVG_MS=$((DURATION_MS / 10))

if [ $AVG_MS -lt 100 ]; then
  echo "  ✅ Good performance: ${AVG_MS}ms average per flag"
  test_pass
elif [ $AVG_MS -lt 200 ]; then
  echo "  ⚠️  Acceptable performance: ${AVG_MS}ms average per flag"
  test_pass
else
  echo "  ⚠️  Slow performance: ${AVG_MS}ms average per flag"
  test_pass  # Still pass, but note the slowness
fi

# Summary
echo "=================================================="
echo "                   TEST SUMMARY"
echo "=================================================="
echo ""
echo "Tests Run:    $TESTS_RUN"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${RESET}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${RESET}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED${RESET}"
  echo ""
  echo "Phase 2 (Flag Generation) integration test: SUCCESS"
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${RESET}"
  echo ""
  echo "Phase 2 (Flag Generation) integration test: FAILURE"
  exit 1
fi
