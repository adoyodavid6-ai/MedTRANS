# Deploying the database to the hosted Supabase project

Hosted project ref: `bsiyaddxphdsenwqybro` (`https://bsiyaddxphdsenwqybro.supabase.co`).

## Values the app needs (set in your host, e.g. Vercel → Environment Variables; never commit them)

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://bsiyaddxphdsenwqybro.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the project's **publishable** key (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | the **secret** key; server-only, needed from Phase 2 for payment webhooks |
| `NEXT_PUBLIC_SITE_URL` | the production origin |

## Linking and pushing migrations

From a machine (or session) that can reach Supabase:

```bash
export SUPABASE_ACCESS_TOKEN=...   # personal access token from supabase.com/dashboard/account/tokens
export SUPABASE_DB_PASSWORD=...    # database password (Project Settings → Database)
npx supabase link --project-ref bsiyaddxphdsenwqybro
npx supabase db push --dry-run     # review exactly which migrations will run
npx supabase db push
```

Then create the first administrator (see README → Bootstrapping).

## Without a direct database connection
Some environments (like the cloud session used to build this) can reach `api.supabase.com` over HTTPS but cannot open a Postgres connection, so `supabase db push` fails. `scripts/apply-hosted-migrations.py` applies the same migrations through the Management API, one transaction per migration, and records each in `supabase_migrations.schema_migrations` so the CLI stays in sync:

```
SUPABASE_ACCESS_TOKEN=... python3 scripts/apply-hosted-migrations.py bsiyaddxphdsenwqybro --dry-run
SUPABASE_ACCESS_TOKEN=... python3 scripts/apply-hosted-migrations.py bsiyaddxphdsenwqybro
```

## Do NOT run `supabase config push`

`supabase/config.toml` is for **local development only**. It contains fixed test sign-in codes
(`[auth.sms.test_otp]`, code 123456), a placeholder SMS provider and relaxed rate limits.
Pushing it to the hosted project would let anyone sign in to those numbers. Configure hosted
Auth in the dashboard instead:

- Authentication → URL configuration: Site URL = production origin; add it to redirect URLs.
- Authentication → Providers → Phone: enable with a real SMS provider `[[CONFIRM: SMS provider]]`.
- Authentication → Providers → Email: configure SMTP `[[CONFIRM: SMTP provider]]`.
- Authentication → Rate limits: review `[[CONFIRM: auth rate limits]]`.

## Do NOT run `npm run db:seed-dev` against it

The seed creates synthetic accounts and test data. It refuses non-local URLs by design.
