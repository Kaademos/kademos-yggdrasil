#!/bin/bash
#
# Generate per-deployment realm flags and the flag master secret into .env.
#
# Flags are deployment secrets, not content: every install gets its own set so
# that no deployment ever runs on a value published in the repository. Realms
# refuse to start without an explicitly configured FLAG, and the Flag Oracle
# builds its valid-flag set from these same variables, so this script is the
# single point where they are created.
#
# Usage:
#   scripts/generate-flags.sh           # fill in any missing or empty flags
#   scripts/generate-flags.sh --force   # rotate every flag and the master secret
#
# Rotating invalidates all previously captured flags and any progression that
# depends on them.

set -euo pipefail

ENV_FILE="${ENV_FILE:-.env}"
FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

# Must match REALM_ORDER in flag-oracle/src/config/realm-order.ts.
REALMS=(SAMPLE NIFLHEIM HELHEIM SVARTALFHEIM JOTUNHEIM MUSPELHEIM NIDAVELLIR VANAHEIM MIDGARD ALFHEIM ASGARD)

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ $ENV_FILE not found. Run 'make setup' first." >&2
    exit 1
fi

# The sample realm predates the <REALM>_FLAG convention.
env_key_for() {
    if [ "$1" = "SAMPLE" ]; then echo "SAMPLE_REALM_FLAG"; else echo "${1}_FLAG"; fi
}

random_uuid() {
    if command -v uuidgen >/dev/null 2>&1; then
        uuidgen | tr 'A-Z' 'a-z'
    else
        # RFC 4122 v4 from 16 random bytes: set version (4) and variant (8-b).
        local h
        h=$(od -An -tx1 -N16 /dev/urandom | tr -d ' \n')
        printf '%s-%s-4%s-%s%s-%s\n' \
            "${h:0:8}" "${h:8:4}" "${h:13:3}" \
            "$(printf '%x' $(( 0x8 + (0x${h:16:1} % 4) )))" "${h:17:3}" \
            "${h:20:12}"
    fi
}

random_hex() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex "$1"
    else
        od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n'
    fi
}

current_value() {
    # Last assignment wins, matching how dotenv parsers resolve duplicates.
    grep "^${1}=" "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2- || true
}

needs_value() {
    local value="$1"
    [ "$FORCE" -eq 1 ] && return 0
    [ -z "$value" ] && return 0
    case "$value" in
        '<'*'>') return 0 ;;   # unreplaced .env.example placeholder
    esac
    return 1
}

set_value() {
    local key="$1" value="$2" tmp
    tmp=$(mktemp)
    if grep -q "^${key}=" "$ENV_FILE"; then
        # Rewrite in place without sed -i, whose flags differ across platforms.
        # The value is written by awk as a literal, so flag characters like { }
        # are never interpreted.
        awk -v key="$key" -v val="$value" \
            'index($0, key "=") == 1 { print key "=" val; next } { print }' \
            "$ENV_FILE" > "$tmp"
    else
        cp "$ENV_FILE" "$tmp"
        printf '%s=%s\n' "$key" "$value" >> "$tmp"
    fi
    # Preserve the original file's permissions rather than mktemp's.
    cat "$tmp" > "$ENV_FILE"
    rm -f "$tmp"
}

echo "🔐 Generating deployment flags in $ENV_FILE..."
[ "$FORCE" -eq 1 ] && echo "   ⚠️  --force: rotating ALL flags. Existing captures will stop validating."
echo ""

generated=0
kept=0

for realm in "${REALMS[@]}"; do
    key=$(env_key_for "$realm")
    value=$(current_value "$key")

    if needs_value "$value"; then
        set_value "$key" "YGGDRASIL{${realm}:$(random_uuid)}"
        echo "   ✅ $key generated"
        generated=$((generated + 1))
    else
        echo "   ↷  $key already set, keeping"
        kept=$((kept + 1))
    fi
done

master=$(current_value "FLAG_MASTER_SECRET")
if needs_value "$master" || [ "${#master}" -lt 32 ]; then
    set_value "FLAG_MASTER_SECRET" "$(random_hex 32)"
    echo "   ✅ FLAG_MASTER_SECRET generated (64 hex chars)"
    generated=$((generated + 1))
else
    echo "   ↷  FLAG_MASTER_SECRET already set, keeping"
    kept=$((kept + 1))
fi

chmod 600 "$ENV_FILE" 2>/dev/null || true

echo ""
echo "🎉 $generated generated, $kept kept."
echo "   Flags live only in $ENV_FILE — it is gitignored. Back up FLAG_MASTER_SECRET:"
echo "   losing it invalidates every per-user flag the Oracle has ever issued."
