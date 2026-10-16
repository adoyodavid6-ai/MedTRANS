-- Reference data. Everything starts INACTIVE.
-- Activation requires the confirmations listed in docs/SETUP-CHECKLIST.md;
-- the check constraints on these tables enforce that at the database level.

insert into public.countries (code, name, currency) values
  ('KE', 'Kenya', 'KES'),     -- Pilot market. [[CONFIRM: PPB / KMPDC / NCK / ODPC review reference]]
  ('SO', 'Somalia', 'SOS');   -- [[CONFIRM: jurisdiction-specific legal and regulatory review]] before any activation

-- The Nairobi pilot area exists so it can be configured, but it has no boundary yet.
-- [[CONFIRM: Nairobi pilot service boundary (GeoJSON MultiPolygon)]]. It cannot be activated until one is set.
insert into public.service_coverage_areas (country_code, name, slug, notes) values
  ('KE', 'Nairobi (pilot)', 'nairobi-pilot', 'Pilot area. Boundary to be confirmed before activation.');

insert into public.coverage_area_services (area_id, module)
select id, m from public.service_coverage_areas, unnest(enum_range(null::public.service_module)) m
where slug = 'nairobi-pilot';

-- No emergency contacts are seeded on purpose.
-- [[CONFIRM: verified emergency number(s) for Kenya / Nairobi, with source]] — an administrator adds them in Operations → Emergency contacts.

insert into public.platform_settings (key, value, description, is_public) values
  ('announcement',
   jsonb_build_object('enabled', false, 'message', null, 'href', null),
   'Announcement strip shown above the header. Service updates only; never unverified claims about hours, times or coverage.',
   true),
  ('policy.version',
   to_jsonb('draft-2026-10'::text),
   'Version label recorded with consent. Bump when legal-reviewed policy text changes. [[CONFIRM: legal-reviewed Terms and Privacy Notice]]',
   true);
