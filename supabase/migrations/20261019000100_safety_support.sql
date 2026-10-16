-- MedTRANS Phase 4 — Safety, emergency assistance, support, incidents, recalls, notifications.
--
--   * Emergency assistance requests exist only while a STAFFED operation is recorded. Until then the
--     Emergency Help page is guidance-and-contact only. A database row is never presented as dispatch.
--   * Repeat emergency submissions are merged, never rejected: abuse controls must not block real emergencies.
--   * Support tickets are a separate system, and say plainly they are not an emergency channel.
--   * Notification text is neutral: no medical detail is ever placed in a notification or message body.

-- ---------------------------------------------------------------------------
-- Emergency operation configuration
-- ---------------------------------------------------------------------------

insert into public.platform_settings (key, value, description, is_public) values
  ('emergency.operation',
   jsonb_build_object('staffed', false, 'hours', null, 'supervisor', null),
   'Whether a staffed, authorised MedTRANS emergency coordination operation is live. [[CONFIRM: staffed emergency operation]]',
   true)
on conflict (key) do nothing;

create or replace function public.emergency_operation_staffed()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (value ->> 'staffed')::boolean from public.platform_settings where key = 'emergency.operation'), false)
     and exists (select 1 from public.user_roles where role = 'emergency_responder' and revoked_at is null);
$$;

-- Admin switches the operation on/off. Switching on requires a named supervisor, hours, and at least one responder.
create or replace function public.admin_set_emergency_operation(p_staffed boolean, p_hours text, p_supervisor text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_staffed then
    if coalesce(btrim(p_hours), '') = '' or coalesce(btrim(p_supervisor), '') = '' then
      raise exception 'record the staffed hours and the responsible supervisor' using errcode = '22023';
    end if;
    if not exists (select 1 from public.user_roles where role = 'emergency_responder' and revoked_at is null) then
      raise exception 'grant the Emergency responder role to at least one trained responder first' using errcode = 'P0001';
    end if;
  end if;
  update public.platform_settings
     set value = jsonb_build_object('staffed', p_staffed, 'hours', nullif(btrim(p_hours), ''), 'supervisor', nullif(btrim(p_supervisor), '')),
         updated_by = (select auth.uid())
   where key = 'emergency.operation';
end;
$$;

-- ---------------------------------------------------------------------------
-- Emergency assistance requests (§10B–F)
-- ---------------------------------------------------------------------------

create type public.emergency_status as enum (
  'received',                 -- details received, awaiting authorised triage
  'acknowledged',             -- a responder has seen it
  'assigned',                 -- a responder has taken ownership
  'coordination_in_progress', -- the responder is actively coordinating (e.g. on the phone)
  'referred_externally',      -- handed to public emergency services or a facility
  'completed',
  'cancelled',
  'unable_to_connect',
  'escalated'                 -- raised to the supervisor
);

create type public.emergency_severity as enum ('life_threatening', 'urgent', 'non_emergency_home_care', 'general_inquiry');

create sequence public.emergency_ref_seq start 300001;

create table public.emergency_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('ER-' || nextval('public.emergency_ref_seq')),
  public_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  user_id uuid references auth.users (id) on delete set null,
  caller_name text check (caller_name is null or char_length(caller_name) <= 120),
  callback_phone text not null check (callback_phone ~ '^\+[0-9]{8,15}$'),
  location extensions.geography(Point, 4326),
  location_text text check (location_text is null or char_length(location_text) <= 300),
  location_shared boolean not null default false,
  nature text check (nature is null or char_length(nature) <= 500),
  conscious text not null default 'unknown' check (conscious in ('yes', 'no', 'unknown')),
  breathing text not null default 'unknown' check (breathing in ('yes', 'no', 'unknown')),
  language text check (language is null or language in ('en', 'sw', 'so', 'fr', 'ar')),
  status public.emergency_status not null default 'received',
  severity public.emergency_severity,
  assigned_to uuid references auth.users (id) on delete set null,
  acknowledged_at timestamptz,
  repeat_count int not null default 0,      -- further submissions merged into this one
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint location_only_with_consent check (location is null or location_shared)
);
create index emergency_requests_open on public.emergency_requests (status, created_at) where status not in ('completed', 'cancelled');
create index emergency_requests_phone on public.emergency_requests (callback_phone, created_at desc);
create trigger emergency_requests_updated_at before update on public.emergency_requests for each row execute function public.set_updated_at();

create table public.emergency_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.emergency_requests (id) on delete cascade,
  status public.emergency_status not null,
  actor_id uuid references auth.users (id) on delete set null,
  actor_kind text not null check (actor_kind in ('requester', 'responder', 'admin', 'system')),
  note text check (note is null or char_length(note) <= 1000),
  occurred_at timestamptz not null default now()
);
create index emergency_events_request on public.emergency_events (request_id, id);
create trigger emergency_events_immutable before update on public.emergency_events for each row execute function public.audit_logs_immutable();

create table public.emergency_call_attempts (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.emergency_requests (id) on delete cascade,
  responder_id uuid references auth.users (id) on delete set null,
  outcome text not null check (outcome in ('answered', 'no_answer', 'busy', 'wrong_number', 'disconnected')),
  note text check (note is null or char_length(note) <= 500),
  attempted_at timestamptz not null default now()
);

-- Submit (anyone, signed in or not). Guidance never depends on this succeeding.
create or replace function public.submit_emergency_request(
  p_callback_phone text, p_caller_name text default null, p_nature text default null,
  p_conscious text default 'unknown', p_breathing text default 'unknown',
  p_share_location boolean default false, p_lat double precision default null, p_lng double precision default null,
  p_location_text text default null, p_language text default null
)
returns table (reference text, public_token text, merged boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  existing public.emergency_requests;
  created public.emergency_requests;
  loc extensions.geography;
begin
  if not public.emergency_operation_staffed() then
    raise exception 'MedTRANS emergency coordination is not staffed. Contact local emergency services directly.' using errcode = 'P0001';
  end if;
  if p_share_location and p_lat is not null and p_lng is not null and p_lat between -90 and 90 and p_lng between -180 and 180 then
    loc := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  end if;

  -- Same number within 15 minutes, still open: merge rather than create a duplicate (never reject).
  select * into existing from public.emergency_requests r
  where r.callback_phone = p_callback_phone and r.created_at > now() - interval '15 minutes'
    and r.status not in ('completed', 'cancelled')
  order by r.created_at desc limit 1 for update;
  if found then
    update public.emergency_requests set repeat_count = repeat_count + 1,
      nature = coalesce(nullif(btrim(p_nature), ''), nature),
      location = coalesce(loc, location), location_shared = location_shared or (loc is not null),
      location_text = coalesce(nullif(btrim(p_location_text), ''), location_text)
    where id = existing.id;
    insert into public.emergency_events (request_id, status, actor_id, actor_kind, note)
    values (existing.id, existing.status, (select auth.uid()), 'requester', 'The requester submitted again.');
    return query select existing.reference, existing.public_token, true;
    return;
  end if;

  insert into public.emergency_requests (user_id, caller_name, callback_phone, location, location_text, location_shared, nature, conscious, breathing, language)
  values ((select auth.uid()), nullif(btrim(p_caller_name), ''), p_callback_phone, loc, nullif(btrim(p_location_text), ''),
          loc is not null, nullif(btrim(p_nature), ''), coalesce(p_conscious, 'unknown'), coalesce(p_breathing, 'unknown'), p_language)
  returning * into created;
  insert into public.emergency_events (request_id, status, actor_id, actor_kind, note)
  values (created.id, 'received', (select auth.uid()), 'requester', 'Request received. Not yet seen by a responder.');
  return query select created.reference, created.public_token, false;
end;
$$;

-- What the requester sees, by private link. Statuses only; responder identity is not exposed.
create or replace function public.emergency_request_status(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'reference', r.reference, 'status', r.status, 'created_at', r.created_at, 'acknowledged_at', r.acknowledged_at,
    'events', coalesce((select jsonb_agg(jsonb_build_object('status', e.status, 'at', e.occurred_at, 'note', case when e.actor_kind = 'responder' then null else e.note end) order by e.id)
                        from public.emergency_events e where e.request_id = r.id), '[]'::jsonb))
  from public.emergency_requests r where r.public_token = p_token;
$$;

create or replace function public.is_responder()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('emergency_responder') or public.is_admin();
$$;

-- Responder actions. Every change is an event with the acting responder.
create or replace function public.responder_update_emergency(
  p_request uuid, p_status public.emergency_status default null, p_severity public.emergency_severity default null, p_note text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.emergency_requests;
  kind text := case when public.is_admin() and not public.has_role('emergency_responder') then 'admin' else 'responder' end;
begin
  if not public.is_responder() then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into r from public.emergency_requests where id = p_request for update;
  if not found then raise exception 'unknown request' using errcode = 'P0002'; end if;
  if r.status in ('completed', 'cancelled') and p_status is not null then
    raise exception 'this request is closed' using errcode = 'P0001';
  end if;
  if p_status in ('referred_externally', 'completed', 'cancelled', 'unable_to_connect', 'escalated') and coalesce(btrim(p_note), '') = '' then
    raise exception 'record what happened' using errcode = '22023';
  end if;

  if p_severity is not null then
    update public.emergency_requests set severity = p_severity where id = r.id;
  end if;
  if p_status is not null and p_status is distinct from r.status then
    update public.emergency_requests
       set status = p_status,
           acknowledged_at = coalesce(acknowledged_at, case when p_status <> 'received' then now() end),
           assigned_to = case when p_status = 'assigned' then (select auth.uid()) else assigned_to end
     where id = r.id;
    insert into public.emergency_events (request_id, status, actor_id, actor_kind, note)
    values (r.id, p_status, (select auth.uid()), kind, nullif(btrim(p_note), ''));
  elsif nullif(btrim(p_note), '') is not null then
    insert into public.emergency_events (request_id, status, actor_id, actor_kind, note)
    values (r.id, r.status, (select auth.uid()), kind, btrim(p_note));
  end if;
end;
$$;

create or replace function public.responder_log_call(p_request uuid, p_outcome text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_responder() then raise exception 'not authorised' using errcode = '42501'; end if;
  insert into public.emergency_call_attempts (request_id, responder_id, outcome, note)
  values (p_request, (select auth.uid()), p_outcome, nullif(btrim(p_note), ''));
end;
$$;

-- ---------------------------------------------------------------------------
-- Support (§11)
-- ---------------------------------------------------------------------------

create type public.ticket_category as enum ('pharmacy_order', 'prescription', 'doctorcare_booking', 'delivery', 'payment_refund', 'account', 'registration', 'complaint', 'other');
create type public.ticket_status as enum ('new', 'open', 'waiting_on_customer', 'resolved', 'closed');
create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');

create sequence public.ticket_number_seq start 400001;

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default ('ST-' || nextval('public.ticket_number_seq')),
  access_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  requester_id uuid references auth.users (id) on delete set null,
  guest_name text check (guest_name is null or char_length(guest_name) <= 120),
  guest_contact text check (guest_contact is null or char_length(guest_contact) <= 254),
  preferred_contact text not null default 'in_app' check (preferred_contact in ('in_app', 'email', 'phone')),
  category public.ticket_category not null,
  subject text not null check (char_length(subject) between 3 and 160),
  status public.ticket_status not null default 'new',
  priority public.ticket_priority not null default 'normal',
  related_order_id uuid references public.orders (id) on delete set null,
  related_booking_id uuid references public.care_bookings (id) on delete set null,
  assigned_to uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  satisfaction int check (satisfaction is null or satisfaction between 1 and 5),
  satisfaction_comment text check (satisfaction_comment is null or char_length(satisfaction_comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticket_has_requester check (requester_id is not null or guest_contact is not null)
);
create index support_tickets_queue on public.support_tickets (status, priority, created_at);
create index support_tickets_requester on public.support_tickets (requester_id, created_at desc);
create trigger support_tickets_updated_at before update on public.support_tickets for each row execute function public.set_updated_at();

create table public.support_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author_kind text not null check (author_kind in ('customer', 'staff')),
  body text not null check (char_length(body) between 1 and 4000),
  is_internal boolean not null default false,   -- staff-only notes, never shown to the customer
  created_at timestamptz not null default now(),
  constraint internal_only_staff check (not is_internal or author_kind = 'staff')
);
create index support_messages_ticket on public.support_messages (ticket_id, id);
create trigger support_messages_immutable before update on public.support_messages for each row execute function public.audit_logs_immutable();

create or replace function public.is_support_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('support') or public.is_admin();
$$;

create or replace function public.create_ticket(
  p_category public.ticket_category, p_subject text, p_body text,
  p_guest_name text default null, p_guest_contact text default null, p_preferred_contact text default 'in_app',
  p_related_order uuid default null, p_related_booking uuid default null
)
returns table (ticket_id uuid, ticket_number text, access_token text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  t public.support_tickets;
begin
  if uid is null and coalesce(btrim(p_guest_contact), '') = '' then
    raise exception 'give us an email address or phone number to reply to' using errcode = '22023';
  end if;
  -- Guests: at most 5 tickets per contact per hour (spam control; not an emergency channel).
  if uid is null and (select count(*) from public.support_tickets st where st.guest_contact = btrim(p_guest_contact) and st.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'you have sent several messages recently; we will reply to those first' using errcode = 'P0001';
  end if;
  if p_related_order is not null and (uid is null or not exists (select 1 from public.orders o where o.id = p_related_order and o.patient_id = uid)) then
    p_related_order := null;
  end if;
  if p_related_booking is not null and (uid is null or not exists (select 1 from public.care_bookings b where b.id = p_related_booking and b.patient_id = uid)) then
    p_related_booking := null;
  end if;

  insert into public.support_tickets (requester_id, guest_name, guest_contact, preferred_contact, category, subject, related_order_id, related_booking_id,
                                      priority)
  values (uid, case when uid is null then nullif(btrim(p_guest_name), '') end, case when uid is null then btrim(p_guest_contact) end,
          coalesce(p_preferred_contact, 'in_app'), p_category, btrim(p_subject), p_related_order, p_related_booking,
          case when p_category in ('complaint', 'payment_refund') then 'high'::public.ticket_priority else 'normal'::public.ticket_priority end)
  returning * into t;
  insert into public.support_messages (ticket_id, author_id, author_kind, body) values (t.id, uid, 'customer', btrim(p_body));
  return query select t.id, t.ticket_number, t.access_token;
end;
$$;

-- Customer reply: signed-in owner, or a guest holding the private token.
create or replace function public.customer_reply(p_ticket uuid, p_body text, p_token text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  t public.support_tickets;
begin
  select * into t from public.support_tickets where id = p_ticket for update;
  if not found or not (t.requester_id = (select auth.uid()) or (p_token is not null and t.access_token = p_token)) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if t.status = 'closed' then raise exception 'this ticket is closed; please open a new one' using errcode = 'P0001'; end if;
  insert into public.support_messages (ticket_id, author_id, author_kind, body) values (t.id, (select auth.uid()), 'customer', btrim(p_body));
  update public.support_tickets set status = 'open', resolved_at = null where id = t.id and status in ('waiting_on_customer', 'resolved', 'new');
end;
$$;

create or replace function public.staff_reply(p_ticket uuid, p_body text, p_internal boolean default false, p_status public.ticket_status default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_support_staff() then raise exception 'not authorised' using errcode = '42501'; end if;
  insert into public.support_messages (ticket_id, author_id, author_kind, body, is_internal) values (p_ticket, (select auth.uid()), 'staff', btrim(p_body), p_internal);
  update public.support_tickets
     set status = coalesce(p_status, case when p_internal then status when status = 'new' then 'waiting_on_customer'::public.ticket_status else 'waiting_on_customer'::public.ticket_status end),
         assigned_to = coalesce(assigned_to, (select auth.uid())),
         resolved_at = case when coalesce(p_status, status) in ('resolved', 'closed') then coalesce(resolved_at, now()) else null end
   where id = p_ticket;
end;
$$;

create or replace function public.rate_ticket(p_ticket uuid, p_rating int, p_comment text default null, p_token text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.support_tickets set satisfaction = p_rating, satisfaction_comment = nullif(btrim(p_comment), '')
   where id = p_ticket and status in ('resolved', 'closed') and p_rating between 1 and 5
     and (requester_id = (select auth.uid()) or (p_token is not null and access_token = p_token));
  if not found then raise exception 'this ticket cannot be rated yet' using errcode = 'P0001'; end if;
end;
$$;

-- Guest view by token: ticket + non-internal messages.
create or replace function public.ticket_by_token(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id, 'ticket_number', t.ticket_number, 'subject', t.subject, 'status', t.status, 'category', t.category,
    'created_at', t.created_at, 'satisfaction', t.satisfaction,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('author_kind', m.author_kind, 'body', m.body, 'created_at', m.created_at) order by m.id)
                          from public.support_messages m where m.ticket_id = t.id and not m.is_internal), '[]'::jsonb))
  from public.support_tickets t where t.access_token = p_token;
$$;

-- ---------------------------------------------------------------------------
-- Safety incidents (§7F, §8, §10E) and recalls
-- ---------------------------------------------------------------------------

create type public.incident_kind as enum ('dispensing_error', 'adverse_reaction', 'suspected_counterfeit', 'expired_or_damaged', 'delivery_incident', 'clinical_incident', 'safeguarding', 'privacy', 'other');
create type public.incident_status as enum ('reported', 'investigating', 'resolved');

create sequence public.incident_ref_seq start 500001;

create table public.safety_incidents (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('SI-' || nextval('public.incident_ref_seq')),
  kind public.incident_kind not null,
  severity text not null default 'moderate' check (severity in ('low', 'moderate', 'severe', 'critical')),
  status public.incident_status not null default 'reported',
  reporter_id uuid references auth.users (id) on delete set null,
  reporter_capacity text not null check (reporter_capacity in ('patient', 'pharmacy', 'courier', 'clinician', 'staff')),
  related_order_id uuid references public.orders (id) on delete set null,
  related_booking_id uuid references public.care_bookings (id) on delete set null,
  related_product_id uuid references public.medicine_products (id) on delete set null,
  description text not null check (char_length(description) between 10 and 4000),
  immediate_action text check (immediate_action is null or char_length(immediate_action) <= 2000),
  handled_by uuid references auth.users (id) on delete set null,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 4000),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index safety_incidents_open on public.safety_incidents (status, created_at desc);
create trigger safety_incidents_updated_at before update on public.safety_incidents for each row execute function public.set_updated_at();

create or replace function public.report_incident(
  p_kind public.incident_kind, p_description text, p_severity text default 'moderate',
  p_order uuid default null, p_booking uuid default null, p_product uuid default null, p_immediate_action text default null
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  capacity text;
  ref text;
begin
  if uid is null then raise exception 'sign in to report a safety incident' using errcode = '42501'; end if;
  capacity := case
    when p_order is not null and exists (select 1 from public.orders o where o.id = p_order and o.patient_id = uid) then 'patient'
    when p_order is not null and exists (select 1 from public.orders o where o.id = p_order and public.is_pharmacy_staff(o.pharmacy_id)) then 'pharmacy'
    when p_order is not null and exists (select 1 from public.orders o where o.id = p_order and o.courier_id = uid) then 'courier'
    when p_booking is not null and exists (select 1 from public.care_bookings b where b.id = p_booking and b.patient_id = uid) then 'patient'
    when p_booking is not null and exists (select 1 from public.care_bookings b where b.id = p_booking and b.provider_id = uid) then 'clinician'
    when p_order is null and p_booking is null and (public.is_admin() or public.has_role('support')) then 'staff'
    when p_order is null and p_booking is null then 'patient'
    else null
  end;
  if capacity is null then raise exception 'you can only report incidents about your own orders or visits' using errcode = '42501'; end if;
  insert into public.safety_incidents (kind, severity, reporter_id, reporter_capacity, related_order_id, related_booking_id, related_product_id, description, immediate_action)
  values (p_kind, coalesce(p_severity, 'moderate'), uid, capacity, p_order, p_booking, p_product, btrim(p_description), nullif(btrim(p_immediate_action), ''))
  returning reference into ref;
  return ref;
end;
$$;

alter table public.medicine_products add column recalled_at timestamptz;
alter table public.medicine_products add column recall_note text check (recall_note is null or char_length(recall_note) <= 1000);
alter table public.medicine_products add constraint recall_has_note check (recalled_at is null or recall_note is not null);

-- A recall takes the product off sale everywhere, immediately, and keeps it off.
create or replace function public.apply_recall()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.recalled_at is not null and old.recalled_at is null then
    update public.inventory_items set is_listed = false where product_id = new.id;
    delete from public.cart_items c using public.inventory_items i where i.id = c.inventory_item_id and i.product_id = new.id;
  end if;
  return new;
end;
$$;
create trigger medicine_products_recall after update on public.medicine_products for each row execute function public.apply_recall();

create or replace function public.block_recalled_listing()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_listed and exists (select 1 from public.medicine_products m where m.id = new.product_id and m.recalled_at is not null) then
    new.is_listed := false;
  end if;
  return new;
end;
$$;
create trigger inventory_items_block_recalled before insert or update on public.inventory_items for each row execute function public.block_recalled_listing();

-- ---------------------------------------------------------------------------
-- Notifications (§16)
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null check (char_length(title) <= 120),
  body text not null check (char_length(body) <= 300),    -- neutral wording only: no medical detail
  link text check (link is null or link ~ '^/'),
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user on public.notifications (user_id, created_at desc);

create table public.notification_outbox (
  id bigint generated always as identity primary key,
  notification_id uuid not null references public.notifications (id) on delete cascade,
  channel text not null check (channel in ('sms', 'email', 'whatsapp')),
  to_address text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (notification_id, channel)
);
create index notification_outbox_pending on public.notification_outbox (status, created_at) where status = 'pending';

-- Creates an in-app notification and queues it for the user's reachable channels.
create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text, p_dedupe text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  n_id uuid;
  u record;
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  values (p_user, p_kind, left(p_title, 120), left(p_body, 300), p_link, p_dedupe)
  on conflict (user_id, dedupe_key) do nothing
  returning id into n_id;
  if n_id is null then return; end if;
  select phone, email into u from auth.users where id = p_user;
  if u.phone is not null and u.phone <> '' then
    insert into public.notification_outbox (notification_id, channel, to_address, body)
    values (n_id, 'sms', '+' || ltrim(u.phone, '+'), 'MedTRANS: ' || left(p_body, 140) || ' Open the app for details.');
  elsif u.email is not null then
    insert into public.notification_outbox (notification_id, channel, to_address, body)
    values (n_id, 'email', u.email, p_body);
  end if;
end;
$$;

-- Event triggers. Wording is deliberately neutral (safe on lock screens and shared phones).
create or replace function public.notify_order_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  if new.status = 'pending_payment' then return new; end if;
  select * into o from public.orders where id = new.order_id;
  perform public.notify(o.patient_id, 'order', 'Order ' || o.order_number || ' updated',
    'Your order ' || o.order_number || ' has an update.', '/orders/' || o.id, 'order:' || o.id || ':' || new.status);
  if new.status = 'awaiting_pharmacy_acceptance' then
    perform public.notify(s.user_id, 'pharmacy_order', 'New paid order', 'Order ' || o.order_number || ' is waiting for acceptance.', '/portal/pharmacy/orders', 'order:' || o.id || ':staff:' || s.user_id)
    from public.pharmacy_staff s where s.pharmacy_id = o.pharmacy_id and s.is_active;
  end if;
  if new.status = 'assigned_to_courier' and o.courier_id is not null then
    perform public.notify(o.courier_id, 'delivery', 'New delivery assignment', 'You have a new delivery to collect.', '/portal/courier', 'order:' || o.id || ':courier:' || o.courier_id);
  end if;
  return new;
end;
$$;
create trigger order_events_notify after insert on public.order_events for each row execute function public.notify_order_event();

create or replace function public.notify_booking_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  b public.care_bookings;
begin
  select * into b from public.care_bookings where id = new.booking_id;
  if new.status <> 'awaiting_acceptance' then
    perform public.notify(b.patient_id, 'booking', 'Home visit ' || b.booking_number || ' updated',
      'Your home visit ' || b.booking_number || ' has an update.', '/bookings/' || b.id, 'booking:' || b.id || ':' || new.status || ':' || new.id);
  end if;
  if new.status = 'confirmed' and b.provider_id is not null then
    perform public.notify(b.provider_id, 'visit', 'Visit confirmed', 'A visit you accepted is now confirmed.', '/portal/care/visits', 'booking:' || b.id || ':provider-confirmed');
  end if;
  return new;
end;
$$;
create trigger booking_events_notify after insert on public.booking_events for each row execute function public.notify_booking_event();

create or replace function public.notify_booking_offer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify(new.provider_id, 'offer', 'New visit request', 'You have a new home-visit request to respond to.', '/portal/care', 'offer:' || new.id);
  return new;
end;
$$;
create trigger booking_offers_notify after insert on public.booking_offers for each row execute function public.notify_booking_offer();

create or replace function public.notify_prescription_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  rx public.prescriptions;
begin
  select * into rx from public.prescriptions where id = new.prescription_id;
  perform public.notify(rx.patient_id, 'prescription', 'Prescription reviewed', 'A pharmacist has reviewed your prescription.', '/account/prescriptions', 'rx:' || rx.id || ':' || new.id);
  return new;
end;
$$;
create trigger prescription_reviews_notify after insert on public.prescription_reviews for each row execute function public.notify_prescription_review();

create or replace function public.notify_new_prescription()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify(s.user_id, 'rx_queue', 'Prescription to review', 'A new prescription is waiting for review.', '/portal/pharmacy/prescriptions', 'rxq:' || new.id || ':' || s.user_id)
  from public.pharmacy_staff s where s.pharmacy_id = new.pharmacy_id and s.is_active and s.staff_role = 'pharmacist' and s.registration_status = 'verified';
  return new;
end;
$$;
create trigger prescriptions_notify after insert on public.prescriptions for each row execute function public.notify_new_prescription();

create or replace function public.notify_support_reply()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  t public.support_tickets;
begin
  if new.author_kind <> 'staff' or new.is_internal then return new; end if;
  select * into t from public.support_tickets where id = new.ticket_id;
  perform public.notify(t.requester_id, 'support', 'Reply to ' || t.ticket_number, 'MedTRANS support has replied to your message.', '/account/support/' || t.id, 'support:' || new.id);
  return new;
end;
$$;
create trigger support_messages_notify after insert on public.support_messages for each row execute function public.notify_support_reply();

create or replace function public.notify_emergency_responders()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify(ur.user_id, 'emergency', 'New assistance request', 'A new assistance request is waiting.', '/portal/emergency', 'er:' || new.id || ':' || ur.user_id)
  from public.user_roles ur where ur.role = 'emergency_responder' and ur.revoked_at is null;
  return new;
end;
$$;
create trigger emergency_requests_notify after insert on public.emergency_requests for each row execute function public.notify_emergency_responders();

-- ---------------------------------------------------------------------------
-- Audit triggers
-- ---------------------------------------------------------------------------

create trigger audit_emergency_requests after insert or update on public.emergency_requests for each row execute function public.audit_row_change();
create trigger audit_support_tickets after insert or update on public.support_tickets for each row execute function public.audit_row_change();
create trigger audit_safety_incidents after insert or update on public.safety_incidents for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.emergency_requests enable row level security;
alter table public.emergency_events enable row level security;
alter table public.emergency_call_attempts enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.safety_incidents enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_outbox enable row level security;

create policy er_select on public.emergency_requests for select to authenticated using (public.is_responder());
create policy ee_select on public.emergency_events for select to authenticated using (public.is_responder());
create policy eca_select on public.emergency_call_attempts for select to authenticated using (public.is_responder());

create policy tickets_select on public.support_tickets for select to authenticated
  using (requester_id = (select auth.uid()) or public.is_support_staff());
create policy tickets_staff_update on public.support_tickets for update to authenticated
  using (public.is_support_staff()) with check (public.is_support_staff());
create policy messages_select on public.support_messages for select to authenticated
  using (public.is_support_staff() or (not is_internal and exists (
    select 1 from public.support_tickets t where t.id = ticket_id and t.requester_id = (select auth.uid()))));

create policy incidents_select on public.safety_incidents for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());
create policy incidents_admin_update on public.safety_incidents for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy notifications_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy outbox_admin_select on public.notification_outbox for select to authenticated using (public.is_admin());

grant select on public.emergency_requests, public.emergency_events, public.emergency_call_attempts to authenticated;
grant select on public.support_tickets, public.support_messages to authenticated;
grant update (status, priority, assigned_to) on public.support_tickets to authenticated;
grant select on public.safety_incidents to authenticated;
grant update (status, handled_by, resolution_note, resolved_at, severity) on public.safety_incidents to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.notification_outbox to authenticated;
grant update (recalled_at, recall_note) on public.medicine_products to authenticated;

revoke all on function public.notify(uuid, text, text, text, text, text), public.notify_order_event(), public.notify_booking_event(),
  public.notify_booking_offer(), public.notify_prescription_review(), public.notify_new_prescription(), public.notify_support_reply(),
  public.notify_emergency_responders(), public.apply_recall(), public.block_recalled_listing() from public, anon, authenticated;
grant execute on function public.emergency_operation_staffed() to anon, authenticated;
grant execute on function public.admin_set_emergency_operation(boolean, text, text) to authenticated;
grant execute on function public.submit_emergency_request(text, text, text, text, text, boolean, double precision, double precision, text, text) to anon, authenticated;
grant execute on function public.emergency_request_status(text) to anon, authenticated;
grant execute on function public.is_responder() to authenticated;
grant execute on function public.responder_update_emergency(uuid, public.emergency_status, public.emergency_severity, text) to authenticated;
grant execute on function public.responder_log_call(uuid, text, text) to authenticated;
grant execute on function public.is_support_staff() to authenticated;
grant execute on function public.create_ticket(public.ticket_category, text, text, text, text, text, uuid, uuid) to anon, authenticated;
grant execute on function public.customer_reply(uuid, text, text) to anon, authenticated;
grant execute on function public.staff_reply(uuid, text, boolean, public.ticket_status) to authenticated;
grant execute on function public.rate_ticket(uuid, int, text, text) to anon, authenticated;
grant execute on function public.ticket_by_token(text) to anon, authenticated;
grant execute on function public.report_incident(public.incident_kind, text, text, uuid, uuid, uuid, text) to authenticated;
