-- Quote for the signed-in patient's cart, using the same rules as place_order().
-- Display only: the order's own totals are recomputed inside place_order() when it is placed.
create or replace function public.quote_cart(p_address uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  ph public.pharmacies;
  addr public.addresses;
  issues text[] := '{}';
  lines jsonb := '[]';
  line record;
  subtotal int := 0;
  tax int := 0;
  service_fee int;
  currency_code char(3);
  pharmacy_count int;
  needs_rx boolean := false;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select count(distinct i.pharmacy_id) into pharmacy_count
  from public.cart_items c join public.inventory_items i on i.id = c.inventory_item_id where c.user_id = uid;
  if pharmacy_count = 0 then return jsonb_build_object('empty', true); end if;
  if pharmacy_count > 1 then issues := issues || 'Your cart has items from more than one pharmacy.'; end if;

  select ph2.* into ph from public.pharmacies ph2
  where ph2.id = (select i.pharmacy_id from public.cart_items c join public.inventory_items i on i.id = c.inventory_item_id
                  where c.user_id = uid order by c.added_at limit 1);
  if not public.pharmacy_can_sell(ph.id) then issues := issues || 'This pharmacy is not taking orders right now.'; end if;
  select c.currency into currency_code from public.countries c where c.code = ph.country_code;

  for line in
    select c.quantity, i.id as inventory_id, i.price_minor, i.quantity_available, i.is_listed, i.stock_confirmed_at,
           m.id as product_id, m.slug, m.name, m.strength, m.pack_size, m.requires_prescription, m.is_controlled, m.is_active, m.vat_rate_bps
    from public.cart_items c
    join public.inventory_items i on i.id = c.inventory_item_id
    join public.medicine_products m on m.id = i.product_id
    where c.user_id = uid
    order by m.requires_prescription desc, m.name
  loop
    if not line.is_listed or not line.is_active then issues := issues || (line.name || ' is no longer available.'); end if;
    if line.is_controlled then issues := issues || (line.name || ' cannot be ordered through MedTRANS.'); end if;
    if line.vat_rate_bps is null then issues := issues || (line.name || ' cannot be ordered yet: its tax treatment has not been confirmed.'); end if;
    if line.quantity_available < line.quantity then
      issues := issues || ('Only ' || line.quantity_available || ' of ' || line.name || ' left in stock.');
    end if;
    if line.requires_prescription then needs_rx := true; end if;
    subtotal := subtotal + line.price_minor * line.quantity;
    tax := tax + round(line.price_minor * line.quantity * coalesce(line.vat_rate_bps, 0) / 10000.0)::int;
    lines := lines || jsonb_build_object(
      'inventory_id', line.inventory_id, 'product_id', line.product_id, 'slug', line.slug, 'name', line.name,
      'strength', line.strength, 'pack_size', line.pack_size, 'requires_prescription', line.requires_prescription,
      'quantity', line.quantity, 'unit_price_minor', line.price_minor, 'line_total_minor', line.price_minor * line.quantity,
      'quantity_available', line.quantity_available, 'stock_confirmed_at', line.stock_confirmed_at);
  end loop;

  select (value #>> '{}')::int into service_fee from public.platform_settings
  where key = 'pharmacy.service_fee_minor' and jsonb_typeof(value) = 'number';
  if service_fee is null then issues := issues || 'Ordering is not available yet: the service fee has not been confirmed.'; end if;

  if p_address is not null then
    select a.* into addr from public.addresses a where a.id = p_address and a.user_id = uid;
    if not found then issues := issues || 'Choose one of your saved addresses.';
    elsif addr.location is null then issues := issues || 'This address needs a map pin so we can confirm the pharmacy delivers there.';
    elsif not extensions.st_dwithin(ph.location, addr.location, ph.delivery_radius_m) then issues := issues || 'This pharmacy does not deliver to that address.';
    elsif not exists (select 1 from public.service_coverage_areas a where a.id = ph.area_id and extensions.st_covers(a.boundary, addr.location)) then
      issues := issues || 'That address is outside our active service area.';
    end if;
  end if;

  return jsonb_build_object(
    'empty', false,
    'pharmacy', jsonb_build_object('id', ph.id, 'name', ph.name, 'slug', ph.slug),
    'currency', currency_code,
    'lines', lines,
    'needs_prescription', needs_rx,
    'subtotal_minor', subtotal,
    'delivery_fee_minor', ph.delivery_fee_minor,
    'service_fee_minor', service_fee,
    'tax_minor', tax,
    'total_minor', case when service_fee is null or ph.delivery_fee_minor is null then null
                        else subtotal + ph.delivery_fee_minor + service_fee + tax end,
    'issues', to_jsonb(issues)
  );
end;
$$;

grant execute on function public.quote_cart(uuid) to authenticated;
