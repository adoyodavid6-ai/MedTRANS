-- Journey A (§22-A) and its access rules (§22-E), end to end at the database level.
begin;
select plan(49);

select tests.create_user('ph-admin@example.test') as admin \gset
select tests.create_user('ph-pharmacist@example.test') as pharmacist \gset
select tests.create_user('ph-other-pharmacist@example.test') as other_pharmacist \gset
select tests.create_user('ph-patient@example.test') as patient \gset
select tests.create_user('ph-patient2@example.test') as patient2 \gset
select tests.create_user('ph-courier@example.test') as courier \gset
select tests.make_admin(:'admin');
insert into public.user_roles (user_id, role) values (:'courier', 'courier');

-- ---- Eligibility gates
select tests.setup_pharmacy(:'admin', :'pharmacist', 'journey') as ph \gset
select tests.setup_pharmacy(:'admin', :'other_pharmacist', 'other') as other_ph \gset
select ok(public.pharmacy_can_sell(:'ph'), 'a fully verified pharmacy can sell');
select tests.act_as(:'admin');
update public.pharmacy_licences set valid_until = current_date - 1 where pharmacy_id = :'other_ph';
select ok(not public.pharmacy_can_sell(:'other_ph'), 'an expired licence stops sales');
update public.pharmacy_licences set valid_until = current_date + 30 where pharmacy_id = :'other_ph';
update public.pharmacies set verification_status = 'suspended' where id = :'other_ph';
select tests.reset_role();
select ok(not public.pharmacy_can_sell(:'other_ph'), 'a suspended pharmacy cannot sell');
select is((select is_accepting_orders from public.pharmacies where id = :'other_ph'), false, 'suspension stops order intake');
select is((select verified_by from public.pharmacies where id = :'ph'), :'admin'::uuid, 'verification records the acting admin');

select tests.add_product('rx-med', true, :'ph', 25000, 10) as rx_product \gset
select tests.add_product('otc-med', false, :'ph', 10000, 5) as otc_product \gset
select id as rx_inv from public.inventory_items where product_id = :'rx_product' \gset
select id as otc_inv from public.inventory_items where product_id = :'otc_product' \gset

-- ---- Patient builds a cart
select tests.act_as(:'patient');
insert into public.addresses (user_id, label, line1) values (:'patient', 'No pin', '1 Somewhere');
insert into public.addresses (user_id, label, line1, location) values (:'patient', 'Home', '2 Pinned Lane', 'SRID=4326;POINT(36.83 -1.29)');
insert into public.addresses (user_id, label, line1, location) values (:'patient', 'Far', '3 Far Away', 'SRID=4326;POINT(39.66 -4.04)');
select id as addr_nopin from public.addresses where label = 'No pin' \gset
select id as addr_home from public.addresses where label = 'Home' \gset
select id as addr_far from public.addresses where label = 'Far' \gset
insert into public.cart_items (user_id, inventory_item_id, quantity) values (:'patient', :'otc_inv', 2), (:'patient', :'rx_inv', 1);

select throws_like(format($$select public.place_order(gen_random_uuid(), %L)$$, :'addr_nopin'), '%map pin%', 'an address without a pin cannot be used');
select throws_like(format($$select public.place_order(gen_random_uuid(), %L)$$, :'addr_far'), '%does not deliver%', 'addresses outside the delivery radius are refused');
select throws_like(format($$select public.place_order(gen_random_uuid(), %L)$$, :'addr_home'), '%prescription is needed%', 'prescription-only items need an approved prescription');

-- ---- Prescription upload and review
select tests.reset_role();
insert into storage.objects (bucket_id, name, owner, metadata)
values ('prescriptions', :'patient' || '/x/rx.pdf', :'patient', '{"mimetype":"application/pdf","size":12345}');
select tests.act_as(:'patient');
select throws_like(
  format($$select public.submit_prescription(%L, %L, 'rx.pdf', %L::jsonb)$$, :'ph', :'patient' || '/x/rx.pdf',
         json_build_array(json_build_object('product_id', :'rx_product', 'quantity', 1))),
  '%consent%', 'uploading a prescription requires consent to process health information');
insert into public.consent_records (user_id, purpose, granted, policy_version) values (:'patient', 'health_data_processing', true, 'test');
select throws_like(
  format($$select public.submit_prescription(%L, %L, 'rx.pdf', %L::jsonb)$$, :'ph', :'patient2' || '/x/rx.pdf',
         json_build_array(json_build_object('product_id', :'rx_product', 'quantity', 1))),
  '%not yours%', 'a patient cannot attach someone else''s file');
select public.submit_prescription(:'ph', :'patient' || '/x/rx.pdf', 'rx.pdf',
  json_build_array(json_build_object('product_id', :'rx_product', 'quantity', 2))::jsonb) as rx \gset
select is((select mime_type from public.prescriptions where id = :'rx'), 'application/pdf', 'file type comes from storage, not the client');
select tests.reset_role();

select tests.act_as(:'other_pharmacist');
select is((select count(*)::int from public.prescriptions where id = :'rx'), 0, 'a pharmacist at another pharmacy cannot see the prescription');
select throws_ok(format($$select public.review_prescription(%L, 'approved', null, current_date + 30, '[]')$$, :'rx'), '42501', null,
  'a pharmacist at another pharmacy cannot review it');
select tests.reset_role();
select tests.act_as(:'admin');
select is((select count(*)::int from public.prescriptions where id = :'rx'), 0, 'administrators cannot see prescriptions');
select tests.reset_role();
select tests.act_as(:'courier');
select is((select count(*)::int from public.prescriptions), 0, 'couriers cannot see prescriptions');
select tests.reset_role();

select tests.act_as(:'pharmacist');
select is((select count(*)::int from public.prescriptions where id = :'rx'), 1, 'the receiving pharmacist can see it');
select throws_like(format($$select public.review_prescription(%L, 'rejected')$$, :'rx'), '%explain%', 'a rejection needs a reason');
select lives_ok(format($$select public.review_prescription(%L, 'approved', 'OK', current_date + 30, %L::jsonb)$$, :'rx',
  json_build_array(json_build_object('product_id', :'rx_product', 'quantity_approved', 1))), 'pharmacist approves one unit');
select is(public.prescription_file_path(:'rx'), :'patient' || '/x/rx.pdf', 'pharmacist can obtain the file path');
select tests.reset_role();
select ok(exists(select 1 from public.audit_logs where action = 'prescription.file_access' and record_id = :'rx'), 'prescription file access is audited');

-- ---- Checkout
select tests.act_as(:'patient');
update public.cart_items set quantity = 2 where inventory_item_id = :'rx_inv';
select throws_like(format($$select public.place_order(gen_random_uuid(), %L, %L)$$, :'addr_home', :'rx'), '%more than the pharmacist approved%',
  'the cart cannot exceed the approved quantity');
update public.cart_items set quantity = 1 where inventory_item_id = :'rx_inv';
select (public.quote_cart(:'addr_home') ->> 'total_minor')::int as quoted \gset
select public.place_order('11111111-1111-1111-1111-111111111111', :'addr_home', :'rx') as ord \gset
select is(public.place_order('11111111-1111-1111-1111-111111111111', :'addr_home', :'rx'), :'ord'::uuid, 'placing the same checkout twice returns the same order');
select is((select total_minor from public.orders where id = :'ord'), 2*10000 + 25000 + 15000 + 5000, 'total is computed on the server: items + delivery + service fee + tax');
select is((select total_minor from public.orders where id = :'ord'), :'quoted'::int, 'the checkout quote matches the order total exactly');
select is((select status::text from public.orders where id = :'ord'), 'pending_payment', 'new orders await payment');
select is((select count(*)::int from public.cart_items), 0, 'cart is emptied');
select tests.reset_role();
select is((select quantity_available from public.inventory_items where id = :'otc_inv'), 3, 'stock is reserved at checkout');

-- The approved prescription cannot be reused for a second order
select tests.act_as(:'patient');
insert into public.cart_items (user_id, inventory_item_id, quantity) values (:'patient', :'rx_inv', 1);
select throws_like(format($$select public.place_order(gen_random_uuid(), %L, %L)$$, :'addr_home', :'rx'), '%already been used%',
  'a prescription cannot be used for two orders');
delete from public.cart_items;
select tests.reset_role();

-- Another patient sees nothing
select tests.act_as(:'patient2');
select is((select count(*)::int from public.orders), 0, 'patients cannot see other patients'' orders');
select throws_ok(format($$select public.transition_order(%L, 'cancelled', 'x')$$, :'ord'), '42501', null, 'patients cannot change other patients'' orders');
select tests.reset_role();

-- ---- Payment
select tests.act_as(:'patient');
select payment_id as pay from public.start_payment(:'ord', 'test', '+254700000001', '22222222-2222-2222-2222-222222222222') \gset
select throws_ok($$select public.record_payment_result('test','e','h','r',true,1,'x',null)$$, '42501', null,
  'patients cannot record payment results');
select tests.reset_role();
select tests.act_as_service();
select public.attach_payment_reference(:'pay', 'TEST-REF-1');
select is(public.record_payment_result('test', 'evt-1', 'h', 'TEST-REF-1', true, 1, 'R1', null), 'amount_mismatch', 'a wrong amount is never accepted as payment');
select tests.reset_role();
select is((select status::text from public.orders where id = :'ord'), 'pending_payment', 'a mismatched payment does not advance the order');

select tests.act_as(:'patient');
select payment_id as pay2 from public.start_payment(:'ord', 'test', null, '33333333-3333-3333-3333-333333333333') \gset
select tests.reset_role();
select tests.act_as_service();
select public.attach_payment_reference(:'pay2', 'TEST-REF-2');
select is(public.record_payment_result('test', 'evt-2', 'h', 'TEST-REF-2', true, 65000, 'R2', null), 'succeeded', 'the correct amount succeeds');
select is(public.record_payment_result('test', 'evt-2', 'h', 'TEST-REF-2', true, 65000, 'R2', null), 'duplicate', 'a replayed callback is ignored');
select tests.reset_role();
select is((select status::text from public.orders where id = :'ord'), 'awaiting_pharmacy_acceptance', 'payment moves the order to the pharmacy');

-- ---- Pharmacy fulfilment
select tests.act_as(:'patient');
select throws_ok(format($$select public.transition_order(%L, 'confirmed')$$, :'ord'), '42501', null, 'patients cannot accept their own order');
select tests.reset_role();
select tests.act_as(:'pharmacist');
select lives_ok(format($$select public.transition_order(%L, 'confirmed')$$, :'ord'), 'pharmacy accepts');
select lives_ok(format($$select public.transition_order(%L, 'preparing')$$, :'ord'), 'pharmacy prepares');
select lives_ok(format($$select public.transition_order(%L, 'ready_for_dispatch')$$, :'ord'), 'ready for dispatch');
select tests.reset_role();

-- ---- Dispatch and delivery
select tests.act_as(:'admin');
select throws_like(format($$select public.assign_courier(%L, %L)$$, :'ord', :'courier'), '%verified delivery partners%', 'an unverified courier cannot be assigned');
insert into public.courier_profiles (user_id, verification_status, check_method) values (:'courier', 'verified', 'synthetic ID check');
select lives_ok(format($$select public.assign_courier(%L, %L)$$, :'ord', :'courier'), 'a verified courier is assigned');
select tests.reset_role();

select handover_code as code from public.orders where id = :'ord' \gset
select tests.act_as(:'courier');
select is((select count(*)::int from public.orders), 0, 'couriers cannot read orders directly');
select is((select count(*)::int from public.order_items), 0, 'couriers cannot see what medicines are in an order');
select is((select item_count from public.courier_assignments() where order_id = :'ord'), 3::bigint, 'couriers see an item count only');
select lives_ok(format($$select public.transition_order(%L, 'out_for_delivery')$$, :'ord'), 'courier confirms pickup');
select is(public.confirm_delivery(:'ord', 'xxxx'), 'wrong_code', 'a wrong handover code is refused');
select is(public.confirm_delivery(:'ord', :'code'), 'delivered', 'the right code completes delivery');
select tests.reset_role();

select is((select array_agg(status::text order by id) from public.order_events where order_id = :'ord'),
  array['pending_payment','awaiting_pharmacy_acceptance','confirmed','preparing','ready_for_dispatch','assigned_to_courier','out_for_delivery','delivered'],
  'every step is recorded on the timeline in order');

select * from finish();
rollback;
