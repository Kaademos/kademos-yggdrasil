#!/bin/bash
#
# Playwright collection guard
#
# Runs the Playwright suite unqualified and asserts it collects a plausible
# number of tests. Needs no running platform — it only lists, never executes.
#
# Why this exists: `playwright.config.ts` sets `testDir: './tests'`, and
# Playwright's default testMatch picks up `*.test.ts` as well as `*.spec.ts`.
# A single Jest-style file landing under tests/ throws during collection and
# collapses the entire run to "0 tests in 0 files". That does exit non-zero,
# but it stayed invisible for months because every CI step named an explicit
# spec path, so nothing ever invoked the suite unqualified.
#
# A floor rather than an exact count: adding tests should never fail this, but
# losing most of the suite will.
#
# Usage: ./scripts/check-e2e-collection.sh [minimum-tests] [minimum-files]

set -uo pipefail

MIN_TESTS="${1:-100}"
MIN_FILES="${2:-6}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$(dirname "$0")/.." || exit 1

echo "🔍 Checking Playwright test collection (unqualified)..."
echo ""

output=$(npx playwright test --list 2>&1)
status=$?

# `--list` exits non-zero when a spec fails to load. Report it either way, since
# a zero exit with an empty suite is just as broken.
summary=$(echo "$output" | grep -oE 'Total: [0-9]+ tests? in [0-9]+ files?' | tail -1)

if [ -z "$summary" ]; then
  echo -e "${RED}✗ Playwright produced no collection summary at all.${NC}"
  echo ""
  echo "$output" | tail -30
  exit 1
fi

tests=$(echo "$summary" | grep -oE 'Total: [0-9]+' | grep -oE '[0-9]+')
files=$(echo "$summary" | grep -oE 'in [0-9]+' | grep -oE '[0-9]+')

echo "  collected: ${tests} tests in ${files} files"
echo "  required:  >= ${MIN_TESTS} tests in >= ${MIN_FILES} files"
echo ""

if [ "$status" -ne 0 ]; then
  echo -e "${RED}✗ Collection reported an error (exit ${status}).${NC}"
  echo ""
  echo "$output" | grep -vE '^\s*(✓|✔)' | tail -30
  exit 1
fi

if [ "$tests" -lt "$MIN_TESTS" ] || [ "$files" -lt "$MIN_FILES" ]; then
  echo -e "${RED}✗ Collection is below the expected floor.${NC}"
  echo ""
  echo "Either a spec file failed to load, or specs stopped matching testMatch."
  echo "Run 'npx playwright test --list' to see the collection directly."
  echo ""
  echo "If the suite legitimately shrank, lower the floor in the Makefile"
  echo "(test-e2e-collect) rather than deleting this check."
  exit 1
fi

echo -e "${GREEN}✓ Playwright collects ${tests} tests across ${files} files.${NC}"

# Surface any spec that loaded but contributed nothing — a soft signal, not a failure.
if echo "$output" | grep -q "0 tests in"; then
  echo -e "${YELLOW}⚠ Some file reported zero tests; check the listing above.${NC}"
fi

exit 0
