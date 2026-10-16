begin;
select plan(13);

select tests.create_user('admin2@example.test') as admin \gset
select tests.make_admin(:'admin');

-- Anonymous visitors
select tests.act_as_anon();
select is((select count(*)::int from public.countries), 0, 'no country is active by default');
select is((select count(*)::int from public.service_coverage_areas), 0, 'no coverage area is active by default');
select is((select count(*)::int from public.emergency_contacts), 0, 'no unverified emergency contact is visible');
select is((select count(*)::int from public.check_coverage(-1.286, 36.817)), 0,
          'coverage check reports no coverage when nothing is active');
select is((select count(*)::int from public.platform_settings where key = 'announcement'), 1, 'public settings are readable');
select throws_ok($$select * from public.profiles$$, '42501', null, 'anonymous visitors cannot read profiles');
select tests.reset_role();

-- Honesty constraints: nothing goes live without the facts behind it
select throws_ok($$update public.service_coverage_areas set is_active = true where slug = 'nairobi-pilot'$$,
                 '23514', null, 'a coverage area cannot be activated without a boundary');
select throws_ok($$update public.countries set is_active = true where code = 'KE'$$,
                 '23514', null, 'a country cannot be activated without a recorded regulatory review');
select throws_ok($$insert into public.emergency_contacts (country_code, label, phone_number, is_active)
                   values ('KE', 'Test', '000', true)$$,
                 '23514', null, 'an emergency number cannot be published without verification and a source');

-- Once properly configured, coverage resolves (synthetic square, not a real boundary)
select tests.act_as(:'admin');
update public.countries set is_active = true, regulatory_review_ref = 'TEST-REF', regulatory_reviewed_at = now() where code = 'KE';
update public.service_coverage_areas
   set boundary = 'SRID=4326;MULTIPOLYGON(((36.7 -1.4,36.95 -1.4,36.95 -1.15,36.7 -1.15,36.7 -1.4)))'::extensions.geography,
       is_active = true
 where slug = 'nairobi-pilot';
select tests.reset_role();

select tests.act_as_anon();
select is((select area_name from public.check_coverage(-1.286, 36.817)), 'Nairobi (pilot)', 'point inside an active area is covered');
select is((select active_modules from public.check_coverage(-1.286, 36.817)), '{}'::public.service_module[],
          'coverage reports no active services until each is switched on');
select is((select count(*)::int from public.check_coverage(-4.04, 39.67)), 0, 'point outside every active area is not covered');
select tests.reset_role();

-- Non-admins cannot change configuration
select tests.create_user('dave@example.test') as dave \gset
select tests.act_as(:'dave');
update public.platform_settings set value = '{"enabled":true,"message":"hacked"}' where key = 'announcement';
select tests.reset_role();
select is((select value ->> 'message' from public.platform_settings where key = 'announcement'), null,
          'non-admins cannot change platform settings');

select * from finish();
rollback;
