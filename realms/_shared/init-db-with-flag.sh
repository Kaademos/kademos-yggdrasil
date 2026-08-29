#!/bin/sh
#
# Postgres init hook that seeds a realm database with the deployment's flag.
#
# Nidavellir and Asgard hand the player their flag out of the database, not out
# of the application, so the seed has to carry the same value the rest of the
# stack was configured with. Committing a literal into init-db.sql is how those
# realms' flags ended up published; this script substitutes REALM_FLAG into the
# template at container-init time instead, so the value exists only in .env.
#
# Postgres runs everything in /docker-entrypoint-initdb.d in alphabetical order,
# and only on first initialisation of an empty data directory. Mount this as
# `10-init.sh` alongside the template at `init.sql.template`.

set -eu

TEMPLATE=/docker-entrypoint-initdb.d/init.sql.template

if [ ! -f "$TEMPLATE" ]; then
    echo "[init-db] ERROR: $TEMPLATE not found." >&2
    exit 1
fi

if [ -z "${REALM_FLAG:-}" ]; then
    echo "[init-db] ERROR: REALM_FLAG is not set. The database would seed a realm" >&2
    echo "[init-db]        with no capturable flag. Run 'make setup' to generate one." >&2
    exit 1
fi

case "$REALM_FLAG" in
    *"'"*)
        # The value is interpolated into a SQL string literal; a quote would
        # break the seed (or worse). Generated flags never contain one.
        echo "[init-db] ERROR: REALM_FLAG must not contain a single quote." >&2
        exit 1
        ;;
esac

echo "[init-db] Seeding $POSTGRES_DB with the configured realm flag..."

# awk rather than sed: the flag contains braces and slashes are plausible in
# future formats, and awk's literal replacement avoids escaping either.
awk -v flag="$REALM_FLAG" '{ gsub(/__REALM_FLAG__/, flag); print }' "$TEMPLATE" \
    | psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"

echo "[init-db] Seed complete."
