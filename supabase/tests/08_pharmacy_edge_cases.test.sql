begin;
select plan(12);

select tests.create_user('edge-admin@example.test') as admin \gset
select tests.create_user('edge-pharmacist@example.test') as pharmacist \gset
select tests.create_user('edge-patient@example.test') as patient \gset
select tests.make_admin(:'admin');
select tests.setup_pharmacy(:'admin', :'pharmacist', 'edge') as ph \gset
select tests.add_product('edge-otc', false, :'ph', 10000, 5) as otc \gset
select id as inv from public.inventory_items where product_id = :'otc' \gset

select tests.act_as(:'patient');
insert into public.addresses (user_id, label, line1, location) values (:'patient', 'Home', '2 Pinned Lane', 'SRID=4326;POINT(36.83 -1.29)');
select id as addr from public.addresses where user_id = :'patient' \gset

-- Cancelling an unpaid order releases stock
insert into public.cart_items values (:'patient', :'inv', 2);
select public.place_order(gen_random_uuid(), :'addr') as o1 \gset
select throws_like(format($$select public.transition_order(%L, 'cancelled')$$, :'o1'), '%reason%', 'cancelling needs a reason');
select lives_ok(format($$select public.transition_order(%L, 'cancelled', 'Changed my mind')$$, :'o1'), 'patient cancels an unpaid order');
select tests.reset_role();
select is((select quantity_available from public.inventory_items where id = :'inv'), 5, 'cancellation releases reserved stock');

-- Expiry
select tests.act_as(:'patient');
insert into public.cart_items values (:'patient', :'inv', 1);
select public.place_order(gen_random_uuid(), :'addr') as o2 \gset
select payment_id as pay from public.start_payment(:'o2', 'test', null, gen_random_uuid()) \gset
select tests.reset_role();
select tests.act_as_service();
select public.attach_payment_reference(:'pay', 'LATE-1');
select tests.reset_role();
update public.orders set created_at = now() - interval '31 minutes' where id = :'o2';
select is(public.expire_unpaid_orders(), 0, 'an order with a payment still being confirmed is not expired');
alter table public.payments disable trigger payments_updated_at;
update public.payments set updated_at = now() - interval '11 minutes' where id = :'pay';
alter table public.payments enable trigger payments_updated_at;
select is(public.expire_unpaid_orders(), 1, 'an abandoned unpaid order expires');
select is((select status::text from public.orders where id = :'o2'), 'cancelled', 'expired order is cancelled');
select is((select quantity_available from public.inventory_items where id = :'inv'), 5, 'expiry releases stock');

-- Payment arriving after expiry is never kept
select tests.act_as_service();
select is(public.record_payment_result('test', 'late-1', 'h', 'LATE-1', true,
  (select total_minor from public.orders where id = :'o2'), 'R', null), 'succeeded_late_refund', 'late payment is flagged for refund');
select tests.reset_role();
select is((select status::text from public.orders where id = :'o2'), 'refund_processing', 'the order shows a refund is being arranged');

select tests.act_as(:'patient');
select throws_ok(format($$select public.record_refund(%L, 'X')$$, :'o2'), '42501', null, 'patients cannot record refunds');
select tests.reset_role();
select tests.act_as(:'admin');
select lives_ok(format($$select public.record_refund(%L, 'MPESA-REV-123')$$, :'o2'), 'admin records the refund with its reference');
select tests.reset_role();
select is((select status::text from public.orders where id = :'o2'), 'refunded', 'order shows refunded');

select * from finish();
rollback;
