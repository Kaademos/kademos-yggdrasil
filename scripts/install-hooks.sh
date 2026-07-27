#!/bin/bash
#
# install-hooks.sh
# Install Git hooks for Project Yggdrasil
#
# This script copies pre-commit hooks to .git/hooks/
# Run this after cloning the repository

set -euo pipefail

echo "🔧 Installing Git hooks for Project Yggdrasil..."
echo ""

# Check if .git exists
if [ ! -d ".git" ]; then
  echo "❌ Error: .git directory not found"
  echo "   Run this script from the project root"
  exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Install pre-commit hook
if [ -f ".git/hooks/pre-commit" ]; then
  echo "⚠️  Pre-commit hook already exists"
  read -p "   Overwrite? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "   Skipped pre-commit hook"
    exit 0
  fi
fi

# Copy pre-commit hook template
cat > .git/hooks/pre-commit << 'HOOK_EOF'
#!/bin/bash
#
# Pre-commit hook for Project Yggdrasil (M8)
#
# This hook runs before git commit to catch issues early:
# - Lint errors (gatekeeper, flag-oracle)
# - Test failures
# - Secret leaks
#
# Override with: git commit --no-verify (use cautiously!)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

echo -e "${BLUE}🔍 Running pre-commit checks...${RESET}"
echo ""

# Track if any checks fail
FAILED=0

# Function to run check
run_check() {
  local name="$1"
  local command="$2"
  
  echo -e "${BLUE}[$name]${RESET}"
  if eval "$command" > /tmp/pre-commit-$name.log 2>&1; then
    echo -e "${GREEN}  ✅ PASS${RESET}"
    return 0
  else
    echo -e "${RED}  ❌ FAIL${RESET}"
    echo "  See: /tmp/pre-commit-$name.log"
    FAILED=1
    return 1
  fi
}

# Check 1: Lint Gatekeeper
if [ -d "gatekeeper" ]; then
  run_check "Lint Gatekeeper" "cd gatekeeper && npm run lint"
fi

# Check 2: Lint Flag-Oracle
if [ -d "flag-oracle" ]; then
  run_check "Lint Flag-Oracle" "cd flag-oracle && npm run lint"
fi

# Check 3: Test Gatekeeper (optional - can be slow)
if [ "${SKIP_TESTS:-false}" != "true" ] && [ -d "gatekeeper" ]; then
  run_check "Test Gatekeeper" "cd gatekeeper && npm test"
fi

# Check 4: Test Flag-Oracle (optional - can be slow)
if [ "${SKIP_TESTS:-false}" != "true" ] && [ -d "flag-oracle" ]; then
  run_check "Test Flag-Oracle" "cd flag-oracle && npm test"
fi

# Check 5: Secrets Scan
if [ -f "scripts/scan-secrets-enhanced.sh" ]; then
  run_check "Secrets Scan" "./scripts/scan-secrets-enhanced.sh"
fi

# Check 6: CI Config Validation (if .circleci/config.yml changed)
if git diff --cached --name-only | grep -q "^.circleci/config.yml"; then
  if [ -f "scripts/validate-circleci.sh" ]; then
    run_check "CI Validation" "./scripts/validate-circleci.sh"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Final verdict
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All pre-commit checks passed!${RESET}"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Some pre-commit checks failed${RESET}"
  echo ""
  echo "Fix the issues above or use:"
  echo "  git commit --no-verify"
  echo ""
  echo "Tip: Skip tests with:"
  echo "  SKIP_TESTS=true git commit"
  echo ""
  exit 1
fi
HOOK_EOF

# Make executable
chmod +x .git/hooks/pre-commit

echo "✅ Pre-commit hook installed successfully!"
echo ""
echo "The hook will run:"
echo "  • Lint checks (gatekeeper, flag-oracle)"
echo "  • Unit tests (both services)"
echo "  • Secrets scan"
echo "  • CI config validation (if changed)"
echo ""
echo "To skip tests (faster commits):"
echo "  SKIP_TESTS=true git commit"
echo ""
echo "To bypass hook (use cautiously):"
echo "  git commit --no-verify"
echo ""
