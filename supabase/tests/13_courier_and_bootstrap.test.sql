begin;
select plan(12);

-- Courier applications
select tests.create_user('cr-applicant@example.test') as applicant \gset
select tests.create_user('cr-admin@example.test') as admin \gset
select tests.make_admin(:'admin');

select tests.act_as_anon();
select throws_ok($$select public.apply_as_courier('X', 'bicycle', null, 'Westlands')$$, '42501', null, 'applying needs an account');
select tests.reset_role();

select tests.act_as(:'applicant');
select throws_like($$select public.apply_as_courier('Synthetic Rider', 'motorbike', null, 'Westlands')$$, '%driving licence%', 'motorbike riders need a licence number');
select lives_ok($$select public.apply_as_courier('Synthetic Rider', 'motorbike', 'DL-SYN-001', 'Westlands')$$, 'a signed-in person can apply');
select is((select verification_status::text from public.courier_profiles where user_id = (select auth.uid())), 'pending', 'the application is pending');
select ok(not public.has_role('courier'), 'applying does not grant the courier role');
with u as (update public.courier_profiles set verification_status = 'verified', check_method = 'self' where user_id = :'applicant' returning 1)
select is((select count(*)::int from u), 0, 'applicants cannot verify themselves');
select tests.reset_role();
select is((select verification_status::text from public.courier_profiles where user_id = :'applicant'), 'pending', 'and the status is unchanged');

select tests.act_as(:'admin');
select lives_ok(format($$update public.courier_profiles set verification_status = 'verified', check_method = 'National ID seen in person (test)' where user_id = %L$$, :'applicant'), 'an admin verifies');
select tests.reset_role();
select tests.act_as(:'applicant');
select throws_like($$select public.apply_as_courier('Synthetic Rider', 'car', 'DL-2', 'CBD')$$, '%already exists%', 'a verified partner cannot reset themselves to pending');
select tests.reset_role();

-- First-admin bootstrap
update public.user_roles set revoked_at = now() where role = 'admin' and revoked_at is null;
insert into public.admin_bootstrap (phone) values ('254799000111');
insert into auth.users (id, phone, aud, role) values ('00000000-0000-4000-8000-0000000000b1', '254799000111', 'authenticated', 'authenticated');
select ok(exists (select 1 from public.user_roles where user_id = '00000000-0000-4000-8000-0000000000b1' and role = 'admin' and revoked_at is null),
  'the bootstrap number becomes admin when no admin exists');
select is((select count(*)::int from public.admin_bootstrap), 0, 'the bootstrap entry is used up');

insert into public.admin_bootstrap (phone) values ('254799000222');
insert into auth.users (id, phone, aud, role) values ('00000000-0000-4000-8000-0000000000b2', '254799000222', 'authenticated', 'authenticated');
select ok(not exists (select 1 from public.user_roles where user_id = '00000000-0000-4000-8000-0000000000b2' and role = 'admin'),
  'once an admin exists, the bootstrap grants nothing');

select * from finish();
rollback;
