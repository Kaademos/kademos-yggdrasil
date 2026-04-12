#!/bin/bash
#
# Quick script to validate all realm manifests exist
# Part of Phase 2 implementation
#

set -e

echo "📋 Validating Realm Manifests"
echo "=============================="
echo ""

REALMS=(
  "niflheim:10:A10:2025"
  "helheim:9:A09:2025"
  "svartalfheim:8:A08:2025"
  "jotunheim:7:A07:2025"
  "muspelheim:6:A06:2025"
  "nidavellir:5:A05:2025"
  "vanaheim:4:A04:2025"
  "midgard:3:A03:2025"
  "alfheim:2:A02:2025"
  "asgard:1:A01:2025"
)

MISSING=0
for realm_info in "${REALMS[@]}"; do
  IFS=: read -r realm level owasp <<< "$realm_info"
  manifest_path="realms/$realm/manifest.json"
  
  if [ -f "$manifest_path" ]; then
    echo "✅ $realm (Level $level - $owasp)"
  else
    echo "❌ MISSING: $realm (Level $level - $owasp)"
    ((MISSING++))
  fi
done

echo ""
if [ $MISSING -eq 0 ]; then
  echo "✅ All 10 realm manifests exist!"
  exit 0
else
  echo "❌ $MISSING manifests missing"
  exit 1
fi
