#!/bin/bash

echo "🔍 Scanning for secrets and sensitive data..."
echo "============================================="
echo ""

FINDINGS=0

# Check for hardcoded secrets in code
echo "1. Checking for hardcoded secrets..."
PATTERNS=(
  "password\s*=\s*['\"][^'\"]*['\"]"
  "api[_-]?key\s*=\s*['\"][^'\"]*['\"]"
  "secret\s*=\s*['\"][^'\"]*['\"]"
  "token\s*=\s*['\"][^'\"]*['\"]"
  "private[_-]?key"
  "BEGIN (RSA|DSA|EC) PRIVATE KEY"
)

for pattern in "${PATTERNS[@]}"; do
  matches=$(grep -rEI "$pattern" \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude-dir=dist \
    --exclude-dir=coverage \
    --exclude="*.test.ts" \
    --exclude="*.spec.ts" \
    --exclude="scan-secrets.sh" \
    --exclude="*.md" \
    . 2>/dev/null || true)
  
  if [ -n "$matches" ]; then
    echo "⚠️  Found potential hardcoded secrets matching: $pattern"
    echo "$matches" | head -5
    echo ""
    FINDINGS=$((FINDINGS + 1))
  fi
done

# Check for committed .env files
echo "2. Checking for committed .env files..."
env_files=$(git ls-files 2>/dev/null | grep -E '\.env$' | grep -v '.env.example' || true)
if [ -n "$env_files" ]; then
  echo "❌ Found committed .env file(s):"
  echo "$env_files"
  echo ""
  FINDINGS=$((FINDINGS + 1))
else
  echo "✅ No .env files committed"
  echo ""
fi

# Check for AWS keys
echo "3. Checking for AWS keys..."
aws_keys=$(grep -rEI '(AKIA[0-9A-Z]{16}|[A-Za-z0-9+/]{40})' \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude="scan-secrets.sh" \
  . 2>/dev/null || true)

if [ -n "$aws_keys" ]; then
  echo "❌ Found potential AWS keys"
  echo "$aws_keys" | head -5
  echo ""
  FINDINGS=$((FINDINGS + 1))
else
  echo "✅ No AWS keys found"
  echo ""
fi

# Check for private keys
echo "4. Checking for private keys..."
private_keys=$(find . -type f \
  -name "*.pem" -o -name "*.key" -o -name "*_rsa" \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  2>/dev/null || true)

if [ -n "$private_keys" ]; then
  echo "⚠️  Found potential private key files:"
  echo "$private_keys"
  echo ""
  echo "Verify these are not real private keys!"
  FINDINGS=$((FINDINGS + 1))
else
  echo "✅ No private key files found"
  echo ""
fi

# Check for database URLs with credentials
echo "5. Checking for database URLs with credentials..."
db_urls=$(grep -rEI '(postgres|mysql|mongodb)://[^/]+:[^/]+@' \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude="*.md" \
  --exclude="scan-secrets.sh" \
  . 2>/dev/null || true)

if [ -n "$db_urls" ]; then
  echo "⚠️  Found database URLs with credentials:"
  echo "$db_urls" | head -5
  echo ""
  echo "Verify these are not real credentials!"
  FINDINGS=$((FINDINGS + 1))
else
  echo "✅ No hardcoded database URLs found"
  echo ""
fi

# Check for bearer tokens
echo "6. Checking for bearer tokens..."
tokens=$(grep -rEI 'Bearer [A-Za-z0-9_\-]{20,}' \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude="*.test.ts" \
  --exclude="*.spec.ts" \
  --exclude="scan-secrets.sh" \
  . 2>/dev/null || true)

if [ -n "$tokens" ]; then
  echo "⚠️  Found potential bearer tokens:"
  echo "$tokens" | head -5
  echo ""
  FINDINGS=$((FINDINGS + 1))
else
  echo "✅ No bearer tokens found"
  echo ""
fi

# Check for IP addresses (potential internal IPs)
echo "7. Checking for hardcoded internal IP addresses..."
internal_ips=$(grep -rEI '\b(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)[0-9]{1,3}\.[0-9]{1,3}\b' \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude="*.md" \
  --exclude="scan-secrets.sh" \
  --exclude="*.test.ts" \
  . 2>/dev/null || true)

if [ -n "$internal_ips" ]; then
  echo "⚠️  Found hardcoded internal IP addresses:"
  echo "$internal_ips" | head -5
  echo ""
  echo "Consider using environment variables or configuration files"
  # Not counting as findings for IPs since they might be examples
fi

# Summary
echo "============================================="
if [ $FINDINGS -eq 0 ]; then
  echo "✅ No secrets found! All checks passed."
  exit 0
else
  echo "⚠️  Found $FINDINGS potential security issues"
  echo ""
  echo "Action required:"
  echo "  1. Review all findings above"
  echo "  2. Remove any real secrets from code"
  echo "  3. Use environment variables instead"
  echo "  4. Add sensitive files to .gitignore"
  echo "  5. Rotate any exposed credentials"
  exit 1
fi
