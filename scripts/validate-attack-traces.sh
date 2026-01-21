#!/bin/bash
#
# Attack Trace Validation Script
# 
# Validates attack trace logs for:
# - JSONL format compliance
# - OpenAI fine-tuning format
# - Metadata completeness
# - File structure
#

set -e

TRACE_DIR="${ATTACK_TRACE_PATH:-./logs/attack-traces}"
ERRORS=0
WARNINGS=0

echo "╔════════════════════════════════════════════════╗"
echo "║   Yggdrasil Attack Trace Validation Tool      ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Check if trace directory exists
if [ ! -d "$TRACE_DIR" ]; then
  echo "⚠️  Warning: Attack trace directory not found: $TRACE_DIR"
  echo "   This is expected if no traces have been generated yet."
  exit 0
fi

echo "📁 Trace Directory: $TRACE_DIR"
echo ""

# Validate JSONL files
validate_jsonl() {
  local file=$1
  local line_num=0
  local valid=true
  
  while IFS= read -r line; do
    ((line_num++))
    
    # Skip empty lines
    if [ -z "$line" ]; then
      continue
    fi
    
    # Validate JSON
    if ! echo "$line" | jq empty 2>/dev/null; then
      echo "   ❌ Line $line_num: Invalid JSON"
      ((ERRORS++))
      valid=false
      continue
    fi
    
    # Validate OpenAI format
    if ! echo "$line" | jq -e '.messages' > /dev/null 2>&1; then
      echo "   ❌ Line $line_num: Missing 'messages' field"
      ((ERRORS++))
      valid=false
    fi
    
    if ! echo "$line" | jq -e '.metadata' > /dev/null 2>&1; then
      echo "   ❌ Line $line_num: Missing 'metadata' field"
      ((ERRORS++))
      valid=false
    fi
    
    # Check message structure
    local msg_count=$(echo "$line" | jq '.messages | length' 2>/dev/null || echo "0")
    if [ "$msg_count" -lt 2 ]; then
      echo "   ⚠️  Line $line_num: Trace should have at least 2 messages"
      ((WARNINGS++))
    fi
    
    # Check metadata fields
    if ! echo "$line" | jq -e '.metadata.timestamp' > /dev/null 2>&1; then
      echo "   ❌ Line $line_num: Missing metadata.timestamp"
      ((ERRORS++))
      valid=false
    fi
    
    if ! echo "$line" | jq -e '.metadata.exploit_successful' > /dev/null 2>&1; then
      echo "   ❌ Line $line_num: Missing metadata.exploit_successful"
      ((ERRORS++))
      valid=false
    fi
  done < "$file"
  
  if $valid; then
    echo "   ✅ Valid JSONL with $line_num traces"
  fi
}

# Find and validate all trace files
TRACE_COUNT=0
for service_dir in "$TRACE_DIR"/*; do
  if [ ! -d "$service_dir" ]; then
    continue
  fi
  
  service_name=$(basename "$service_dir")
  echo "📊 Validating $service_name traces..."
  
  for trace_file in "$service_dir"/*.jsonl; do
    if [ ! -f "$trace_file" ]; then
      continue
    fi
    
    echo "  📄 $(basename "$trace_file")"
    validate_jsonl "$trace_file"
    ((TRACE_COUNT++))
  done
done

echo ""
echo "════════════════════════════════════════════════"
echo "Summary:"
echo "  Trace files validated: $TRACE_COUNT"
echo "  Errors: $ERRORS"
echo "  Warnings: $WARNINGS"
echo ""

if [ $TRACE_COUNT -eq 0 ]; then
  echo "ℹ️  No trace files found - this is expected for fresh installs"
  echo "   Run the platform and perform some actions to generate traces"
  exit 0
fi

if [ $ERRORS -gt 0 ]; then
  echo "❌ Validation failed with $ERRORS errors"
  exit 1
else
  echo "✅ All attack traces valid!"
  if [ $WARNINGS -gt 0 ]; then
    echo "⚠️  $WARNINGS warnings found (non-blocking)"
  fi
  exit 0
fi
