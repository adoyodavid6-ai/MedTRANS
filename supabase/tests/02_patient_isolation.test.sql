begin;
select plan(16);

select tests.create_user('alice@example.test') as alice \gset
select tests.create_user('bob@example.test') as bob \gset

-- Bootstrap
select is((select count(*)::int from public.profiles where id = :'alice'), 1, 'new user gets a profile');
select is((select array_agg(role) from public.user_roles where user_id = :'alice' and revoked_at is null),
          array['patient']::public.app_role[], 'new user gets only the patient role');

-- Bob writes his own data
select tests.act_as(:'bob');
insert into public.addresses (user_id, label, line1) values (:'bob', 'Home', '1 Example Road');
insert into public.household_members (owner_id, full_name, relationship, authority_confirmed_at)
  values (:'bob', 'Child Example', 'child', now());
insert into public.consent_records (user_id, purpose, granted, policy_version)
  values (:'bob', 'privacy_notice', true, 'test');
update public.profiles set full_name = 'Bob Example' where id = :'bob';
select is((select count(*)::int from public.addresses), 1, 'bob sees his own address');
select tests.reset_role();

-- Alice cannot see or touch any of it
select tests.act_as(:'alice');
select is((select count(*)::int from public.addresses), 0, 'alice cannot read bob''s addresses');
select is((select count(*)::int from public.household_members), 0, 'alice cannot read bob''s household');
select is((select count(*)::int from public.consent_records), 0, 'alice cannot read bob''s consents');
select is((select count(*)::int from public.profiles where id = :'bob'), 0, 'alice cannot read bob''s profile');
select is((select count(*)::int from public.user_roles where user_id = :'bob'), 0, 'alice cannot read bob''s roles');

update public.profiles set full_name = 'Hijacked' where id = :'bob';
update public.addresses set line1 = 'Hijacked' where user_id = :'bob';
delete from public.household_members where owner_id = :'bob';

select throws_ok(
  format($$insert into public.addresses (user_id, label, line1) values (%L, 'x', 'x')$$, :'bob'),
  '42501', null, 'alice cannot create an address owned by bob');
select throws_ok(
  format($$insert into public.user_roles (user_id, role) values (%L, 'admin')$$, :'alice'),
  '42501', null, 'patients cannot grant themselves roles directly');
select throws_ok(
  format($$select public.admin_grant_role(%L, 'admin')$$, :'alice'),
  '42501', null, 'patients cannot call admin_grant_role');
select is((select count(*)::int from public.audit_logs), 0, 'patients cannot read the audit log');
select tests.reset_role();

select is((select full_name from public.profiles where id = :'bob'), 'Bob Example', 'bob''s profile unchanged by alice');
select is((select line1 from public.addresses where user_id = :'bob'), '1 Example Road', 'bob''s address unchanged by alice');
select is((select count(*)::int from public.household_members where owner_id = :'bob'), 1, 'bob''s household unchanged by alice');

-- Consent is append-only, even for its owner
select tests.act_as(:'bob');
select throws_ok($$update public.consent_records set granted = false$$, null, null, 'consent records cannot be edited');
select tests.reset_role();

select * from finish();
rollback;
