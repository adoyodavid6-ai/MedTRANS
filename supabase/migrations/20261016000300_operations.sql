-- Phase 1 operations helpers.

-- Who verified an emergency contact is always the signed-in user who set the verification,
-- never a value supplied by the client.
create or replace function public.emergency_contacts_stamp_verifier()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.verified_at is not null then
      new.verified_at := now();
      new.verified_by := (select auth.uid());
    else
      new.verified_by := null;
    end if;
  elsif new.verified_at is distinct from old.verified_at or new.verified_by is distinct from old.verified_by then
    if new.verified_at is not null then
      new.verified_at := now();
      new.verified_by := (select auth.uid());
    else
      new.verified_by := null;
      new.is_active := false;  -- un-verifying a number takes it off the public page
    end if;
  end if;
  -- Changing the number itself invalidates the previous verification.
  if tg_op = 'UPDATE' and new.phone_number is distinct from old.phone_number then
    new.verified_at := null;
    new.verified_by := null;
    new.is_active := false;
  end if;
  return new;
end;
$$;

create trigger emergency_contacts_verifier before insert or update on public.emergency_contacts
  for each row execute function public.emergency_contacts_stamp_verifier();

-- Set a coverage boundary from GeoJSON (Polygon or MultiPolygon, WGS84).
create or replace function public.admin_set_area_boundary(area uuid, geojson text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g extensions.geometry;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  if geojson is null or btrim(geojson) = '' then
    update public.service_coverage_areas set boundary = null, is_active = false where id = area;
    return;
  end if;

  begin
    g := extensions.st_setsrid(extensions.st_geomfromgeojson(geojson), 4326);
  exception when others then
    raise exception 'boundary is not valid GeoJSON' using errcode = '22023';
  end;

  if extensions.geometrytype(g) not in ('POLYGON', 'MULTIPOLYGON') then
    raise exception 'boundary must be a Polygon or MultiPolygon' using errcode = '22023';
  end if;
  if not extensions.st_isvalid(g) then
    raise exception 'boundary polygon is not valid (self-intersecting or unclosed)' using errcode = '22023';
  end if;

  update public.service_coverage_areas
     set boundary = extensions.st_multi(g)::extensions.geography
   where id = area;
  if not found then
    raise exception 'unknown area' using errcode = 'P0002';
  end if;
end;
$$;

-- Area list for the operations console, with boundary as GeoJSON.
create or replace function public.admin_list_areas()
returns table (
  id uuid, country_code char(2), name text, slug text, is_active boolean, notes text,
  boundary_geojson text, modules jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  return query
  select a.id, a.country_code, a.name, a.slug, a.is_active, a.notes,
         case when a.boundary is null then null else extensions.st_asgeojson(a.boundary, 6) end,
         coalesce((select jsonb_object_agg(s.module, s.is_active) from public.coverage_area_services s where s.area_id = a.id), '{}'::jsonb)
  from public.service_coverage_areas a
  order by a.country_code, a.name;
end;
$$;

-- Real, database-backed counts for the operations overview. No mock metrics.
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'generated_at', now(),
    'accounts_total', (select count(*) from auth.users),
    'accounts_last_7_days', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'roles', (select coalesce(jsonb_object_agg(role, n), '{}'::jsonb)
                from (select role, count(*) n from public.user_roles where revoked_at is null group by role) r),
    'countries_active', (select count(*) from public.countries where is_active),
    'areas_active', (select count(*) from public.service_coverage_areas where is_active),
    'areas_total', (select count(*) from public.service_coverage_areas),
    'emergency_contacts_published', (select count(*) from public.emergency_contacts where is_active)
  );
end;
$$;

revoke all on function public.emergency_contacts_stamp_verifier() from public, anon, authenticated;
grant execute on function public.admin_set_area_boundary(uuid, text) to authenticated;
grant execute on function public.admin_list_areas() to authenticated;
grant execute on function public.admin_overview() to authenticated;
