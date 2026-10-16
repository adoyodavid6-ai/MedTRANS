-- MedTRANS Phase 2 — Pharmacy workflows.
-- Every state change goes through one of these functions. Each checks who is acting,
-- locks what it changes, and writes the event that the timeline shows.

-- ---------------------------------------------------------------------------
-- Verifier stamping: "verified by" is always the signed-in admin, never a client value.
-- ---------------------------------------------------------------------------

create or replace function public.stamp_pharmacy_verifier()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.verification_status = 'verified'
     and (tg_op = 'INSERT' or old.verification_status is distinct from 'verified') then
    new.verified_at := now();
    new.verified_by := (select auth.uid());
  elsif new.verification_status <> 'verified' then
    new.verified_at := null;
    new.verified_by := null;
    new.is_accepting_orders := false; -- an unverified or suspended pharmacy cannot take orders
  end if;
  return new;
end;
$$;
create trigger pharmacies_stamp_verifier before insert or update on public.pharmacies
  for each row execute function public.stamp_pharmacy_verifier();

create or replace function public.stamp_licence_checker()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'verified' and (tg_op = 'INSERT' or old.status is distinct from 'verified'
       or new.licence_number is distinct from old.licence_number or new.valid_until is distinct from old.valid_until) then
    new.checked_at := now();
    new.checked_by := (select auth.uid());
  end if;
  return new;
end;
$$;
create trigger pharmacy_licences_stamp before insert or update on public.pharmacy_licences
  for each row execute function public.stamp_licence_checker();

create or replace function public.stamp_staff_registration()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.registration_number is distinct from old.registration_number then
    new.registration_status := 'unverified'; -- a changed number must be re-checked
  end if;
  if new.registration_status = 'verified' and (tg_op = 'INSERT' or old.registration_status is distinct from 'verified') then
    new.registration_checked_at := now();
    new.registration_checked_by := (select auth.uid());
  elsif new.registration_status <> 'verified' then
    new.registration_checked_at := null;
    new.registration_checked_by := null;
  end if;
  return new;
end;
$$;
create trigger pharmacy_staff_stamp before insert or update on public.pharmacy_staff
  for each row execute function public.stamp_staff_registration();

create or replace function public.stamp_courier_verifier()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.verification_status = 'verified' and (tg_op = 'INSERT' or old.verification_status is distinct from 'verified') then
    new.verified_at := now();
    new.verified_by := (select auth.uid());
  elsif new.verification_status <> 'verified' then
    new.verified_at := null;
    new.verified_by := null;
    new.is_available := false;
  end if;
  return new;
end;
$$;
create trigger courier_profiles_stamp before insert or update on public.courier_profiles
  for each row execute function public.stamp_courier_verifier();

-- ---------------------------------------------------------------------------
-- Prescriptions
-- ---------------------------------------------------------------------------

-- Patient submits an uploaded file to a pharmacy, listing what they want dispensed.
-- File type and size are read from storage, not trusted from the client.
create or replace function public.submit_prescription(
  p_pharmacy uuid,
  p_storage_path text,
  p_file_name text,
  p_items jsonb,               -- [{ "product_id": uuid, "quantity": int }]
  p_note text default null,
  p_household_member uuid default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  obj record;
  rx_id uuid;
  item jsonb;
  consent_ok boolean;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;

  select c.granted into consent_ok
  from public.consent_records c
  where c.user_id = uid and c.purpose = 'health_data_processing'
  order by c.recorded_at desc limit 1;
  if not coalesce(consent_ok, false) then
    raise exception 'consent to process health information is required' using errcode = 'P0001';
  end if;

  if split_part(p_storage_path, '/', 1) <> uid::text then
    raise exception 'file is not yours' using errcode = '42501';
  end if;
  select o.metadata into obj from storage.objects o
  where o.bucket_id = 'prescriptions' and o.name = p_storage_path;
  if not found then raise exception 'uploaded file not found' using errcode = 'P0002'; end if;

  if not public.pharmacy_can_sell(p_pharmacy) then
    raise exception 'this pharmacy is not accepting prescriptions' using errcode = 'P0001';
  end if;
  if p_household_member is not null and not exists (
    select 1 from public.household_members h where h.id = p_household_member and h.owner_id = uid) then
    raise exception 'unknown household member' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 20 then
    raise exception 'list the medicines this prescription is for' using errcode = '22023';
  end if;

  insert into public.prescriptions (patient_id, household_member_id, pharmacy_id, storage_path, file_name, mime_type, size_bytes, patient_note)
  values (uid, p_household_member, p_pharmacy, p_storage_path, left(p_file_name, 200),
          obj.metadata ->> 'mimetype', (obj.metadata ->> 'size')::int, nullif(btrim(p_note), ''))
  returning id into rx_id;

  for item in select * from jsonb_array_elements(p_items) loop
    if not exists (
      select 1 from public.medicine_products m
      join public.inventory_items i on i.product_id = m.id and i.pharmacy_id = p_pharmacy and i.is_listed
      where m.id = (item ->> 'product_id')::uuid and m.is_active and m.requires_prescription and not m.is_controlled
    ) then
      raise exception 'a listed medicine is not available on prescription at this pharmacy' using errcode = '22023';
    end if;
    insert into public.prescription_items (prescription_id, product_id, quantity_requested)
    values (rx_id, (item ->> 'product_id')::uuid, (item ->> 'quantity')::int);
  end loop;

  return rx_id;
end;
$$;

-- Pharmacist decision. Only a verified pharmacist at the receiving pharmacy may decide.
create or replace function public.review_prescription(
  p_prescription uuid,
  p_decision public.prescription_status,
  p_note text default null,
  p_valid_until date default null,
  p_items jsonb default null     -- approve only: [{ "product_id": uuid, "quantity_approved": int }]
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  rx public.prescriptions;
  item jsonb;
  approved_total int;
begin
  select * into rx from public.prescriptions where id = p_prescription for update;
  if not found then raise exception 'unknown prescription' using errcode = 'P0002'; end if;
  if not public.is_verified_pharmacist_at(rx.pharmacy_id) then
    raise exception 'only a verified pharmacist at this pharmacy can review it' using errcode = '42501';
  end if;
  if rx.status <> 'submitted' then
    raise exception 'this prescription has already been decided' using errcode = 'P0001';
  end if;
  if p_decision not in ('approved', 'clarification_needed', 'rejected') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;
  if p_decision in ('clarification_needed', 'rejected') and coalesce(btrim(p_note), '') = '' then
    raise exception 'explain the decision to the patient' using errcode = '22023';
  end if;

  if p_decision = 'approved' then
    if p_valid_until is null or p_valid_until < current_date or p_valid_until > current_date + 365 then
      raise exception 'set how long this approval is valid for (today to one year)' using errcode = '22023';
    end if;
    if p_items is null or jsonb_typeof(p_items) <> 'array' then
      raise exception 'approve a quantity for each medicine' using errcode = '22023';
    end if;
    for item in select * from jsonb_array_elements(p_items) loop
      update public.prescription_items
         set quantity_approved = (item ->> 'quantity_approved')::int
       where prescription_id = rx.id and product_id = (item ->> 'product_id')::uuid
         and (item ->> 'quantity_approved')::int between 0 and quantity_requested;
      if not found then
        raise exception 'approved quantity must be between 0 and the quantity requested' using errcode = '22023';
      end if;
    end loop;
    update public.prescription_items set quantity_approved = 0
     where prescription_id = rx.id and quantity_approved is null;
    select coalesce(sum(quantity_approved), 0) into approved_total from public.prescription_items where prescription_id = rx.id;
    if approved_total = 0 then
      raise exception 'approve at least one item, or reject with a reason' using errcode = '22023';
    end if;
  end if;

  update public.prescriptions
     set status = p_decision, decided_at = now(), decided_by = (select auth.uid()),
         valid_until = case when p_decision = 'approved' then p_valid_until end
   where id = rx.id;

  insert into public.prescription_reviews (prescription_id, reviewer_id, decision, note_to_patient)
  values (rx.id, (select auth.uid()), p_decision, nullif(btrim(p_note), ''));
end;
$$;

create or replace function public.withdraw_prescription(p_prescription uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.prescriptions set status = 'withdrawn'
   where id = p_prescription and patient_id = (select auth.uid())
     and status in ('submitted', 'clarification_needed');
  if not found then raise exception 'this prescription cannot be withdrawn' using errcode = 'P0001'; end if;
end;
$$;

-- Returns the storage path for a signed URL, after checking access and recording it in the audit log.
create or replace function public.prescription_file_path(p_prescription uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  rx public.prescriptions;
begin
  select * into rx from public.prescriptions where id = p_prescription;
  if not found or not (rx.patient_id = (select auth.uid()) or public.is_verified_pharmacist_at(rx.pharmacy_id)) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  insert into public.audit_logs (actor_id, action, table_name, record_id)
  values ((select auth.uid()), 'prescription.file_access', 'prescriptions', rx.id::text);
  return rx.storage_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create or replace function public.order_actor_kinds(o public.orders)
returns text[] language sql stable security definer set search_path = '' as $$
  select array_remove(array[
    case when o.patient_id = (select auth.uid()) then 'patient' end,
    case when public.is_pharmacy_staff(o.pharmacy_id) then 'pharmacy' end,
    case when o.courier_id = (select auth.uid()) and public.has_role('courier') then 'courier' end,
    case when public.is_admin() then 'admin' end
  ], null);
$$;

-- Put reserved stock back (once) when an order stops before it leaves the pharmacy.
create or replace function public.release_order_stock(p_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.inventory_items i
     set quantity_available = i.quantity_available + oi.quantity
    from public.order_items oi
   where oi.order_id = p_order and oi.inventory_item_id = i.id
     and exists (select 1 from public.orders o where o.id = p_order and not o.stock_released);
  update public.orders set stock_released = true where id = p_order;
end;
$$;

-- Internal: change status and write the timeline event.
create or replace function public.apply_order_status(p_order uuid, p_to public.order_status, p_actor_kind text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set status = p_to where id = p_order;
  insert into public.order_events (order_id, status, actor_id, actor_kind, note)
  values (p_order, p_to, (select auth.uid()), p_actor_kind, nullif(btrim(p_note), ''));
end;
$$;

-- Turn the signed-in patient's cart into an order. Prices, fees, tax, stock, eligibility,
-- delivery range and prescription coverage are all checked here, inside one transaction.
create or replace function public.place_order(
  p_idempotency_key uuid,
  p_address uuid,
  p_prescription uuid default null,
  p_household_member uuid default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  existing uuid;
  ph public.pharmacies;
  addr public.addresses;
  rx public.prescriptions;
  pharmacy_count int;
  line record;
  needs_rx boolean := false;
  subtotal int := 0;
  tax int := 0;
  service_fee int;
  currency_code char(3);
  recipient text;
  new_order uuid;
  code char(4);
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;

  -- Idempotency: the same checkout submission always yields the same order.
  select id into existing from public.orders where idempotency_key = p_idempotency_key and patient_id = uid;
  if found then return existing; end if;

  select count(distinct i.pharmacy_id) into pharmacy_count
  from public.cart_items c join public.inventory_items i on i.id = c.inventory_item_id
  where c.user_id = uid;
  if pharmacy_count = 0 then raise exception 'your cart is empty' using errcode = 'P0001'; end if;
  if pharmacy_count > 1 then raise exception 'a cart can only hold items from one pharmacy' using errcode = 'P0001'; end if;

  select ph2.* into ph from public.pharmacies ph2
  where ph2.id = (select i.pharmacy_id from public.cart_items c join public.inventory_items i on i.id = c.inventory_item_id
                  where c.user_id = uid limit 1);
  if not public.pharmacy_can_sell(ph.id) then
    raise exception 'this pharmacy is not taking orders right now' using errcode = 'P0001';
  end if;

  select a.* into addr from public.addresses a where a.id = p_address and a.user_id = uid;
  if not found then raise exception 'choose one of your saved addresses' using errcode = 'P0001'; end if;
  if addr.location is null then
    raise exception 'this address needs a map pin so we can confirm the pharmacy delivers there' using errcode = 'P0001';
  end if;
  if not extensions.st_dwithin(ph.location, addr.location, ph.delivery_radius_m) then
    raise exception 'this pharmacy does not deliver to that address' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.service_coverage_areas a where a.id = ph.area_id and extensions.st_covers(a.boundary, addr.location)) then
    raise exception 'that address is outside our active service area' using errcode = 'P0001';
  end if;

  if p_household_member is not null then
    select h.full_name into recipient from public.household_members h where h.id = p_household_member and h.owner_id = uid;
    if not found then raise exception 'unknown household member' using errcode = '42501'; end if;
  else
    select coalesce(nullif(btrim(p.full_name), ''), 'Patient') into recipient from public.profiles p where p.id = uid;
  end if;

  select (value #>> '{}')::int into service_fee from public.platform_settings
  where key = 'pharmacy.service_fee_minor' and jsonb_typeof(value) = 'number';
  if service_fee is null then
    raise exception 'ordering is not available yet: the service fee has not been confirmed' using errcode = 'P0001';
  end if;
  select c.currency into currency_code from public.countries c where c.code = ph.country_code;

  -- Lock every inventory row in the cart, then validate each line against live data.
  for line in
    select c.quantity, i.id as inventory_id, i.price_minor, i.quantity_available, i.is_listed,
           m.id as product_id, m.name, m.strength, m.dosage_form, m.pack_size,
           m.requires_prescription, m.is_controlled, m.is_active, m.vat_rate_bps
    from public.cart_items c
    join public.inventory_items i on i.id = c.inventory_item_id
    join public.medicine_products m on m.id = i.product_id
    where c.user_id = uid
    order by i.id
    for update of i
  loop
    if not line.is_listed or not line.is_active then
      raise exception '% is no longer available', line.name using errcode = 'P0001';
    end if;
    if line.is_controlled then
      raise exception '% cannot be ordered through MedTRANS', line.name using errcode = 'P0001';
    end if;
    if line.vat_rate_bps is null then
      raise exception '% cannot be ordered yet: its tax treatment has not been confirmed', line.name using errcode = 'P0001';
    end if;
    if line.quantity_available < line.quantity then
      raise exception 'only % of % left in stock', line.quantity_available, line.name using errcode = 'P0001';
    end if;
    if line.requires_prescription then needs_rx := true; end if;
    subtotal := subtotal + line.price_minor * line.quantity;
    tax := tax + round(line.price_minor * line.quantity * line.vat_rate_bps / 10000.0)::int;
  end loop;

  if needs_rx then
    if p_prescription is null then
      raise exception 'a pharmacist-approved prescription is needed for this order' using errcode = 'P0001';
    end if;
    select r.* into rx from public.prescriptions r where r.id = p_prescription and r.patient_id = uid for update;
    if not found or rx.status <> 'approved' or rx.pharmacy_id <> ph.id then
      raise exception 'that prescription is not approved for this pharmacy' using errcode = 'P0001';
    end if;
    if rx.valid_until < current_date then
      raise exception 'that prescription approval has expired' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.orders o where o.prescription_id = rx.id
               and o.status not in ('cancelled', 'refund_processing', 'refunded')) then
      raise exception 'that prescription has already been used for an order' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.cart_items c
      join public.inventory_items i on i.id = c.inventory_item_id
      join public.medicine_products m on m.id = i.product_id and m.requires_prescription
      left join public.prescription_items pi on pi.prescription_id = rx.id and pi.product_id = m.id
      where c.user_id = uid and coalesce(pi.quantity_approved, 0) < c.quantity
    ) then
      raise exception 'your cart has more than the pharmacist approved' using errcode = 'P0001';
    end if;
  else
    p_prescription := null;
  end if;

  code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 10000)::text, 4, '0');

  insert into public.orders (
    patient_id, household_member_id, pharmacy_id, prescription_id, currency,
    subtotal_minor, delivery_fee_minor, service_fee_minor, tax_minor, total_minor,
    delivery_address, delivery_location, recipient_name, idempotency_key, handover_code
  ) values (
    uid, p_household_member, ph.id, p_prescription, currency_code,
    subtotal, ph.delivery_fee_minor, service_fee, tax, subtotal + ph.delivery_fee_minor + service_fee + tax,
    jsonb_build_object('label', addr.label, 'line1', addr.line1, 'area', addr.area,
                       'building_details', addr.building_details, 'landmark', addr.landmark),
    addr.location, recipient, p_idempotency_key, code
  ) returning id into new_order;

  insert into public.order_items (order_id, inventory_item_id, product_id, product_name, strength, dosage_form, pack_size,
                                  requires_prescription, unit_price_minor, quantity, vat_rate_bps, line_total_minor)
  select new_order, i.id, m.id, m.name, m.strength, m.dosage_form, m.pack_size,
         m.requires_prescription, i.price_minor, c.quantity, m.vat_rate_bps, i.price_minor * c.quantity
  from public.cart_items c
  join public.inventory_items i on i.id = c.inventory_item_id
  join public.medicine_products m on m.id = i.product_id
  where c.user_id = uid;

  -- Reserve stock now; it is released if the order is cancelled before dispatch.
  update public.inventory_items i set quantity_available = i.quantity_available - c.quantity
  from public.cart_items c where c.user_id = uid and c.inventory_item_id = i.id;

  delete from public.cart_items where user_id = uid;

  insert into public.order_events (order_id, status, actor_id, actor_kind, note)
  values (new_order, 'pending_payment', uid, 'patient', 'Order placed. Stock reserved while you pay.');

  return new_order;
exception
  when unique_violation then
    -- A concurrent submission with the same key won the race: return its order.
    select id into existing from public.orders where idempotency_key = p_idempotency_key and patient_id = uid;
    if existing is not null then return existing; end if;
    raise;
end;
$$;

-- The order state machine. Each allowed move names who may make it.
create or replace function public.transition_order(p_order uuid, p_to public.order_status, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  kinds text[];
  allowed text[];
  acting text;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'unknown order' using errcode = 'P0002'; end if;
  kinds := public.order_actor_kinds(o);

  allowed := case
    when o.status = 'pending_payment' and p_to = 'cancelled' then array['patient', 'admin']
    when o.status = 'awaiting_pharmacy_acceptance' and p_to = 'confirmed' then array['pharmacy']
    when o.status = 'awaiting_pharmacy_acceptance' and p_to = 'refund_processing' then array['patient', 'pharmacy', 'admin']
    when o.status = 'confirmed' and p_to = 'preparing' then array['pharmacy']
    when o.status = 'preparing' and p_to = 'ready_for_dispatch' then array['pharmacy']
    when o.status in ('confirmed', 'preparing', 'ready_for_dispatch') and p_to = 'refund_processing' then array['pharmacy', 'admin']
    when o.status = 'assigned_to_courier' and p_to = 'ready_for_dispatch' then array['admin']
    when o.status = 'assigned_to_courier' and p_to = 'out_for_delivery' then array['courier']
    when o.status = 'out_for_delivery' and p_to = 'failed_delivery' then array['courier', 'admin']
    when o.status = 'failed_delivery' and p_to = 'ready_for_dispatch' then array['admin']
    when o.status = 'failed_delivery' and p_to = 'refund_processing' then array['admin']
    else array[]::text[]
  end;

  if cardinality(allowed) = 0 then
    raise exception 'an order that is % cannot move to %', o.status, p_to using errcode = 'P0001';
  end if;
  select k into acting from unnest(allowed) k where k = any(kinds) limit 1;
  if acting is null then
    raise exception 'you are not allowed to make this change' using errcode = '42501';
  end if;
  if p_to in ('cancelled', 'refund_processing', 'failed_delivery') and coalesce(btrim(p_note), '') = '' then
    raise exception 'give a reason' using errcode = '22023';
  end if;

  if p_to in ('cancelled', 'refund_processing')
     and o.status in ('pending_payment', 'awaiting_pharmacy_acceptance', 'confirmed', 'preparing', 'ready_for_dispatch', 'assigned_to_courier') then
    perform public.release_order_stock(o.id);
  end if;
  if p_to = 'cancelled' then
    update public.payments set status = 'cancelled', failure_reason = 'order cancelled'
     where order_id = o.id and status in ('initiated', 'pending');
  end if;
  if p_to = 'ready_for_dispatch' and o.courier_id is not null then
    update public.orders set courier_id = null where id = o.id;
  end if;

  perform public.apply_order_status(o.id, p_to, acting, p_note);
end;
$$;

create or replace function public.assign_courier(p_order uuid, p_courier uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'unknown order' using errcode = 'P0002'; end if;
  if o.status <> 'ready_for_dispatch' then
    raise exception 'only orders that are ready for dispatch can be assigned' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.courier_profiles cp
    join public.user_roles ur on ur.user_id = cp.user_id and ur.role = 'courier' and ur.revoked_at is null
    where cp.user_id = p_courier and cp.verification_status = 'verified'
  ) then
    raise exception 'only verified delivery partners can be assigned' using errcode = 'P0001';
  end if;
  update public.orders set courier_id = p_courier, handover_attempts = 0 where id = o.id;
  perform public.apply_order_status(o.id, 'assigned_to_courier', 'admin', null);
end;
$$;

-- The courier completes delivery by entering the code the patient sees. Five wrong tries lock it.
create or replace function public.confirm_delivery(p_order uuid, p_code text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.courier_id is distinct from (select auth.uid()) or not public.has_role('courier') then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if o.status <> 'out_for_delivery' then
    raise exception 'this order is not out for delivery' using errcode = 'P0001';
  end if;
  if o.handover_attempts >= 5 then
    return 'locked';
  end if;
  if p_code is distinct from o.handover_code then
    update public.orders set handover_attempts = handover_attempts + 1 where id = o.id;
    return case when o.handover_attempts + 1 >= 5 then 'locked' else 'wrong_code' end;
  end if;
  perform public.apply_order_status(o.id, 'delivered', 'courier', 'Handover code confirmed.');
  return 'delivered';
end;
$$;

-- What a courier needs, and nothing clinical: no medicine names, no prescription.
create or replace function public.courier_assignments()
returns table (
  order_id uuid, order_number text, status public.order_status, updated_at timestamptz,
  pharmacy_name text, pharmacy_address text, pharmacy_phone text, pharmacy_lat double precision, pharmacy_lng double precision,
  delivery_address jsonb, delivery_lat double precision, delivery_lng double precision,
  recipient_name text, recipient_phone text, item_count bigint, handover_locked boolean
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.has_role('courier') then raise exception 'not authorised' using errcode = '42501'; end if;
  return query
  select o.id, o.order_number, o.status, o.updated_at,
         ph.name, ph.address_line, ph.phone,
         extensions.st_y(ph.location::extensions.geometry), extensions.st_x(ph.location::extensions.geometry),
         o.delivery_address,
         extensions.st_y(o.delivery_location::extensions.geometry), extensions.st_x(o.delivery_location::extensions.geometry),
         o.recipient_name,
         case when o.status in ('assigned_to_courier', 'out_for_delivery') then '+' || ltrim(u.phone, '+') end,
         (select coalesce(sum(oi.quantity), 0) from public.order_items oi where oi.order_id = o.id),
         o.handover_attempts >= 5
  from public.orders o
  join public.pharmacies ph on ph.id = o.pharmacy_id
  join auth.users u on u.id = o.patient_id
  where o.courier_id = (select auth.uid())
    and (o.status in ('assigned_to_courier', 'out_for_delivery', 'failed_delivery')
         or (o.status = 'delivered' and o.updated_at > now() - interval '24 hours'))
  order by o.updated_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments. Only the server (service role) records provider outcomes.
-- ---------------------------------------------------------------------------

create or replace function public.start_payment(p_order uuid, p_provider text, p_phone text, p_idempotency_key uuid)
returns table (payment_id uuid, amount_minor int, currency char(3), status public.payment_status)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  o public.orders;
  p public.payments;
begin
  select * into o from public.orders where id = p_order and patient_id = (select auth.uid()) for update;
  if not found then raise exception 'unknown order' using errcode = 'P0002'; end if;

  select * into p from public.payments where idempotency_key = p_idempotency_key and order_id = o.id;
  if found then return query select p.id, p.amount_minor, p.currency, p.status; return; end if;

  if o.status <> 'pending_payment' then
    raise exception 'this order is not waiting for payment' using errcode = 'P0001';
  end if;

  -- One payment in flight at a time. A request older than 3 minutes is treated as abandoned;
  -- if the provider later confirms it anyway, record_payment_result still honours it.
  update public.payments set status = 'failed', failure_reason = 'No confirmation received in time.'
   where order_id = o.id and status in ('initiated', 'pending') and created_at < now() - interval '3 minutes';
  if exists (select 1 from public.payments where order_id = o.id and status in ('initiated', 'pending')) then
    raise exception 'a payment request is already waiting for your confirmation' using errcode = 'P0001';
  end if;

  insert into public.payments (order_id, provider, amount_minor, currency, payer_phone, idempotency_key)
  values (o.id, p_provider, o.total_minor, o.currency, nullif(p_phone, ''), p_idempotency_key)
  returning * into p;
  return query select p.id, p.amount_minor, p.currency, p.status;
end;
$$;

create or replace function public.attach_payment_reference(p_payment uuid, p_reference text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.payments set provider_reference = p_reference, status = 'pending'
   where id = p_payment and status = 'initiated';
end;
$$;

create or replace function public.fail_payment_start(p_payment uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.payments set status = 'failed', failure_reason = left(p_reason, 300)
   where id = p_payment and status in ('initiated', 'pending');
end;
$$;

-- Records a provider callback exactly once. Returns what happened, for logging.
create or replace function public.record_payment_result(
  p_provider text, p_event_key text, p_payload_sha256 text, p_reference text,
  p_success boolean, p_amount_minor int, p_receipt text, p_reason text
)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  p public.payments;
  o public.orders;
  result text;
begin
  begin
    insert into public.payment_webhook_events (provider, event_key, payload_sha256, outcome)
    values (p_provider, p_event_key, p_payload_sha256, 'processing');
  exception when unique_violation then
    return 'duplicate';
  end;

  select * into p from public.payments where provider = p_provider and provider_reference = p_reference for update;
  if not found then
    result := 'unknown_payment';
  elsif p.status = 'succeeded' then
    result := 'already_succeeded';
  elsif not p_success then
    update public.payments set status = 'failed', failure_reason = left(coalesce(p_reason, 'Payment was not completed.'), 300)
     where id = p.id;
    result := 'failed';
  elsif p_amount_minor is distinct from p.amount_minor then
    update public.payments set status = 'failed', failure_reason = 'Amount did not match the order total; flagged for review.'
     where id = p.id;
    result := 'amount_mismatch';
  else
    update public.payments set status = 'succeeded', provider_receipt = p_receipt, failure_reason = null where id = p.id;
    select * into o from public.orders where id = p.order_id for update;
    if o.status = 'pending_payment' then
      perform public.apply_order_status(o.id, 'awaiting_pharmacy_acceptance', 'payment_provider', 'Payment confirmed by the provider.');
      result := 'succeeded';
    else
      -- Money arrived for an order that is no longer payable (e.g. it expired): never keep it.
      perform public.apply_order_status(o.id, 'refund_processing', 'system',
        'Payment arrived after the order was ' || replace(o.status::text, '_', ' ') || '. A refund is being arranged.');
      result := 'succeeded_late_refund';
    end if;
  end if;

  update public.payment_webhook_events w set outcome = result
   where w.provider = p_provider and w.event_key = p_event_key;
  return result;
end;
$$;

create or replace function public.record_refund(p_order uuid, p_reference text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  p public.payments;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found or o.status <> 'refund_processing' then
    raise exception 'this order is not awaiting a refund' using errcode = 'P0001';
  end if;
  select * into p from public.payments where order_id = o.id and status = 'succeeded';
  if not found then raise exception 'no successful payment to refund' using errcode = 'P0001'; end if;
  if coalesce(btrim(p_reference), '') = '' then
    raise exception 'record the provider refund reference' using errcode = '22023';
  end if;
  insert into public.refunds (order_id, payment_id, amount_minor, provider_reference, recorded_by)
  values (o.id, p.id, p.amount_minor, btrim(p_reference), (select auth.uid()));
  perform public.apply_order_status(o.id, 'refunded', 'admin', 'Refund reference ' || btrim(p_reference));
end;
$$;

-- Unpaid orders expire after 30 minutes (unless a payment is still being confirmed) and release their stock.
create or replace function public.expire_unpaid_orders()
returns int language plpgsql security definer set search_path = '' as $$
declare
  o record;
  n int := 0;
begin
  for o in
    select id from public.orders ord
    where ord.status = 'pending_payment' and ord.created_at < now() - interval '30 minutes'
      and not exists (select 1 from public.payments p where p.order_id = ord.id
                      and p.status in ('initiated', 'pending') and p.updated_at > now() - interval '10 minutes')
    for update skip locked
  loop
    perform public.release_order_stock(o.id);
    update public.payments set status = 'cancelled', failure_reason = 'Order expired before payment.'
     where order_id = o.id and status in ('initiated', 'pending');
    perform public.apply_order_status(o.id, 'cancelled', 'system', 'Not paid within 30 minutes. Stock released.');
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function
  public.stamp_pharmacy_verifier(), public.stamp_licence_checker(), public.stamp_staff_registration(),
  public.stamp_courier_verifier(), public.release_order_stock(uuid),
  public.apply_order_status(uuid, public.order_status, text, text), public.order_actor_kinds(public.orders),
  public.attach_payment_reference(uuid, text), public.fail_payment_start(uuid, text),
  public.record_payment_result(text, text, text, text, boolean, int, text, text), public.expire_unpaid_orders()
from public, anon, authenticated;

grant execute on function public.submit_prescription(uuid, text, text, jsonb, text, uuid) to authenticated;
grant execute on function public.review_prescription(uuid, public.prescription_status, text, date, jsonb) to authenticated;
grant execute on function public.withdraw_prescription(uuid) to authenticated;
grant execute on function public.prescription_file_path(uuid) to authenticated;
grant execute on function public.place_order(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.transition_order(uuid, public.order_status, text) to authenticated;
grant execute on function public.assign_courier(uuid, uuid) to authenticated;
grant execute on function public.confirm_delivery(uuid, text) to authenticated;
grant execute on function public.courier_assignments() to authenticated;
grant execute on function public.start_payment(uuid, text, text, uuid) to authenticated;
grant execute on function public.record_refund(uuid, text) to authenticated;

-- Server-only (payment provider callbacks and scheduled jobs).
grant execute on function public.attach_payment_reference(uuid, text) to service_role;
grant execute on function public.fail_payment_start(uuid, text) to service_role;
grant execute on function public.record_payment_result(text, text, text, text, boolean, int, text, text) to service_role;
grant execute on function public.expire_unpaid_orders() to service_role;
