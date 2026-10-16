begin;
select plan(3);

-- Every table in the exposed schema has RLS switched on.
select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  null,
  'every table in public has row level security enabled'
);

-- No views in public bypass RLS (all must be security_invoker).
select is(
  (select array_agg(c.relname::text) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      and not coalesce(c.reloptions @> array['security_invoker=true'], false)),
  null,
  'every view in public is security_invoker'
);

-- Every SECURITY DEFINER function in public pins search_path.
select is(
  (select array_agg(p.proname::text) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not coalesce(p.proconfig::text[] @> array['search_path=""'], false)),
  null,
  'every security definer function sets an empty search_path'
);

select * from finish();
rollback;
