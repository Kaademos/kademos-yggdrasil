#!/bin/bash
# Milestone 4 Master Test Suite
# Tests all three Phase 2 realms: Jotunheim, Muspelheim, Nidavellir

set -e

echo "======================================================================="
echo "MILESTONE 4 - MASTER TEST SUITE"
echo "Testing Realms 7-5: Jotunheim, Muspelheim, Nidavellir"
echo "======================================================================="
echo ""

FAILED=0
PASSED=0

# Test Jotunheim
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing JOTUNHEIM (Realm 7)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if ./scripts/test-jotunheim.sh; then
  echo "✓ Jotunheim tests PASSED"
  ((PASSED++))
else
  echo "✗ Jotunheim tests FAILED"
  ((FAILED++))
fi
echo ""

# Test Muspelheim
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing MUSPELHEIM (Realm 6)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if ./scripts/test-muspelheim.sh; then
  echo "✓ Muspelheim tests PASSED"
  ((PASSED++))
else
  echo "✗ Muspelheim tests FAILED"
  ((FAILED++))
fi
echo ""

# Test Nidavellir
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing NIDAVELLIR (Realm 5)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if ./scripts/test-nidavellir.sh; then
  echo "✓ Nidavellir tests PASSED"
  ((PASSED++))
else
  echo "✗ Nidavellir tests FAILED"
  ((FAILED++))
fi
echo ""

# Summary
echo "======================================================================="
echo "MILESTONE 4 TEST SUMMARY"
echo "======================================================================="
echo "Passed: $PASSED/3"
echo "Failed: $FAILED/3"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✓ ALL MILESTONE 4 TESTS PASSED!"
  echo "======================================================================="
  exit 0
else
  echo "✗ SOME TESTS FAILED"
  echo "======================================================================="
  exit 1
fi
