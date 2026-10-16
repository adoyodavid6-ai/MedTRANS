-- Journeys B and C (§22-B, §22-C) at the database level, plus §22-E access rules.
begin;
select plan(44);

select tests.create_user('dc-admin@example.test') as admin \gset
select tests.create_user('dc-near@example.test') as near_doc \gset
select tests.create_user('dc-far@example.test') as far_doc \gset
select tests.create_user('dc-unverified@example.test') as unverified_doc \gset
select tests.create_user('dc-patient@example.test') as patient \gset
select tests.create_user('dc-patient2@example.test') as patient2 \gset
select tests.make_admin(:'admin');
select tests.setup_doctorcare() as svc \gset

-- Patient at (36.82, -1.29); near doctor ~1 km away, far doctor ~6 km away (both within 10 km radius).
select tests.make_doctor(:'admin', :'near_doc', :'svc', 36.829, -1.29, 300000, '{en}');
select tests.make_doctor(:'admin', :'far_doc', :'svc', 36.87, -1.29, 250000, '{en,sw}');

-- Unverified doctor (self-registered only)
select tests.act_as(:'unverified_doc');
insert into public.provider_profiles (user_id, profession, display_name, regulator, registration_number, base_location, service_radius_m)
values (:'unverified_doc', 'doctor', 'Dr Unverified', 'KMPDC', 'X-1', 'SRID=4326;POINT(36.821 -1.29)', 10000);
insert into public.provider_services (provider_id, service_id, fee_minor) values (:'unverified_doc', :'svc', 100000);
select throws_ok(format($$update public.provider_profiles set verification_status = 'verified' where user_id = %L$$, :'unverified_doc'),
  '42501', null, 'providers cannot verify themselves');
select tests.reset_role();

select tests.act_as(:'patient');
insert into public.addresses (user_id, label, line1, area, location) values (:'patient', 'Home', '9 Private Close', 'Kilimani', 'SRID=4326;POINT(36.82 -1.29)');
select id as addr from public.addresses where user_id = :'patient' \gset
insert into public.addresses (user_id, label, line1, location) values (:'patient', 'Coast', 'Far away', 'SRID=4326;POINT(39.66 -4.04)');
select id as addr_far from public.addresses where label = 'Coast' and user_id = :'patient' \gset

-- ---- Matching (§22-C)
select tests.tomorrow_at('10:00') as slot \gset
select is((select array_agg(provider_id order by distance_m) from public.slot_providers(:'svc', :'addr', :'slot')),
  array[:'near_doc', :'far_doc']::uuid[], 'only verified doctors are candidates, nearest first');
select ok((select bool_and(distance_m % 100 = 0) from public.slot_providers(:'svc', :'addr', :'slot')), 'distances are rounded, never exact positions');
select is((select count(*)::int from public.slot_providers(:'svc', :'addr_far', :'slot')), 0, 'nobody is offered outside coverage and service radius');
select ok((select count(*) from public.available_slots(:'svc', :'addr', ((now() at time zone 'Africa/Nairobi')::date + 1))) > 0, 'tomorrow has bookable slots');
select is((select count(*)::int from public.available_slots(:'svc', :'addr', ((now() at time zone 'Africa/Nairobi')::date + 1))
           where (slot_start at time zone 'Africa/Nairobi')::time < '06:00' or (slot_start at time zone 'Africa/Nairobi')::time > '21:00'), 0,
  'no slots outside working hours');
select tests.reset_role();

select tests.act_as(:'far_doc');
insert into public.provider_time_off (provider_id, period) values (:'far_doc', tstzrange(tests.tomorrow_at('09:00'), tests.tomorrow_at('12:00')));
select tests.reset_role();
select tests.act_as(:'patient');
select is((select array_agg(provider_id) from public.slot_providers(:'svc', :'addr', :'slot')), array[:'near_doc']::uuid[], 'time off removes a doctor from that slot');
select is((select provider_id from public.slot_providers(:'svc', :'addr', tests.tomorrow_at('14:00'), 'sw') order by language_match desc, distance_m limit 1),
  :'far_doc'::uuid, 'language match is available as a preference');

-- ---- Screening (§8C step 5)
select tests.reset_role();
update public.care_screening_questions set clinically_reviewed_at = null where position = 2 and is_active;
select tests.act_as(:'patient');
select throws_like(format($$select * from public.create_booking(gen_random_uuid(), %L, %L, %L, %L, '{}')$$, :'svc', :'addr', :'slot', :'near_doc'),
  '%clinically reviewed%', 'no bookings until screening is clinically reviewed');
select tests.reset_role();
update public.care_screening_questions set clinically_reviewed_at = now(), clinically_reviewed_by = 'TEST' where is_active;
select id as q1 from public.care_screening_questions where is_active and position = 1 \gset
select id as q2 from public.care_screening_questions where is_active and position = 2 \gset
select tests.act_as(:'patient');
select throws_like(format($$select * from public.create_booking(gen_random_uuid(), %L, %L, %L, %L, %L)$$, :'svc', :'addr', :'slot', :'near_doc', json_build_object(:'q1', false)),
  '%every safety question%', 'every screening question must be answered');
select status::text as esc_status, booking_id as esc from public.create_booking(gen_random_uuid(), :'svc', :'addr', :'slot', :'near_doc',
  json_build_object(:'q1'::text, false, :'q2'::text, true)::jsonb) \gset
select is(:'esc_status'::text, 'escalated', 'a red flag stops the routine booking');
select is((select provider_id from public.care_bookings where id = :'esc'), null::uuid, 'an escalated request is never sent to a provider');
select is((select count(*)::int from public.booking_offers where booking_id = :'esc'), 0, 'and no offer is created');

-- ---- Booking and dispatch (§22-B)
select booking_id as bk from public.create_booking('44444444-4444-4444-4444-444444444444', :'svc', :'addr', :'slot', :'near_doc',
  json_build_object(:'q1'::text, false, :'q2'::text, false)::jsonb, 'Fever for two days', 'few_days') \gset
select is((select booking_id from public.create_booking('44444444-4444-4444-4444-444444444444', :'svc', :'addr', :'slot', :'near_doc',
  json_build_object(:'q1'::text, false, :'q2'::text, false)::jsonb)), :'bk'::uuid, 'submitting the same booking twice returns the same booking');
select is((select status::text from public.care_bookings where id = :'bk'), 'awaiting_acceptance', 'booking waits for the chosen doctor');
select tests.reset_role();

select tests.act_as(:'far_doc');
select is((select count(*)::int from public.care_bookings where id = :'bk'), 0, 'a doctor who was not offered the booking cannot see it');
select is((select count(*)::int from public.my_offers()), 0, 'and has no offer');
select tests.reset_role();
select tests.act_as(:'admin');
select is((select count(*)::int from public.care_bookings where id = :'bk'), 0, 'administrators cannot read clinical booking details');
select is((select status::text from public.admin_bookings() where booking_id = :'bk'), 'awaiting_acceptance', 'administrators get an operational view');
select tests.reset_role();

select tests.act_as(:'near_doc');
select is((select need_description from public.my_offers() where booking_id = :'bk'), 'Fever for two days', 'the offered doctor sees the need');
select is((select area from public.my_offers() where booking_id = :'bk'), 'Kilimani', 'the offered doctor sees the area, not the address');
select id as offer1 from public.booking_offers where booking_id = :'bk' and provider_id = :'near_doc' \gset
select is(public.respond_to_offer(:'offer1', false, 'Fully booked'), 'declined', 'doctor declines');
select tests.reset_role();
select is((select count(*)::int from public.booking_offers where booking_id = :'bk' and status = 'pending'), 0,
  'no other eligible doctor is free (far doctor is on leave), so nothing is offered');
select is((select status::text from public.care_bookings where id = :'bk'), 'no_provider_available', 'and the patient is told plainly');

-- New booking at 14:00: near doctor offered, offer expires, far doctor (cheaper) is next
select tests.act_as(:'patient');
select booking_id as bk2 from public.create_booking(gen_random_uuid(), :'svc', :'addr', tests.tomorrow_at('14:00'), :'near_doc',
  json_build_object(:'q1'::text, false, :'q2'::text, false)::jsonb, 'Wound check', 'few_days') \gset
select tests.reset_role();
update public.booking_offers set expires_at = now() - interval '1 second' where booking_id = :'bk2';
select ok(public.expire_booking_offers() >= 1, 'expired offers are processed');
select is((select provider_id from public.booking_offers where booking_id = :'bk2' and status = 'pending'), :'far_doc'::uuid, 'the next eligible doctor is offered');

select tests.act_as(:'far_doc');
select id as offer2 from public.booking_offers where booking_id = :'bk2' and status = 'pending' \gset
select is(public.respond_to_offer(:'offer2', true), 'accepted', 'far doctor accepts');
select tests.reset_role();
select is((select status::text from public.care_bookings where id = :'bk2'), 'awaiting_payment', 'accepted bookings await payment');
select is((select total_minor from public.care_bookings where id = :'bk2'), 250000 + 20000, 'total = the accepting doctor''s fee + booking fee');

-- No double-booking, even if something tries to force it
select tests.act_as(:'patient2');
insert into public.addresses (user_id, label, line1, location) values (:'patient2', 'Home', 'x', 'SRID=4326;POINT(36.83 -1.29)');
select tests.reset_role();
select throws_ok(format($$insert into public.care_bookings (patient_id, patient_name, service_id, provider_id, status, slot, screening, idempotency_key)
  values (%L, 'x', %L, %L, 'confirmed', tstzrange(tests.tomorrow_at('14:30'), tests.tomorrow_at('15:30')), '{}', gen_random_uuid())$$, :'patient2', :'svc', :'far_doc'),
  '23P01', null, 'the database refuses overlapping visits for one doctor');
select tests.act_as(:'patient2');
select is((select count(*)::int from public.slot_providers(:'svc', (select id from public.addresses where user_id = :'patient2'), tests.tomorrow_at('14:30'))
           where provider_id = :'far_doc'), 0, 'a booked doctor is not shown as available for an overlapping slot');
select tests.reset_role();

-- ---- Payment and visit lifecycle
select tests.act_as(:'patient');
select payment_id as pay from public.start_booking_payment(:'bk2', 'test', null, gen_random_uuid()) \gset
select tests.reset_role();
select tests.act_as_service();
select public.attach_payment_reference(:'pay', 'DC-REF-1');
select is(public.record_payment_result('test', 'dc-evt-1', 'h', 'DC-REF-1', true, 270000, 'R', null), 'succeeded', 'payment recorded');
select tests.reset_role();
select is((select status::text from public.care_bookings where id = :'bk2'), 'confirmed', 'payment confirms the booking');

select tests.act_as(:'far_doc');
select is((select address ->> 'line1' from public.my_visits() where booking_id = :'bk2'), '9 Private Close', 'the confirmed doctor gets the address to travel');
select throws_like(format($$select public.complete_visit(%L, 'x', 'y')$$, :'bk2'), '%in progress%', 'a visit cannot be completed before it starts');
select lives_ok(format($$select public.transition_booking(%L, 'en_route')$$, :'bk2'), 'en route');
select lives_ok(format($$select public.transition_booking(%L, 'arrived')$$, :'bk2'), 'arrived');
select lives_ok(format($$select public.transition_booking(%L, 'in_progress')$$, :'bk2'), 'in progress');
select lives_ok(format($$select public.complete_visit(%L, 'Wound review', 'Cleaned and dressed', null, '{"temp_c": 36.8}', 'Keep dry', 'Review in 3 days')$$, :'bk2'), 'visit documented and completed');
select throws_ok(format($$update public.clinical_visit_records set care_provided = 'changed' where booking_id = %L$$, :'bk2'), null, null, 'signed visit records cannot be edited');
select tests.reset_role();

select tests.act_as(:'patient');
select is((select care_provided from public.clinical_visit_records where booking_id = :'bk2'), 'Cleaned and dressed', 'the patient can read their visit summary');
select tests.reset_role();
select tests.act_as(:'near_doc');
select is((select count(*)::int from public.clinical_visit_records), 0, 'other doctors cannot read it');
select tests.reset_role();
select tests.act_as(:'admin');
select is((select count(*)::int from public.clinical_visit_records), 0, 'administrators cannot read it');
select tests.reset_role();

select is((select array_agg(status::text order by id) from public.booking_events where booking_id = :'bk2'),
  array['awaiting_acceptance','awaiting_payment','confirmed','en_route','arrived','in_progress','completed'], 'every step is on the timeline');

select * from finish();
rollback;
