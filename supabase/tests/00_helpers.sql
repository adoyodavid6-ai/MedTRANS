-- Shared helpers for pgTAP tests. Loaded before each test file by scripts/test-db.sh.
-- All test data is synthetic and every test file runs inside a transaction that is rolled back.

create schema if not exists tests;

create or replace function tests.create_user(email text)
returns uuid language plpgsql as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, now(), now());
  return uid;
end $$;

-- Act as a signed-in user (as PostgREST would after verifying their JWT).
create or replace function tests.act_as(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function tests.act_as_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;

create or replace function tests.reset_role()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- Make a user an admin without going through admin_grant_role (bootstrap path).
create or replace function tests.make_admin(uid uuid)
returns void language sql as $$
  insert into public.user_roles (user_id, role) values (uid, 'admin');
$$;

grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;
