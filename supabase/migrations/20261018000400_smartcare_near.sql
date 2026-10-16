-- SmartCare "near me": verified, bookable professionals whose service area covers a point.
-- Distance is rounded to the nearest kilometre and is straight-line: positions are never revealed.
create or replace function public.providers_near(lat double precision, lng double precision)
returns table (provider_id uuid, display_name text, profession public.provider_profession, languages text[],
               distance_km int, services jsonb)
language sql stable security definer set search_path = '' as $$
  with here as (select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography g)
  select pp.user_id, pp.display_name, pp.profession, pp.languages,
         greatest(1, round(extensions.st_distance(pp.base_location, here.g) / 1000))::int,
         coalesce((select jsonb_agg(jsonb_build_object('slug', cs.slug, 'name', cs.name, 'fee_minor', ps.fee_minor) order by cs.name)
                   from public.provider_services ps join public.care_services cs on cs.id = ps.service_id and cs.is_active
                   where ps.provider_id = pp.user_id), '[]'::jsonb)
  from public.provider_profiles pp, here
  join public.user_roles ur on true
  where ur.user_id = pp.user_id and ur.role::text = pp.profession::text and ur.revoked_at is null
    and lat between -90 and 90 and lng between -180 and 180
    and pp.verification_status = 'verified' and pp.accepts_bookings
    and pp.base_location is not null and extensions.st_dwithin(pp.base_location, here.g, pp.service_radius_m)
    and exists (
      select 1 from public.service_coverage_areas a
      join public.countries c on c.code = a.country_code and c.is_active
      join public.coverage_area_services s on s.area_id = a.id and s.module = 'doctorcare' and s.is_active
      where a.is_active and extensions.st_covers(a.boundary, here.g)
    )
  order by extensions.st_distance(pp.base_location, here.g)
  limit 50;
$$;
grant execute on function public.providers_near(double precision, double precision) to anon, authenticated;
