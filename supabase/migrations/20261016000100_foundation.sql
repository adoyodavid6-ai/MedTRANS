-- MedTRANS Phase 1 — Foundation schema
--
-- Principles enforced here (see docs/00-audit-and-plan.md):
--   * Row Level Security on every table in the exposed `public` schema.
--   * Roles are granted only by administrators, through audited functions.
--   * The audit log is append-only and records field NAMES, never values,
--     so it cannot leak personal or clinical detail.
--   * Nothing is active until it is configured and verified: countries,
--     coverage areas and emergency contacts all default to inactive, and
--     check constraints stop them being activated without the data that
--     makes activation honest.

create extension if not exists postgis with schema extensions;
create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums shared across modules
-- ---------------------------------------------------------------------------

create type public.app_role as enum (
  'patient',
  'doctor',
  'nurse',
  'pharmacist',
  'pharmacy_admin',
  'courier',
  'support',
  'admin',
  'emergency_responder'
);

-- Used by pharmacies, pharmacy licences, providers and credentials in later phases.
-- Only `verified` may ever be presented as verified, and only when a completed check backs it.
create type public.verification_status as enum ('unverified', 'pending', 'verified', 'suspended');

create type public.service_module as enum ('pharmacy', 'doctorcare', 'emergency_guidance');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) between 1 and 120),
  preferred_language text not null default 'en' check (preferred_language in ('en', 'sw', 'so')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);

-- One active grant per (user, role).
create unique index user_roles_one_active on public.user_roles (user_id, role) where revoked_at is null;
create index user_roles_user on public.user_roles (user_id);

-- True when the signed-in user currently holds `r`.
-- SECURITY DEFINER so policies on other tables can call it without
-- needing (and recursing through) SELECT rights on user_roles.
create or replace function public.has_role(r public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = r
      and ur.revoked_at is null
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin');
$$;

create or replace function public.my_roles()
returns setof public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select ur.role from public.user_roles ur
  where ur.user_id = (select auth.uid()) and ur.revoked_at is null
  order by ur.role;
$$;

-- ---------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,                         -- auth.uid() at the time; null for system/service actions
  action text not null,                  -- e.g. 'insert', 'update', 'delete', 'role.grant'
  table_name text,
  record_id text,
  changed_fields text[],                 -- names only; values are never copied here
  metadata jsonb not null default '{}'::jsonb
);

create index audit_logs_occurred on public.audit_logs (occurred_at desc);
create index audit_logs_record on public.audit_logs (table_name, record_id);
create index audit_logs_actor on public.audit_logs (actor_id);

create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;

create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function public.audit_logs_immutable();

-- Generic row-change auditor. Records which columns changed, never their contents.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fields text[];
  rec_id text;
begin
  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into fields
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value and n.key <> 'updated_at';
    if fields is null then
      return new; -- nothing meaningful changed
    end if;
    rec_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key', to_jsonb(new) ->> 'code');
  elsif tg_op = 'INSERT' then
    rec_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key', to_jsonb(new) ->> 'code');
  else
    rec_id := coalesce(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'key', to_jsonb(old) ->> 'code');
  end if;

  insert into public.audit_logs (actor_id, action, table_name, record_id, changed_fields)
  values ((select auth.uid()), lower(tg_op), tg_table_name, rec_id, fields);

  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- New-user bootstrap: every account gets a profile and the `patient` role.
-- All other roles require an administrator (and, from Phase 2/3, verification).
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'patient') on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Role administration (the only write path to user_roles)
-- ---------------------------------------------------------------------------

create or replace function public.admin_grant_role(target uuid, r public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = target) then
    raise exception 'unknown user' using errcode = 'P0002';
  end if;
  insert into public.user_roles (user_id, role, granted_by)
  values (target, r, (select auth.uid()))
  on conflict (user_id, role) where revoked_at is null do nothing;

  insert into public.audit_logs (actor_id, action, table_name, record_id, metadata)
  values ((select auth.uid()), 'role.grant', 'user_roles', target::text, jsonb_build_object('role', r));
end;
$$;

create or replace function public.admin_revoke_role(target uuid, r public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining_admins int;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  if r = 'admin' then
    select count(*) into remaining_admins from public.user_roles
    where role = 'admin' and revoked_at is null and user_id <> target;
    if remaining_admins = 0 then
      raise exception 'cannot revoke the last administrator' using errcode = 'P0001';
    end if;
  end if;

  update public.user_roles
     set revoked_at = now(), revoked_by = (select auth.uid())
   where user_id = target and role = r and revoked_at is null;

  insert into public.audit_logs (actor_id, action, table_name, record_id, metadata)
  values ((select auth.uid()), 'role.revoke', 'user_roles', target::text, jsonb_build_object('role', r));
end;
$$;

-- Admin user directory. Exposes contact identifiers needed to administer
-- accounts, nothing clinical. Every call is itself audited.
create or replace function public.admin_list_users(search text default null, max_rows int default 50)
returns table (
  id uuid,
  email text,
  phone text,
  full_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  roles public.app_role[]
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  insert into public.audit_logs (actor_id, action, table_name, metadata)
  values ((select auth.uid()), 'users.list', 'auth.users',
          jsonb_build_object('searched', search is not null and search <> ''));

  return query
  select u.id, u.email::text, u.phone::text, p.full_name, u.created_at, u.last_sign_in_at,
         coalesce(array_agg(ur.role order by ur.role) filter (where ur.role is not null), '{}')
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.user_roles ur on ur.user_id = u.id and ur.revoked_at is null
  where search is null or search = ''
     or u.email ilike '%' || search || '%'
     or u.phone ilike '%' || search || '%'
     or p.full_name ilike '%' || search || '%'
  group by u.id, p.full_name
  order by u.created_at desc
  limit least(greatest(max_rows, 1), 200);
end;
$$;

-- ---------------------------------------------------------------------------
-- Patient-owned data
-- ---------------------------------------------------------------------------

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  line1 text not null check (char_length(line1) between 1 and 200),
  area text check (area is null or char_length(area) <= 120),
  building_details text check (building_details is null or char_length(building_details) <= 200),
  landmark text check (landmark is null or char_length(landmark) <= 200),
  location extensions.geography(Point, 4326),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index addresses_user on public.addresses (user_id);
create unique index addresses_one_default on public.addresses (user_id) where is_default;
create trigger addresses_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();

-- People a patient is authorised to manage care for (e.g. a child or an older parent).
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  relationship text not null check (relationship in ('child', 'parent', 'spouse_partner', 'sibling', 'other_dependant')),
  date_of_birth date check (date_of_birth is null or date_of_birth <= current_date),
  -- The account holder confirms they are authorised to act for this person.
  authority_confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index household_members_owner on public.household_members (owner_id);
create trigger household_members_updated_at before update on public.household_members
  for each row execute function public.set_updated_at();

-- Consent is an append-only ledger: withdrawing consent is a new row with granted = false.
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in (
    'terms_of_service',
    'privacy_notice',
    'health_data_processing',
    'location_for_matching',
    'marketing_messages',
    'analytics'
  )),
  granted boolean not null,
  policy_version text not null check (char_length(policy_version) between 1 and 40),
  recorded_at timestamptz not null default now()
);

create index consent_records_user_purpose on public.consent_records (user_id, purpose, recorded_at desc);

create trigger consent_records_immutable before update or delete on public.consent_records
  for each row execute function public.audit_logs_immutable();

-- Current consent state per purpose for the signed-in user.
create or replace view public.my_current_consents
with (security_invoker = true)
as
select distinct on (purpose) purpose, granted, policy_version, recorded_at
from public.consent_records
where user_id = (select auth.uid())
order by purpose, recorded_at desc;

-- ---------------------------------------------------------------------------
-- Platform configuration
-- ---------------------------------------------------------------------------

create table public.platform_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.]{1,63}$'),
  value jsonb not null,
  description text,
  is_public boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger platform_settings_updated_at before update on public.platform_settings
  for each row execute function public.set_updated_at();

create table public.countries (
  code char(2) primary key check (code ~ '^[A-Z]{2}$'),
  name text not null,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  is_active boolean not null default false,
  -- A country may only go live after the regulatory review for it is recorded.
  regulatory_review_ref text,
  regulatory_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint countries_active_requires_review
    check (not is_active or (regulatory_review_ref is not null and regulatory_reviewed_at is not null))
);

create trigger countries_updated_at before update on public.countries
  for each row execute function public.set_updated_at();

create table public.service_coverage_areas (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null references public.countries (code),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  boundary extensions.geography(MultiPolygon, 4326),
  is_active boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An area cannot be live without a defined boundary: otherwise "do you cover me?" has no honest answer.
  constraint coverage_active_requires_boundary check (not is_active or boundary is not null)
);

create index service_coverage_areas_boundary on public.service_coverage_areas using gist (boundary);
create trigger service_coverage_areas_updated_at before update on public.service_coverage_areas
  for each row execute function public.set_updated_at();

create table public.coverage_area_services (
  area_id uuid not null references public.service_coverage_areas (id) on delete cascade,
  module public.service_module not null,
  is_active boolean not null default false,
  activated_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (area_id, module),
  constraint coverage_service_activation_time check (not is_active or activated_at is not null)
);

create trigger coverage_area_services_updated_at before update on public.coverage_area_services
  for each row execute function public.set_updated_at();

-- Emergency contact numbers. Nothing is shown publicly unless it was verified,
-- by whom, when, and against which source.
create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null references public.countries (code),
  area_id uuid references public.service_coverage_areas (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  phone_number text not null check (phone_number ~ '^\+?[0-9 ]{2,20}$'),
  description text check (description is null or char_length(description) <= 280),
  source text,                       -- where the number was verified (e.g. official government page)
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  is_active boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emergency_contact_active_requires_verification
    check (not is_active or (verified_at is not null and source is not null and char_length(source) > 0))
);

create index emergency_contacts_country on public.emergency_contacts (country_code) where is_active;
create trigger emergency_contacts_updated_at before update on public.emergency_contacts
  for each row execute function public.set_updated_at();

-- Coverage lookup for any visitor. Returns only active areas in active countries, and only active services.
create or replace function public.check_coverage(lat double precision, lng double precision)
returns table (area_name text, country_code char(2), active_modules public.service_module[])
language sql
stable
security definer
set search_path = ''
as $$
  select a.name, a.country_code,
         coalesce(array_agg(s.module order by s.module) filter (where s.is_active), '{}')
  from public.service_coverage_areas a
  join public.countries c on c.code = a.country_code and c.is_active
  left join public.coverage_area_services s on s.area_id = a.id
  where a.is_active
    and lat between -90 and 90 and lng between -180 and 180
    and extensions.st_covers(a.boundary, extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography)
  group by a.id
  order by a.name;
$$;

-- ---------------------------------------------------------------------------
-- Audit triggers
-- ---------------------------------------------------------------------------

create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change();
create trigger audit_addresses after insert or update or delete on public.addresses
  for each row execute function public.audit_row_change();
create trigger audit_household_members after insert or update or delete on public.household_members
  for each row execute function public.audit_row_change();
create trigger audit_consent_records after insert on public.consent_records
  for each row execute function public.audit_row_change();
create trigger audit_platform_settings after insert or update or delete on public.platform_settings
  for each row execute function public.audit_row_change();
create trigger audit_countries after insert or update or delete on public.countries
  for each row execute function public.audit_row_change();
create trigger audit_service_coverage_areas after insert or update or delete on public.service_coverage_areas
  for each row execute function public.audit_row_change();
create trigger audit_coverage_area_services after insert or update or delete on public.coverage_area_services
  for each row execute function public.audit_row_change();
create trigger audit_emergency_contacts after insert or update or delete on public.emergency_contacts
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.addresses enable row level security;
alter table public.household_members enable row level security;
alter table public.consent_records enable row level security;
alter table public.platform_settings enable row level security;
alter table public.countries enable row level security;
alter table public.service_coverage_areas enable row level security;
alter table public.coverage_area_services enable row level security;
alter table public.emergency_contacts enable row level security;

-- Profiles: you see and edit your own; admins and support may read (not edit) for account administration.
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin() or public.has_role('support'));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Roles: you see your own; admins see all. No write policies: writes go through admin_grant_role/admin_revoke_role.
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Audit log: admins read. Nobody writes directly (triggers and definer functions do).
create policy audit_logs_admin_select on public.audit_logs for select to authenticated
  using (public.is_admin());

-- Addresses: strictly owner-only. Admins get no blanket access to where patients live.
create policy addresses_owner_all on public.addresses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Household members: owner-only.
create policy household_owner_all on public.household_members for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Consent: owner reads and appends.
create policy consent_owner_select on public.consent_records for select to authenticated
  using (user_id = (select auth.uid()));
create policy consent_owner_insert on public.consent_records for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Settings: public keys readable by anyone; everything readable and writable by admins.
create policy settings_public_select on public.platform_settings for select to anon, authenticated
  using (is_public or public.is_admin());
create policy settings_admin_insert on public.platform_settings for insert to authenticated
  with check (public.is_admin());
create policy settings_admin_update on public.platform_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy settings_admin_delete on public.platform_settings for delete to authenticated
  using (public.is_admin());

-- Countries / coverage / services: public sees active rows; admins see and manage everything.
create policy countries_select on public.countries for select to anon, authenticated
  using (is_active or public.is_admin());
create policy countries_admin_update on public.countries for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy countries_admin_insert on public.countries for insert to authenticated
  with check (public.is_admin());

create policy coverage_select on public.service_coverage_areas for select to anon, authenticated
  using (is_active or public.is_admin());
create policy coverage_admin_insert on public.service_coverage_areas for insert to authenticated
  with check (public.is_admin());
create policy coverage_admin_update on public.service_coverage_areas for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy coverage_admin_delete on public.service_coverage_areas for delete to authenticated
  using (public.is_admin());

create policy coverage_services_select on public.coverage_area_services for select to anon, authenticated
  using (is_active or public.is_admin());
create policy coverage_services_admin_insert on public.coverage_area_services for insert to authenticated
  with check (public.is_admin());
create policy coverage_services_admin_update on public.coverage_area_services for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy emergency_contacts_select on public.emergency_contacts for select to anon, authenticated
  using (is_active or public.is_admin());
create policy emergency_contacts_admin_insert on public.emergency_contacts for insert to authenticated
  with check (public.is_admin());
create policy emergency_contacts_admin_update on public.emergency_contacts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy emergency_contacts_admin_delete on public.emergency_contacts for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants. Supabase grants broad table privileges to anon/authenticated by default;
-- tighten to exactly what the policies above intend, so a missing policy fails closed twice.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

grant select, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.audit_logs to authenticated;
grant select, insert, update, delete on public.addresses to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select, insert on public.consent_records to authenticated;
grant select on public.my_current_consents to authenticated;
grant select on public.platform_settings to anon;
grant select, insert, update, delete on public.platform_settings to authenticated;
grant select on public.countries, public.service_coverage_areas, public.coverage_area_services, public.emergency_contacts to anon;
grant select, insert, update on public.countries to authenticated;
grant select, insert, update, delete on public.service_coverage_areas to authenticated;
grant select, insert, update on public.coverage_area_services to authenticated;
grant select, insert, update, delete on public.emergency_contacts to authenticated;

-- anon needs these because public-read policies reference them (they return false for anon).
grant execute on function public.has_role(public.app_role) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.my_roles() to authenticated;
grant execute on function public.admin_grant_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_revoke_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_list_users(text, int) to authenticated;
grant execute on function public.check_coverage(double precision, double precision) to anon, authenticated;

-- Future objects in public must be granted explicitly.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;
