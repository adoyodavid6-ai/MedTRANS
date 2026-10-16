# MedTRANS — Setup Checklist (single source of placeholder tokens)

Nothing below is guessed in code. Each value appears in the app as an explicit token or a disabled state until it is provided.

## Decided
- [x] Stack: Next.js + Supabase (approved 2026-10-16)
- [x] Pilot market: Nairobi, Kenya (approved 2026-10-16)
- [x] Hosted Supabase project: `bsiyaddxphdsenwqybro` (provided 2026-10-17). Not yet linked: see docs/DEPLOYMENT.md

## Needed to deploy Phase 1
- [ ] `[[CONFIRM: hosting — Vercel or other]]`
- [ ] `[[CONFIRM: Supabase project region / data residency]]`
- [ ] `[[ENV: NEXT_PUBLIC_SUPABASE_URL]]`, `[[ENV: NEXT_PUBLIC_SUPABASE_ANON_KEY]]`, `[[ENV: SUPABASE_SERVICE_ROLE_KEY]]` (server only; used by the dev seed, not the app), `[[ENV: NEXT_PUBLIC_SITE_URL]]`
- [ ] `[[CONFIRM: SMS provider for phone sign-in codes]]`. Without it, phone sign-in cannot work in production. Supabase supports Twilio, MessageBird, Textlocal and Vonage; Africa's Talking would need a custom Auth SMS hook.
- [ ] `[[CONFIRM: SMTP provider for email sign-in codes]]`
- [ ] `[[CONFIRM: auth rate limits]]` for production: SMS per hour, verifications, per-number resend interval. Local values are raised for testing only.
- [ ] First administrator account (see README → Bootstrapping)
- [ ] `[[CONFIRM: brand assets — logo, wordmark, approved photography]]`. A text wordmark is used until supplied.
- [ ] `[[CONFIRM: languages at launch]]`. English is built; Kiswahili and Somali show as "coming later" until professionally translated.

## Legal entity & content
- [ ] `[[CONFIRM: registered business name, address, registration number]]`
- [ ] `[[CONFIRM: support email / phone / hours]]`
- [ ] `[[CONFIRM: Terms, Privacy Notice, Cancellation & Refund policy — legal-reviewed text]]`
- [ ] `[[CONFIRM: healthcare disclaimer text — clinically and legally reviewed]]`
- [ ] `[[CONFIRM: Data Protection Officer contact; ODPC registration status (Kenya DPA 2019)]]`
- [ ] `[[CONFIRM: Somalia regulatory review before any regulated service is activated]]`

## Emergency (Module D)
- [ ] `[[CONFIRM: verified emergency number(s) per jurisdiction and per area, with source and date verified]]`. Entered by an admin in Operations → Emergency contacts. None are hardcoded, and a test enforces that.
- [ ] `[[CONFIRM: clinical review of emergency guidance copy]]` (`src/app/emergency/page.tsx`: warning signs and "what to say" list)
- [ ] `[[CONFIRM: is a staffed, authorised MedTRANS emergency coordination operation planned? If not, guidance-and-contact mode only]]`
- [ ] `[[CONFIRM: clinically reviewed urgent-symptom screening questions and severity rules — named clinical owner]]`

## Coverage
- [ ] `[[CONFIRM: Nairobi pilot service boundary (GeoJSON MultiPolygon)]]`. Pasted in Operations → Countries & coverage; the area cannot be activated without it.
- [ ] `[[CONFIRM: PPB / KMPDC / NCK / ODPC review reference]]`. Kenya cannot be activated without a recorded review reference.

## Pharmacy (Module A): built in Phase 2, needs these to go live
- [ ] `[[CONFIRM: service fee]]`: set `pharmacy.service_fee_minor` in Operations → Settings (ordering is blocked until set)
- [ ] `[[CONFIRM: VAT treatment]]`: per product in Operations → Catalogue (a product can't be ordered until its VAT rate is set); also whether shelf prices include VAT and whether VAT applies to delivery/service fees
- [ ] `[[CONFIRM: delivery fee model]]`: currently a flat fee per pharmacy
- [ ] `[[CONFIRM: approved product information source]]`: product pages show "not added yet" until approved text and its source are recorded
- [ ] `[[CONFIRM: structured verified hours]]`
- [ ] M-Pesa: `[[ENV: MPESA_CONSUMER_KEY]]`, `[[ENV: MPESA_CONSUMER_SECRET]]`, `[[ENV: MPESA_SHORTCODE]]`, `[[ENV: MPESA_PASSKEY]]`, `[[ENV: MPESA_CALLBACK_BASE_URL]]`, `[[ENV: MPESA_CALLBACK_TOKEN]]`, `MPESA_ENV=sandbox|production`. **The adapter has not yet been run against the Daraja sandbox.**
- [ ] `[[ENV: SUPABASE_SERVICE_ROLE_KEY]]` on the server: payment callbacks need it
- [ ] `[[CONFIRM: mapping provider]]`: courier "Open map" links currently go to OpenStreetMap
- [ ] Never set `PAYMENTS_TEST_MODE` in production

- [ ] `[[CONFIRM: partner pharmacies + PPB licence numbers and verification procedure]]`
- [ ] `[[CONFIRM: controlled/restricted medicine list per jurisdiction]]`
- [ ] `[[CONFIRM: prescription validity rules (days) per jurisdiction]]`
- [ ] `[[CONFIRM: delivery fee model, service fee, VAT treatment]]`
- [ ] `[[CONFIRM: is guest checkout lawful/desired?]]`
- [ ] `[[CONFIRM: cash on delivery allowed?]]`

## DoctorCare / SmartCare (Modules B, C): built in Phase 3, needs these to go live
- [ ] `[[CONFIRM: clinical review of screening questions]]`: a named clinician reviews the 9 draft red-flag questions (Operations → Home-care services). **Home-visit requests are blocked until this is recorded.**
- [ ] `[[CONFIRM: clinical eligibility criteria]]` and `[[CONFIRM: clinical escalation protocol]]` for the GP home visit (and each further service)
- [ ] `[[CONFIRM: booking fee]]`: set `doctorcare.booking_fee_minor` (requests are blocked until set)
- [ ] `[[CONFIRM: match offer timeout]]`: `doctorcare.offer_timeout_minutes` (default 10)
- [ ] `[[CONFIRM: commission and provider settlement terms]]`: the clinician portal shows gross completed-visit fees only
- [ ] `[[CONFIRM: KMPDC / NCK registration check procedure]]` for verifying clinicians
- [ ] `[[CONFIRM: routing provider]]` for travel-time ETAs: until then, distances are straight-line and labelled as such

- [ ] `[[CONFIRM: launch service list, required qualifications per service, regulator (KMPDC / NCK) verification procedure]]`
- [ ] `[[CONFIRM: visit fees, travel charges, cancellation windows]]`
- [ ] `[[CONFIRM: match offer timeout and max retries]]`
- [ ] `[[CONFIRM: teleconsultation lawful at launch?]]`
- [ ] `[[CONFIRM: mapping provider — Mapbox or Google Maps Platform]]` → `[[ENV: MAPBOX_TOKEN]]` or `[[ENV: GOOGLE_MAPS_API_KEY]]`

## Payments
- [ ] `[[ENV: MPESA_CONSUMER_KEY]]`, `[[ENV: MPESA_CONSUMER_SECRET]]`, `[[ENV: MPESA_SHORTCODE]]`, `[[ENV: MPESA_PASSKEY]]`, `[[ENV: MPESA_CALLBACK_URL]]` (sandbox first)
- [ ] `[[CONFIRM: Pesapal / Paystack needed at launch?]]` → `[[ENV: PESAPAL_*]]` / `[[ENV: PAYSTACK_SECRET_KEY]]`
- [ ] `[[CONFIRM: commission rates, settlement schedule, refund policy]]`

## Safety, support & notifications: built in Phase 4
- [ ] `[[CONFIRM: staffed emergency operation]]`: the callback-request feature stays off until an admin records staffed hours and a named supervisor (Operations → Emergency operation) and at least one trained responder has the role
- [ ] `[[CONFIRM: emergency escalation and outage procedures]]` and responder training records (outside the app)
- [ ] `[[ENV: CRON_SECRET]]` and a scheduler (e.g. Vercel Cron) calling `POST /api/jobs/deliver-notifications` every minute
- [ ] SMS via Africa's Talking: `[[ENV: AFRICASTALKING_API_KEY]]`, `[[ENV: AFRICASTALKING_USERNAME]]`, `[[ENV: SMS_SENDER_ID]]`. **Adapter written, not yet tested against a live account.** Until set, SMS are recorded as "skipped".
- [ ] Email: `[[ENV: EMAIL_API_URL]]`, `[[ENV: EMAIL_API_KEY]]`, `[[ENV: EMAIL_FROM]]` (any HTTPS email API taking from/to/subject/text). Not yet tested.
- [ ] `[[CONFIRM: support hours and response targets]]`

## Notifications
- [ ] `[[CONFIRM: SMS provider — e.g. Africa's Talking]]` → `[[ENV: SMS_API_KEY]]`, `[[ENV: SMS_SENDER_ID]]`
- [ ] `[[CONFIRM: email provider]]` → `[[ENV: EMAIL_API_KEY]]`, `[[ENV: EMAIL_FROM]]`
- [ ] `[[CONFIRM: WhatsApp Business API access]]`

## Operations
- [ ] `[[CONFIRM: error monitoring — e.g. Sentry]]` → `[[ENV: SENTRY_DSN]]`
- [ ] `[[CONFIRM: analytics tool + consent approach]]`
- [ ] `[[CONFIRM: record retention periods per data class]]`
