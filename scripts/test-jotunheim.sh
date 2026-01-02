#!/bin/bash
# Integration test script for Jotunheim realm
# Tests the session fixation vulnerability

set -e

REALM="jotunheim"
BASE_URL="http://localhost:8080/realms/${REALM}"
COLORS=true

# Color output
if [ "$COLORS" = true ]; then
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m'
else
  GREEN=''
  RED=''
  YELLOW=''
  BLUE=''
  NC=''
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Testing JOTUNHEIM Realm${NC}"
echo -e "${BLUE}A07:2025 - Authentication Failures${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Health check
echo -e "${YELLOW}Step 1: Checking realm health...${NC}"
HEALTH_RESPONSE=$(curl -s "${BASE_URL}/health")
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
  echo -e "${GREEN}✓ Health check passed${NC}"
else
  echo -e "${RED}✗ Health check failed${NC}"
  exit 1
fi
echo ""

# Step 2: Get initial session
echo -e "${YELLOW}Step 2: Getting initial session ID...${NC}"
COOKIE_JAR=$(mktemp)
SESSION_RESPONSE=$(curl -s -c "$COOKIE_JAR" "${BASE_URL}/api/session")
SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.sessionId')
echo -e "${GREEN}✓ Session ID: $SESSION_ID${NC}"
echo ""

# Step 3: Login with valid credentials
echo -e "${YELLOW}Step 3: Logging in as admin...${NC}"
LOGIN_RESPONSE=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"icethrone2024"}' \
  "${BASE_URL}/api/login")

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Login successful${NC}"
else
  echo -e "${RED}✗ Login failed${NC}"
  echo "$LOGIN_RESPONSE"
  rm "$COOKIE_JAR"
  exit 1
fi
echo ""

# Step 4: Verify session ID not regenerated (VULNERABILITY)
echo -e "${YELLOW}Step 4: Checking if session ID was regenerated...${NC}"
SESSION_RESPONSE_AFTER=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/api/session")
SESSION_ID_AFTER=$(echo "$SESSION_RESPONSE_AFTER" | jq -r '.sessionId')

if [ "$SESSION_ID" = "$SESSION_ID_AFTER" ]; then
  echo -e "${GREEN}✓ Session fixation vulnerability confirmed!${NC}"
  echo -e "  Session ID unchanged: $SESSION_ID"
else
  echo -e "${RED}✗ Session ID was regenerated (vulnerability not present)${NC}"
  echo -e "  Before: $SESSION_ID"
  echo -e "  After:  $SESSION_ID_AFTER"
fi
echo ""

# Step 5: Access admin panel
echo -e "${YELLOW}Step 5: Accessing admin panel...${NC}"
ADMIN_RESPONSE=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/api/admin")

if echo "$ADMIN_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Admin panel accessed${NC}"
else
  echo -e "${RED}✗ Failed to access admin panel${NC}"
  echo "$ADMIN_RESPONSE"
  rm "$COOKIE_JAR"
  exit 1
fi
echo ""

# Step 6: Extract flag
echo -e "${YELLOW}Step 6: Extracting flag...${NC}"
FLAG=$(echo "$ADMIN_RESPONSE" | jq -r '.flag')

if [ -z "$FLAG" ] || [ "$FLAG" = "null" ]; then
  echo -e "${RED}✗ Flag not found in response${NC}"
  rm "$COOKIE_JAR"
  exit 1
fi

echo -e "${GREEN}✓ Flag extracted: $FLAG${NC}"
echo ""

# Step 7: Validate flag format
echo -e "${YELLOW}Step 7: Validating flag format...${NC}"
if echo "$FLAG" | grep -qP '^YGGDRASIL\{JOTUNHEIM:[a-f0-9-]+\}$'; then
  echo -e "${GREEN}✓ Flag format is valid${NC}"
else
  echo -e "${RED}✗ Invalid flag format: $FLAG${NC}"
  rm "$COOKIE_JAR"
  exit 1
fi
echo ""

# Cleanup
rm "$COOKIE_JAR"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ All JOTUNHEIM tests passed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Flag: ${BLUE}$FLAG${NC}"
echo ""
