-- MedTRANS Phase 3 — DoctorCare & SmartCare workflows.

-- ---------------------------------------------------------------------------
-- Provider verification guard
-- ---------------------------------------------------------------------------

create or replace function public.guard_provider_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  admin boolean := public.is_admin();
begin
  if tg_op = 'UPDATE' and (new.registration_number is distinct from old.registration_number or new.regulator is distinct from old.regulator) then
    new.verification_status := 'pending';     -- a changed registration must be re-checked
  elsif not admin and tg_op = 'UPDATE' and new.verification_status is distinct from old.verification_status then
    raise exception 'only MedTRANS operations can change verification status' using errcode = '42501';
  end if;
  if not admin and tg_op = 'UPDATE' and new.check_method is distinct from old.check_method then
    raise exception 'only MedTRANS operations can record verification checks' using errcode = '42501';
  end if;

  if new.verification_status = 'verified' and (tg_op = 'INSERT' or old.verification_status is distinct from 'verified') then
    if not admin then raise exception 'only MedTRANS operations can verify providers' using errcode = '42501'; end if;
    new.verified_at := now();
    new.verified_by := (select auth.uid());
  elsif new.verification_status <> 'verified' then
    new.verified_at := null;
    new.verified_by := null;
    if new.verification_status in ('suspended', 'unverified') then new.accepts_bookings := false; end if;
  end if;
  return new;
end;
$$;
create trigger provider_profiles_guard before insert or update on public.provider_profiles
  for each row execute function public.guard_provider_profile();

-- Admin verifies (or suspends) a provider and grants/revokes the matching clinical role.
create or replace function public.admin_set_provider_status(p_provider uuid, p_status public.verification_status, p_check_method text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  prof public.provider_profession;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_status = 'verified' and coalesce(btrim(p_check_method), '') = '' then
    raise exception 'record how the registration was checked' using errcode = '22023';
  end if;
  update public.provider_profiles set verification_status = p_status, check_method = nullif(btrim(p_check_method), '')
   where user_id = p_provider returning profession into prof;
  if not found then raise exception 'unknown provider' using errcode = 'P0002'; end if;
  if p_status = 'verified' then
    perform public.admin_grant_role(p_provider, prof::text::public.app_role);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Eligibility and matching (§9B, §9C)
-- ---------------------------------------------------------------------------

-- Every gate must pass. Nothing here can be outranked by a score.
create or replace function public.provider_is_eligible(p_provider uuid, p_service uuid, p_location extensions.geography, p_slot tstzrange)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.provider_profiles pp
    join public.care_services cs on cs.id = p_service and cs.is_active and cs.required_profession = pp.profession
    join public.provider_services ps on ps.provider_id = pp.user_id and ps.service_id = cs.id
    join public.user_roles ur on ur.user_id = pp.user_id and ur.role::text = pp.profession::text and ur.revoked_at is null
    where pp.user_id = p_provider
      and pp.verification_status = 'verified'
      and pp.accepts_bookings
      and pp.base_location is not null and pp.service_radius_m is not null
      and extensions.st_dwithin(pp.base_location, p_location, pp.service_radius_m)
      -- the patient's location is inside an active area with DoctorCare switched on, in an active country
      and exists (
        select 1 from public.service_coverage_areas a
        join public.countries c on c.code = a.country_code and c.is_active
        join public.coverage_area_services s on s.area_id = a.id and s.module = 'doctorcare' and s.is_active
        where a.is_active and extensions.st_covers(a.boundary, p_location)
      )
      -- working hours cover the whole visit (Nairobi local time)
      and exists (
        select 1 from public.provider_weekly_hours h
        where h.provider_id = pp.user_id
          and h.weekday = extract(dow from (lower(p_slot) at time zone 'Africa/Nairobi'))::int
          and (lower(p_slot) at time zone 'Africa/Nairobi')::time >= h.start_time
          and (upper(p_slot) at time zone 'Africa/Nairobi')::time <= h.end_time
          and (lower(p_slot) at time zone 'Africa/Nairobi')::date = (upper(p_slot) at time zone 'Africa/Nairobi')::date
      )
      and not exists (select 1 from public.provider_time_off t where t.provider_id = pp.user_id and t.period && p_slot)
      -- genuinely free, including travel buffer either side
      and not exists (
        select 1 from public.care_bookings b
        where b.provider_id = pp.user_id
          and b.status in ('awaiting_payment', 'confirmed', 'en_route', 'arrived', 'in_progress')
          and b.slot && tstzrange(lower(p_slot) - make_interval(mins => pp.travel_buffer_minutes),
                                  upper(p_slot) + make_interval(mins => pp.travel_buffer_minutes))
      )
  );
$$;

-- Eligible providers for a slot, ranked by straight-line distance then language match.
-- Distance is approximate (rounded to 100 m) and labelled as straight-line: no routing service is connected.
create or replace function public.slot_candidates(
  p_service uuid, p_location extensions.geography, p_slot tstzrange,
  p_language text default null, p_max_fee int default null, p_exclude uuid[] default '{}'
)
returns table (provider_id uuid, display_name text, profession public.provider_profession, languages text[],
               years_experience int, fee_minor int, distance_m int, language_match boolean)
language sql stable security definer set search_path = '' as $$
  select pp.user_id, pp.display_name, pp.profession, pp.languages, pp.years_experience, ps.fee_minor,
         (round(extensions.st_distance(pp.base_location, p_location) / 100) * 100)::int,
         coalesce(p_language = any(pp.languages), false)
  from public.provider_profiles pp
  join public.provider_services ps on ps.provider_id = pp.user_id and ps.service_id = p_service
  where public.provider_is_eligible(pp.user_id, p_service, p_location, p_slot)
    and (p_max_fee is null or ps.fee_minor <= p_max_fee)
    and not (pp.user_id = any(p_exclude))
  order by extensions.st_distance(pp.base_location, p_location),
           coalesce(p_language = any(pp.languages), false) desc,
           pp.user_id;
$$;

-- Bookable start times on a day for a patient's saved, pinned address.
create or replace function public.available_slots(p_service uuid, p_address uuid, p_day date)
returns table (slot_start timestamptz, provider_count int, min_fee_minor int)
language plpgsql stable security definer set search_path = '' as $$
declare
  addr public.addresses;
  dur int;
begin
  select a.* into addr from public.addresses a where a.id = p_address and a.user_id = (select auth.uid());
  if not found or addr.location is null then return; end if;
  select duration_minutes into dur from public.care_services where id = p_service and is_active;
  if dur is null then return; end if;
  if p_day < (now() at time zone 'Africa/Nairobi')::date or p_day > (now() at time zone 'Africa/Nairobi')::date + 14 then return; end if;

  return query
  with starts as (
    -- 06:00 to 21:30 local time, every 30 minutes
    select (p_day::timestamp + make_interval(mins => 360 + 30 * n)) at time zone 'Africa/Nairobi' as s
    from generate_series(0, 31) n
  )
  select st.s, count(c.provider_id)::int, min(c.fee_minor)
  from starts st
  cross join lateral public.slot_candidates(p_service, addr.location, tstzrange(st.s, st.s + make_interval(mins => dur))) c
  where st.s >= now() + interval '60 minutes'   -- minimum notice for travel
  group by st.s
  order by st.s;
end;
$$;

-- Candidates for a specific slot, for the patient to choose from (no locations, distance only).
create or replace function public.slot_providers(p_service uuid, p_address uuid, p_start timestamptz, p_language text default null)
returns table (provider_id uuid, display_name text, profession public.provider_profession, languages text[],
               years_experience int, fee_minor int, distance_m int, language_match boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  addr public.addresses;
  dur int;
begin
  select a.* into addr from public.addresses a where a.id = p_address and a.user_id = (select auth.uid());
  if not found or addr.location is null then return; end if;
  select duration_minutes into dur from public.care_services where id = p_service and is_active;
  if dur is null then return; end if;
  return query select * from public.slot_candidates(p_service, addr.location, tstzrange(p_start, p_start + make_interval(mins => dur)), p_language);
end;
$$;

-- ---------------------------------------------------------------------------
-- Booking lifecycle
-- ---------------------------------------------------------------------------

create or replace function public.apply_booking_status(p_booking uuid, p_to public.booking_status, p_actor text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.care_bookings set status = p_to where id = p_booking;
  insert into public.booking_events (booking_id, status, actor_id, actor_kind, note)
  values (p_booking, p_to, (select auth.uid()), p_actor, nullif(btrim(p_note), ''));
end;
$$;

-- Offer the booking to the next eligible candidate, or record honestly that nobody is available.
create or replace function public.dispatch_next_offer(p_booking uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  b public.care_bookings;
  tried uuid[];
  cand record;
  timeout_min int;
  offer_id uuid;
begin
  select * into b from public.care_bookings where id = p_booking for update;
  if b.status <> 'awaiting_acceptance' then return null; end if;
  select coalesce(array_agg(provider_id), '{}') into tried from public.booking_offers where booking_id = b.id;
  select (value #>> '{}')::int into timeout_min from public.platform_settings where key = 'doctorcare.offer_timeout_minutes' and jsonb_typeof(value) = 'number';
  timeout_min := coalesce(timeout_min, 10);

  select * into cand from public.slot_candidates(b.service_id, b.location, b.slot, b.preferred_language, b.max_visit_fee_minor, tried) limit 1;
  if not found then
    perform public.apply_booking_status(b.id, 'no_provider_available', 'system',
      'No suitable professional accepted in time. You have not been charged.');
    return null;
  end if;
  insert into public.booking_offers (booking_id, provider_id, rank, distance_m, expires_at)
  values (b.id, cand.provider_id, coalesce(array_length(tried, 1), 0) + 1, cand.distance_m, now() + make_interval(mins => timeout_min))
  returning id into offer_id;
  return offer_id;
end;
$$;

-- Creates a booking. Screening runs here, on the server: any red flag stops a routine booking.
create or replace function public.create_booking(
  p_idempotency_key uuid,
  p_service uuid,
  p_address uuid,
  p_start timestamptz,
  p_provider uuid,                    -- the professional the patient chose (their fee is the ceiling)
  p_screening jsonb,                  -- { "<question id>": true|false, ... } for every active question
  p_need_description text default null,
  p_need_duration text default null,
  p_household_member uuid default null,
  p_language text default null
)
returns table (booking_id uuid, status public.booking_status)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  existing public.care_bookings;
  addr public.addresses;
  svc public.care_services;
  q record;
  red_flag boolean := false;
  unreviewed int;
  fee int;
  booking_fee int;
  name text;
  new_id uuid;
  slot tstzrange;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into existing from public.care_bookings where idempotency_key = p_idempotency_key and patient_id = uid;
  if found then return query select existing.id, existing.status; return; end if;

  select * into svc from public.care_services where id = p_service and is_active;
  if not found then raise exception 'this service is not available' using errcode = 'P0001'; end if;

  -- Screening must be clinically reviewed, and answered in full.
  select count(*) into unreviewed from public.care_screening_questions where is_active and clinically_reviewed_at is null;
  if unreviewed > 0 or not exists (select 1 from public.care_screening_questions where is_active) then
    raise exception 'home visits are not available yet: urgent-symptom screening has not been clinically reviewed' using errcode = 'P0001';
  end if;
  for q in select id, is_red_flag from public.care_screening_questions where is_active loop
    if coalesce(jsonb_typeof(p_screening -> q.id::text), 'missing') <> 'boolean' then
      raise exception 'answer every safety question' using errcode = '22023';
    end if;
    if q.is_red_flag and (p_screening ->> q.id::text)::boolean then red_flag := true; end if;
  end loop;

  if p_household_member is not null then
    select h.full_name into name from public.household_members h where h.id = p_household_member and h.owner_id = uid;
    if not found then raise exception 'unknown household member' using errcode = '42501'; end if;
  else
    select coalesce(nullif(btrim(p.full_name), ''), 'Patient') into name from public.profiles p where p.id = uid;
  end if;

  slot := tstzrange(p_start, p_start + make_interval(mins => svc.duration_minutes));

  if red_flag then
    -- Recorded for safety review; no provider, no fee. The patient is shown emergency guidance.
    insert into public.care_bookings (patient_id, household_member_id, patient_name, service_id, status, slot, screening, idempotency_key)
    values (uid, p_household_member, name, svc.id, 'escalated', slot, p_screening, p_idempotency_key)
    returning id into new_id;
    insert into public.booking_events (booking_id, status, actor_id, actor_kind, note)
    values (new_id, 'escalated', uid, 'system', 'Screening answers suggest an emergency. Routine booking stopped; emergency guidance shown.');
    return query select new_id, 'escalated'::public.booking_status;
    return;
  end if;

  select a.* into addr from public.addresses a where a.id = p_address and a.user_id = uid;
  if not found then raise exception 'choose one of your saved addresses' using errcode = 'P0001'; end if;
  if addr.location is null then raise exception 'this address needs a map pin' using errcode = 'P0001'; end if;
  if p_start < now() + interval '60 minutes' then raise exception 'choose a time at least an hour from now' using errcode = 'P0001'; end if;

  select ps.fee_minor into fee from public.provider_services ps where ps.provider_id = p_provider and ps.service_id = svc.id;
  if fee is null or not public.provider_is_eligible(p_provider, svc.id, addr.location, slot) then
    raise exception 'that professional is no longer available at this time; please choose again' using errcode = 'P0001';
  end if;
  select (value #>> '{}')::int into booking_fee from public.platform_settings where key = 'doctorcare.booking_fee_minor' and jsonb_typeof(value) = 'number';
  if booking_fee is null then
    raise exception 'home visits are not available yet: the booking fee has not been confirmed' using errcode = 'P0001';
  end if;

  insert into public.care_bookings (
    patient_id, household_member_id, patient_name, service_id, status, slot, address, location,
    need_description, need_duration, screening, preferred_language, max_visit_fee_minor, booking_fee_minor, idempotency_key
  ) values (
    uid, p_household_member, name, svc.id, 'awaiting_acceptance', slot,
    jsonb_build_object('label', addr.label, 'line1', addr.line1, 'area', addr.area, 'building_details', addr.building_details, 'landmark', addr.landmark),
    addr.location, nullif(btrim(p_need_description), ''), p_need_duration, p_screening, p_language, fee, booking_fee, p_idempotency_key
  ) returning id into new_id;

  insert into public.booking_events (booking_id, status, actor_id, actor_kind, note)
  values (new_id, 'awaiting_acceptance', uid, 'patient', 'Request sent. Waiting for the professional to accept.');

  insert into public.booking_offers (booking_id, provider_id, rank, distance_m, expires_at)
  select new_id, p_provider, 1, (round(extensions.st_distance(pp.base_location, addr.location) / 100) * 100)::int,
         now() + make_interval(mins => coalesce((select (value #>> '{}')::int from public.platform_settings where key = 'doctorcare.offer_timeout_minutes' and jsonb_typeof(value) = 'number'), 10))
  from public.provider_profiles pp where pp.user_id = p_provider;

  return query select new_id, 'awaiting_acceptance'::public.booking_status;
exception
  when unique_violation then
    select * into existing from public.care_bookings where idempotency_key = p_idempotency_key and patient_id = uid;
    if found then return query select existing.id, existing.status; return; end if;
    raise;
end;
$$;

-- What an offered clinician sees: enough to decide, nothing more. Approximate area, not the address.
create or replace function public.my_offers()
returns table (offer_id uuid, booking_id uuid, booking_number text, service_name text, slot_start timestamptz, slot_end timestamptz,
               area text, distance_m int, need_description text, need_duration text, patient_first_name text,
               fee_minor int, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.id, b.id, b.booking_number, cs.name, lower(b.slot), upper(b.slot),
         b.address ->> 'area', o.distance_m, b.need_description, b.need_duration,
         split_part(b.patient_name, ' ', 1), b.max_visit_fee_minor, o.expires_at
  from public.booking_offers o
  join public.care_bookings b on b.id = o.booking_id
  join public.care_services cs on cs.id = b.service_id
  where o.provider_id = (select auth.uid()) and o.status = 'pending' and o.expires_at > now() and b.status = 'awaiting_acceptance'
  order by lower(b.slot);
$$;

create or replace function public.respond_to_offer(p_offer uuid, p_accept boolean, p_reason text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  o public.booking_offers;
  b public.care_bookings;
  fee int;
begin
  select * into o from public.booking_offers where id = p_offer for update;
  if not found or o.provider_id <> (select auth.uid()) then raise exception 'not authorised' using errcode = '42501'; end if;
  if o.status <> 'pending' or o.expires_at <= now() then return 'expired'; end if;
  select * into b from public.care_bookings where id = o.booking_id for update;
  if b.status <> 'awaiting_acceptance' then return 'no_longer_needed'; end if;

  if not p_accept then
    update public.booking_offers set status = 'declined', responded_at = now(), decline_reason = left(p_reason, 300) where id = o.id;
    perform public.dispatch_next_offer(b.id);
    return 'declined';
  end if;

  if not public.provider_is_eligible(o.provider_id, b.service_id, b.location, b.slot) then
    update public.booking_offers set status = 'declined', responded_at = now(), decline_reason = 'No longer eligible or free at this time.' where id = o.id;
    perform public.dispatch_next_offer(b.id);
    return 'not_eligible';
  end if;
  select ps.fee_minor into fee from public.provider_services ps where ps.provider_id = o.provider_id and ps.service_id = b.service_id;
  if fee is null or fee > b.max_visit_fee_minor then
    update public.booking_offers set status = 'declined', responded_at = now(), decline_reason = 'Fee above what the patient agreed.' where id = o.id;
    perform public.dispatch_next_offer(b.id);
    return 'fee_mismatch';
  end if;

  update public.booking_offers set status = 'accepted', responded_at = now() where id = o.id;
  -- The exclusion constraint makes this fail if the clinician was double-booked concurrently.
  begin
    update public.care_bookings
       set provider_id = o.provider_id, visit_fee_minor = fee, total_minor = fee + booking_fee_minor
     where id = b.id;
  exception when exclusion_violation then
    update public.booking_offers set status = 'declined', decline_reason = 'Clashes with another visit.' where id = o.id;
    perform public.dispatch_next_offer(b.id);
    return 'clash';
  end;
  perform public.apply_booking_status(b.id, 'awaiting_payment', 'provider', 'Accepted. Pay to confirm the visit.');
  return 'accepted';
end;
$$;

-- Expired offers move to the next candidate. Unpaid accepted bookings release the slot after 30 minutes.
create or replace function public.expire_booking_offers()
returns int language plpgsql security definer set search_path = '' as $$
declare
  o record;
  n int := 0;
begin
  for o in select id, booking_id from public.booking_offers where status = 'pending' and expires_at <= now() for update skip locked loop
    update public.booking_offers set status = 'expired' where id = o.id;
    perform public.dispatch_next_offer(o.booking_id);
    n := n + 1;
  end loop;
  for o in
    select b.id from public.care_bookings b
    where b.status = 'awaiting_payment' and b.updated_at < now() - interval '30 minutes'
      and not exists (select 1 from public.payments p where p.booking_id = b.id and p.status in ('initiated', 'pending') and p.updated_at > now() - interval '10 minutes')
    for update skip locked
  loop
    update public.payments set status = 'cancelled', failure_reason = 'Booking expired before payment.' where booking_id = o.id and status in ('initiated', 'pending');
    perform public.apply_booking_status(o.id, 'cancelled', 'system', 'Not paid within 30 minutes. The time slot has been released.');
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.booking_actor_kinds(b public.care_bookings)
returns text[] language sql stable security definer set search_path = '' as $$
  select array_remove(array[
    case when b.patient_id = (select auth.uid()) then 'patient' end,
    case when b.provider_id = (select auth.uid()) then 'provider' end,
    case when public.is_admin() then 'admin' end
  ], null);
$$;

create or replace function public.transition_booking(p_booking uuid, p_to public.booking_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.care_bookings;
  allowed text[];
  acting text;
begin
  select * into b from public.care_bookings where id = p_booking for update;
  if not found then raise exception 'unknown booking' using errcode = 'P0002'; end if;

  allowed := case
    when b.status in ('awaiting_acceptance', 'awaiting_payment') and p_to = 'cancelled' then array['patient', 'admin']
    when b.status = 'confirmed' and p_to = 'en_route' then array['provider']
    when b.status = 'en_route' and p_to = 'arrived' then array['provider']
    when b.status = 'arrived' and p_to = 'in_progress' then array['provider']
    when b.status in ('arrived', 'en_route') and p_to = 'no_show' then array['provider', 'admin']
    when b.status in ('confirmed', 'en_route') and p_to = 'refund_processing' then array['patient', 'provider', 'admin']
    when b.status in ('confirmed', 'en_route', 'arrived', 'in_progress') and p_to = 'failed' then array['admin']
    when b.status = 'failed' and p_to = 'refund_processing' then array['admin']
    else array[]::text[]
  end;
  if cardinality(allowed) = 0 then
    raise exception 'a booking that is % cannot move to %', b.status, p_to using errcode = 'P0001';
  end if;
  select k into acting from unnest(allowed) k where k = any(public.booking_actor_kinds(b)) limit 1;
  if acting is null then raise exception 'you are not allowed to make this change' using errcode = '42501'; end if;
  if p_to in ('cancelled', 'refund_processing', 'no_show', 'failed') and coalesce(btrim(p_note), '') = '' then
    raise exception 'give a reason' using errcode = '22023';
  end if;
  if p_to = 'cancelled' then
    update public.booking_offers set status = 'withdrawn' where booking_id = b.id and status = 'pending';
    update public.payments set status = 'cancelled', failure_reason = 'Booking cancelled.' where booking_id = b.id and status in ('initiated', 'pending');
  end if;
  perform public.apply_booking_status(b.id, p_to, acting, p_note);
end;
$$;

-- The treating clinician signs the visit record, which completes the visit.
create or replace function public.complete_visit(
  p_booking uuid, p_presenting_concern text, p_care_provided text,
  p_observations text default null, p_vitals jsonb default '{}'::jsonb, p_advice text default null,
  p_follow_up text default null, p_referral text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.care_bookings;
  pp public.provider_profiles;
begin
  select * into b from public.care_bookings where id = p_booking for update;
  if not found or b.provider_id is distinct from (select auth.uid()) then raise exception 'not authorised' using errcode = '42501'; end if;
  if b.status <> 'in_progress' then raise exception 'the visit must be in progress to complete it' using errcode = 'P0001'; end if;
  select * into pp from public.provider_profiles where user_id = b.provider_id;
  insert into public.clinical_visit_records (booking_id, provider_id, presenting_concern, observations, vitals, care_provided, advice, follow_up, referral, signed_by_name, signed_registration)
  values (b.id, b.provider_id, p_presenting_concern, nullif(btrim(p_observations), ''), coalesce(p_vitals, '{}'::jsonb), p_care_provided,
          nullif(btrim(p_advice), ''), nullif(btrim(p_follow_up), ''), nullif(btrim(p_referral), ''), pp.display_name, pp.regulator || ' ' || pp.registration_number);
  perform public.apply_booking_status(b.id, 'completed', 'provider', 'Visit completed and documented.');
end;
$$;

-- Assigned clinician: address and contact only once the visit is confirmed (needed to travel).
create or replace function public.my_visits()
returns table (booking_id uuid, booking_number text, status public.booking_status, service_name text, slot_start timestamptz, slot_end timestamptz,
               patient_name text, patient_phone text, address jsonb, lat double precision, lng double precision,
               need_description text, need_duration text, visit_fee_minor int, has_record boolean)
language sql stable security definer set search_path = '' as $$
  select b.id, b.booking_number, b.status, cs.name, lower(b.slot), upper(b.slot), b.patient_name,
         case when b.status in ('confirmed', 'en_route', 'arrived', 'in_progress') then '+' || ltrim(u.phone, '+') end,
         case when b.status in ('confirmed', 'en_route', 'arrived', 'in_progress', 'completed') then b.address end,
         case when b.status in ('confirmed', 'en_route', 'arrived', 'in_progress') then extensions.st_y(b.location::extensions.geometry) end,
         case when b.status in ('confirmed', 'en_route', 'arrived', 'in_progress') then extensions.st_x(b.location::extensions.geometry) end,
         b.need_description, b.need_duration, b.visit_fee_minor,
         exists (select 1 from public.clinical_visit_records r where r.booking_id = b.id)
  from public.care_bookings b
  join public.care_services cs on cs.id = b.service_id
  join auth.users u on u.id = b.patient_id
  where b.provider_id = (select auth.uid())
  order by lower(b.slot) desc
  limit 200;
$$;

-- Operational view for administrators: no visit description, screening answers or records.
create or replace function public.admin_bookings(p_status public.booking_status default null)
returns table (booking_id uuid, booking_number text, status public.booking_status, service_name text, slot_start timestamptz,
               provider_name text, area text, total_minor int, currency char(3), created_at timestamptz, offers int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  return query
  select b.id, b.booking_number, b.status, cs.name, lower(b.slot), pp.display_name, b.address ->> 'area', b.total_minor, b.currency, b.created_at,
         (select count(*)::int from public.booking_offers o where o.booking_id = b.id)
  from public.care_bookings b
  join public.care_services cs on cs.id = b.service_id
  left join public.provider_profiles pp on pp.user_id = b.provider_id
  where p_status is null or b.status = p_status
  order by b.created_at desc limit 200;
end;
$$;

-- Public directory: verified, active professionals. No locations, no contact details.
create or replace function public.provider_directory()
returns table (provider_id uuid, display_name text, profession public.provider_profession, bio text, languages text[],
               years_experience int, regulator text, registration_number text, verified_at timestamptz,
               accepts_bookings boolean, services jsonb)
language sql stable security definer set search_path = '' as $$
  select pp.user_id, pp.display_name, pp.profession, pp.bio, pp.languages, pp.years_experience,
         pp.regulator, pp.registration_number, pp.verified_at, pp.accepts_bookings,
         coalesce((select jsonb_agg(jsonb_build_object('slug', cs.slug, 'name', cs.name, 'fee_minor', ps.fee_minor) order by cs.name)
                   from public.provider_services ps join public.care_services cs on cs.id = ps.service_id and cs.is_active
                   where ps.provider_id = pp.user_id), '[]'::jsonb)
  from public.provider_profiles pp
  join public.user_roles ur on ur.user_id = pp.user_id and ur.role::text = pp.profession::text and ur.revoked_at is null
  where pp.verification_status = 'verified'
  order by pp.display_name;
$$;

-- Payments for bookings
create or replace function public.start_booking_payment(p_booking uuid, p_provider text, p_phone text, p_idempotency_key uuid)
returns table (payment_id uuid, amount_minor int, currency char(3), status public.payment_status)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  b public.care_bookings;
  p public.payments;
begin
  select * into b from public.care_bookings where id = p_booking and patient_id = (select auth.uid()) for update;
  if not found then raise exception 'unknown booking' using errcode = 'P0002'; end if;
  select * into p from public.payments where idempotency_key = p_idempotency_key and booking_id = b.id;
  if found then return query select p.id, p.amount_minor, p.currency, p.status; return; end if;
  if b.status <> 'awaiting_payment' then raise exception 'this booking is not waiting for payment' using errcode = 'P0001'; end if;
  update public.payments set status = 'failed', failure_reason = 'No confirmation received in time.'
   where booking_id = b.id and status in ('initiated', 'pending') and created_at < now() - interval '3 minutes';
  if exists (select 1 from public.payments where booking_id = b.id and status in ('initiated', 'pending')) then
    raise exception 'a payment request is already waiting for your confirmation' using errcode = 'P0001';
  end if;
  insert into public.payments (booking_id, provider, amount_minor, currency, payer_phone, idempotency_key)
  values (b.id, p_provider, b.total_minor, b.currency, nullif(p_phone, ''), p_idempotency_key) returning * into p;
  return query select p.id, p.amount_minor, p.currency, p.status;
end;
$$;

-- record_payment_result now settles orders OR bookings.
create or replace function public.record_payment_result(
  p_provider text, p_event_key text, p_payload_sha256 text, p_reference text,
  p_success boolean, p_amount_minor int, p_receipt text, p_reason text
)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  p public.payments;
  o public.orders;
  b public.care_bookings;
  result text;
begin
  begin
    insert into public.payment_webhook_events (provider, event_key, payload_sha256, outcome)
    values (p_provider, p_event_key, p_payload_sha256, 'processing');
  exception when unique_violation then
    return 'duplicate';
  end;

  select * into p from public.payments where provider = p_provider and provider_reference = p_reference for update;
  if not found then
    result := 'unknown_payment';
  elsif p.status = 'succeeded' then
    result := 'already_succeeded';
  elsif not p_success then
    update public.payments set status = 'failed', failure_reason = left(coalesce(p_reason, 'Payment was not completed.'), 300) where id = p.id;
    result := 'failed';
  elsif p_amount_minor is distinct from p.amount_minor then
    update public.payments set status = 'failed', failure_reason = 'Amount did not match the total; flagged for review.' where id = p.id;
    result := 'amount_mismatch';
  else
    update public.payments set status = 'succeeded', provider_receipt = p_receipt, failure_reason = null where id = p.id;
    if p.order_id is not null then
      select * into o from public.orders where id = p.order_id for update;
      if o.status = 'pending_payment' then
        perform public.apply_order_status(o.id, 'awaiting_pharmacy_acceptance', 'payment_provider', 'Payment confirmed by the provider.');
        result := 'succeeded';
      else
        perform public.apply_order_status(o.id, 'refund_processing', 'system',
          'Payment arrived after the order was ' || replace(o.status::text, '_', ' ') || '. A refund is being arranged.');
        result := 'succeeded_late_refund';
      end if;
    else
      select * into b from public.care_bookings where id = p.booking_id for update;
      if b.status = 'awaiting_payment' then
        perform public.apply_booking_status(b.id, 'confirmed', 'payment_provider', 'Payment confirmed. Your visit is booked.');
        result := 'succeeded';
      else
        perform public.apply_booking_status(b.id, 'refund_processing', 'system',
          'Payment arrived after the booking was ' || replace(b.status::text, '_', ' ') || '. A refund is being arranged.');
        result := 'succeeded_late_refund';
      end if;
    end if;
  end if;

  update public.payment_webhook_events w set outcome = result where w.provider = p_provider and w.event_key = p_event_key;
  return result;
end;
$$;

create or replace function public.record_booking_refund(p_booking uuid, p_reference text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.care_bookings;
  p public.payments;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into b from public.care_bookings where id = p_booking for update;
  if not found or b.status <> 'refund_processing' then raise exception 'this booking is not awaiting a refund' using errcode = 'P0001'; end if;
  select * into p from public.payments where booking_id = b.id and status = 'succeeded';
  if not found then raise exception 'no successful payment to refund' using errcode = 'P0001'; end if;
  if coalesce(btrim(p_reference), '') = '' then raise exception 'record the provider refund reference' using errcode = '22023'; end if;
  insert into public.refunds (booking_id, payment_id, amount_minor, provider_reference, recorded_by)
  values (b.id, p.id, p.amount_minor, btrim(p_reference), (select auth.uid()));
  perform public.apply_booking_status(b.id, 'refunded', 'admin', 'Refund reference ' || btrim(p_reference));
end;
$$;

select cron.schedule('medtrans-expire-booking-offers', '* * * * *', $$select public.expire_booking_offers()$$);

-- Grants
revoke all on function public.guard_provider_profile(), public.apply_booking_status(uuid, public.booking_status, text, text),
  public.dispatch_next_offer(uuid), public.expire_booking_offers(), public.booking_actor_kinds(public.care_bookings),
  public.slot_candidates(uuid, extensions.geography, tstzrange, text, int, uuid[]),
  public.provider_is_eligible(uuid, uuid, extensions.geography, tstzrange)
from public, anon, authenticated;
revoke all on function public.record_payment_result(text, text, text, text, boolean, int, text, text) from public, anon, authenticated;
grant execute on function public.record_payment_result(text, text, text, text, boolean, int, text, text) to service_role;
grant execute on function public.expire_booking_offers() to service_role;

grant execute on function public.admin_set_provider_status(uuid, public.verification_status, text) to authenticated;
grant execute on function public.available_slots(uuid, uuid, date) to authenticated;
grant execute on function public.slot_providers(uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.create_booking(uuid, uuid, uuid, timestamptz, uuid, jsonb, text, text, uuid, text) to authenticated;
grant execute on function public.my_offers() to authenticated;
grant execute on function public.respond_to_offer(uuid, boolean, text) to authenticated;
grant execute on function public.transition_booking(uuid, public.booking_status, text) to authenticated;
grant execute on function public.complete_visit(uuid, text, text, text, jsonb, text, text, text) to authenticated;
grant execute on function public.my_visits() to authenticated;
grant execute on function public.admin_bookings(public.booking_status) to authenticated;
grant execute on function public.provider_directory() to anon, authenticated;
grant execute on function public.start_booking_payment(uuid, text, text, uuid) to authenticated;
grant execute on function public.record_booking_refund(uuid, text) to authenticated;
