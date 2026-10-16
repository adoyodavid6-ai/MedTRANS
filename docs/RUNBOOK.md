# MedTRANS operations runbook

For the people running the pilot. Keep a printed copy with the on-call phone. Anything marked
`[[CONFIRM: …]]` must be filled in before launch (see `SETUP-CHECKLIST.md`).

## Who to call
- On-call engineer: `[[CONFIRM: on-call rota and phone]]`
- Emergency operation supervisor: recorded in Operations → Emergency operation
- Data Protection Officer: `[[CONFIRM: Data Protection Officer contact]]`
- Supabase support plan: `[[CONFIRM: Supabase plan and support tier]]`
- Safaricom Daraja support: `[[CONFIRM: Daraja account manager contact]]`

## Daily checks (10 minutes)
1. Operations → Overview: open orders, bookings waiting for a clinician, unacknowledged emergency callbacks.
2. Operations → Safety incidents: anything not yet triaged.
3. Operations → Support tickets: anything past its response target.
4. Operations → Data requests: deletion requests older than 7 days.
5. Host logs: search for `"level":"error"`; each line has a `digest` that matches the error shown to users.

## If something goes wrong

### The site is down or very slow
1. Check the host status page and Supabase status page.
2. Check the latest deploy. If it started after a deploy, **roll back** to the previous deployment in the host (Vercel → Deployments → Promote previous).
3. Emergency Help is pre-rendered and keeps serving its last good version (guidance and verified numbers) while the database is unreachable; confirm `/emergency` loads. If even that fails, it is a hosting/DNS problem.
4. Post a banner: Operations → Settings → `announcement` (if the database is up).

### Payments are failing
1. Operations → Orders: orders stuck in "pending payment" expire on their own after the timeout; nobody is charged for an expired order.
2. Check Daraja status. If callbacks are not arriving, the app re-queries Daraja before trusting any result, so a missing callback never marks an order paid.
3. A payment that arrives after an order expired is recorded and refunded automatically (`refund_processing`); finish the refund in Operations → Orders.
4. Never mark an order paid by hand.

### Emergency callback operation cannot be staffed
1. Operations → Emergency operation → switch **off**. The callback form disappears at once; the guidance and verified emergency numbers remain.
2. Tell people already waiting: the responder queue shows them. Call each one back.

### A medicine is recalled
Operations → Catalogue → Recall. It disappears from search, carts and checkout immediately and cannot be re-listed. Then check open orders in Operations → Orders for that medicine and contact those patients.

### Suspected data breach
1. Contain: revoke the affected keys (Supabase → Settings → API → roll keys; rotate `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `MPESA_*`), and suspend affected staff accounts (Operations → Users & roles → revoke roles).
2. Preserve evidence: export the audit log for the period (Operations → Audit log) and host logs. Do not delete anything.
3. Tell the DPO immediately. The Office of the Data Protection Commissioner must be notified within **72 hours** of becoming aware (Data Protection Act 2019, s. 43), and affected people without undue delay where there is a real risk of harm.
4. Record what happened, when, what data, how many people, and what you did.

## Backups and recovery
- **Database:** Supabase daily backups are included on paid plans; enable **Point-in-Time Recovery** for the production project (`[[CONFIRM: Supabase plan with PITR]]`). Target: lose at most 5 minutes of data (RPO), back within 4 hours (RTO) `[[CONFIRM: RPO/RTO]]`.
- **Prescription files** (Storage bucket `prescriptions`) are *not* covered by database PITR. Schedule a nightly copy to a second, access-restricted bucket or provider `[[CONFIRM: storage backup destination]]`.
- **Restore drill:** once before launch and then quarterly: restore to a *new* Supabase project, point a preview deployment at it, sign in with a test account, open an order, and record how long it took.
- **Code and schema** are in git; every schema change is a migration in `supabase/migrations`. Never change the production schema in the dashboard.

## Rotating secrets
| Secret | Where | After rotating |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API | update host env, redeploy |
| `CRON_SECRET` | host env + scheduler | update both together |
| `MPESA_CALLBACK_TOKEN` | host env | redeploy; it changes the callback URL registered with Daraja |
| `PAYMENTS_TEST_WEBHOOK_SECRET` | local/CI only | never set in production |

## Deletion requests (Operations → Data requests)
1. Read the preview: what will be removed and what must be kept.
2. Finish or cancel the person's open orders and visits; revoke any staff/partner roles.
3. Complete the request with a plain-language outcome. The person sees it in their account. Sign-in is disabled automatically; if the screen says it could not be, disable the user in the Supabase dashboard (Authentication → Users → Ban).
4. Retained records (orders, prescriptions, visit notes, payments) are kept for `[[CONFIRM: record retention periods per data class]]` and then deleted.

## Measuring performance
`BASE_URL=https://<your-domain> node scripts/perf.mjs` reports LCP, CLS, TTFB and JavaScript size for key pages on a throttled mid-range phone. Budget: LCP ≤ 2.5 s, CLS ≤ 0.1.
