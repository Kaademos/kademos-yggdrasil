#!/bin/bash
#
# validate-circleci.sh (M8)
# Validates CircleCI configuration against Yggdrasil CI policies
#
# This script enforces CI policies defined in M8:
# - No third-party orbs (security policy)
# - Required jobs present (lint, test, security-scan)
# - Main branch must always be green
# - All tests must pass before merge
#
# Exit codes:
#   0 - Policy compliant
#   1 - Policy violations detected
#   2 - Configuration file not found

set -euo pipefail

# Configuration
SCRIPT_VERSION="1.0.0-m8"
CIRCLECI_CONFIG=".circleci/config.yml"

# Color codes (disabled in CI)
if [ "${CI:-false}" = "true" ]; then
  RED=""; YELLOW=""; GREEN=""; BLUE=""; RESET=""
else
  RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; RESET='\033[0m'
fi

echo "🔍 Validating CircleCI configuration (v${SCRIPT_VERSION})..."
echo ""

# Check if config exists
if [ ! -f "$CIRCLECI_CONFIG" ]; then
  echo -e "${RED}❌ CircleCI configuration not found: $CIRCLECI_CONFIG${RESET}"
  echo ""
  echo "This project requires a CircleCI configuration to enforce CI policies."
  echo "Create $CIRCLECI_CONFIG to define your CI pipeline."
  exit 2
fi

echo "📋 Configuration file: $CIRCLECI_CONFIG"
echo ""

# Statistics
VIOLATIONS=0
WARNINGS=0

# Policy checks
echo "═══════════════════════════════════════════════════════════════"
echo "                    POLICY CHECKS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Policy 1: No third-party orbs
echo -e "${BLUE}[POLICY 1]${RESET} Checking for third-party orbs..."
if grep -q "^orbs:" "$CIRCLECI_CONFIG"; then
  # Check if orbs section exists and has non-empty content
  orbs_count=$(grep -A 10 "^orbs:" "$CIRCLECI_CONFIG" | grep -c ":" || true)
  if [ "$orbs_count" -gt 1 ]; then
    echo -e "${RED}  ❌ VIOLATION: Third-party orbs detected${RESET}"
    echo "     M8 policy prohibits third-party orbs for security reasons"
    echo "     Found:"
    grep -A 10 "^orbs:" "$CIRCLECI_CONFIG" | grep ":" | head -5 | while IFS= read -r line; do
      echo "       $line"
    done
    echo ""
    VIOLATIONS=$((VIOLATIONS + 1))
  else
    echo -e "${GREEN}  ✅ PASS: No orbs section or empty${RESET}"
  fi
else
  echo -e "${GREEN}  ✅ PASS: No orbs section found${RESET}"
fi
echo ""

# Policy 2: Required jobs present
echo -e "${BLUE}[POLICY 2]${RESET} Checking for required jobs..."
required_jobs=("lint" "test")
missing_jobs=()

for job in "${required_jobs[@]}"; do
  if ! grep -q "^  ${job}:" "$CIRCLECI_CONFIG"; then
    missing_jobs+=("$job")
  fi
done

if [ ${#missing_jobs[@]} -gt 0 ]; then
  echo -e "${YELLOW}  ⚠️  WARNING: Missing recommended jobs${RESET}"
  for job in "${missing_jobs[@]}"; do
    echo "     - $job"
  done
  echo ""
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${GREEN}  ✅ PASS: All required jobs present${RESET}"
fi
echo ""

# Policy 3: Lint job configuration
echo -e "${BLUE}[POLICY 3]${RESET} Checking lint job configuration..."
if grep -q "^  lint:" "$CIRCLECI_CONFIG"; then
  # Check if lint runs for both services
  if grep -A 20 "^  lint:" "$CIRCLECI_CONFIG" | grep -q "gatekeeper" && \
     grep -A 20 "^  lint:" "$CIRCLECI_CONFIG" | grep -q "flag-oracle"; then
    echo -e "${GREEN}  ✅ PASS: Lint job covers gatekeeper and flag-oracle${RESET}"
  else
    echo -e "${YELLOW}  ⚠️  WARNING: Lint job may not cover all services${RESET}"
    echo "     Ensure gatekeeper and flag-oracle are both linted"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${YELLOW}  ⚠️  WARNING: No lint job defined${RESET}"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Policy 4: Test job configuration
echo -e "${BLUE}[POLICY 4]${RESET} Checking test job configuration..."
if grep -q "^  test:" "$CIRCLECI_CONFIG"; then
  echo -e "${GREEN}  ✅ PASS: Test job present${RESET}"
  
  # Check if tests actually run (handle "npm test" with or without arguments)
  if grep -A 30 "^  test:" "$CIRCLECI_CONFIG" | grep -q "npm test"; then
    echo -e "${GREEN}     Tests are executed${RESET}"
  else
    echo -e "${YELLOW}     ⚠️  WARNING: No 'npm test' command found${RESET}"
    echo -e "${YELLOW}        Check that tests are actually running${RESET}"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${YELLOW}  ⚠️  WARNING: No test job defined${RESET}"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Policy 5: Security scanning
echo -e "${BLUE}[POLICY 5]${RESET} Checking for security scanning..."
if grep -q "security" "$CIRCLECI_CONFIG" || grep -q "scan-secrets" "$CIRCLECI_CONFIG" || grep -q "gitleaks" "$CIRCLECI_CONFIG"; then
  echo -e "${GREEN}  ✅ PASS: Security scanning configured${RESET}"
else
  echo -e "${YELLOW}  ⚠️  WARNING: No security scanning detected${RESET}"
  echo "     Consider adding secrets scanning with:"
  echo "       ./scripts/scan-secrets-enhanced.sh"
  echo "     or:"
  echo "       gitleaks detect --config .gitleaks.toml"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Policy 6: Branch restrictions
echo -e "${BLUE}[POLICY 6]${RESET} Checking branch restrictions..."
if grep -q "only:.*main" "$CIRCLECI_CONFIG" || grep -q "only:.*master" "$CIRCLECI_CONFIG"; then
  echo -e "${GREEN}  ✅ PASS: Branch filters configured${RESET}"
else
  echo -e "${YELLOW}  ⚠️  WARNING: No branch filters detected${RESET}"
  echo "     Consider adding filters to workflows to protect main branch"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Policy 7: Workflow requirements
echo -e "${BLUE}[POLICY 7]${RESET} Checking workflow configuration..."
if grep -q "^workflows:" "$CIRCLECI_CONFIG"; then
  echo -e "${GREEN}  ✅ PASS: Workflows section present${RESET}"
  
  # Check for requires dependencies
  if grep -q "requires:" "$CIRCLECI_CONFIG"; then
    echo -e "${GREEN}     Job dependencies configured${RESET}"
  else
    echo -e "${YELLOW}     ⚠️  WARNING: No job dependencies found${RESET}"
    echo "        Consider requiring lint/test to pass before other jobs"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${YELLOW}  ⚠️  WARNING: No workflows section${RESET}"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Policy 8: Docker image security
echo -e "${BLUE}[POLICY 8]${RESET} Checking Docker image sources..."
if grep -q "image:" "$CIRCLECI_CONFIG"; then
  # Check for CircleCI official images
  if grep "image:" "$CIRCLECI_CONFIG" | grep -q "cimg/"; then
    echo -e "${GREEN}  ✅ PASS: Using CircleCI convenience images (cimg/)${RESET}"
  else
    echo -e "${YELLOW}  ⚠️  WARNING: Not using CircleCI convenience images${RESET}"
    echo "     Consider using cimg/* images for better caching and security"
    WARNINGS=$((WARNINGS + 1))
  fi
fi
echo ""

# Policy 9: YAML syntax validation
echo -e "${BLUE}[POLICY 9]${RESET} Validating YAML syntax..."
if command -v yq &> /dev/null; then
  if yq eval '.' "$CIRCLECI_CONFIG" > /dev/null 2>&1; then
    echo -e "${GREEN}  ✅ PASS: Valid YAML syntax${RESET}"
  else
    echo -e "${RED}  ❌ VIOLATION: Invalid YAML syntax${RESET}"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
else
  echo -e "${BLUE}  ℹ️  INFO: yq not installed, skipping YAML validation${RESET}"
  echo "     Install yq for syntax validation: https://github.com/mikefarah/yq"
fi
echo ""

# Policy 10: Fail-fast configuration
echo -e "${BLUE}[POLICY 10]${RESET} Checking fail-fast configuration..."
if grep -q "set -e" "$CIRCLECI_CONFIG" || grep -q "set -euo pipefail" "$CIRCLECI_CONFIG"; then
  echo -e "${GREEN}  ✅ PASS: Fail-fast enabled in scripts${RESET}"
else
  echo -e "${YELLOW}  ⚠️  WARNING: No fail-fast configuration detected${RESET}"
  echo "     Consider using 'set -euo pipefail' in shell scripts"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Policy 11: CI/local test parity
#
# Every test suite must be defined once, in the Makefile, and invoked by CI via
# its target. Before this policy existed the two had drifted badly: ten realm
# packages (472 tests) ran in neither CI nor any make target, two Playwright
# specs ran nowhere, and the e2e suite collected zero tests for months because
# every CI step named an explicit spec path.
echo -e "${BLUE}[POLICY 11]${RESET} Checking CI/local test parity..."

PARITY_OK=true

# 11a. CI must not invoke test runners directly — only make targets.
DIRECT_RUNNERS=$(grep -nE '^\s+(npm (test|run lint)|npx (playwright test|tsc|prettier)|jest)' \
  "$CIRCLECI_CONFIG" || true)
if [ -n "$DIRECT_RUNNERS" ]; then
  echo -e "${RED}  ❌ VIOLATION: CI invokes a test runner directly${RESET}"
  echo "$DIRECT_RUNNERS" | sed 's/^/       /'
  echo "     Add a Makefile target and call that instead, so a local run matches."
  VIOLATIONS=$((VIOLATIONS + 1))
  PARITY_OK=false
fi

# Targets CI actually *invokes*. YAML comments and `name:` lines are stripped
# first — otherwise a step named "Realm test suites (make test-realms)" would
# satisfy the check even after its command was changed to something else.
CI_INVOKED=$(grep -vE '^\s*#' "$CIRCLECI_CONFIG" \
  | grep -vE '^\s*name:' \
  | grep -oE 'make test[a-z0-9-]*' \
  | awk '{print $2}' | sort -u)

# 11b. Every make target CI invokes must exist in the Makefile.
for target in $CI_INVOKED; do
  if ! grep -qE "^${target}:" Makefile; then
    echo -e "${RED}  ❌ VIOLATION: CI calls 'make ${target}' but the Makefile has no such target${RESET}"
    VIOLATIONS=$((VIOLATIONS + 1))
    PARITY_OK=false
  fi
done

# 11c. Every suite target in the Makefile must be reached by CI, so a suite
#      cannot be added locally and silently skipped in CI.
SUITE_TARGETS="test-lint test-unit test-realms test-manifests test-attack-traces test-e2e-collect test-e2e test-integration test-security"
for target in $SUITE_TARGETS; do
  if ! echo "$CI_INVOKED" | grep -qx "$target"; then
    echo -e "${RED}  ❌ VIOLATION: Makefile defines suite '${target}' but no CI job runs it${RESET}"
    VIOLATIONS=$((VIOLATIONS + 1))
    PARITY_OK=false
  fi
done

if [ "$PARITY_OK" = true ]; then
  echo -e "${GREEN}  ✅ PASS: CI and local run the same suites via shared make targets${RESET}"
fi
echo ""

# Summary
echo "═══════════════════════════════════════════════════════════════"
echo "                    VALIDATION SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Policies Checked: 11"
echo -e "Violations:       ${RED}$VIOLATIONS${RESET}"
echo -e "Warnings:         ${YELLOW}$WARNINGS${RESET}"
echo ""

# Determine exit code
if [ $VIOLATIONS -gt 0 ]; then
  echo -e "${RED}❌ VALIDATION FAILED${RESET}"
  echo "   Policy violations detected. Review and fix issues above."
  echo ""
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  VALIDATION PASSED WITH WARNINGS${RESET}"
  echo "   Configuration is acceptable but could be improved."
  echo "   Review warnings above for recommendations."
  echo ""
  exit 0
else
  echo -e "${GREEN}✅ VALIDATION PASSED${RESET}"
  echo "   CircleCI configuration complies with all policies."
  echo ""
  exit 0
fi
