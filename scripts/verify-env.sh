#!/bin/bash

# Verify .env configuration for Project Yggdrasil
# This script checks that all required environment variables are set

set -e

echo "🔍 Verifying .env configuration..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "   Run 'make setup' to create it."
    exit 1
fi

echo "✅ .env file exists"

# Count required variables
REQUIRED_VARS=(
    "APP_PORT"
    "SESSION_SECRET"
    "FLAG_MASTER_SECRET"
    "NIFLHEIM_FLAG"
    "HELHEIM_FLAG"
    "SVARTALFHEIM_FLAG"
    "JOTUNHEIM_FLAG"
    "JOTUNHEIM_SESSION_SECRET"
    "MUSPELHEIM_FLAG"
    "NIDAVELLIR_FLAG"
    "NIDAVELLIR_DB_PASSWORD"
    "VANAHEIM_FLAG"
    "MIDGARD_FLAG"
    "ALFHEIM_FLAG"
    "ASGARD_FLAG"
    "ASGARD_DB_PASSWORD"
    "GRAFANA_ADMIN_PASSWORD"
)

MISSING=0
PLACEHOLDER=0

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" .env; then
        echo "❌ Missing: $var"
        ((MISSING++))
    else
        # An empty value is as bad as a missing key: realms fail closed on an
        # unset FLAG, and an unset secret silently disables features.
        value=$(grep "^${var}=" .env | tail -n 1 | cut -d= -f2-)
        if [ -z "$value" ]; then
            echo "❌ Empty: $var"
            ((MISSING++))
        elif [[ "$value" == "<"*">" ]]; then
            echo "⚠️  Placeholder found in: $var"
            ((PLACEHOLDER++))
        fi
    fi
done

echo ""

if [ $MISSING -eq 0 ] && [ $PLACEHOLDER -eq 0 ]; then
    echo "✅ All ${#REQUIRED_VARS[@]} required variables are set"
    echo "✅ No placeholder values found"
    echo ""
    echo "🎉 .env configuration is valid!"
    exit 0
else
    echo "❌ Configuration issues found:"
    [ $MISSING -gt 0 ] && echo "   - $MISSING missing variables"
    [ $PLACEHOLDER -gt 0 ] && echo "   - $PLACEHOLDER placeholder values need to be replaced"
    echo ""
    echo "   Run 'make setup' to auto-generate secrets"
    echo "   (flags and FLAG_MASTER_SECRET: scripts/generate-flags.sh)"
    exit 1
fi
