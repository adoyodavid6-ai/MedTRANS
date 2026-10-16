# MedTRANS — Setup Checklist (single source of placeholder tokens)

Nothing below is guessed in code. Each value appears in the app as an explicit token or a disabled state until it is provided.

## Decided
- [x] Stack: Next.js + Supabase (approved 2026-10-16)
- [x] Pilot market: Nairobi, Kenya (approved 2026-10-16)

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

## Pharmacy (Module A)
- [ ] `[[CONFIRM: partner pharmacies + PPB licence numbers and verification procedure]]`
- [ ] `[[CONFIRM: controlled/restricted medicine list per jurisdiction]]`
- [ ] `[[CONFIRM: prescription validity rules (days) per jurisdiction]]`
- [ ] `[[CONFIRM: delivery fee model, service fee, VAT treatment]]`
- [ ] `[[CONFIRM: is guest checkout lawful/desired?]]`
- [ ] `[[CONFIRM: cash on delivery allowed?]]`

## DoctorCare / SmartCare (Modules B, C)
- [ ] `[[CONFIRM: launch service list, required qualifications per service, regulator (KMPDC / NCK) verification procedure]]`
- [ ] `[[CONFIRM: visit fees, travel charges, cancellation windows]]`
- [ ] `[[CONFIRM: match offer timeout and max retries]]`
- [ ] `[[CONFIRM: teleconsultation lawful at launch?]]`
- [ ] `[[CONFIRM: mapping provider — Mapbox or Google Maps Platform]]` → `[[ENV: MAPBOX_TOKEN]]` or `[[ENV: GOOGLE_MAPS_API_KEY]]`

## Payments
- [ ] `[[ENV: MPESA_CONSUMER_KEY]]`, `[[ENV: MPESA_CONSUMER_SECRET]]`, `[[ENV: MPESA_SHORTCODE]]`, `[[ENV: MPESA_PASSKEY]]`, `[[ENV: MPESA_CALLBACK_URL]]` (sandbox first)
- [ ] `[[CONFIRM: Pesapal / Paystack needed at launch?]]` → `[[ENV: PESAPAL_*]]` / `[[ENV: PAYSTACK_SECRET_KEY]]`
- [ ] `[[CONFIRM: commission rates, settlement schedule, refund policy]]`

## Notifications
- [ ] `[[CONFIRM: SMS provider — e.g. Africa's Talking]]` → `[[ENV: SMS_API_KEY]]`, `[[ENV: SMS_SENDER_ID]]`
- [ ] `[[CONFIRM: email provider]]` → `[[ENV: EMAIL_API_KEY]]`, `[[ENV: EMAIL_FROM]]`
- [ ] `[[CONFIRM: WhatsApp Business API access]]`

## Operations
- [ ] `[[CONFIRM: error monitoring — e.g. Sentry]]` → `[[ENV: SENTRY_DSN]]`
- [ ] `[[CONFIRM: analytics tool + consent approach]]`
- [ ] `[[CONFIRM: record retention periods per data class]]`
