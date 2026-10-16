#!/usr/bin/env bash
# Runs the pgTAP suite in supabase/tests against the local database.
set -euo pipefail
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
cd "$(dirname "$0")/.."

psql "$DB_URL" -qX -v ON_ERROR_STOP=1 -c 'create extension if not exists pgtap with schema extensions;' >/dev/null
psql "$DB_URL" -qX -v ON_ERROR_STOP=1 -f supabase/tests/00_helpers.sql >/dev/null

fail=0
for f in supabase/tests/*.test.sql; do
  out=$(PGOPTIONS='-c search_path=public,extensions' psql "$DB_URL" -qtAX -v ON_ERROR_STOP=1 -f "$f" 2>&1) || fail=1
  if echo "$out" | grep -qE '^not ok|Looks like you|ERROR'; then fail=1; fi
  echo "== $f"; echo "$out" | grep -E '^(ok|not ok|#|1\.\.)|ERROR' | sed 's/^/   /'
done

psql "$DB_URL" -qX -c 'drop schema if exists tests cascade;' >/dev/null
if [ "$fail" -ne 0 ]; then echo "DATABASE TESTS FAILED"; exit 1; fi
echo "All database tests passed."
