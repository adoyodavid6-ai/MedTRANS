-- Public read functions for the storefront. They expose only what the public may see,
-- and compute "can this actually be bought right now" from the same gates checkout uses.

create or replace function public.search_medicines(q text default null, max_rows int default 40)
returns table (
  id uuid, slug text, name text, generic_name text, brand text, strength text, dosage_form text, pack_size text,
  requires_prescription boolean, is_controlled boolean,
  sellable_offers int, min_price_minor int, currency char(3)
)
language sql stable security definer set search_path = '' as $$
  select m.id, m.slug, m.name, m.generic_name, m.brand, m.strength, m.dosage_form, m.pack_size,
         m.requires_prescription, m.is_controlled,
         count(i.id) filter (where public.pharmacy_can_sell(ph.id) and i.quantity_available > 0)::int,
         min(i.price_minor) filter (where public.pharmacy_can_sell(ph.id) and i.quantity_available > 0),
         min(c.currency) filter (where public.pharmacy_can_sell(ph.id) and i.quantity_available > 0)::char(3)
  from public.medicine_products m
  left join public.inventory_items i on i.product_id = m.id and i.is_listed
  left join public.pharmacies ph on ph.id = i.pharmacy_id and ph.is_listed
  left join public.countries c on c.code = ph.country_code
  where m.is_active
    and (q is null or btrim(q) = '' or
         (m.name || ' ' || m.generic_name || ' ' || coalesce(m.brand, '')) ilike '%' || btrim(q) || '%')
  group by m.id
  order by m.requires_prescription, m.name
  limit least(greatest(max_rows, 1), 100);
$$;

create or replace function public.product_offers(p_product uuid)
returns table (
  inventory_id uuid, pharmacy_id uuid, pharmacy_name text, pharmacy_slug text,
  verification_status public.verification_status, can_sell boolean,
  price_minor int, currency char(3), quantity_available int, stock_confirmed_at timestamptz,
  delivery_fee_minor int, delivery_radius_m int
)
language sql stable security definer set search_path = '' as $$
  select i.id, ph.id, ph.name, ph.slug, ph.verification_status, public.pharmacy_can_sell(ph.id),
         i.price_minor, c.currency, i.quantity_available, i.stock_confirmed_at,
         ph.delivery_fee_minor, ph.delivery_radius_m
  from public.inventory_items i
  join public.pharmacies ph on ph.id = i.pharmacy_id and ph.is_listed
  join public.countries c on c.code = ph.country_code
  join public.medicine_products m on m.id = i.product_id and m.is_active
  where i.product_id = p_product and i.is_listed
  order by public.pharmacy_can_sell(ph.id) desc, i.price_minor;
$$;

create or replace function public.pharmacy_directory()
returns table (
  id uuid, name text, slug text, address_line text, verification_status public.verification_status,
  can_sell boolean, verified_hours text, delivery_radius_m int, delivery_fee_minor int, currency char(3),
  licence_number text, licence_regulator text, licence_valid_until date, licence_status public.verification_status,
  lat double precision, lng double precision
)
language sql stable security definer set search_path = '' as $$
  select ph.id, ph.name, ph.slug, ph.address_line, ph.verification_status, public.pharmacy_can_sell(ph.id),
         ph.verified_hours, ph.delivery_radius_m, ph.delivery_fee_minor, c.currency,
         l.licence_number, l.regulator, l.valid_until, l.status,
         extensions.st_y(ph.location::extensions.geometry), extensions.st_x(ph.location::extensions.geometry)
  from public.pharmacies ph
  join public.countries c on c.code = ph.country_code
  left join lateral (
    select * from public.pharmacy_licences pl where pl.pharmacy_id = ph.id order by (pl.status = 'verified') desc, pl.valid_until desc limit 1
  ) l on true
  where ph.is_listed
  order by public.pharmacy_can_sell(ph.id) desc, ph.name;
$$;

grant execute on function public.search_medicines(text, int) to anon, authenticated;
grant execute on function public.product_offers(uuid) to anon, authenticated;
grant execute on function public.pharmacy_directory() to anon, authenticated;
