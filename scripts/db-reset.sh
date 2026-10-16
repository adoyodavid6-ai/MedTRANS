#!/usr/bin/env bash
# Resets the local database (migrations + no data) and waits until Auth answers through the API gateway.
set -euo pipefail
export SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN="${SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN:-local-placeholder}"
cd "$(dirname "$0")/.."
npx supabase db reset >/dev/null
ANON=$(npx supabase status -o env 2>/dev/null | grep '^ANON_KEY=' | cut -d'"' -f2)
healthy() { [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:54321/auth/v1/health -H "apikey: $ANON")" = "200" ]; }
for i in $(seq 1 15); do healthy && exit 0; sleep 2; done
# The gateway can keep a stale upstream address after Auth restarts; restart it once.
docker restart supabase_kong_medtrans supabase_rest_medtrans >/dev/null 2>&1 || true
for i in $(seq 1 20); do healthy && exit 0; sleep 2; done
echo "Auth did not become healthy" >&2; exit 1
