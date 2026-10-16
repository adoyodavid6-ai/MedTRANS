begin;
select plan(14);

select tests.create_user('admin@example.test') as admin \gset
select tests.create_user('carol@example.test') as carol \gset
select tests.make_admin(:'admin');

-- Carol stores something private
select tests.act_as(:'carol');
insert into public.addresses (user_id, label, line1) values (:'carol', 'Home', 'Private Lane 7');
update public.profiles set full_name = 'Secret Fullname' where id = :'carol';
select tests.reset_role();

select tests.act_as(:'admin');
select lives_ok(format($$select public.admin_grant_role(%L, 'nurse')$$, :'carol'), 'admin can grant a role');
select is((select count(*)::int from public.user_roles where user_id = :'carol' and role = 'nurse' and revoked_at is null),
          1, 'role grant recorded');
select lives_ok(format($$select public.admin_grant_role(%L, 'nurse')$$, :'carol'), 'granting an existing role is idempotent');
select lives_ok(format($$select public.admin_revoke_role(%L, 'nurse')$$, :'carol'), 'admin can revoke a role');
select is((select count(*)::int from public.user_roles where user_id = :'carol' and role = 'nurse' and revoked_at is null),
          0, 'revoked role is no longer active');
select throws_ok(format($$select public.admin_revoke_role(%L, 'admin')$$, :'admin'),
          'P0001', 'cannot revoke the last administrator', 'the last administrator cannot be removed');

select is((select count(*)::int from public.addresses where user_id = :'carol'), 0,
          'admins have no blanket access to patient addresses');
select is((select count(*)::int from public.profiles where id = :'carol'), 1, 'admins can read profiles for account administration');
select is((select count(*)::int from public.admin_list_users('carol@', 10)), 1, 'admin user search works');

select ok((select count(*) from public.audit_logs where action = 'role.grant') >= 1, 'role grants are audited');
select ok((select count(*) from public.audit_logs where action = 'users.list') >= 1, 'user directory access is audited');
select is((select changed_fields from public.audit_logs
            where table_name = 'profiles' and record_id = :'carol' and action = 'update' order by id desc limit 1),
          array['full_name'], 'profile edits record the changed field name');
select is((select count(*)::int from public.audit_logs
            where metadata::text like '%Secret Fullname%' or array_to_string(changed_fields, ',') like '%Secret%'
               or metadata::text like '%Private Lane%'),
          0, 'audit log never stores personal values');
select tests.reset_role();

-- Even the database owner cannot rewrite history
select throws_ok($$update public.audit_logs set action = 'tampered'$$, 'P0001', 'audit_logs is append-only',
                 'audit log rows cannot be modified');

select * from finish();
rollback;
