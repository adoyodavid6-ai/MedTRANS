-- MedTRANS Phase 5 — Commercial: commissions, settlements, plans, applications, reviewed articles, analytics.
--
--   * Commission rates are unknown until confirmed: settlements cannot be generated while they are unset.
--   * MedTRANS does not move payout money itself here: a settlement is "paid" only with an external reference.
--   * Analytics are anonymous daily counts of allow-listed events: no user id, no session id, no clinical content.
--   * Health articles are public only once reviewed by a named clinician.

-- ---------------------------------------------------------------------------
-- Commissions & settlements (§13)
-- ---------------------------------------------------------------------------

insert into public.platform_settings (key, value, description, is_public) values
  ('commission.pharmacy_bps', 'null', 'MedTRANS commission on pharmacy item sales, in basis points. [[CONFIRM: commission rates]]', false),
  ('commission.doctorcare_bps', 'null', 'MedTRANS commission on home-visit fees, in basis points. [[CONFIRM: commission rates]]', false)
on conflict (key) do nothing;

create type public.settlement_status as enum ('draft', 'approved', 'paid', 'void');

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  payee_kind text not null check (payee_kind in ('pharmacy', 'provider')),
  pharmacy_id uuid references public.pharmacies (id) on delete restrict,
  provider_id uuid references public.provider_profiles (user_id) on delete restrict,
  period_start date not null,
  period_end date not null,
  currency char(3) not null,
  gross_minor int not null check (gross_minor >= 0),
  commission_bps int not null check (commission_bps between 0 and 10000),
  commission_minor int not null check (commission_minor >= 0),
  net_minor int not null,
  item_count int not null,
  status public.settlement_status not null default 'draft',
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  paid_reference text check (paid_reference is null or char_length(paid_reference) between 3 and 120),
  paid_by uuid references auth.users (id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint settlement_payee check ((payee_kind = 'pharmacy') = (pharmacy_id is not null) and (payee_kind = 'provider') = (provider_id is not null)),
  constraint settlement_net check (net_minor = gross_minor - commission_minor),
  constraint settlement_paid_has_ref check (status <> 'paid' or paid_reference is not null),
  constraint settlement_period check (period_start <= period_end)
);

-- Each delivered order / completed visit is settled at most once.
create table public.settlement_items (
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  order_id uuid unique references public.orders (id) on delete restrict,
  booking_id uuid unique references public.care_bookings (id) on delete restrict,
  gross_minor int not null,
  check ((order_id is null) <> (booking_id is null))
);

create or replace function public.admin_generate_settlements(p_start date, p_end date)
returns int language plpgsql security definer set search_path = '' as $$
declare
  ph_bps int;
  dc_bps int;
  r record;
  s_id uuid;
  n int := 0;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_start > p_end or p_end >= (now() at time zone 'Africa/Nairobi')::date then
    raise exception 'choose a completed period that ends before today' using errcode = '22023';
  end if;
  select (value #>> '{}')::int into ph_bps from public.platform_settings where key = 'commission.pharmacy_bps' and jsonb_typeof(value) = 'number';
  select (value #>> '{}')::int into dc_bps from public.platform_settings where key = 'commission.doctorcare_bps' and jsonb_typeof(value) = 'number';
  if ph_bps is null or dc_bps is null then
    raise exception 'commission rates have not been confirmed, so settlements cannot be calculated' using errcode = 'P0001';
  end if;

  -- Pharmacies: item subtotal of orders delivered in the period (delivery and service fees are MedTRANS revenue).
  for r in
    select o.pharmacy_id, o.currency, sum(o.subtotal_minor)::int as gross, count(*)::int as n, array_agg(o.id) as ids
    from public.orders o
    where o.status = 'delivered'
      and (select max(e.occurred_at) from public.order_events e where e.order_id = o.id and e.status = 'delivered') at time zone 'Africa/Nairobi' >= p_start
      and (select max(e.occurred_at) from public.order_events e where e.order_id = o.id and e.status = 'delivered') at time zone 'Africa/Nairobi' < p_end + 1
      and not exists (select 1 from public.settlement_items si where si.order_id = o.id)
    group by o.pharmacy_id, o.currency
  loop
    insert into public.settlements (payee_kind, pharmacy_id, period_start, period_end, currency, gross_minor, commission_bps, commission_minor, net_minor, item_count)
    values ('pharmacy', r.pharmacy_id, p_start, p_end, r.currency, r.gross, ph_bps, round(r.gross * ph_bps / 10000.0)::int,
            r.gross - round(r.gross * ph_bps / 10000.0)::int, r.n)
    returning id into s_id;
    insert into public.settlement_items (settlement_id, order_id, gross_minor)
    select s_id, o.id, o.subtotal_minor from public.orders o where o.id = any(r.ids);
    n := n + 1;
  end loop;

  -- Clinicians: visit fees of visits completed in the period (booking fees are MedTRANS revenue).
  for r in
    select b.provider_id, b.currency, sum(b.visit_fee_minor)::int as gross, count(*)::int as n, array_agg(b.id) as ids
    from public.care_bookings b
    where b.status = 'completed'
      and (select max(e.occurred_at) from public.booking_events e where e.booking_id = b.id and e.status = 'completed') at time zone 'Africa/Nairobi' >= p_start
      and (select max(e.occurred_at) from public.booking_events e where e.booking_id = b.id and e.status = 'completed') at time zone 'Africa/Nairobi' < p_end + 1
      and not exists (select 1 from public.settlement_items si where si.booking_id = b.id)
    group by b.provider_id, b.currency
  loop
    insert into public.settlements (payee_kind, provider_id, period_start, period_end, currency, gross_minor, commission_bps, commission_minor, net_minor, item_count)
    values ('provider', r.provider_id, p_start, p_end, r.currency, r.gross, dc_bps, round(r.gross * dc_bps / 10000.0)::int,
            r.gross - round(r.gross * dc_bps / 10000.0)::int, r.n)
    returning id into s_id;
    insert into public.settlement_items (settlement_id, booking_id, gross_minor)
    select s_id, b.id, b.visit_fee_minor from public.care_bookings b where b.id = any(r.ids);
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.admin_settlement_action(p_settlement uuid, p_action text, p_reference text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.settlements;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into s from public.settlements where id = p_settlement for update;
  if not found then raise exception 'unknown settlement' using errcode = 'P0002'; end if;
  if p_action = 'approve' and s.status = 'draft' then
    update public.settlements set status = 'approved', approved_by = (select auth.uid()), approved_at = now() where id = s.id;
  elsif p_action = 'paid' and s.status = 'approved' then
    if coalesce(btrim(p_reference), '') = '' then raise exception 'record the payout reference' using errcode = '22023'; end if;
    if s.approved_by = (select auth.uid()) then
      raise exception 'a different administrator must record the payout (four-eyes check)' using errcode = 'P0001';
    end if;
    update public.settlements set status = 'paid', paid_reference = btrim(p_reference), paid_by = (select auth.uid()), paid_at = now() where id = s.id;
  elsif p_action = 'void' and s.status in ('draft', 'approved') then
    delete from public.settlement_items where settlement_id = s.id;  -- frees the items for a corrected settlement
    update public.settlements set status = 'void' where id = s.id;
  else
    raise exception 'that action is not allowed for a % settlement', s.status using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Subscription plans (configurable; no billing until prices and terms are confirmed)
-- ---------------------------------------------------------------------------

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('pharmacy', 'provider', 'organisation')),
  name text not null check (char_length(name) between 2 and 80),
  summary text not null check (char_length(summary) between 5 and 300),
  features text[] not null default '{}',
  price_minor int check (price_minor is null or price_minor >= 0),
  billing_period text check (billing_period is null or billing_period in ('month', 'year')),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint active_plan_has_price check (not is_active or (price_minor is not null and billing_period is not null))
);

-- ---------------------------------------------------------------------------
-- Partner applications (pharmacies, organisations)
-- ---------------------------------------------------------------------------

create table public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pharmacy', 'organisation')),
  applicant_id uuid references auth.users (id) on delete set null,
  organisation_name text not null check (char_length(organisation_name) between 2 and 160),
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  contact_phone text check (contact_phone is null or contact_phone ~ '^\+[0-9]{8,15}$'),
  contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  details jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received', 'in_review', 'approved', 'declined')),
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint application_contact check (contact_phone is not null or contact_email is not null)
);

create or replace function public.submit_partner_application(
  p_kind text, p_organisation text, p_contact_name text, p_phone text, p_email text, p_details jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  if (select count(*) from public.partner_applications where coalesce(contact_email, contact_phone) = coalesce(p_email, p_phone) and created_at > now() - interval '1 day') >= 3 then
    raise exception 'we already have your application; our team will be in touch' using errcode = 'P0001';
  end if;
  insert into public.partner_applications (kind, applicant_id, organisation_name, contact_name, contact_phone, contact_email, details)
  values (p_kind, (select auth.uid()), btrim(p_organisation), btrim(p_contact_name), nullif(btrim(p_phone), ''), nullif(btrim(p_email), ''),
          coalesce(p_details, '{}'::jsonb))
  returning id into new_id;
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Health resources: only clinically reviewed articles are public (§19)
-- ---------------------------------------------------------------------------

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 5 and 160),
  summary text not null check (char_length(summary) between 10 and 300),
  body text not null check (char_length(body) between 50 and 20000),
  reviewed_by_name text,
  reviewed_by_credentials text,
  reviewed_at date,
  next_review_due date,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_requires_review check (not is_published or (reviewed_by_name is not null and reviewed_by_credentials is not null and reviewed_at is not null))
);
create trigger articles_updated_at before update on public.articles for each row execute function public.set_updated_at();

-- Editing a published article's text withdraws it until it is reviewed again.
create or replace function public.articles_rereview()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.body is distinct from old.body or new.title is distinct from old.title) and new.reviewed_at is not distinct from old.reviewed_at then
    new.is_published := false;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;
create trigger articles_rereview before update on public.articles for each row execute function public.articles_rereview();

-- ---------------------------------------------------------------------------
-- Anonymous analytics (§20): daily counts only. No identifiers are ever stored.
-- ---------------------------------------------------------------------------

create table public.analytics_daily (
  day date not null,
  event text not null check (event in ('landing_view', 'pharmacy_search', 'product_view', 'add_to_cart', 'checkout_started',
                                       'prescription_upload_started', 'doctorcare_service_view', 'booking_started', 'emergency_view', 'coverage_check')),
  path text not null check (char_length(path) <= 120),
  count int not null default 0,
  primary key (day, event, path)
);

create or replace function public.track_event(p_event text, p_path text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.analytics_daily (day, event, path, count)
  values ((now() at time zone 'Africa/Nairobi')::date, p_event, left(coalesce(p_path, '/'), 120), 1)
  on conflict (day, event, path) do update set count = public.analytics_daily.count + 1;
exception when check_violation then
  return; -- unknown events are ignored
end;
$$;

-- Funnel and operations metrics computed from real transactions over the last p_days.
create or replace function public.admin_analytics(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  return jsonb_build_object(
    'since', since,
    'events', coalesce((select jsonb_object_agg(event, n) from (select event, sum(count)::int n from public.analytics_daily where day >= since::date group by event) x), '{}'::jsonb),
    'registrations', (select count(*) from auth.users where created_at >= since),
    'orders_placed', (select count(*) from public.orders where created_at >= since),
    'orders_paid', (select count(*) from public.orders o where o.created_at >= since and exists (select 1 from public.payments p where p.order_id = o.id and p.status = 'succeeded')),
    'orders_delivered', (select count(*) from public.orders where created_at >= since and status in ('delivered')),
    'orders_cancelled', (select count(*) from public.orders where created_at >= since and status in ('cancelled', 'refund_processing', 'refunded')),
    'pharmacy_acceptance_rate', (select round(100.0 * count(*) filter (where exists (select 1 from public.order_events e where e.order_id = o.id and e.status = 'confirmed'))
                                               / nullif(count(*), 0), 1)
                                 from public.orders o where o.created_at >= since and exists (select 1 from public.order_events e where e.order_id = o.id and e.status = 'awaiting_pharmacy_acceptance')),
    'rx_review_median_minutes', (select round(extract(epoch from percentile_cont(0.5) within group (order by decided_at - created_at)) / 60)
                                 from public.prescriptions where created_at >= since and decided_at is not null),
    'bookings_requested', (select count(*) from public.care_bookings where created_at >= since and status <> 'escalated'),
    'bookings_escalated', (select count(*) from public.care_bookings where created_at >= since and status = 'escalated'),
    'bookings_no_provider', (select count(*) from public.care_bookings where created_at >= since and status = 'no_provider_available'),
    'bookings_completed', (select count(*) from public.care_bookings where created_at >= since and status = 'completed'),
    'offer_acceptance_rate', (select round(100.0 * count(*) filter (where status = 'accepted') / nullif(count(*) filter (where status in ('accepted', 'declined', 'expired')), 0), 1)
                              from public.booking_offers where offered_at >= since),
    'median_hours_to_visit', (select round((extract(epoch from percentile_cont(0.5) within group (order by lower(slot) - created_at)) / 3600)::numeric, 1)
                              from public.care_bookings where created_at >= since and status in ('confirmed', 'en_route', 'arrived', 'in_progress', 'completed')),
    'gross_pharmacy_minor', (select coalesce(sum(subtotal_minor), 0) from public.orders where created_at >= since and status = 'delivered'),
    'platform_fees_minor', (select coalesce(sum(delivery_fee_minor + service_fee_minor), 0) from public.orders where created_at >= since and status = 'delivered')
                           + (select coalesce(sum(booking_fee_minor), 0) from public.care_bookings where created_at >= since and status = 'completed'),
    'gross_doctorcare_minor', (select coalesce(sum(visit_fee_minor), 0) from public.care_bookings where created_at >= since and status = 'completed'),
    'support_satisfaction', (select round(avg(satisfaction)::numeric, 2) from public.support_tickets where created_at >= since and satisfaction is not null),
    'tickets_open', (select count(*) from public.support_tickets where status in ('new', 'open', 'waiting_on_customer')),
    'incidents_open', (select count(*) from public.safety_incidents where status <> 'resolved'),
    'weekly_orders', coalesce((select jsonb_agg(jsonb_build_object('week', w, 'orders', n) order by w)
                               from (select date_trunc('week', created_at at time zone 'Africa/Nairobi')::date w, count(*)::int n
                                     from public.orders where created_at >= now() - interval '8 weeks' group by 1) x), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.settlements enable row level security;
alter table public.settlement_items enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.partner_applications enable row level security;
alter table public.articles enable row level security;
alter table public.analytics_daily enable row level security;

create policy settlements_select on public.settlements for select to authenticated
  using (public.is_admin() or provider_id = (select auth.uid()) or (pharmacy_id is not null and public.is_pharmacy_staff(pharmacy_id)));
create policy settlement_items_select on public.settlement_items for select to authenticated
  using (exists (select 1 from public.settlements s where s.id = settlement_id
                 and (public.is_admin() or s.provider_id = (select auth.uid()) or (s.pharmacy_id is not null and public.is_pharmacy_staff(s.pharmacy_id)))));
create policy plans_select on public.subscription_plans for select to anon, authenticated using (is_active or public.is_admin());
create policy plans_admin_insert on public.subscription_plans for insert to authenticated with check (public.is_admin());
create policy plans_admin_update on public.subscription_plans for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy applications_select on public.partner_applications for select to authenticated
  using (applicant_id = (select auth.uid()) or public.is_admin());
create policy applications_admin_update on public.partner_applications for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy articles_select on public.articles for select to anon, authenticated using (is_published or public.is_admin());
create policy articles_admin_insert on public.articles for insert to authenticated with check (public.is_admin());
create policy articles_admin_update on public.articles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy analytics_admin_select on public.analytics_daily for select to authenticated using (public.is_admin());

create trigger audit_settlements after insert or update on public.settlements for each row execute function public.audit_row_change();
create trigger audit_subscription_plans after insert or update on public.subscription_plans for each row execute function public.audit_row_change();
create trigger audit_partner_applications after insert or update on public.partner_applications for each row execute function public.audit_row_change();
create trigger audit_articles after insert or update on public.articles for each row execute function public.audit_row_change();

grant select on public.settlements, public.settlement_items to authenticated;
grant select on public.subscription_plans, public.articles to anon;
grant select, insert, update on public.subscription_plans, public.articles to authenticated;
grant select on public.partner_applications to authenticated;
grant update (status, review_note, reviewed_by) on public.partner_applications to authenticated;
grant select on public.analytics_daily to authenticated;

grant execute on function public.admin_generate_settlements(date, date) to authenticated;
grant execute on function public.admin_settlement_action(uuid, text, text) to authenticated;
grant execute on function public.submit_partner_application(text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.track_event(text, text) to anon, authenticated;
grant execute on function public.admin_analytics(int) to authenticated;
revoke all on function public.articles_rereview() from public, anon, authenticated;
