# Phase 1 — Foundation: report

Status: **built and tested locally; awaiting your review before Phase 2.**

## What was built

**Public site (§6, §21).** Homepage with Order Medicines, Request Home Care and Get Urgent Medical Help above the fold at 360 px. Header with all §6B nav items, a location selector, a persistent Emergency Help button and a mobile menu. Live pages: Emergency Help, How it works, About, Coverage checker, Help Centre, Contact, and four legal pages (marked as drafts awaiting legal review). The other 16 §21 public pages exist and say plainly "Not yet activated", naming the phase that delivers them; they are excluded from search indexing and the sitemap. A single route registry (`src/lib/site/routes.ts`) drives the nav, footer, sitemap and tests.

**Emergency Help (§10).** Guidance first. It works without JavaScript, with no form, sign-in or confirmation in the way. Numbers appear only if an admin has verified one against a recorded source. With none configured (the current state), the page says so and still tells people what to do. There is a "show my location" helper whose coordinates never leave the device, and an explicit statement that MedTRANS is not a dispatch service. There is no request form until a staffed operation is confirmed (Phase 4).

**Accounts and roles (§12).** Sign-in with a one-time code by phone (Kenyan 07…/01… formats accepted) or email. On first sign-in, accepting the Terms and Privacy notice is recorded in the consent ledger. Nine roles with server-side guards on every page and action, a 403 page, open-redirect protection, and a role-specific landing portal for each role.
- **Patient account:** profile, addresses (optional map pin), household members (with confirmation of authority to act for them), and privacy/consent settings with full history.
- **Professional portals** (doctor/nurse, pharmacy, courier, emergency responder): honest placeholders. Each shows its verification state as *Not verified*, since no verification exists yet.

**Operations console (§14).** Overview metrics come straight from the database, with definitions. Admins can search users and grant or revoke roles (confirmation required, last admin protected), manage countries and coverage areas (GeoJSON boundaries, per-service switches), manage verified emergency contacts, edit the announcement strip, and view an append-only audit log.

## Database changes (`supabase/migrations/`)

| Migration | Contents |
|---|---|
| `…0100_foundation` | Enums (`app_role`, `verification_status`, `service_module`); tables `profiles`, `user_roles`, `audit_logs`, `addresses` (PostGIS), `household_members`, `consent_records`, `platform_settings`, `countries`, `service_coverage_areas` (PostGIS), `coverage_area_services`, `emergency_contacts`; RLS on all of them; audit triggers; role-admin and coverage functions; tightened grants |
| `…0200_reference_data` | Kenya and Somalia (inactive), Nairobi pilot area (inactive, no boundary), announcement and policy-version settings. **No emergency numbers.** |
| `…0300_operations` | Verifier stamping for emergency contacts, GeoJSON boundary setter, admin area list, overview metrics |
| `…0400_consent_erasure` | Consent ledger stays append-only but no longer blocks account erasure |

## Security and privacy controls

- RLS on every table. Grants are revoked by default, so a missing policy fails closed. A test fails if any table lacks RLS, any view bypasses it, or any SECURITY DEFINER function lacks a pinned `search_path`.
- Roles can only be changed through audited admin functions. Granting a professional role does **not** verify anyone.
- Admins have no blanket access to patient addresses or household members.
- The audit log is append-only even for the database owner, and records field *names*, never values.
- The consent ledger is append-only, but erasable when the account is deleted.
- Honesty constraints are enforced in the database: a country needs a recorded regulatory review, an area needs a boundary, and an emergency number needs verification plus a source before it can go live. Changing a number automatically unpublishes it.
- Security headers (frame-deny, nosniff, referrer policy, a permissions policy limiting geolocation to our own origin, HSTS in production).
- Cache Components is deliberately off, so no user data can be cached server-side across users.

## Tests run (actual results, final run)

| Suite | Result |
|---|---|
| ESLint + TypeScript strict | clean |
| Unit (Vitest) | **82 / 82 passed** |
| Database access control and integrity (pgTAP against real RLS) | **61 / 61 passed** |
| End-to-end + accessibility (Playwright, 360 px phone + desktop, axe WCAG 2.2 A/AA on 9 pages) | **46 / 46 passed**, three consecutive full runs |

The E2E tests cover: core actions above the fold; every nav item reaching a page; no sideways scrolling on phones; Emergency Help with and without JavaScript (location never transmitted); the full first-sign-in consent journey; addresses, household and consent; a second patient unable to see the first patient's data; patients, couriers and support blocked from areas they shouldn't reach (403); open-redirect rejection; sign-out; admin role grant/revoke appearing in the audit log; and refusal to activate an area without a boundary.

Bugs these tests caught and that were fixed: forms wiped user input after a validation error; account pages scrolled sideways on phones; the consent ledger blocked account deletion; duplicate element IDs across the location dialogs; a sign-in race that could wipe an auto-filled code.

**Not yet run:** the GitHub Actions workflow (`.github/workflows/ci.yml`) has been written but has not run on GitHub yet; it will on the next push. Core Web Vitals have not been measured on a real deployment (Phase 6).

## Known limitations

- Phone sign-in in production needs an SMS provider, and email sign-in needs SMTP (see checklist).
- Typed addresses aren't geocoded; that needs a map provider (Phase 3). Coverage checks use device location.
- Kiswahili and Somali are not yet available.
- Legal pages are commitments, not final legal text.
- The emergency guidance copy needs clinical review.
