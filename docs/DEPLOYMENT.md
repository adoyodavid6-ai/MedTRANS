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

## Status of the hosted project (`bsiyaddxphdsenwqybro`, eu-west-1)
- 16 Oct 2026: all 16 migrations applied through `scripts/apply-hosted-migrations.py` and recorded in `supabase_migrations.schema_migrations`. Checked afterwards: 52 public tables, all with RLS; every SECURITY DEFINER function pins `search_path`; pg_cron jobs `medtrans-expire-unpaid-orders` and `medtrans-expire-booking-offers` scheduled; private `prescriptions` bucket; Kenya and Somalia inactive; emergency callback off; no users, no seed data.
- Phone sign-in enabled (Twilio) by the project owner. Next: deploy the app, sign in once, then bootstrap the first administrator (README).

## Deploying on Vercel
`vercel.json` pins functions to Dublin (`dub1`, next to the database in eu-west-1) and runs the notification job every minute. Per-minute cron schedules need a Vercel Pro plan; on Hobby, change the schedule to daily or use an external scheduler that sends `Authorization: Bearer $CRON_SECRET`.

Environment variables (Production):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://bsiyaddxphdsenwqybro.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the publishable key (Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | the secret key (Settings → API); server only |
| `NEXT_PUBLIC_SITE_URL` | your real https domain |
| `CRON_SECRET` | a long random string |

Leave `PAYMENTS_TEST_MODE` unset. Optional: `MPESA_*`, `AFRICASTALKING_*`, `EMAIL_*`, `ERROR_REPORT_URL`.

Then, in Supabase → Authentication → URL Configuration, set the Site URL to the same domain.

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
