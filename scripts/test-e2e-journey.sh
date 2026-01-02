#!/bin/bash
set -e

echo "🎭 Starting Yggdrasil E2E Journey Tests"
echo "======================================="
echo ""

GATEKEEPER_URL="${GATEKEEPER_URL:-http://localhost:8080}"
MAX_RETRIES=30
RETRY_DELAY=2

# Check if platform is running
echo "⏳ Checking if platform is running..."
retries=0
while [ $retries -lt $MAX_RETRIES ]; do
  if curl -sf "$GATEKEEPER_URL/health" > /dev/null 2>&1; then
    echo "✅ Platform is running"
    break
  fi
  retries=$((retries + 1))
  if [ $retries -eq $MAX_RETRIES ]; then
    echo "❌ Platform is not running. Please run 'make up' first."
    exit 1
  fi
  echo "   Waiting for platform... ($retries/$MAX_RETRIES)"
  sleep $RETRY_DELAY
done

echo ""
echo "📦 Installing Playwright browsers (if needed)..."
npx playwright install chromium --with-deps

echo ""
echo "🧪 Running E2E Journey Tests..."
echo "================================"
echo ""

# Run full journey test
npx playwright test tests/e2e/journey/full-journey.spec.ts --reporter=list

# Run isolation tests
npx playwright test tests/e2e/journey/isolation.spec.ts --reporter=list

echo ""
echo "📊 Generating HTML Report..."
npx playwright show-report

echo ""
echo "✅ E2E Journey Tests Complete!"
echo ""
