-- 1. Delivery partner self-applications.
-- Applicants create their own pending profile through apply_as_courier(); they never get the courier role
-- or become assignable until an administrator verifies them (and records how identity was checked).

alter table public.courier_profiles
  add column vehicle_type text check (vehicle_type is null or vehicle_type in ('on_foot', 'bicycle', 'motorbike', 'car')),
  add column driving_licence_number text check (driving_licence_number is null or char_length(driving_licence_number) between 4 and 40),
  add column operating_area text check (operating_area is null or char_length(operating_area) between 2 and 120),
  add column applied_at timestamptz;

create or replace function public.apply_as_courier(p_full_name text, p_vehicle text, p_licence text, p_area text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  existing public.courier_profiles;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if coalesce(btrim(p_full_name), '') = '' then raise exception 'enter your full name' using errcode = '22023'; end if;
  if p_vehicle not in ('on_foot', 'bicycle', 'motorbike', 'car') then raise exception 'choose how you will deliver' using errcode = '22023'; end if;
  if p_vehicle in ('motorbike', 'car') and coalesce(btrim(p_licence), '') = '' then
    raise exception 'a driving licence number is needed for motorbike or car deliveries' using errcode = '22023';
  end if;
  if coalesce(btrim(p_area), '') = '' then raise exception 'tell us the area you can cover' using errcode = '22023'; end if;

  select * into existing from public.courier_profiles where user_id = uid;
  if found and existing.verification_status in ('verified', 'suspended') then
    raise exception 'your delivery partner account already exists; contact MedTRANS to change it' using errcode = 'P0001';
  end if;

  update public.profiles set full_name = btrim(p_full_name) where id = uid;
  insert into public.courier_profiles (user_id, verification_status, vehicle_type, driving_licence_number, operating_area, applied_at)
  values (uid, 'pending', p_vehicle, nullif(btrim(p_licence), ''), btrim(p_area), now())
  on conflict (user_id) do update set verification_status = 'pending', vehicle_type = excluded.vehicle_type,
    driving_licence_number = excluded.driving_licence_number, operating_area = excluded.operating_area, applied_at = now();
end;
$$;
revoke all on function public.apply_as_courier(text, text, text, text) from public, anon;
grant execute on function public.apply_as_courier(text, text, text, text) to authenticated;

-- 2. First-administrator bootstrap.
-- The owner's phone number is inserted here once, directly in the database (never in the repository).
-- When an account with that phone is created AND no active administrator exists, it is made admin and the row
-- is consumed. Once any admin exists this does nothing, so it cannot be used to add administrators later.
create table public.admin_bootstrap (
  phone text primary key check (phone ~ '^[0-9]{8,15}$'),
  created_at timestamptz not null default now()
);
alter table public.admin_bootstrap enable row level security;
revoke all on public.admin_bootstrap from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'patient') on conflict do nothing;
  if new.phone is not null
     and exists (select 1 from public.admin_bootstrap b where b.phone = new.phone)
     and not exists (select 1 from public.user_roles r where r.role = 'admin' and r.revoked_at is null) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
    delete from public.admin_bootstrap where phone = new.phone;
    insert into public.audit_logs (actor_id, action, table_name, record_id, metadata)
    values (null, 'role.grant', 'user_roles', new.id::text, jsonb_build_object('role', 'admin', 'via', 'first-admin bootstrap'));
  end if;
  return new;
end;
$$;
