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
