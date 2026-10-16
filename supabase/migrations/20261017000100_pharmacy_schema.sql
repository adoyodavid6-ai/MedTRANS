-- MedTRANS Phase 2 — Pharmacy: schema and Row Level Security.
--
-- Rules enforced here (masterplan §3, §7, §12, §13):
--   * Only verified pharmacies with a current, verified licence can sell (see pharmacy_can_sell()).
--   * Prescription-only items need a pharmacist-approved prescription BEFORE checkout.
--   * Controlled medicines cannot be ordered through MedTRANS at all.
--   * Prices, fees, taxes and totals are computed in the database, never taken from the client.
--   * Clinical data (prescriptions, order contents) is never visible to couriers; admins get
--     operational order access but no prescription access.
--   * Order status only changes through audited workflow functions (next migration).

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Pharmacies, licences and staff
-- ---------------------------------------------------------------------------

create table public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  country_code char(2) not null references public.countries (code),
  area_id uuid references public.service_coverage_areas (id),
  address_line text not null check (char_length(address_line) between 3 and 200),
  location extensions.geography(Point, 4326) not null,
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{6,20}$'),
  verification_status public.verification_status not null default 'unverified',
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  -- Shown in the public directory only when true. Listing never implies verification.
  is_listed boolean not null default false,
  is_accepting_orders boolean not null default false,
  delivery_radius_m int check (delivery_radius_m is null or delivery_radius_m between 100 and 50000),
  -- Flat delivery fee in minor units (KES cents). Null = delivery not configured, so the pharmacy cannot sell.
  delivery_fee_minor int check (delivery_fee_minor is null or delivery_fee_minor >= 0),
  -- Opening hours as verified text, shown only when set. [[CONFIRM: structured verified hours]]
  verified_hours text check (verified_hours is null or char_length(verified_hours) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pharmacy_verified_has_verifier
    check (verification_status <> 'verified' or (verified_at is not null and verified_by is not null))
);

create index pharmacies_location on public.pharmacies using gist (location);
create trigger pharmacies_updated_at before update on public.pharmacies
  for each row execute function public.set_updated_at();

create table public.pharmacy_licences (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  regulator text not null default 'Pharmacy and Poisons Board' check (char_length(regulator) between 2 and 120),
  licence_number text not null check (char_length(licence_number) between 2 and 60),
  valid_from date,
  valid_until date not null,
  status public.verification_status not null default 'pending',
  checked_at timestamptz,
  checked_by uuid references auth.users (id) on delete set null,
  check_method text check (check_method is null or char_length(check_method) <= 300), -- how it was verified (internal)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint licence_verified_has_check
    check (status <> 'verified' or (checked_at is not null and checked_by is not null and check_method is not null)),
  constraint licence_dates check (valid_from is null or valid_from <= valid_until)
);

create index pharmacy_licences_pharmacy on public.pharmacy_licences (pharmacy_id);
create trigger pharmacy_licences_updated_at before update on public.pharmacy_licences
  for each row execute function public.set_updated_at();

create type public.pharmacy_staff_role as enum ('pharmacist', 'manager', 'dispatcher');

create table public.pharmacy_staff (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  staff_role public.pharmacy_staff_role not null,
  -- Pharmacists only: professional registration, checked with the regulator before they may review prescriptions.
  registration_number text check (registration_number is null or char_length(registration_number) between 2 and 60),
  registration_status public.verification_status not null default 'unverified',
  registration_checked_at timestamptz,
  registration_checked_by uuid references auth.users (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pharmacy_id, user_id, staff_role),
  constraint staff_registration_verified_has_check
    check (registration_status <> 'verified' or (registration_checked_at is not null and registration_checked_by is not null and registration_number is not null))
);

create index pharmacy_staff_user on public.pharmacy_staff (user_id) where is_active;
create trigger pharmacy_staff_updated_at before update on public.pharmacy_staff
  for each row execute function public.set_updated_at();

-- Membership helpers for policies. SECURITY DEFINER avoids recursive RLS through pharmacy_staff.
create or replace function public.is_pharmacy_staff(p uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pharmacy_staff s
    where s.pharmacy_id = p and s.user_id = (select auth.uid()) and s.is_active
  );
$$;

-- A pharmacist whose registration has been verified, at a pharmacy that is itself verified.
create or replace function public.is_verified_pharmacist_at(p uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pharmacy_staff s
    join public.pharmacies ph on ph.id = s.pharmacy_id
    where s.pharmacy_id = p and s.user_id = (select auth.uid()) and s.is_active
      and s.staff_role = 'pharmacist' and s.registration_status = 'verified'
      and ph.verification_status = 'verified'
  );
$$;

-- ---------------------------------------------------------------------------
-- Courier verification
-- ---------------------------------------------------------------------------

create table public.courier_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  verification_status public.verification_status not null default 'unverified',
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  check_method text check (check_method is null or char_length(check_method) <= 300),
  is_available boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courier_verified_has_check
    check (verification_status <> 'verified' or (verified_at is not null and verified_by is not null and check_method is not null))
);

create trigger courier_profiles_updated_at before update on public.courier_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catalogue and inventory
-- ---------------------------------------------------------------------------

create table public.medicine_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 160),
  generic_name text not null check (char_length(generic_name) between 2 and 160),
  brand text check (brand is null or char_length(brand) <= 120),
  strength text not null check (char_length(strength) between 1 and 60),       -- e.g. "500 mg"
  dosage_form text not null check (char_length(dosage_form) between 2 and 60), -- e.g. "Tablet"
  pack_size text not null check (char_length(pack_size) between 1 and 60),     -- e.g. "Pack of 20"
  manufacturer text check (manufacturer is null or char_length(manufacturer) <= 160),
  requires_prescription boolean not null,
  -- Controlled / scheduled substances are never sold through MedTRANS. [[CONFIRM: controlled list per jurisdiction]]
  is_controlled boolean not null default false,
  -- Approved product information. Shown only when present; never generated. [[CONFIRM: approved product information source]]
  approved_info text check (approved_info is null or char_length(approved_info) <= 4000),
  approved_info_source text check (approved_info_source is null or char_length(approved_info_source) <= 300),
  -- VAT in basis points. Null = tax treatment not confirmed, so the product cannot be ordered. [[CONFIRM: VAT treatment]]
  vat_rate_bps int check (vat_rate_bps is null or vat_rate_bps between 0 and 10000),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approved_info_has_source check (approved_info is null or approved_info_source is not null)
);

create index medicine_products_search on public.medicine_products
  using gin ((name || ' ' || generic_name || ' ' || coalesce(brand, '')) extensions.gin_trgm_ops);
create trigger medicine_products_updated_at before update on public.medicine_products
  for each row execute function public.set_updated_at();

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  product_id uuid not null references public.medicine_products (id) on delete restrict,
  price_minor int not null check (price_minor > 0),
  quantity_available int not null check (quantity_available >= 0),
  is_listed boolean not null default true,
  stock_confirmed_at timestamptz not null default now(), -- last time staff confirmed price/stock
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pharmacy_id, product_id)
);

create index inventory_items_product on public.inventory_items (product_id) where is_listed;
create trigger inventory_items_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();

-- Every staff change to price or stock re-stamps the confirmation time.
create or replace function public.inventory_stamp_confirmation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.price_minor is distinct from old.price_minor
     or new.quantity_available is distinct from old.quantity_available
     or new.is_listed is distinct from old.is_listed then
    new.stock_confirmed_at := now();
  end if;
  return new;
end;
$$;
create trigger inventory_items_stamp before update on public.inventory_items
  for each row execute function public.inventory_stamp_confirmation();

-- Can this pharmacy take orders right now? Every gate must pass; none can be bought.
create or replace function public.pharmacy_can_sell(p uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.pharmacies ph
    join public.countries c on c.code = ph.country_code and c.is_active
    join public.service_coverage_areas a on a.id = ph.area_id and a.is_active
    join public.coverage_area_services s on s.area_id = a.id and s.module = 'pharmacy' and s.is_active
    where ph.id = p
      and ph.verification_status = 'verified'
      and ph.is_accepting_orders
      and ph.delivery_fee_minor is not null
      and ph.delivery_radius_m is not null
      and exists (
        select 1 from public.pharmacy_licences l
        where l.pharmacy_id = ph.id and l.status = 'verified' and l.valid_until >= current_date
          and (l.valid_from is null or l.valid_from <= current_date)
      )
      and exists (
        select 1 from public.pharmacy_staff st
        where st.pharmacy_id = ph.id and st.is_active and st.staff_role = 'pharmacist' and st.registration_status = 'verified'
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Cart (persistent, signed-in users; one pharmacy per cart)
-- ---------------------------------------------------------------------------

create table public.cart_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  quantity int not null check (quantity between 1 and 20),
  added_at timestamptz not null default now(),
  primary key (user_id, inventory_item_id)
);

-- ---------------------------------------------------------------------------
-- Prescriptions
-- ---------------------------------------------------------------------------

create type public.prescription_status as enum (
  'submitted', 'approved', 'clarification_needed', 'rejected', 'withdrawn'
);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  household_member_id uuid references public.household_members (id) on delete set null,
  pharmacy_id uuid not null references public.pharmacies (id) on delete restrict,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes int not null check (size_bytes between 1 and 10485760),
  patient_note text check (patient_note is null or char_length(patient_note) <= 500),
  status public.prescription_status not null default 'submitted',
  valid_until date,                -- set by the reviewing pharmacist on approval
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prescription_approved_has_validity check (status <> 'approved' or (valid_until is not null and decided_by is not null))
);

create index prescriptions_patient on public.prescriptions (patient_id, created_at desc);
create index prescriptions_queue on public.prescriptions (pharmacy_id, status, created_at);
create trigger prescriptions_updated_at before update on public.prescriptions
  for each row execute function public.set_updated_at();

-- What the patient asked for, and what the pharmacist approved.
create table public.prescription_items (
  prescription_id uuid not null references public.prescriptions (id) on delete cascade,
  product_id uuid not null references public.medicine_products (id),
  quantity_requested int not null check (quantity_requested between 1 and 20),
  quantity_approved int check (quantity_approved is null or quantity_approved between 0 and 20),
  primary key (prescription_id, product_id)
);

-- Review decisions are an append-only history (approve / clarify / reject, with notes to the patient).
create table public.prescription_reviews (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id) on delete cascade,
  reviewer_id uuid references auth.users (id) on delete set null,
  decision public.prescription_status not null check (decision in ('approved', 'clarification_needed', 'rejected')),
  note_to_patient text check (note_to_patient is null or char_length(note_to_patient) <= 1000),
  created_at timestamptz not null default now()
);

create index prescription_reviews_prescription on public.prescription_reviews (prescription_id, created_at);
create trigger prescription_reviews_immutable before update on public.prescription_reviews
  for each row execute function public.audit_logs_immutable();

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create type public.order_status as enum (
  'pending_payment',
  'awaiting_pharmacy_acceptance',
  'confirmed',
  'preparing',
  'ready_for_dispatch',
  'assigned_to_courier',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'failed_delivery',
  'refund_processing',
  'refunded'
);

create sequence public.order_number_seq start 100001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('MT-' || nextval('public.order_number_seq')),
  patient_id uuid not null references auth.users (id) on delete restrict,
  household_member_id uuid references public.household_members (id) on delete set null,
  pharmacy_id uuid not null references public.pharmacies (id) on delete restrict,
  prescription_id uuid references public.prescriptions (id) on delete restrict,
  status public.order_status not null default 'pending_payment',
  currency char(3) not null,
  subtotal_minor int not null check (subtotal_minor >= 0),
  delivery_fee_minor int not null check (delivery_fee_minor >= 0),
  service_fee_minor int not null check (service_fee_minor >= 0),
  tax_minor int not null check (tax_minor >= 0),
  total_minor int not null check (total_minor > 0),
  delivery_address jsonb not null,      -- snapshot at order time
  delivery_location extensions.geography(Point, 4326) not null,
  recipient_name text not null check (char_length(recipient_name) between 1 and 120),
  idempotency_key uuid not null unique, -- one order per checkout submission, however many times it's sent
  handover_code char(4) not null,       -- shown to the patient; the courier must enter it to complete delivery
  handover_attempts int not null default 0,
  stock_released boolean not null default false,
  courier_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_total_adds_up check (total_minor = subtotal_minor + delivery_fee_minor + service_fee_minor + tax_minor)
);

create index orders_patient on public.orders (patient_id, created_at desc);
create index orders_pharmacy on public.orders (pharmacy_id, status, created_at desc);
create index orders_courier on public.orders (courier_id) where courier_id is not null;
create index orders_status on public.orders (status, created_at);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  product_id uuid not null references public.medicine_products (id) on delete restrict,
  product_name text not null,   -- snapshots: what the patient saw and paid for
  strength text not null,
  dosage_form text not null,
  pack_size text not null,
  requires_prescription boolean not null,
  unit_price_minor int not null check (unit_price_minor > 0),
  quantity int not null check (quantity between 1 and 20),
  vat_rate_bps int not null check (vat_rate_bps between 0 and 10000),
  line_total_minor int not null check (line_total_minor = unit_price_minor * quantity)
);

create index order_items_order on public.order_items (order_id);

-- The order timeline. Every status shown to anyone is backed by a row here.
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  actor_id uuid references auth.users (id) on delete set null,
  actor_kind text not null check (actor_kind in ('patient', 'pharmacy', 'courier', 'admin', 'system', 'payment_provider')),
  note text check (note is null or char_length(note) <= 500),
  occurred_at timestamptz not null default now()
);

create index order_events_order on public.order_events (order_id, id);
create trigger order_events_immutable before update on public.order_events
  for each row execute function public.audit_logs_immutable();

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

create type public.payment_status as enum ('initiated', 'pending', 'succeeded', 'failed', 'cancelled');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null check (provider in ('mpesa', 'test')),
  amount_minor int not null check (amount_minor > 0),
  currency char(3) not null,
  status public.payment_status not null default 'initiated',
  payer_phone text check (payer_phone is null or payer_phone ~ '^\+?[0-9]{8,15}$'),
  provider_reference text unique,      -- e.g. M-Pesa CheckoutRequestID
  provider_receipt text,               -- e.g. M-Pesa receipt number, once confirmed
  failure_reason text check (failure_reason is null or char_length(failure_reason) <= 300),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_order on public.payments (order_id, created_at desc);
-- At most one payment in flight per order.
create unique index payments_one_active on public.payments (order_id) where status in ('initiated', 'pending');
-- At most one successful payment per order.
create unique index payments_one_success on public.payments (order_id) where status = 'succeeded';
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- Every provider callback we accept, keyed so a replayed callback is recognised and ignored.
create table public.payment_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_key text not null,
  payload_sha256 text not null,
  received_at timestamptz not null default now(),
  outcome text not null,
  unique (provider, event_key)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  payment_id uuid not null references public.payments (id) on delete restrict,
  amount_minor int not null check (amount_minor > 0),
  provider_reference text not null check (char_length(provider_reference) between 3 and 120),
  recorded_by uuid references auth.users (id) on delete set null,
  recorded_at timestamptz not null default now(),
  unique (payment_id)
);

-- ---------------------------------------------------------------------------
-- Audit triggers
-- ---------------------------------------------------------------------------

create trigger audit_pharmacies after insert or update or delete on public.pharmacies
  for each row execute function public.audit_row_change();
create trigger audit_pharmacy_licences after insert or update or delete on public.pharmacy_licences
  for each row execute function public.audit_row_change();
create trigger audit_pharmacy_staff after insert or update or delete on public.pharmacy_staff
  for each row execute function public.audit_row_change();
create trigger audit_courier_profiles after insert or update or delete on public.courier_profiles
  for each row execute function public.audit_row_change();
create trigger audit_medicine_products after insert or update or delete on public.medicine_products
  for each row execute function public.audit_row_change();
create trigger audit_inventory_items after insert or update or delete on public.inventory_items
  for each row execute function public.audit_row_change();
create trigger audit_prescriptions after insert or update or delete on public.prescriptions
  for each row execute function public.audit_row_change();
create trigger audit_orders after insert or update or delete on public.orders
  for each row execute function public.audit_row_change();
create trigger audit_payments after insert or update or delete on public.payments
  for each row execute function public.audit_row_change();
create trigger audit_refunds after insert or update or delete on public.refunds
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.pharmacies enable row level security;
alter table public.pharmacy_licences enable row level security;
alter table public.pharmacy_staff enable row level security;
alter table public.courier_profiles enable row level security;
alter table public.medicine_products enable row level security;
alter table public.inventory_items enable row level security;
alter table public.cart_items enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.prescription_reviews enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.refunds enable row level security;

-- Pharmacies: the public sees listed pharmacies (with their honest status); staff see their own; admins see all.
create policy pharmacies_select on public.pharmacies for select to anon, authenticated
  using (is_listed or public.is_pharmacy_staff(id) or public.is_admin());
create policy pharmacies_admin_insert on public.pharmacies for insert to authenticated with check (public.is_admin());
create policy pharmacies_admin_update on public.pharmacies for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Licences: public sees licences of listed pharmacies (column grants below hide internal check notes).
create policy licences_select on public.pharmacy_licences for select to anon, authenticated
  using (
    exists (select 1 from public.pharmacies p where p.id = pharmacy_id and p.is_listed)
    or public.is_pharmacy_staff(pharmacy_id) or public.is_admin()
  );
create policy licences_admin_insert on public.pharmacy_licences for insert to authenticated with check (public.is_admin());
create policy licences_admin_update on public.pharmacy_licences for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Staff: you see your own memberships and colleagues at your pharmacy; admins manage.
create policy staff_select on public.pharmacy_staff for select to authenticated
  using (user_id = (select auth.uid()) or public.is_pharmacy_staff(pharmacy_id) or public.is_admin());
create policy staff_admin_insert on public.pharmacy_staff for insert to authenticated with check (public.is_admin());
create policy staff_admin_update on public.pharmacy_staff for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Courier profiles: the courier sees their own; admins manage.
create policy courier_profiles_select on public.courier_profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy courier_profiles_admin_insert on public.courier_profiles for insert to authenticated with check (public.is_admin());
create policy courier_profiles_admin_update on public.courier_profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Catalogue: active products are public; admins manage the catalogue.
create policy products_select on public.medicine_products for select to anon, authenticated
  using (is_active or public.is_admin());
create policy products_admin_insert on public.medicine_products for insert to authenticated with check (public.is_admin());
create policy products_admin_update on public.medicine_products for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Inventory: listed items at listed pharmacies are public; staff of the pharmacy manage their own.
create policy inventory_select on public.inventory_items for select to anon, authenticated
  using (
    (is_listed and exists (select 1 from public.pharmacies p where p.id = pharmacy_id and p.is_listed))
    or public.is_pharmacy_staff(pharmacy_id) or public.is_admin()
  );
create policy inventory_staff_insert on public.inventory_items for insert to authenticated
  with check (public.is_pharmacy_staff(pharmacy_id));
create policy inventory_staff_update on public.inventory_items for update to authenticated
  using (public.is_pharmacy_staff(pharmacy_id)) with check (public.is_pharmacy_staff(pharmacy_id));

-- Cart: owner only.
create policy cart_owner_all on public.cart_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Prescriptions: the patient, and verified pharmacists at the pharmacy it was sent to. Nobody else — not admins, not couriers.
create policy prescriptions_select on public.prescriptions for select to authenticated
  using (patient_id = (select auth.uid()) or public.is_verified_pharmacist_at(pharmacy_id));
create policy prescription_items_select on public.prescription_items for select to authenticated
  using (exists (
    select 1 from public.prescriptions p where p.id = prescription_id
      and (p.patient_id = (select auth.uid()) or public.is_verified_pharmacist_at(p.pharmacy_id))
  ));
create policy prescription_reviews_select on public.prescription_reviews for select to authenticated
  using (exists (
    select 1 from public.prescriptions p where p.id = prescription_id
      and (p.patient_id = (select auth.uid()) or public.is_verified_pharmacist_at(p.pharmacy_id))
  ));

-- Orders: the patient, staff of the fulfilling pharmacy, and admins (operations). Couriers use courier_assignments().
create policy orders_select on public.orders for select to authenticated
  using (patient_id = (select auth.uid()) or public.is_pharmacy_staff(pharmacy_id) or public.is_admin());
create policy order_items_select on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id
      and (o.patient_id = (select auth.uid()) or public.is_pharmacy_staff(o.pharmacy_id) or public.is_admin())
  ));
create policy order_events_select on public.order_events for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id
      and (o.patient_id = (select auth.uid()) or public.is_pharmacy_staff(o.pharmacy_id) or public.is_admin())
  ));

-- Payments: the paying patient and admins can see status. Only the service role (webhooks) changes them.
create policy payments_select on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.patient_id = (select auth.uid())) or public.is_admin());
create policy refunds_select on public.refunds for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.patient_id = (select auth.uid())) or public.is_admin());
create policy webhook_events_admin_select on public.payment_webhook_events for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants (default-deny from the foundation migration; grant exactly what policies intend)
-- ---------------------------------------------------------------------------

grant select on public.pharmacies to anon, authenticated;
grant insert, update on public.pharmacies to authenticated;
-- Public licence view: never the internal check notes or who checked.
grant select (id, pharmacy_id, regulator, licence_number, valid_from, valid_until, status, checked_at)
  on public.pharmacy_licences to anon;
grant select, insert, update on public.pharmacy_licences to authenticated;
grant select, insert, update on public.pharmacy_staff to authenticated;
grant select, insert, update on public.courier_profiles to authenticated;
grant select on public.medicine_products to anon;
grant select, insert, update on public.medicine_products to authenticated;
grant select on public.inventory_items to anon;
grant select, insert on public.inventory_items to authenticated;
-- Staff may change price, stock and listing only; never which pharmacy or product a row belongs to.
grant update (price_minor, quantity_available, is_listed) on public.inventory_items to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
grant select on public.prescriptions, public.prescription_items, public.prescription_reviews to authenticated;
grant select on public.orders, public.order_items, public.order_events to authenticated;
grant select on public.payments, public.refunds, public.payment_webhook_events to authenticated;

grant execute on function public.is_pharmacy_staff(uuid) to anon, authenticated;
grant execute on function public.is_verified_pharmacist_at(uuid) to authenticated;
grant execute on function public.pharmacy_can_sell(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Private storage for prescription files
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prescriptions', 'prescriptions', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Object path: {patient_id}/{prescription_id}/{file}. Patients upload into their own folder only.
create policy prescription_files_patient_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'prescriptions' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Read: the patient, or a verified pharmacist at the pharmacy the prescription was sent to.
create policy prescription_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'prescriptions' and exists (
      select 1 from public.prescriptions p
      where p.storage_path = name
        and (p.patient_id = (select auth.uid()) or public.is_verified_pharmacist_at(p.pharmacy_id))
    )
  );
