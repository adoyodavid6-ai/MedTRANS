begin;
select plan(18);

select tests.create_user('cm-admin@example.test') as admin \gset
select tests.create_user('cm-admin2@example.test') as admin2 \gset
select tests.create_user('cm-pharmacist@example.test') as pharmacist \gset
select tests.create_user('cm-other-pharmacist@example.test') as other_ph \gset
select tests.create_user('cm-patient@example.test') as patient \gset
select tests.make_admin(:'admin');
select tests.make_admin(:'admin2');
select tests.setup_pharmacy(:'admin', :'pharmacist', 'cm-ph') as ph \gset
select tests.setup_pharmacy(:'admin', :'other_ph', 'cm-other') as ph2 \gset

-- A delivered order, delivered yesterday (synthetic)
insert into public.orders (patient_id, pharmacy_id, currency, subtotal_minor, delivery_fee_minor, service_fee_minor, tax_minor, total_minor,
  delivery_address, delivery_location, recipient_name, idempotency_key, handover_code, status)
values (:'patient', :'ph', 'KES', 100000, 15000, 5000, 0, 120000, '{}', 'SRID=4326;POINT(36.8 -1.3)', 'P', gen_random_uuid(), '1234', 'delivered')
returning id as ord \gset
insert into public.order_events (order_id, status, actor_kind, occurred_at) values (:'ord', 'delivered', 'courier', now() - interval '1 day');
update public.platform_settings set value = 'null' where key in ('commission.pharmacy_bps', 'commission.doctorcare_bps');

select tests.act_as(:'admin');
select throws_like($$select public.admin_generate_settlements(current_date - 2, current_date - 1)$$, '%commission rates%', 'settlements need confirmed commission rates');
select tests.reset_role();
update public.platform_settings set value = '1000' where key = 'commission.pharmacy_bps';
update public.platform_settings set value = '1500' where key = 'commission.doctorcare_bps';
select tests.act_as(:'admin');
select throws_like($$select public.admin_generate_settlements(current_date - 1, current_date)$$, '%completed period%', 'only completed periods can be settled');
select is(public.admin_generate_settlements(current_date - 2, current_date - 1), 1, 'one settlement for the pharmacy');
select is((select net_minor from public.settlements where pharmacy_id = :'ph'), 90000, 'net = item subtotal minus 10% commission (fees are not the pharmacy''s)');
select is(public.admin_generate_settlements(current_date - 2, current_date - 1), 0, 'running it again settles nothing twice');
select id as st from public.settlements where pharmacy_id = :'ph' \gset
select throws_like(format($$select public.admin_settlement_action(%L, 'paid', 'REF')$$, :'st'), '%not allowed%', 'a draft cannot be marked paid');
select lives_ok(format($$select public.admin_settlement_action(%L, 'approve')$$, :'st'), 'approve');
select throws_like(format($$select public.admin_settlement_action(%L, 'paid', 'BANK-REF-1')$$, :'st'), '%different administrator%', 'the approver cannot also record the payout');
select tests.reset_role();
select tests.act_as(:'admin2');
select lives_ok(format($$select public.admin_settlement_action(%L, 'paid', 'BANK-REF-1')$$, :'st'), 'a second administrator records the payout');
select tests.reset_role();

select tests.act_as(:'pharmacist');
select is((select count(*)::int from public.settlements), 1, 'pharmacy staff see their own settlement');
select tests.reset_role();
select tests.act_as(:'other_ph');
select is((select count(*)::int from public.settlements), 0, 'other pharmacies cannot');
select tests.reset_role();

-- Articles
select tests.act_as(:'admin');
select throws_ok($$insert into public.articles (slug, title, summary, body, is_published) values ('a', 'A title here', 'A summary here', repeat('x', 60), true)$$,
  '23514', null, 'an article cannot be published without a named clinical reviewer');
insert into public.articles (slug, title, summary, body, reviewed_by_name, reviewed_by_credentials, reviewed_at, is_published)
values ('reviewed', 'A reviewed title', 'A summary here', repeat('y', 60), 'Dr Reviewer', 'KMPDC TEST', current_date, true);
update public.articles set body = repeat('z', 60) where slug = 'reviewed';
select is((select is_published from public.articles where slug = 'reviewed'), false, 'changing reviewed text withdraws it until reviewed again');
select tests.reset_role();

-- Analytics
select tests.act_as_anon();
select public.track_event('product_view', '/pharmacy/medicines/x');
select public.track_event('product_view', '/pharmacy/medicines/x');
select lives_ok($$select public.track_event('steal_cookies', '/')$$, 'unknown events are silently ignored');
select throws_ok($$select * from public.analytics_daily$$, '42501', null, 'the public cannot read analytics');
select tests.reset_role();
select is((select count from public.analytics_daily where event = 'product_view' and path = '/pharmacy/medicines/x'), 2, 'events are counted');
select is((select array_agg(column_name::text order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'analytics_daily'),
  array['count', 'day', 'event', 'path'], 'analytics stores no user, session or device identifiers');
select tests.act_as(:'admin');
select ok((public.admin_analytics(30) ->> 'orders_placed')::int >= 1, 'admin analytics come from real records');
select tests.reset_role();

select * from finish();
rollback;
