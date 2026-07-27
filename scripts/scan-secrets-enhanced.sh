#!/bin/bash
#
# scan-secrets-enhanced.sh (M8 Enhanced)
# Multi-level secrets scanning to prevent accidental commits of sensitive data
#
# Features (M8):
# - Severity levels: CRITICAL, HIGH, MEDIUM
# - Configurable exit behavior
# - Comprehensive pattern library
# - Colored output with statistics
#
# Exit codes:
#   0 - No critical/high secrets found
#   1 - Critical or high-severity secrets detected
#   2 - Medium-severity issues detected (only if EXIT_ON_MEDIUM=true)

set -euo pipefail

# Configuration
SCRIPT_VERSION="2.0.0-m8"
EXIT_ON_MEDIUM=${EXIT_ON_MEDIUM:-false}
SHOW_CONTEXT=${SHOW_CONTEXT:-true}

# Color codes (disabled in CI)
if [ "${CI:-false}" = "true" ]; then
  RED=""; YELLOW=""; GREEN=""; BLUE=""; RESET=""
else
  RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; RESET='\033[0m'
fi

# Statistics
CRITICAL_COUNT=0
HIGH_COUNT=0
MEDIUM_COUNT=0

echo "🔍 Scanning for secrets and sensitive data (v${SCRIPT_VERSION})..."
echo ""

# CRITICAL SEVERITY: Real secrets that must never be committed
declare -A CRITICAL_PATTERNS=(
  ["-----BEGIN.*PRIVATE KEY-----"]="Private key file"
  ["-----BEGIN.*RSA PRIVATE KEY-----"]="RSA private key"
  ["AKIA[0-9A-Z]{16}"]="AWS Access Key ID"
  ["aws_secret_access_key\s*=\s*['\"][A-Za-z0-9/+=]{40}"]="AWS Secret Access Key"
  ["ghp_[A-Za-z0-9]{36}"]="GitHub Personal Access Token"
  ["gho_[A-Za-z0-9]{36}"]="GitHub OAuth Token"
  ["ghs_[A-Za-z0-9]{36}"]="GitHub Server Token"
  ["npm_[A-Za-z0-9]{36}"]="NPM Token"
  ["sk-[A-Za-z0-9]{48}"]="OpenAI API Key"
  ["xox[pboa]-[0-9]{10,12}-[0-9]{10,12}-[A-Za-z0-9]{24,}"]="Slack Token"
)

# HIGH SEVERITY: Real flags and production secrets
declare -A HIGH_PATTERNS=(
  ["YGGDRASIL\{[A-Z_]+:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\}"]="Yggdrasil flag (real UUID format)"
  ["password\s*[=:]\s*['\"][^'\"]{12,}['\"]"]="Strong password (12+ chars)"
  ["api[_-]?key\s*[=:]\s*['\"][A-Za-z0-9]{32,}['\"]"]="API key (32+ chars)"
  ["secret[_-]?key\s*[=:]\s*['\"][A-Za-z0-9]{32,}['\"]"]="Secret key (32+ chars)"
  ["Bearer [A-Za-z0-9\-._~+/]{40,}"]="Long bearer token"
)

# MEDIUM SEVERITY: Potential issues or placeholders
declare -A MEDIUM_PATTERNS=(
  ["password\s*[=:]\s*['\"][^'\"]{8,11}['\"]"]="Short password (8-11 chars)"
  ["TODO.*password"]="TODO about password"
  ["FIXME.*secret"]="FIXME about secret"
  ["admin.*123"]="Weak admin credential"
)

# Directories to exclude (including realms which intentionally contain vulnerabilities)
EXCLUDE_DIRS=(
  node_modules .git dist coverage build .next .cache vendor .factory .docs
  realms tests scripts
)

# Files to exclude (all markdown is documentation, plus .env files and lockfiles).
#
# These MUST stay in an array and be expanded quoted. As a space-separated string
# iterated unquoted, `*.md` was glob-expanded by the shell against the repo root,
# so the loop only ever excluded the five top-level markdown files — every
# docs/**/*.md was still scanned, and the flag-format examples in DEVELOPER.md and
# QUICK_REFERENCE.md tripped the HIGH gate on every run.
EXCLUDE_PATTERNS=(
  '*.log' '*.md' 'package-lock.json' '*.min.js' '*.map'
  '.env.example' '.env' 'docker-compose.yml' 'flag-repository.ts'
)

# Known example/dummy credentials to allow (AWS documentation standard examples)
ALLOWED_EXAMPLES=(
  "AKIAIOSFODNN7EXAMPLE"
  "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
)

scan_patterns() {
  local severity=$1
  local -n patterns=$2
  local count=0
  
  echo -e "${BLUE}Scanning ${severity} patterns...${RESET}"
  
  # Build exclude flags as an array so globs reach grep intact instead of being
  # expanded by the shell first.
  local exclude_flags=()
  local dir pat
  for dir in "${EXCLUDE_DIRS[@]}"; do
    exclude_flags+=(--exclude-dir="$dir")
  done
  for pat in "${EXCLUDE_PATTERNS[@]}"; do
    exclude_flags+=(--exclude="$pat")
  done

  for pattern in "${!patterns[@]}"; do
    local description="${patterns[$pattern]}"
    local results
    results=$(grep -rEn "${exclude_flags[@]}" "$pattern" . 2>/dev/null || true)
    
    # Filter out allowed example credentials
    if [ -n "$results" ]; then
      for example in "${ALLOWED_EXAMPLES[@]}"; do
        results=$(echo "$results" | grep -v "$example" || true)
      done
    fi
    
    if [ -n "$results" ]; then
      count=$((count + 1))
      
      case "$severity" in
        CRITICAL) 
          echo -e "${RED}🔴 CRITICAL: ${description}${RESET}"
          CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
          ;;
        HIGH)
          echo -e "${YELLOW}🟠 HIGH: ${description}${RESET}"
          HIGH_COUNT=$((HIGH_COUNT + 1))
          ;;
        MEDIUM)
          echo -e "${BLUE}🟡 MEDIUM: ${description}${RESET}"
          MEDIUM_COUNT=$((MEDIUM_COUNT + 1))
          ;;
      esac
      
      if [ "$SHOW_CONTEXT" = "true" ]; then
        echo "$results" | head -5 | while IFS= read -r line; do
          echo "   $line"
        done
        echo ""
      fi
    fi
  done
  
  return $count
}

# Scan each severity level
scan_patterns "CRITICAL" CRITICAL_PATTERNS || true
scan_patterns "HIGH" HIGH_PATTERNS || true
scan_patterns "MEDIUM" MEDIUM_PATTERNS || true

# Summary
echo "═══════════════════════════════════════════════════════════════"
echo "                    SCAN RESULTS"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Summary:"
echo "  🔴 CRITICAL findings: $CRITICAL_COUNT"
echo "  🟠 HIGH findings:     $HIGH_COUNT"
echo "  🟡 MEDIUM findings:   $MEDIUM_COUNT"
echo ""

# Determine exit code
if [ $CRITICAL_COUNT -gt 0 ]; then
  echo -e "${RED}❌ CRITICAL secrets detected!${RESET}"
  echo "   Action required: Remove all critical secrets before committing"
  exit 1
elif [ $HIGH_COUNT -gt 0 ]; then
  echo -e "${YELLOW}❌ HIGH severity secrets detected!${RESET}"
  echo "   Action required: Review and remove high-severity findings"
  exit 1
elif [ $MEDIUM_COUNT -gt 0 ]; then
  echo -e "${BLUE}⚠️  MEDIUM severity issues detected${RESET}"
  if [ "$EXIT_ON_MEDIUM" = "true" ]; then
    echo "   EXIT_ON_MEDIUM=true: Failing build"
    exit 2
  else
    echo "   EXIT_ON_MEDIUM=false: Allowing build to continue"
    exit 0
  fi
else
  echo -e "${GREEN}✅ No secrets detected - scan passed${RESET}"
  exit 0
fi
