# MedTRANS

**Healthcare, delivered with care.** Medicines from verified pharmacies, qualified home care, and honest emergency guidance, all from one account.

Built to the masterplan in the project brief. Planning documents are in [`docs/`](docs/):

- [`docs/00-audit-and-plan.md`](docs/00-audit-and-plan.md): audit, stack and phase plan
- [`docs/01-phase-1-report.md`](docs/01-phase-1-report.md): what Phase 1 delivered, and how it was tested
- [`docs/SETUP-CHECKLIST.md`](docs/SETUP-CHECKLIST.md): every value we still need (`[[CONFIRM]]` / `[[ENV]]`)

## Stack

Next.js 16 (App Router, TypeScript, Tailwind v4) · Supabase (Postgres 17 + PostGIS, Auth, RLS) · Zod · Vitest · pgTAP · Playwright + axe.

## Run it locally

Requirements: Node 22+, Docker.

```bash
npm install
npm run db:start            # local Supabase (mirrors images from Docker Hub if AWS ECR is unreachable)
npx supabase db reset       # apply migrations
cp .env.example .env.local  # then paste the anon + service-role keys from `npx supabase status`
npm run db:seed-dev         # synthetic accounts, one per role
npm run dev                 # http://localhost:3000
```

Sign in with any seeded number and the fixed local code **123456**. No SMS is ever sent locally.

| Number | Role |
|---|---|
| 0700 000 001 | Patient (first sign-in, goes through consent) |
| 0700 000 010 | Patient |
| 0700 000 002 / 003 | Doctor / Nurse |
| 0700 000 004 / 005 | Pharmacist / Pharmacy admin |
| 0700 000 006 | Delivery partner |
| 0700 000 007 | Support |
| 0700 000 008 | Administrator |
| 0700 000 009 | Emergency responder |

## Tests

```bash
npm run lint && npm run typecheck
npm test            # unit tests (Vitest)
npm run test:db     # access-control and data-integrity tests against real RLS (pgTAP)
npm run test:e2e    # end-to-end + WCAG checks (Playwright; builds and starts the app on :3100)
```

## Bootstrapping the first administrator (production)

Administrators can only be granted by another administrator. For the very first one, run this once in the Supabase SQL editor after that person has signed in:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where phone = '2547XXXXXXXX';  -- their number, without +
```
