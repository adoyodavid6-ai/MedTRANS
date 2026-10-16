begin;
select plan(34);

select tests.create_user('ss-admin@example.test') as admin \gset
select tests.create_user('ss-responder@example.test') as responder \gset
select tests.create_user('ss-support@example.test') as support \gset
select tests.create_user('ss-patient@example.test') as patient \gset
select tests.create_user('ss-other@example.test') as other \gset
select tests.make_admin(:'admin');
update public.user_roles set revoked_at = now() where role = 'emergency_responder';
update public.platform_settings set value = '{"staffed": false}' where key = 'emergency.operation';
insert into public.user_roles (user_id, role) values (:'support', 'support');

-- ---- Emergency operation gate
select tests.act_as_anon();
select throws_like($$select * from public.submit_emergency_request('+254700000123')$$, '%not staffed%',
  'no assistance requests are accepted while no staffed operation exists');
select tests.reset_role();
select tests.act_as(:'admin');
select throws_like($$select public.admin_set_emergency_operation(true, '24/7', 'Dr Supervisor')$$, '%responder%',
  'the operation cannot be switched on without a trained responder');
select public.admin_grant_role(:'responder', 'emergency_responder');
select throws_like($$select public.admin_set_emergency_operation(true, '', '')$$, '%supervisor%', 'staffed hours and a named supervisor are required');
select lives_ok($$select public.admin_set_emergency_operation(true, '24/7 (test)', 'Test Supervisor')$$, 'admin records a staffed operation');
select tests.reset_role();

-- ---- Requests
select tests.act_as_anon();
select reference as ref, public_token as tok, merged from public.submit_emergency_request('+254700000123', 'Caller', 'Fell down stairs', 'yes', 'yes', true, -1.29, 36.82) \gset
select is(:'merged'::boolean, false, 'an anonymous caller can request assistance');
select is((select merged from public.submit_emergency_request('+254700000123', null, 'Now bleeding')), true, 'a repeat submission is merged, not rejected');
select is((public.emergency_request_status(:'tok') ->> 'status'), 'received', 'the requester sees "received", nothing more');
select throws_ok($$select * from public.emergency_requests$$, '42501', null, 'anonymous visitors cannot list requests');
select is(public.emergency_request_status('not-a-token'), null, 'a wrong token reveals nothing');
select tests.reset_role();

select tests.act_as(:'patient');
select is((select count(*)::int from public.emergency_requests), 0, 'patients cannot see assistance requests');
select tests.reset_role();
select tests.act_as(:'responder');
select is((select repeat_count from public.emergency_requests where reference = :'ref'), 1, 'responders see the merged request');
select id as er from public.emergency_requests where reference = :'ref' \gset
select lives_ok(format($$select public.responder_update_emergency(%L, 'acknowledged', 'life_threatening')$$, :'er'), 'responder acknowledges and triages');
select throws_like(format($$select public.responder_update_emergency(%L, 'referred_externally')$$, :'er'), '%record what happened%', 'closing steps need a note');
select lives_ok(format($$select public.responder_log_call(%L, 'answered', 'Spoke to caller')$$, :'er'), 'call attempts are logged');
select tests.reset_role();
select isnt((select acknowledged_at from public.emergency_requests where id = :'er'), null, 'acknowledgement time is recorded');
select is((public.emergency_request_status(:'tok') ->> 'status'), 'acknowledged', 'the requester sees it was acknowledged');
select is((select count(*)::int from jsonb_array_elements(public.emergency_request_status(:'tok') -> 'events') e where e ->> 'status' = 'dispatched'), 0,
  'no "dispatched" state exists to show');
select tests.reset_role();

-- ---- Support
select tests.act_as_anon();
select ticket_id as t1, access_token as t1tok from public.create_ticket('delivery', 'Late delivery', 'My order is late', 'Guest', 'guest@example.test') \gset
select tests.reset_role();
select tests.act_as(:'support');
select lives_ok(format($$select public.staff_reply(%L, 'Internal: check courier logs', true)$$, :'t1'), 'staff add an internal note');
select lives_ok(format($$select public.staff_reply(%L, 'We are looking into it.')$$, :'t1'), 'staff reply to the customer');
select tests.reset_role();
select tests.act_as_anon();
select is((select count(*)::int from jsonb_array_elements(public.ticket_by_token(:'t1tok') -> 'messages')), 2, 'the guest sees their message and the reply');
select is((select count(*)::int from jsonb_array_elements(public.ticket_by_token(:'t1tok') -> 'messages') m where m ->> 'body' like 'Internal%'), 0, 'internal notes are never shown to the customer');
select tests.reset_role();

select tests.act_as(:'patient');
select ticket_id as t2 from public.create_ticket('account', 'Change my name', 'Please help') \gset
select tests.reset_role();
select tests.act_as(:'other');
select is((select count(*)::int from public.support_tickets where id = :'t2'), 0, 'customers cannot see other customers'' tickets');
select throws_ok(format($$select public.customer_reply(%L, 'hijack')$$, :'t2'), '42501', null, 'or reply to them');
select tests.reset_role();

-- ---- Incidents
select tests.act_as(:'patient');
select ok(public.report_incident('adverse_reaction', 'Rash after taking a medicine') like 'SI-%', 'a patient can report a safety incident');
select tests.reset_role();
select tests.create_user('ss-x@example.test') as x \gset
insert into public.orders (patient_id, pharmacy_id, currency, subtotal_minor, delivery_fee_minor, service_fee_minor, tax_minor, total_minor,
  delivery_address, delivery_location, recipient_name, idempotency_key, handover_code)
select :'x', p.id, 'KES', 100, 0, 0, 0, 100, '{}', 'SRID=4326;POINT(36.8 -1.3)', 'X', gen_random_uuid(), '0000' from public.pharmacies p limit 1;
select id as xorder from public.orders where patient_id = :'x' limit 1 \gset
select tests.act_as(:'other');
select throws_ok(format($$select public.report_incident('dispensing_error', 'Not my order at all', 'moderate', %L)$$, :'xorder'),
  '42501', null, 'nobody can file incidents against other people''s orders');
select is((select count(*)::int from public.safety_incidents), 0, 'and nobody sees other people''s reports');
select tests.reset_role();
select tests.act_as(:'admin');
select ok((select count(*) from public.safety_incidents) >= 1, 'administrators see safety incidents');
select tests.reset_role();

-- ---- Recall
select tests.act_as(:'admin');
update public.medicine_products set recalled_at = now(), recall_note = 'Batch recall (test)' where slug = (select slug from public.medicine_products limit 1);
select tests.reset_role();
select is((select count(*)::int from public.inventory_items i join public.medicine_products m on m.id = i.product_id where m.recalled_at is not null and i.is_listed), 0,
  'a recall takes the product off sale everywhere');
update public.inventory_items set is_listed = true where product_id = (select id from public.medicine_products where recalled_at is not null limit 1);
select is((select count(*)::int from public.inventory_items i join public.medicine_products m on m.id = i.product_id where m.recalled_at is not null and i.is_listed), 0,
  'and it cannot be relisted');

-- ---- Notifications
select tests.act_as(:'patient');
select is((select count(*)::int from public.notifications where kind = 'support'), 0, 'no notification before a staff reply');
select tests.reset_role();
select tests.act_as(:'support');
select public.staff_reply(:'t2', 'Done: your name is updated.', false, 'resolved');
select tests.reset_role();
select tests.act_as(:'patient');
select is((select count(*)::int from public.notifications where kind = 'support'), 1, 'a staff reply notifies the customer in-app');
select tests.reset_role();
select tests.act_as(:'other');
select is((select count(*)::int from public.notifications where user_id = :'patient'), 0, 'nobody else can read it');
select tests.reset_role();
select ok((select bool_and(body not ilike '%name is updated%') from public.notification_outbox), 'outbound messages never carry the message content');
select tests.act_as(:'patient');
select lives_ok(format($$select public.rate_ticket(%L, 5, 'Quick')$$, :'t2'), 'customers can rate a resolved ticket');
select tests.reset_role();

select * from finish();
rollback;
