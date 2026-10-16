begin;
select plan(17);

select tests.create_user('dr-admin@example.test') as admin \gset
select tests.create_user('dr-admin2@example.test') as admin2 \gset
select tests.create_user('dr-patient@example.test') as patient \gset
select tests.create_user('dr-other@example.test') as other \gset
select tests.create_user('dr-pharm@example.test') as pharm \gset
select tests.make_admin(:'admin');
select tests.make_admin(:'admin2');
select tests.setup_pharmacy(:'admin', :'pharm', 'dr-ph') as ph \gset

update public.profiles set full_name = 'Synthetic Person' where id = :'patient';
insert into public.addresses (user_id, label, line1, location)
values (:'patient', 'Home', '1 Synthetic Road', 'SRID=4326;POINT(36.8 -1.3)');
insert into public.orders (patient_id, pharmacy_id, currency, subtotal_minor, delivery_fee_minor, service_fee_minor, tax_minor, total_minor,
  delivery_address, delivery_location, recipient_name, idempotency_key, handover_code, status)
values (:'patient', :'ph', 'KES', 1000, 0, 0, 0, 1000, '{}', 'SRID=4326;POINT(36.8 -1.3)', 'P', gen_random_uuid(), '1234', 'out_for_delivery')
returning id as ord \gset

-- Export
select tests.act_as_anon();
select throws_ok($$select public.record_data_export()$$, '42501', null, 'export needs a signed-in account');
select tests.reset_role();
select tests.act_as(:'patient');
select ok(public.record_data_export() is not null, 'a patient can record an export of their own data');
select is((select count(*)::int from public.data_subject_requests where kind = 'export'), 1, 'and sees only their own requests');
select tests.reset_role();

-- Erasure request
select tests.act_as(:'patient');
select ok(public.request_erasure('Moving away') is not null, 'a patient can ask for deletion');
select throws_like($$select public.request_erasure(null)$$, '%already have your deletion request%', 'only one open deletion request at a time');
select id as req from public.data_subject_requests where kind = 'erasure' \gset
select throws_ok(format($$select public.admin_complete_erasure(%L, 'x')$$, :'req'), '42501', null, 'patients cannot complete erasure');
select tests.reset_role();
select tests.act_as(:'other');
select is((select count(*)::int from public.data_subject_requests), 0, 'other people cannot see the request');
select tests.reset_role();

-- Admin
select tests.act_as(:'admin');
select is((public.admin_erasure_preview(:'req') -> 'retain' ->> 'orders')::int, 1, 'the preview lists retained records');
select throws_like(format($$select public.admin_complete_erasure(%L, 'done')$$, :'req'), '%open orders%', 'erasure waits for open orders to finish');
select tests.reset_role();
update public.orders set status = 'delivered' where id = :'ord';
select tests.act_as(:'admin');
select throws_like(format($$select public.admin_complete_erasure(%L, '  ')$$, :'req'), '%record what was removed%', 'the outcome must be recorded');
select lives_ok(format($$select public.admin_complete_erasure(%L, 'Removed address book and profile name; order kept for the legal retention period.')$$, :'req'), 'admin completes erasure');
select tests.reset_role();

select is((select count(*)::int from public.addresses where user_id = :'patient'), 0, 'addresses are removed');
select is((select full_name from public.profiles where id = :'patient'), null, 'the profile name is removed');
select is((select count(*)::int from public.orders where patient_id = :'patient'), 1, 'dispensing records are retained');
select is((select status from public.data_subject_requests where id = :'req'), 'completed', 'the request is closed');
select ok(exists (select 1 from public.audit_logs where table_name = 'data_subject_requests' and record_id = :'req'), 'request handling is audited');

-- An administrator cannot complete their own erasure
select tests.act_as(:'admin2');
select public.request_erasure(null) as own \gset
select throws_like(format($$select public.admin_complete_erasure(%L, 'self')$$, :'own'), '%another administrator%', 'admins cannot erase themselves');
select tests.reset_role();

select * from finish();
rollback;
