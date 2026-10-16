#!/usr/bin/env bash
# Starts the local Supabase stack.
# Some sandboxed environments cannot reach public.ecr.aws (the CLI's default registry).
# When a pull fails, this mirrors the image from Docker Hub and re-tags it with the name the CLI expects.
set -uo pipefail
export SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN="${SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN:-local-placeholder}"

# Images whose Docker Hub name differs from the ECR name.
hub_name() {
  case "$1" in
    supabase/kong:*) echo "kong:${1#supabase/kong:}" ;;
    supabase/mailpit:*) echo "axllent/mailpit:${1#supabase/mailpit:}" ;;
    supabase/postgrest:*) echo "postgrest/postgrest:${1#supabase/postgrest:}" ;;
    *) echo "$1" ;;
  esac
}

for _ in $(seq 1 15); do
  out=$(npx supabase start 2>&1) && { echo "$out"; exit 0; }
  img=$(echo "$out" | grep -o 'public.ecr.aws/supabase/[a-z0-9_.-]*:[A-Za-z0-9_.-]*' | head -1)
  if [ -z "$img" ]; then echo "$out"; exit 1; fi
  hub=$(hub_name "${img#public.ecr.aws/}")
  echo "Mirroring $hub -> $img"
  docker pull -q "$hub" && docker tag "$hub" "$img" || exit 1
done
exit 1
