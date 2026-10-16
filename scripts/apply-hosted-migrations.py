#!/usr/bin/env python3
"""
Applies supabase/migrations to a hosted Supabase project through the Management API's SQL endpoint,
for environments that cannot open a direct Postgres connection (the CLI's `db push` needs one).

Each migration runs in its own transaction together with its row in supabase_migrations.schema_migrations,
the same history table `supabase db push` uses, so the CLI stays in sync afterwards. Already-applied
versions are skipped; the run stops at the first failure.

Never use this to apply seeds or local config. Usage:
  SUPABASE_ACCESS_TOKEN=... python3 scripts/apply-hosted-migrations.py <project-ref> [--dry-run]
"""
import glob, json, os, sys, urllib.request

if len(sys.argv) < 2:
    sys.exit(__doc__)
REF, DRY = sys.argv[1], "--dry-run" in sys.argv
API = f"https://api.supabase.com/v1/projects/{REF}/database/query"
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN") or sys.exit("Set SUPABASE_ACCESS_TOKEN.")


def q(sql):
    req = urllib.request.Request(API, data=json.dumps({"query": sql}).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return r.status, json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


root = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations")
st, res = q("select to_regclass('supabase_migrations.schema_migrations') is not null as present")
if st not in (200, 201):
    sys.exit(f"Cannot reach the project ({st}): {res}")
done = set()
if res[0]["present"]:
    st, rows = q("select version from supabase_migrations.schema_migrations")
    done = {r["version"] for r in rows}

for f in sorted(glob.glob(os.path.join(root, "*.sql"))):
    base = os.path.basename(f)[:-4]
    version, name = base.split("_", 1)
    if version in done:
        print("already applied", base)
        continue
    if DRY:
        print("would apply", base)
        continue
    sql = open(f).read()
    assert "$mig$" not in sql
    st, res = q(
        "begin;\n"
        "create schema if not exists supabase_migrations;\n"
        "create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);\n"
        f"{sql}\n;\n"
        f"insert into supabase_migrations.schema_migrations (version, name, statements) values ('{version}', '{name}', array[$mig${sql}$mig$]);\n"
        "commit;"
    )
    if st not in (200, 201):
        sys.exit(f"FAILED {base} ({st}): {str(res)[:2000]}")
    print("applied", base)
