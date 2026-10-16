# MedTRANS — Phase 0: Audit, Plan, Phase 1 Proposal

Status: **awaiting approval**. No application code has been written yet.

## 1. Audit (2026-10-16)

| Area | Finding | Status |
|---|---|---|
| Repository | `adoyodavid6-ai/MedTRANS`. No commits, no branches on the remote. | Missing |
| Framework / routing / components | None | Missing |
| Styling / design system | None | Missing |
| Database / migrations | None | Missing |
| Auth / RBAC | None | Missing |
| APIs / integrations | None | Missing |
| Tests / CI | None | Missing |
| Deployment config | None | Missing |
| Brand assets (logo, photography) | None in repo | Missing (token `[[CONFIRM: brand assets]]`) |

Conclusion: nothing exists to reuse, so the §2.1 "build on what exists" rule doesn't apply yet.
Every choice below is a greenfield proposal. Once Phase 1 merges, that rule applies in full.

## 2. Proposed stack

Chosen for the brief's hard requirements: server-authoritative state, RLS on every table, PostGIS matching,
low-bandwidth mobile performance, and one codebase serving six modules.

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js (App Router) + TypeScript (strict)** | Server Components and Server Actions keep pricing, stock and state transitions on the server. Streaming SSR helps LCP on slow networks. SEO built in. |
| Styling | **Tailwind CSS + CSS-variable design tokens** (§5 palette) | Tokens in one place; small CSS output. |
| UI primitives | Radix UI primitives (accessible) + own components | WCAG 2.2 AA building blocks; no heavy template look. |
| Validation | **Zod** shared client/server schemas | One schema, validated on the server every time. |
| Database | **Supabase Postgres + PostGIS** | RLS on every exposed table and bucket. Geography types for coverage, radius and nearest-suitable queries. |
| Auth | **Supabase Auth** (phone OTP + email) with role claims from a `user_roles` table | Phone-first fits Kenya and Somalia. Roles are enforced in RLS, not in the UI. |
| Files | Supabase Storage, private buckets, signed time-limited URLs | Prescriptions and clinical attachments. |
| Jobs | Postgres functions + `pg_cron` / Supabase scheduled functions | Match timeouts, expiry checks, notification retries. |
| Maps / routing | Provider-agnostic `GeoService` interface. Mapbox **or** Google behind it. | Without a key: manual address entry, a list view, and straight-line distance clearly labelled as such (§9C). |
| Payments | Provider-agnostic `PaymentGateway` interface. M-Pesa Daraja first, Pesapal/Paystack adapters later. | Idempotency keys, verified webhooks, a server-side ledger. Disabled state until credentials exist. |
| Notifications | `Notifier` interface: in-app first; email/SMS/WhatsApp adapters later | Templates, dedupe and retries in the database. |
| Tests | **Vitest** (unit), **pgTAP** (RLS and DB rules), **Playwright** (E2E + axe accessibility) | §22-E access-control proofs run as SQL tests against real RLS. |
| CI | GitHub Actions: lint, typecheck, unit, DB tests, E2E | |
| Hosting | `[[CONFIRM: hosting — Vercel recommended]]` + Supabase project region `[[CONFIRM: region]]` | Data residency affects the Kenya DPA 2019 assessment. |

Alternatives, if you prefer: Remix/SvelteKit (fine, less ecosystem), or a separate API (NestJS) with plain Postgres
(more moving parts; RLS would then be replaced by application-layer authorisation). I recommend the stack above.

## 3. Build sequence for this codebase (maps to §23)

Nothing to reuse, so each phase builds on the previous one. Pause and preview at the end of every phase.

1. **Foundation**: scaffold, tokens, layout shell, all §21 public routes (real or "not yet activated"), auth, RBAC, core schema + RLS, country/service-area config, CI.
2. **Pharmacy**: pharmacy onboarding + verification states, catalogue, inventory, prescription upload → pharmacist review, cart, server-priced checkout, payment boundary (M-Pesa sandbox), order state machine + tracking.
   *Proof first:* one complete product → order → delivered journey before the bulk catalogue tooling.
3. **DoctorCare + SmartCare**: service catalogue (one service fully specified first, then roll out), provider onboarding + credentials, availability with overlap exclusion constraints, booking wizard with urgent-symptom screening, eligibility gates → ranking, offer/accept/expire dispatch, visit records.
4. **Safety + support**: Emergency Help (guidance-and-contact mode unless a staffed operation is confirmed), request lifecycle, tickets, incidents, notification engine.
5. **Commercial**: commissions, settlements, subscriptions, analytics (consent-gated, no clinical data), SEO, partner pages.
6. **Hardening**: security tests, accessibility audit, Core Web Vitals, backups, monitoring, runbooks, pilot.

## 4. Phase 1 proposal (for approval)

**Deliverables**

1. **Scaffold**: Next.js + TS strict, ESLint/Prettier, Tailwind with §5 tokens, UK-English copy conventions, error/404 pages, `robots.txt`/sitemap skeleton.
2. **Design system**: tokens; type scale; Button, Card, Field, Select, Badge (including a `VerificationBadge` that renders only `verified | pending | suspended | unverified` from data); StatusTimeline; EmptyState; Alert; Skeleton; Dialog; and a persistent **Emergency Help** button. Each has keyboard and screen-reader support plus visible focus.
3. **Public shell**: header with nav + location selector (manual entry plus opt-in geolocation, never blocking), mobile menu, footer with emergency disclaimer.
   - **Homepage**: hero with the three CTAs above the fold on a 360px phone, trust section (driven by real counts, or omitted), how-it-works, FAQ.
   - Every §21 public route exists, either functional or showing an explicit "not yet activated" state. No fake testimonials, stats, logos or app-store links.
4. **Emergency Help page (honest v0)**: guidance first, with nothing gated. It shows a number only when one is configured and verified for the user's jurisdiction; otherwise it says plainly that none is configured. There is no request form until Phase 4.
5. **Auth + RBAC**: phone OTP/email sign-in; roles `patient, doctor, nurse, pharmacist, pharmacy_admin, courier, support, admin, emergency_responder`. Server-side route guards, plus an empty role dashboard per role.
6. **Database**: migrations for `users/profiles, user_roles, household_members, consent_records, audit_logs, platform_settings, countries, service_coverage_areas (PostGIS), addresses`, plus the verification-state enum shared by later modules. **RLS on every table.** Append-only audit log written by triggers.
7. **Country/coverage config**: admin-editable countries, coverage polygons, and per-service activation flags. Kenya and Somalia rows are created **inactive** until `[[CONFIRM]]` tokens are resolved.
8. **Tests + CI**: pgTAP tests proving cross-user isolation on every Phase 1 table; Playwright smoke + axe checks on the homepage and Emergency page; GitHub Actions workflow.

**Out of scope for Phase 1:** catalogue, orders, payments, bookings, maps SDK, notifications beyond in-app stubs.

**Preview:** `npm run dev` against local Supabase (`supabase start`, Docker), with a seed of synthetic users (one per role), plus a Vercel preview deploy once `[[ENV]]` values exist.

**Decisions needed before I start:** see `docs/SETUP-CHECKLIST.md` → "Blocking for Phase 1".
