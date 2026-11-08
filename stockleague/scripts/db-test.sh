#!/usr/bin/env bash
# Applique toutes les migrations sur une base Postgres vierge puis lance les tests SQL.
# Usage : PGHOST=localhost PGUSER=postgres PGPASSWORD=... npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-stockleague_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f supabase/tests/_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f"
done
for f in supabase/tests/*.test.sql; do
  echo "→ test $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -o /dev/null -f "$f"
done
echo "✓ Tous les tests SQL passent"
