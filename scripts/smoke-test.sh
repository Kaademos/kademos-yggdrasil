#!/bin/bash

set -e

GATEKEEPER_URL="${GATEKEEPER_URL:-http://localhost:8080}"
MAX_RETRIES=30
RETRY_DELAY=2

echo "🧪 Starting smoke tests..."
echo "Target: $GATEKEEPER_URL"
echo ""

wait_for_service() {
  local url=$1
  local service_name=$2
  local retries=0

  echo "⏳ Waiting for $service_name to be ready..."
  
  while [ $retries -lt $MAX_RETRIES ]; do
    if curl -sf "$url" > /dev/null 2>&1; then
      echo "✅ $service_name is ready"
      return 0
    fi
    retries=$((retries + 1))
    echo "   Attempt $retries/$MAX_RETRIES..."
    sleep $RETRY_DELAY
  done
  
  echo "❌ $service_name failed to become ready"
  return 1
}

check_security_headers() {
  local url=$1
  echo "🔒 Checking security headers..."
  
  headers=$(curl -sI "$url")
  
  if echo "$headers" | grep -q "X-Content-Type-Options: nosniff"; then
    echo "   ✅ X-Content-Type-Options header present"
  else
    echo "   ❌ X-Content-Type-Options header missing"
    return 1
  fi
  
  if echo "$headers" | grep -q "Content-Security-Policy"; then
    echo "   ✅ Content-Security-Policy header present"
  else
    echo "   ❌ Content-Security-Policy header missing"
    return 1
  fi
  
  return 0
}

test_endpoint() {
  local url=$1
  local expected_status=$2
  local description=$3
  
  echo "Testing: $description"
  echo "   URL: $url"
  
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  
  if [ "$status" = "$expected_status" ]; then
    echo "   ✅ Status: $status (expected $expected_status)"
    return 0
  else
    echo "   ❌ Status: $status (expected $expected_status)"
    return 1
  fi
}

test_flag_submission() {
  echo "🚩 Testing flag submission..."
  
  response=$(curl -s -X POST "$GATEKEEPER_URL/submit-flag" \
    -H "Content-Type: application/json" \
    -d '{"userId":"test-user","flag":"YGGDRASIL{SAMPLE:00000000-0000-0000-0000-000000000000}"}')
  
  if echo "$response" | grep -q '"status":"success"'; then
    echo "   ✅ Flag submission successful"
    return 0
  else
    echo "   ❌ Flag submission failed"
    echo "   Response: $response"
    return 1
  fi
}

wait_for_service "$GATEKEEPER_URL/health" "Gatekeeper"

echo ""
echo "📋 Running endpoint tests..."
echo ""

test_endpoint "$GATEKEEPER_URL/health" "200" "Gatekeeper health check"
test_endpoint "$GATEKEEPER_URL/realms" "200" "Realms list endpoint"
test_endpoint "$GATEKEEPER_URL/auth/status" "200" "Auth status endpoint"

# These endpoints require authentication, so expect 401 without login
test_endpoint "$GATEKEEPER_URL/realms/sample/" "401" "Sample realm proxy (requires auth)"

echo ""
check_security_headers "$GATEKEEPER_URL/health"

echo ""
echo "🎉 All smoke tests passed!"
echo ""
