-- MedTRANS Phase 3 — DoctorCare & SmartCare: schema and Row Level Security.
--
--   * A provider can only be offered work after their professional registration is verified.
--   * Matching = eligibility gates first (never overridable), ranking second (distance, language).
--   * Double-booking is impossible: an exclusion constraint guards every provider's time.
--   * Visit descriptions, screening answers and visit records are clinical: only the patient and
--     the treating (or offered) clinician see them. Administrators get an operational view without them.
--   * A provider's base location is private. The public sees approximate distance only.

create extension if not exists btree_gist with schema extensions;

create type public.provider_profession as enum ('doctor', 'nurse');

create table public.care_services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  summary text not null check (char_length(summary) between 10 and 300),
  description text check (description is null or char_length(description) <= 4000),
  required_profession public.provider_profession not null,
  duration_minutes int not null check (duration_minutes between 15 and 480),
  eligibility_notes text check (eligibility_notes is null or char_length(eligibility_notes) <= 2000), -- who it is (and isn't) for
  escalation_notes text check (escalation_notes is null or char_length(escalation_notes) <= 2000),   -- when to stop and escalate
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger care_services_updated_at before update on public.care_services for each row execute function public.set_updated_at();

-- Urgent-symptom screening. Any "yes" to a red-flag question stops a routine booking.
-- Bookings are refused until the active question set has a recorded clinical review.
create table public.care_screening_questions (
  id uuid primary key default gen_random_uuid(),
  position int not null,
  question text not null check (char_length(question) between 5 and 300),
  is_red_flag boolean not null default true,
  is_active boolean not null default true,
  clinically_reviewed_by text,           -- named clinician / governance body [[CONFIRM: clinical review]]
  clinically_reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.provider_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profession public.provider_profession not null,
  display_name text not null check (char_length(display_name) between 2 and 120),
  bio text check (bio is null or char_length(bio) <= 1000),
  languages text[] not null default '{en}' check (languages <@ array['en', 'sw', 'so', 'fr', 'ar']::text[] and cardinality(languages) >= 1),
  years_experience int check (years_experience is null or years_experience between 0 and 60),
  regulator text not null check (char_length(regulator) between 2 and 120),
  registration_number text not null check (char_length(registration_number) between 2 and 60),
  verification_status public.verification_status not null default 'pending',
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  check_method text check (check_method is null or char_length(check_method) <= 300),
  country_code char(2) not null default 'KE' references public.countries (code),
  accepts_bookings boolean not null default false,
  base_location extensions.geography(Point, 4326),        -- PRIVATE: never exposed directly
  service_radius_m int check (service_radius_m is null or service_radius_m between 500 and 50000),
  travel_buffer_minutes int not null default 30 check (travel_buffer_minutes between 0 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_verified_has_check
    check (verification_status <> 'verified' or (verified_at is not null and verified_by is not null and check_method is not null))
);
create index provider_profiles_location on public.provider_profiles using gist (base_location);
create trigger provider_profiles_updated_at before update on public.provider_profiles for each row execute function public.set_updated_at();

create table public.provider_services (
  provider_id uuid not null references public.provider_profiles (user_id) on delete cascade,
  service_id uuid not null references public.care_services (id) on delete cascade,
  fee_minor int not null check (fee_minor > 0),       -- the provider's visit fee for this service
  primary key (provider_id, service_id)
);

create table public.provider_weekly_hours (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (user_id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),   -- 0 = Sunday, in Africa/Nairobi time
  start_time time not null,
  end_time time not null,
  check (start_time < end_time)
);
create index provider_weekly_hours_provider on public.provider_weekly_hours (provider_id, weekday);

create table public.provider_time_off (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (user_id) on delete cascade,
  period tstzrange not null,
  note text check (note is null or char_length(note) <= 200)
);
create index provider_time_off_period on public.provider_time_off using gist (provider_id, period);

create type public.booking_status as enum (
  'awaiting_acceptance',
  'awaiting_payment',
  'confirmed',
  'en_route',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
  'no_provider_available',
  'escalated',
  'no_show',
  'failed',
  'refund_processing',
  'refunded'
);

create sequence public.booking_number_seq start 200001;

create table public.care_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text not null unique default ('DC-' || nextval('public.booking_number_seq')),
  patient_id uuid not null references auth.users (id) on delete restrict,
  household_member_id uuid references public.household_members (id) on delete set null,
  patient_name text not null,
  service_id uuid not null references public.care_services (id),
  provider_id uuid references public.provider_profiles (user_id) on delete restrict,
  status public.booking_status not null,
  slot tstzrange not null,
  address jsonb,
  location extensions.geography(Point, 4326),
  need_description text check (need_description is null or char_length(need_description) <= 1000),   -- clinical
  need_duration text check (need_duration is null or need_duration in ('today', 'few_days', 'week_plus', 'ongoing')),
  screening jsonb not null,                                                                           -- clinical
  preferred_language text check (preferred_language is null or preferred_language in ('en', 'sw', 'so', 'fr', 'ar')),
  max_visit_fee_minor int check (max_visit_fee_minor is null or max_visit_fee_minor > 0),            -- what the patient agreed to
  visit_fee_minor int check (visit_fee_minor is null or visit_fee_minor > 0),
  booking_fee_minor int check (booking_fee_minor is null or booking_fee_minor >= 0),
  total_minor int check (total_minor is null or total_minor > 0),
  currency char(3) not null default 'KES',
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_total_adds_up check (total_minor is null or total_minor = visit_fee_minor + booking_fee_minor),
  -- Nobody can be in two places at once: active bookings for the same provider never overlap.
  constraint booking_no_double_booking exclude using gist (provider_id with =, slot with &&)
    where (provider_id is not null and status in ('awaiting_payment', 'confirmed', 'en_route', 'arrived', 'in_progress'))
);
create index care_bookings_patient on public.care_bookings (patient_id, created_at desc);
create index care_bookings_provider on public.care_bookings (provider_id, status);
create trigger care_bookings_updated_at before update on public.care_bookings for each row execute function public.set_updated_at();

create type public.offer_status as enum ('pending', 'accepted', 'declined', 'expired', 'withdrawn');

create table public.booking_offers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.care_bookings (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (user_id) on delete cascade,
  rank int not null,
  distance_m int,
  status public.offer_status not null default 'pending',
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  decline_reason text check (decline_reason is null or char_length(decline_reason) <= 300),
  unique (booking_id, provider_id)
);
create index booking_offers_provider on public.booking_offers (provider_id, status);
create unique index booking_offers_one_pending on public.booking_offers (booking_id) where status = 'pending';

create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.care_bookings (id) on delete cascade,
  status public.booking_status not null,
  actor_id uuid references auth.users (id) on delete set null,
  actor_kind text not null check (actor_kind in ('patient', 'provider', 'admin', 'system', 'payment_provider')),
  note text check (note is null or char_length(note) <= 500),
  occurred_at timestamptz not null default now()
);
create index booking_events_booking on public.booking_events (booking_id, id);
create trigger booking_events_immutable before update on public.booking_events for each row execute function public.audit_logs_immutable();

-- Visit documentation (§8G). Clinical: patient + treating clinician only. Immutable once signed.
create table public.clinical_visit_records (
  booking_id uuid primary key references public.care_bookings (id) on delete restrict,
  provider_id uuid not null references public.provider_profiles (user_id) on delete restrict,
  presenting_concern text not null check (char_length(presenting_concern) between 2 and 2000),
  observations text check (observations is null or char_length(observations) <= 4000),
  vitals jsonb not null default '{}'::jsonb,
  care_provided text not null check (char_length(care_provided) between 2 and 4000),
  advice text check (advice is null or char_length(advice) <= 4000),
  follow_up text check (follow_up is null or char_length(follow_up) <= 2000),
  referral text check (referral is null or char_length(referral) <= 2000),
  signed_by_name text not null,
  signed_registration text not null,
  signed_at timestamptz not null default now()
);
create trigger clinical_visit_records_immutable before update or delete on public.clinical_visit_records
  for each row execute function public.audit_logs_immutable();

-- Payments may now be for an order OR a booking (exactly one).
alter table public.payments alter column order_id drop not null;
alter table public.payments add column booking_id uuid references public.care_bookings (id) on delete restrict;
alter table public.payments add constraint payment_for_exactly_one check ((order_id is null) <> (booking_id is null));
drop index public.payments_one_active;
drop index public.payments_one_success;
create unique index payments_one_active_order on public.payments (order_id) where order_id is not null and status in ('initiated', 'pending');
create unique index payments_one_success_order on public.payments (order_id) where order_id is not null and status = 'succeeded';
create unique index payments_one_active_booking on public.payments (booking_id) where booking_id is not null and status in ('initiated', 'pending');
create unique index payments_one_success_booking on public.payments (booking_id) where booking_id is not null and status = 'succeeded';
create index payments_booking on public.payments (booking_id) where booking_id is not null;

alter table public.refunds alter column order_id drop not null;
alter table public.refunds add column booking_id uuid references public.care_bookings (id) on delete restrict;
alter table public.refunds add constraint refund_for_exactly_one check ((order_id is null) <> (booking_id is null));

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

create trigger audit_care_services after insert or update or delete on public.care_services for each row execute function public.audit_row_change();
create trigger audit_care_screening_questions after insert or update or delete on public.care_screening_questions for each row execute function public.audit_row_change();
create trigger audit_provider_profiles after insert or update or delete on public.provider_profiles for each row execute function public.audit_row_change();
create trigger audit_provider_services after insert or update or delete on public.provider_services for each row execute function public.audit_row_change();
create trigger audit_care_bookings after insert or update or delete on public.care_bookings for each row execute function public.audit_row_change();
create trigger audit_clinical_visit_records after insert on public.clinical_visit_records for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.care_services enable row level security;
alter table public.care_screening_questions enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.provider_services enable row level security;
alter table public.provider_weekly_hours enable row level security;
alter table public.provider_time_off enable row level security;
alter table public.care_bookings enable row level security;
alter table public.booking_offers enable row level security;
alter table public.booking_events enable row level security;
alter table public.clinical_visit_records enable row level security;

create policy care_services_select on public.care_services for select to anon, authenticated using (is_active or public.is_admin());
create policy care_services_admin_insert on public.care_services for insert to authenticated with check (public.is_admin());
create policy care_services_admin_update on public.care_services for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy screening_select on public.care_screening_questions for select to anon, authenticated using (is_active or public.is_admin());
create policy screening_admin_insert on public.care_screening_questions for insert to authenticated with check (public.is_admin());
create policy screening_admin_update on public.care_screening_questions for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Provider profiles: your own row, or admins. The public uses provider_directory() (no location).
create policy provider_self_select on public.provider_profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy provider_self_insert on public.provider_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and verification_status = 'pending');
create policy provider_self_update on public.provider_profiles for update to authenticated
  using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());

create policy provider_services_select on public.provider_services for select to anon, authenticated using (true);
create policy provider_services_own on public.provider_services for insert to authenticated with check (provider_id = (select auth.uid()));
create policy provider_services_own_update on public.provider_services for update to authenticated
  using (provider_id = (select auth.uid())) with check (provider_id = (select auth.uid()));
create policy provider_services_own_delete on public.provider_services for delete to authenticated using (provider_id = (select auth.uid()));

create policy hours_own on public.provider_weekly_hours for all to authenticated
  using (provider_id = (select auth.uid())) with check (provider_id = (select auth.uid()));
create policy hours_admin_select on public.provider_weekly_hours for select to authenticated using (public.is_admin());
create policy time_off_own on public.provider_time_off for all to authenticated
  using (provider_id = (select auth.uid())) with check (provider_id = (select auth.uid()));

-- Bookings: the patient, and the assigned clinician. Offered clinicians use my_offers(); admins use admin_bookings().
create policy bookings_select on public.care_bookings for select to authenticated
  using (patient_id = (select auth.uid()) or provider_id = (select auth.uid()));
create policy booking_events_select on public.booking_events for select to authenticated
  using (exists (select 1 from public.care_bookings b where b.id = booking_id
                 and (b.patient_id = (select auth.uid()) or b.provider_id = (select auth.uid()) or public.is_admin())));
create policy offers_select on public.booking_offers for select to authenticated
  using (provider_id = (select auth.uid()) or public.is_admin());
create policy visit_records_select on public.clinical_visit_records for select to authenticated
  using (provider_id = (select auth.uid()) or exists (
    select 1 from public.care_bookings b where b.id = booking_id and b.patient_id = (select auth.uid())));

-- payments / refunds: extend patient visibility to booking payments
drop policy payments_select on public.payments;
create policy payments_select on public.payments for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.patient_id = (select auth.uid()))
    or exists (select 1 from public.care_bookings b where b.id = booking_id and b.patient_id = (select auth.uid()))
    or public.is_admin()
  );
drop policy refunds_select on public.refunds;
create policy refunds_select on public.refunds for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.patient_id = (select auth.uid()))
    or exists (select 1 from public.care_bookings b where b.id = booking_id and b.patient_id = (select auth.uid()))
    or public.is_admin()
  );

-- Grants
grant select on public.care_services, public.care_screening_questions to anon;
grant select, insert, update on public.care_services, public.care_screening_questions to authenticated;
grant select, insert on public.provider_profiles to authenticated;
-- Providers edit only these columns; verification is admin-only (enforced again by trigger).
grant update (display_name, bio, languages, years_experience, regulator, registration_number, accepts_bookings,
              base_location, service_radius_m, travel_buffer_minutes, verification_status, check_method)
  on public.provider_profiles to authenticated;
grant select on public.provider_services to anon;
grant select, insert, update, delete on public.provider_services to authenticated;
grant select, insert, update, delete on public.provider_weekly_hours, public.provider_time_off to authenticated;
grant select on public.care_bookings, public.booking_events, public.booking_offers, public.clinical_visit_records to authenticated;
