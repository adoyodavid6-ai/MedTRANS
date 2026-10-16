-- Shared helpers for pgTAP tests. Loaded before each test file by scripts/test-db.sh.
-- All test data is synthetic and every test file runs inside a transaction that is rolled back.

create schema if not exists tests;

create or replace function tests.create_user(email text)
returns uuid language plpgsql as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, now(), now());
  return uid;
end $$;

-- Act as a signed-in user (as PostgREST would after verifying their JWT).
create or replace function tests.act_as(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function tests.act_as_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;

create or replace function tests.reset_role()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- Make a user an admin without going through admin_grant_role (bootstrap path).
create or replace function tests.make_admin(uid uuid)
returns void language sql as $$
  insert into public.user_roles (user_id, role) values (uid, 'admin');
$$;

grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

create or replace function tests.act_as_service()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
end $$;

-- Builds a fully eligible synthetic pharmacy (all honesty gates satisfied). Returns its id.
-- Must be called while acting as an admin, so verification stamps record a real verifier.
create or replace function tests.setup_pharmacy(admin_id uuid, pharmacist_id uuid, p_slug text default 'test-pharmacy')
returns uuid language plpgsql as $$
declare
  area uuid;
  ph uuid;
begin
  perform tests.reset_role();
  update public.countries set is_active = true, regulatory_review_ref = 'TEST', regulatory_reviewed_at = now() where code = 'KE';
  select a.id into area from public.service_coverage_areas a where a.slug = 'test-area';
  if area is null then
    insert into public.service_coverage_areas (country_code, name, slug, boundary, is_active)
    values ('KE', 'Test area', 'test-area',
            'SRID=4326;MULTIPOLYGON(((36.7 -1.4,36.95 -1.4,36.95 -1.15,36.7 -1.15,36.7 -1.4)))', true)
    returning id into area;
    insert into public.coverage_area_services (area_id, module, is_active, activated_at) values (area, 'pharmacy', true, now());
  end if;
  update public.platform_settings set value = '5000' where key = 'pharmacy.service_fee_minor';
  if not found then
    insert into public.platform_settings (key, value, is_public) values ('pharmacy.service_fee_minor', '5000', true);
  end if;

  perform tests.act_as(admin_id);
  insert into public.pharmacies (name, slug, country_code, area_id, address_line, location, verification_status,
                                 is_listed, delivery_radius_m, delivery_fee_minor)
  values ('Test Pharmacy ' || p_slug, p_slug, 'KE', area, '1 Test Road', 'SRID=4326;POINT(36.82 -1.28)', 'verified',
          true, 10000, 15000)
  returning id into ph;
  update public.pharmacies set is_accepting_orders = true where id = ph;
  insert into public.pharmacy_licences (pharmacy_id, licence_number, valid_until, status, check_method)
  values (ph, 'TEST-LIC-' || p_slug, current_date + 365, 'verified', 'synthetic test');
  insert into public.pharmacy_staff (pharmacy_id, user_id, staff_role, registration_number, registration_status)
  values (ph, pharmacist_id, 'pharmacist', 'TEST-REG', 'verified');
  perform tests.reset_role();
  insert into public.user_roles (user_id, role) values (pharmacist_id, 'pharmacist') on conflict do nothing;
  return ph;
end $$;

create or replace function tests.add_product(p_slug text, rx boolean, ph uuid, price int, qty int)
returns uuid language plpgsql as $$
declare pid uuid;
begin
  insert into public.medicine_products (slug, name, generic_name, strength, dosage_form, pack_size, requires_prescription, vat_rate_bps, is_active)
  values (p_slug, 'Test ' || p_slug, 'testgeneric ' || p_slug, '500 mg', 'Tablet', 'Pack of 10', rx, 0, true) returning id into pid;
  insert into public.inventory_items (pharmacy_id, product_id, price_minor, quantity_available) values (ph, pid, price, qty);
  return pid;
end $$;

grant execute on all functions in schema tests to anon, authenticated, service_role;
grant usage on schema tests to service_role;

-- DoctorCare fixtures: active area with DoctorCare on, a reviewed screening set, fees, one service.
create or replace function tests.setup_doctorcare()
returns uuid language plpgsql as $$
declare
  area uuid;
  svc uuid;
begin
  perform tests.reset_role();
  update public.countries set is_active = true, regulatory_review_ref = 'TEST', regulatory_reviewed_at = now() where code = 'KE';
  select a.id into area from public.service_coverage_areas a where a.slug = 'test-area';
  if area is null then
    insert into public.service_coverage_areas (country_code, name, slug, boundary, is_active)
    values ('KE', 'Test area', 'test-area', 'SRID=4326;MULTIPOLYGON(((36.7 -1.4,36.95 -1.4,36.95 -1.15,36.7 -1.15,36.7 -1.4)))', true)
    returning id into area;
  end if;
  insert into public.coverage_area_services (area_id, module, is_active, activated_at) values (area, 'doctorcare', true, now())
  on conflict (area_id, module) do update set is_active = true, activated_at = now();
  delete from public.platform_settings where key in ('doctorcare.booking_fee_minor', 'doctorcare.offer_timeout_minutes');
  insert into public.platform_settings (key, value, is_public) values ('doctorcare.booking_fee_minor', '20000', true), ('doctorcare.offer_timeout_minutes', '10', true);
  update public.care_screening_questions set is_active = false;
  insert into public.care_screening_questions (position, question, is_red_flag, clinically_reviewed_by, clinically_reviewed_at)
  values (1, 'Is the person struggling to breathe?', true, 'TEST reviewer', now()), (2, 'Do they have chest pain?', true, 'TEST reviewer', now());
  insert into public.care_services (slug, name, summary, required_profession, duration_minutes, is_active)
  values ('test-gp-visit', 'Test GP visit', 'A synthetic GP home visit for tests.', 'doctor', 60, true) returning id into svc;
  return svc;
end $$;

-- A verified doctor at a location, working every day 06:00-22:00, offering the service at a fee.
create or replace function tests.make_doctor(admin_id uuid, uid uuid, svc uuid, lng float, lat float, fee int, langs text[] default '{en}')
returns void language plpgsql as $$
begin
  perform tests.act_as(uid);
  insert into public.provider_profiles (user_id, profession, display_name, regulator, registration_number, languages, base_location, service_radius_m, travel_buffer_minutes)
  values (uid, 'doctor', 'Dr ' || left(uid::text, 4), 'KMPDC', 'TEST-' || left(uid::text, 6), langs,
          extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography, 10000, 30);
  insert into public.provider_services (provider_id, service_id, fee_minor) values (uid, svc, fee);
  insert into public.provider_weekly_hours (provider_id, weekday, start_time, end_time) select uid, d, '06:00', '22:00' from generate_series(0, 6) d;
  perform tests.reset_role();
  perform tests.act_as(admin_id);
  perform public.admin_set_provider_status(uid, 'verified', 'synthetic test check');
  perform tests.reset_role();
  perform tests.act_as(uid);
  update public.provider_profiles set accepts_bookings = true where user_id = uid;
  perform tests.reset_role();
end $$;

create or replace function tests.tomorrow_at(hhmm text)
returns timestamptz language sql as $$
  select (((now() at time zone 'Africa/Nairobi')::date + 1) + hhmm::time) at time zone 'Africa/Nairobi';
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;
