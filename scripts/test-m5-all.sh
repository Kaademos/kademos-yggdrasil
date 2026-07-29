#!/bin/bash
# Master test suite for Milestone 5 - All realms (4-1)
set -e

echo "=========================================="
echo "MILESTONE 5 - MASTER TEST SUITE"
echo "Testing Realms 4-1: Vanaheim → Midgard → Alfheim → Asgard"
echo "=========================================="
echo ""

FAILED=0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing Realm 4: VANAHEIM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./scripts/test-vanaheim.sh || FAILED=$((FAILED + 1))
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing Realm 3: MIDGARD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./scripts/test-midgard.sh || FAILED=$((FAILED + 1))
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing Realm 2: ALFHEIM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./scripts/test-alfheim.sh || FAILED=$((FAILED + 1))
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing Realm 1: ASGARD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./scripts/test-asgard.sh || FAILED=$((FAILED + 1))
echo ""

echo "=========================================="
if [ $FAILED -eq 0 ]; then
  echo "✅ ALL MILESTONE 5 TESTS PASSED!"
  echo "=========================================="
  echo "Summary:"
  echo "  • Vanaheim (A04): Cryptographic Failures ✓"
  echo "  • Midgard (A03): Supply Chain Failures ✓"
  echo "  • Alfheim (A02): Security Misconfiguration ✓"
  echo "  • Asgard (A01): Broken Access Control + SSRF ✓"
  echo ""
  echo "All 4 M5 realms validated successfully!"
else
  echo "❌ $FAILED TEST(S) FAILED"
  echo "=========================================="
  exit 1
fi
