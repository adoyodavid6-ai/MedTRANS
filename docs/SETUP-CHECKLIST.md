# MedTRANS — Setup Checklist (single source of placeholder tokens)

Nothing below is guessed in code. Each value appears in the app as an explicit token or a disabled state until it is provided.

## Blocking for Phase 1
- [ ] `[[CONFIRM: stack — Next.js + Supabase as proposed in 00-audit-and-plan.md]]`
- [ ] `[[CONFIRM: hosting — Vercel or other]]`
- [ ] `[[CONFIRM: Supabase project region / data residency]]`
- [ ] `[[CONFIRM: launch market(s) and first city for pilot — e.g. Nairobi only?]]`
- [ ] `[[CONFIRM: brand assets — logo, wordmark, approved photography; or proceed with text wordmark]]`
- [ ] `[[CONFIRM: languages at launch — English only, or English + Kiswahili + Somali]]`
- [ ] `[[ENV: NEXT_PUBLIC_SUPABASE_URL]]`, `[[ENV: NEXT_PUBLIC_SUPABASE_ANON_KEY]]`, `[[ENV: SUPABASE_SERVICE_ROLE_KEY]]` (server only). Local dev works without them.

## Legal entity & content
- [ ] `[[CONFIRM: registered business name, address, registration number]]`
- [ ] `[[CONFIRM: support email / phone / hours]]`
- [ ] `[[CONFIRM: Terms, Privacy Notice, Cancellation & Refund policy — legal-reviewed text]]`
- [ ] `[[CONFIRM: healthcare disclaimer text — clinically and legally reviewed]]`
- [ ] `[[CONFIRM: Data Protection Officer contact; ODPC registration status (Kenya DPA 2019)]]`
- [ ] `[[CONFIRM: Somalia regulatory review before any regulated service is activated]]`

## Emergency (Module D)
- [ ] `[[CONFIRM: verified emergency number(s) per jurisdiction and per area, with source and date verified]]`
- [ ] `[[CONFIRM: is a staffed, authorised MedTRANS emergency coordination operation planned? If not, guidance-and-contact mode only]]`
- [ ] `[[CONFIRM: clinically reviewed urgent-symptom screening questions and severity rules — named clinical owner]]`

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
