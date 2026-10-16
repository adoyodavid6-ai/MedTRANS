begin;
select plan(4);

select tests.create_user('erase-me@example.test') as uid \gset
insert into public.consent_records (user_id, purpose, granted, policy_version) values (:'uid', 'privacy_notice', true, 'test');
insert into public.addresses (user_id, label, line1) values (:'uid', 'Home', '1 Erasure Road');

select throws_ok(format($$delete from public.consent_records where user_id = %L$$, :'uid'), 'P0001', 'consent_records is append-only',
                 'consent records cannot be deleted directly');
select lives_ok(format($$delete from auth.users where id = %L$$, :'uid'), 'an account with consent history can be erased');
select is((select count(*)::int from public.consent_records where user_id = :'uid'), 0, 'erasure removes consent records');
select is((select count(*)::int from public.addresses where user_id = :'uid'), 0, 'erasure removes addresses');

select * from finish();
rollback;
