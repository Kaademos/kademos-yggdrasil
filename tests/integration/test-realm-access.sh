#!/bin/bash
# Integration test: Realm Access without Authentication
# Tests that realms are accessible to anonymous users

set -e

BASE_URL="${BASE_URL:-http://localhost:8080}"
PASS=0
FAIL=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASS=$((PASS + 1))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAIL=$((FAIL + 1))
}

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# Test: Health check
test_health() {
    log_info "Testing health endpoint..."
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
    if [ "$response" = "200" ]; then
        log_pass "Health check returns 200"
    else
        log_fail "Health check returned $response (expected 200)"
    fi
}

# Test: Niflheim accessible without auth
test_niflheim_no_auth() {
    log_info "Testing Niflheim access without authentication..."
    
    # Test health endpoint
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/realms/niflheim/health")
    if [ "$response" = "200" ]; then
        log_pass "Niflheim health accessible without auth"
    else
        log_fail "Niflheim health returned $response (expected 200)"
    fi
    
    # Test main page returns HTML
    response=$(curl -s "$BASE_URL/realms/niflheim/" | head -1)
    if [[ "$response" == *"<!DOCTYPE html>"* ]]; then
        log_pass "Niflheim serves HTML content"
    else
        log_fail "Niflheim did not return HTML"
    fi
    
    # Test CSS is served
    css_response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/realms/niflheim/css/scada.css")
    if [ "$css_response" = "200" ]; then
        log_pass "Niflheim CSS accessible"
    else
        log_fail "Niflheim CSS returned $css_response (expected 200)"
    fi
    
    # Test JS is served
    js_response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/realms/niflheim/js/niflheim-scada.js")
    if [ "$js_response" = "200" ]; then
        log_pass "Niflheim JS accessible"
    else
        log_fail "Niflheim JS returned $js_response (expected 200)"
    fi
}

# Test: Helheim should be locked
test_helheim_locked() {
    log_info "Testing Helheim is locked for new session..."
    
    response=$(curl -s "$BASE_URL/realms/helheim/health")
    if [[ "$response" == *"Realm locked"* ]]; then
        log_pass "Helheim correctly locked for unauthenticated user"
    else
        log_fail "Helheim should be locked but got: $response"
    fi
}

# Test: Realms API returns correct lock states
test_realms_api() {
    log_info "Testing realms API..."
    
    response=$(curl -s "$BASE_URL/realms")
    
    # Check Niflheim is unlocked (using Python for JSON parsing)
    niflheim_locked=$(echo "$response" | python3 -c "import sys, json; data = json.load(sys.stdin); realm = next((r for r in data['realms'] if r['name'] == 'niflheim'), None); print(realm['locked'] if realm else 'not_found')")
    if [ "$niflheim_locked" = "False" ]; then
        log_pass "Niflheim marked as unlocked in API"
    else
        log_fail "Niflheim should be unlocked in API response (got: $niflheim_locked)"
    fi
    
    # Check Helheim is locked
    helheim_locked=$(echo "$response" | python3 -c "import sys, json; data = json.load(sys.stdin); realm = next((r for r in data['realms'] if r['name'] == 'helheim'), None); print(realm['locked'] if realm else 'not_found')")
    if [ "$helheim_locked" = "True" ]; then
        log_pass "Helheim marked as locked in API"
    else
        log_fail "Helheim should be locked in API response (got: $helheim_locked)"
    fi
    
    # Check sample realm is unlocked
    sample_locked=$(echo "$response" | python3 -c "import sys, json; data = json.load(sys.stdin); realm = next((r for r in data['realms'] if r['name'] == 'sample'), None); print(realm['locked'] if realm else 'not_found')")
    if [ "$sample_locked" = "False" ]; then
        log_pass "Sample realm marked as unlocked in API"
    else
        log_fail "Sample realm should be unlocked in API response (got: $sample_locked)"
    fi
}

# Test: Sample realm accessible
test_sample_realm() {
    log_info "Testing sample realm access..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/realms/sample/health")
    if [ "$response" = "200" ]; then
        log_pass "Sample realm health accessible"
    else
        log_fail "Sample realm health returned $response (expected 200)"
    fi
}

# Test: Landing page with Yggdrasil image
test_landing_page() {
    log_info "Testing landing page..."
    
    # Test landing page loads
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
    if [ "$response" = "200" ]; then
        log_pass "Landing page returns 200"
    else
        log_fail "Landing page returned $response (expected 200)"
    fi
    
    # Test Yggdrasil image is accessible
    img_response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/assets/ygg.webp")
    if [ "$img_response" = "200" ]; then
        log_pass "Yggdrasil image accessible"
    else
        log_fail "Yggdrasil image returned $img_response (expected 200)"
    fi
}

# Run all tests
main() {
    echo "=============================================="
    echo "  Realm Access Integration Tests"
    echo "=============================================="
    echo ""
    
    test_health
    echo ""
    test_landing_page
    echo ""
    test_niflheim_no_auth
    echo ""
    test_helheim_locked
    echo ""
    test_realms_api
    echo ""
    test_sample_realm
    
    echo ""
    echo "=============================================="
    echo "  Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
    echo "=============================================="
    
    if [ $FAIL -gt 0 ]; then
        exit 1
    fi
}

main
