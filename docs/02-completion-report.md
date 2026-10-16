# MedTRANS: completion report (Phases 1–6)

Branch `claude/bold-bardeen-75mxhk`. Stack: Next.js 16 (App Router) + Supabase (Postgres 17, PostGIS, pg_cron), Nairobi pilot.
Everything below was built and tested against a **local** Supabase stack with synthetic data. Nothing has been deployed, and no real credential, partner, price or clinician has been used.

## 1. What was implemented
| Phase | Scope |
|---|---|
| 1 Foundation | Public site, Emergency Help (guidance first, verified numbers only), OTP sign-in, consent ledger, 9 roles with server- and database-side guards, patient profile, addresses and household, operations console, audit log |
| 2 Pharmacy | Verified pharmacies and licences, catalogue and inventory, prescription upload and pharmacist review, server-priced cart and checkout, stock reservation, payments (M-Pesa adapter + test gateway), order state machine, courier handover codes, refunds, unpaid-order expiry |
| 3 DoctorCare & SmartCare | Clinician registration and verification, services, fees, availability, server-side red-flag screening, nearest-suitable matching with offers and timeouts, no double-booking, booking payments, signed visit records, provider directory and map list |
| 4 Safety & support | Emergency callback (only while a staffed operation is recorded), responder queue, support tickets with internal notes, safety incidents, medicine recalls, notifications (in-app, SMS/email outbox) |
| 5 Commercial & growth | Settlements (draft → approve → four-eyes payout record), partner applications, subscription plans (hidden until priced), clinician-reviewed health articles, aggregate first-party analytics, sitemap, structured data, social image |
| 6 Hardening | Content-Security-Policy and headers, data export and erasure requests, redacted error reporting hook, test-gateway production guard, performance measurement, runbook and backup plan |

## 2. Working features (verified end to end locally)
Journeys A–D from §22 run in the browser across several real signed-in roles: order an OTC medicine; prescription upload → pharmacist approval → order → courier delivery with handover code; home-visit booking → clinician offer → visit record; emergency guidance and callback with responder acknowledgement; support conversation; recall; settlement calculation refusal without rates; article review gate; data export and deletion request.

## 3. Needs external credentials or partners (built behind a disabled state)
- **Payments:** M-Pesa Daraja keys (adapter written, never run against Daraja). Checkout shows "payments not yet activated" until set.
- **SMS / email:** Africa's Talking and an email API (adapters written, untested). Messages are recorded as "skipped" until set.
- **Emergency callback:** a staffed, trained responder operation with a named supervisor.
- **Pharmacies and clinicians:** real licences and registrations, checked with the PPB and KMPDC/NCK.
- **Clinical content:** DoctorCare screening questions and every article need named clinical review.
- **Commercial terms:** commission rates and plan prices.
- **Hosted Supabase:** project `bsiyaddxphdsenwqybro` is not linked yet. This environment's network policy blocks supabase.co, and no access token or database password was provided (see `DEPLOYMENT.md`).
- **Monitoring endpoint:** `ERROR_REPORT_URL`.

The full list of tokens is in `SETUP-CHECKLIST.md`.

## 4. Database changes
Migrations are in `supabase/migrations`:

| Phase | Migrations |
|---|---|
| 1 | `20261016*` (foundation, reference data, operations, consent erasure) |
| 2 | `20261017*` (pharmacy schema, workflows, jobs, read functions, cart quote) |
| 3 | `20261018*` (DoctorCare schema, workflows, reference data, near-me) |
| 4 | `20261019000100_safety_support` |
| 5 | `20261020000100_commercial` |
| 6 | `20261021000100_data_rights` |

Every table has RLS. Privileged changes go through `SECURITY DEFINER` functions with an empty `search_path`, and every function is checked by test.

## 5. Environment variables
See `.env.example`.

| Variable | Status |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Required |
| `MPESA_*` | Optional |
| `CRON_SECRET`, `AFRICASTALKING_*`, `SMS_SENDER_ID`, `EMAIL_*` | Optional |
| `ERROR_REPORT_URL`, `ERROR_REPORT_TOKEN`, `RELEASE` | Optional |
| `PAYMENTS_TEST_MODE`, `PAYMENTS_TEST_WEBHOOK_SECRET` | Local/CI only; refused on any non-localhost site |

## 6. Setup and deployment
- **Local:** see `README.md`. In short: `npm ci`, then `npm run db:start`, then `npm run db:reset`, then `npm run db:seed-dev`, then `npm run dev`.
- **Production:** see `DEPLOYMENT.md`. In short:
  1. Link the project.
  2. Run `supabase db push`.
  3. Configure Auth (SMS provider, OTP) in the dashboard. **Never** run `config push`, and **never** run the dev seed.
  4. Set the environment variables in the host and deploy.
  5. Bootstrap the first admin (README).
  6. Schedule the notifications job.

## 7. Security and privacy controls
- **Access control:**
  - RLS on every table, with default grants revoked and column-level grants.
  - Role checks are enforced in both the server and the database.
  - Audit log records field names only, never values.
- **Pricing:** all prices and totals are recalculated server-side, with idempotent order placement.
- **Payments:** payment results are trusted only after verification (Daraja re-query / HMAC), with replay and amount checks.
- **Prescription files:**
  - Private bucket, opened through short-lived signed URLs, and every access is audited.
  - Uploads are content-sniffed.
- **Data minimisation by role:**
  - Couriers never see clinical data.
  - Admin booking lists exclude clinical fields.
  - The public directory shows rounded distances only.
- **Consent:** the consent ledger is append-only.
- **Data subject rights:**
  - Data export: the user's own records only, even for staff accounts.
  - Erasure workflow: retention-aware, an admin cannot handle their own request, and sign-in is disabled afterwards.
- **Headers:**
  - CSP: `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`, and connect limited to the app's own origin and Supabase.
  - HSTS, nosniff, COOP, and a Permissions-Policy.
- **Error reports:** paths, phone numbers and email addresses are redacted, and headers, cookies and bodies are never sent.
- **Dependencies:** `npm audit --omit=dev`: 0 vulnerabilities (16 Oct 2026).

## 8. Tests (actual results, final run 16 Oct 2026)
- **Unit (Vitest):** 89 passed.
- **Database (pgTAP):** 235 passed across 12 files.
- **End-to-end (Playwright, 360 px mobile + desktop):** 101 passed, 2 skipped. The skipped test is the "planned page" check, which has no target now that every route is live. The run includes axe accessibility scans of 20 public pages.
- **Lint and typecheck:** clean.
- **CI (GitHub Actions):** Phases 1–5 green. The Phase 6 run is triggered by this push.
- **Performance** (`scripts/perf.mjs`, Pixel 5, 4× CPU, 1.6 Mbps / 150 ms):

  | Page | LCP |
  |---|---|
  | `/` | 696 ms |
  | `/emergency` | 680 ms |
  | `/pharmacy/medicines` | 544 ms |
  | `/doctorcare` | 660 ms |
  | `/coverage` | 656 ms |
  | `/resources` | 536 ms |

  CLS was 0.000 everywhere, and each page loads about 208 KB of JavaScript transferred. These numbers come from a local server, so production TTFB will add to them.

## 9. Known limitations and risks
- The M-Pesa, Africa's Talking and email adapters have **never run against the real services**. Run them in sandbox before any real money or message.
- **CSP allows `'unsafe-inline'` scripts.** Nonces would make every page dynamic, including Emergency Help. Revisit SRI/nonces once traffic patterns are known.
- **Rate limiting:**
  - It is database-level for guest forms (emergency, support, applications, exports) and Supabase's for OTP.
  - There is no edge/IP limiter: configure one at the host.
  - The analytics counter can be inflated by scripted requests; it is aggregate-only and contains no personal data.
- **Distance:** matching and "near me" use straight-line distance, not road travel time.
- **Erasure is semi-manual.** An admin completes it, and orders, prescriptions and visit notes are retained by design. Retention periods are unconfirmed, so nothing deletes retained records automatically yet.
- **Settlements:** they calculate and record payouts; they do not move money.
- **Backups:** prescription files in Storage are not covered by database PITR; a separate backup is needed.
- **No real-world validation yet:** no load testing has been done, and there has been no penetration test or clinical safety review (DCB0129-style). All screening content is draft.
- **Data:** all data is synthetic. Nothing has been validated with real pharmacies, clinicians or patients.

## 10. Prioritised launch checklist
1. **Legal and clinical:**
   - Business registration, ODPC registration and DPIA, DPO.
   - Privacy notice and terms reviewed by a Kenyan lawyer.
   - Clinical lead signs off the screening questions and the emergency guidance.
2. **Hosted Supabase:**
   - Allow supabase.co / supabase.com in this environment, or link from your machine.
   - Run `db push`.
   - Configure Auth SMS in the dashboard.
   - Enable PITR and set up a storage backup.
   - Do a restore drill.
3. **Hosting:**
   - Set the environment variables (real `NEXT_PUBLIC_SITE_URL`) and deploy.
   - Configure edge rate limits.
   - Set `ERROR_REPORT_URL`.
   - Schedule `deliver-notifications` with `CRON_SECRET`.
4. **Payments:** run the Daraja sandbox end to end (STK push, callback, re-query, late payment → refund), then production keys at a small limit.
5. **Notifications:** run the Africa's Talking sandbox, then live with the approved sender ID; test email.
6. **First partners:**
   - Verify 1–3 pharmacies (licence checks recorded) and their stock.
   - Verify 3–5 clinicians.
   - Draw the Nairobi pilot boundary and activate it.
7. **Commercial:** confirm commission rates; record them in Settings.
8. **Emergency callback:** only once a staffed, trained operation exists. Guidance and verified numbers are live regardless.
9. **Pilot:**
   - A closed pilot with known users.
   - Daily runbook checks.
   - Review incidents, support and analytics weekly before widening.
