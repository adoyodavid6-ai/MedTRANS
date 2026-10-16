begin;
select plan(11);

select tests.create_user('ops-admin@example.test') as admin \gset
select tests.create_user('ops-other-admin@example.test') as admin2 \gset
select tests.create_user('ops-patient@example.test') as patient \gset
select tests.make_admin(:'admin');
select tests.make_admin(:'admin2');

select tests.act_as(:'patient');
select throws_ok($$select public.admin_overview()$$, '42501', null, 'patients cannot read the operations overview');
select throws_ok($$select * from public.admin_list_areas()$$, '42501', null, 'patients cannot list coverage areas');
select tests.reset_role();

select tests.act_as(:'admin');
select is((public.admin_overview() ->> 'areas_total')::int, (select count(*)::int from public.service_coverage_areas), 'overview counts come from the database');

-- Boundaries
select throws_ok(
  format($$select public.admin_set_area_boundary(%L, 'not json')$$, (select id from public.service_coverage_areas where slug = 'nairobi-pilot')),
  '22023', 'boundary is not valid GeoJSON', 'invalid GeoJSON is rejected');
select throws_ok(
  format($$select public.admin_set_area_boundary(%L, '{"type":"Point","coordinates":[36.8,-1.3]}')$$, (select id from public.service_coverage_areas where slug = 'nairobi-pilot')),
  '22023', 'boundary must be a Polygon or MultiPolygon', 'non-polygon boundaries are rejected');
select lives_ok(
  format($$select public.admin_set_area_boundary(%L, '{"type":"Polygon","coordinates":[[[36.7,-1.4],[36.95,-1.4],[36.95,-1.15],[36.7,-1.15],[36.7,-1.4]]]}')$$,
         (select id from public.service_coverage_areas where slug = 'nairobi-pilot')),
  'a valid polygon boundary is accepted');
select isnt((select boundary_geojson from public.admin_list_areas() where slug = 'nairobi-pilot'), null, 'boundary is stored');

-- Verifier stamping: a client cannot claim someone else verified a number
insert into public.emergency_contacts (country_code, label, phone_number, source, verified_at, verified_by, is_active)
values ('KE', 'Synthetic test line', '000', 'test source', '2000-01-01', :'admin2', true);
select is((select verified_by from public.emergency_contacts where label = 'Synthetic test line'), :'admin'::uuid,
          'verified_by is always the acting user');
select ok((select verified_at > now() - interval '1 minute' from public.emergency_contacts where label = 'Synthetic test line'),
          'verified_at is the actual verification time, not a client value');

update public.emergency_contacts set phone_number = '0000' where label = 'Synthetic test line';
select is((select is_active from public.emergency_contacts where label = 'Synthetic test line'), false,
          'changing a number unpublishes it');
select is((select verified_at from public.emergency_contacts where label = 'Synthetic test line'), null,
          'changing a number clears its verification');
select tests.reset_role();

select * from finish();
rollback;
