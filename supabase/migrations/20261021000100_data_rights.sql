-- Phase 6: data-subject rights (Kenya Data Protection Act 2019, ss. 26, 31, 40).
-- Export is self-service. Erasure is a request that a data-protection administrator completes:
-- records the law requires us to keep (dispensing, prescriptions, clinical visit notes, payments)
-- are retained for their retention period, and everything else is removed or anonymised.

create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('export', 'erasure')),
  status text not null default 'received' check (status in ('received', 'in_progress', 'completed', 'declined')),
  reason text check (reason is null or char_length(reason) <= 1000),
  outcome_note text check (outcome_note is null or char_length(outcome_note) <= 2000),
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint dsr_completed_at check ((status in ('completed', 'declined')) = (completed_at is not null))
);
create index dsr_open on public.data_subject_requests (status, created_at) where status in ('received', 'in_progress');
create unique index dsr_one_open_erasure on public.data_subject_requests (user_id)
  where kind = 'erasure' and status in ('received', 'in_progress');

alter table public.data_subject_requests enable row level security;
create policy dsr_select on public.data_subject_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
grant select on public.data_subject_requests to authenticated;

create trigger audit_data_subject_requests after insert or update on public.data_subject_requests
  for each row execute function public.audit_row_change();

-- Records that the signed-in user downloaded a copy of their data (the export itself is built by the app under RLS).
create or replace function public.record_data_export()
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if (select count(*) from public.data_subject_requests where user_id = (select auth.uid()) and kind = 'export' and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'you have downloaded your data several times in the last hour; please try again later' using errcode = 'P0001';
  end if;
  insert into public.data_subject_requests (user_id, kind, status, completed_at)
  values ((select auth.uid()), 'export', 'completed', now()) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.request_erasure(p_reason text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if exists (select 1 from public.data_subject_requests where user_id = (select auth.uid()) and kind = 'erasure' and status in ('received', 'in_progress')) then
    raise exception 'we already have your deletion request and are working on it' using errcode = 'P0001';
  end if;
  insert into public.data_subject_requests (user_id, kind, reason)
  values ((select auth.uid()), 'erasure', nullif(btrim(p_reason), '')) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.cancel_erasure_request()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.data_subject_requests set status = 'declined', outcome_note = 'Withdrawn by the account holder.', completed_at = now()
  where user_id = (select auth.uid()) and kind = 'erasure' and status = 'received';
  if not found then raise exception 'there is no pending request you can withdraw' using errcode = 'P0001'; end if;
end;
$$;

-- What erasure would remove vs retain, so the administrator can explain it to the person.
create or replace function public.admin_erasure_preview(p_request uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  select user_id into uid from public.data_subject_requests where id = p_request and kind = 'erasure';
  if uid is null then raise exception 'unknown request' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'remove', jsonb_build_object(
      'addresses', (select count(*) from public.addresses where user_id = uid),
      'household_members', (select count(*) from public.household_members where owner_id = uid),
      'cart_items', (select count(*) from public.cart_items where user_id = uid),
      'notifications', (select count(*) from public.notifications where user_id = uid)),
    'retain', jsonb_build_object(
      'orders', (select count(*) from public.orders where patient_id = uid),
      'prescriptions', (select count(*) from public.prescriptions where patient_id = uid),
      'bookings', (select count(*) from public.care_bookings where patient_id = uid)),
    'open_orders', (select count(*) from public.orders where patient_id = uid and status in ('pending_payment', 'awaiting_pharmacy_acceptance', 'confirmed', 'preparing', 'ready_for_dispatch', 'assigned_to_courier', 'out_for_delivery', 'failed_delivery', 'refund_processing')),
    'open_bookings', (select count(*) from public.care_bookings where patient_id = uid and status in ('awaiting_acceptance', 'awaiting_payment', 'confirmed', 'en_route', 'arrived', 'in_progress', 'refund_processing')),
    'staff_roles', (select coalesce(jsonb_agg(role::text), '[]'::jsonb) from public.user_roles where user_id = uid and revoked_at is null and role::text <> 'patient')
  );
end;
$$;

-- Removes what we don't need to keep and anonymises the profile. Signing-in is disabled by the app
-- (service role, Auth admin API) after this returns. Retained records stay linked only to the opaque user id.
create or replace function public.admin_complete_erasure(p_request uuid, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r public.data_subject_requests;
  open_work int;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into r from public.data_subject_requests where id = p_request and kind = 'erasure' for update;
  if not found then raise exception 'unknown request' using errcode = 'P0002'; end if;
  if r.status not in ('received', 'in_progress') then raise exception 'this request is already closed' using errcode = 'P0001'; end if;
  if r.user_id = (select auth.uid()) then raise exception 'another administrator must handle your own request' using errcode = 'P0001'; end if;
  if coalesce(btrim(p_note), '') = '' then raise exception 'record what was removed and what was retained' using errcode = '22023'; end if;
  select (select count(*) from public.orders where patient_id = r.user_id and status in ('pending_payment', 'awaiting_pharmacy_acceptance', 'confirmed', 'preparing', 'ready_for_dispatch', 'assigned_to_courier', 'out_for_delivery', 'failed_delivery', 'refund_processing'))
       + (select count(*) from public.care_bookings where patient_id = r.user_id and status in ('awaiting_acceptance', 'awaiting_payment', 'confirmed', 'en_route', 'arrived', 'in_progress', 'refund_processing'))
    into open_work;
  if open_work > 0 then raise exception 'finish or cancel the open orders and visits first' using errcode = 'P0001'; end if;
  if exists (select 1 from public.user_roles where user_id = r.user_id and revoked_at is null and role::text <> 'patient') then
    raise exception 'revoke the person''s staff or partner roles first' using errcode = 'P0001';
  end if;

  delete from public.addresses where user_id = r.user_id;
  delete from public.household_members where owner_id = r.user_id;
  delete from public.cart_items where user_id = r.user_id;
  delete from public.notifications where user_id = r.user_id;
  update public.profiles set full_name = null where id = r.user_id;
  update public.data_subject_requests set status = 'completed', outcome_note = btrim(p_note), handled_by = (select auth.uid()), completed_at = now()
  where id = r.id;
  return r.user_id;
end;
$$;

create or replace function public.admin_decline_erasure(p_request uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if coalesce(btrim(p_note), '') = '' then raise exception 'explain why, so the person can be told' using errcode = '22023'; end if;
  update public.data_subject_requests set status = 'declined', outcome_note = btrim(p_note), handled_by = (select auth.uid()), completed_at = now()
  where id = p_request and kind = 'erasure' and status in ('received', 'in_progress');
  if not found then raise exception 'unknown or closed request' using errcode = 'P0001'; end if;
end;
$$;

-- Admins see the request queue; this is the place they can also see the requester's name.
grant execute on function public.record_data_export() to authenticated;
grant execute on function public.request_erasure(text) to authenticated;
grant execute on function public.cancel_erasure_request() to authenticated;
grant execute on function public.admin_erasure_preview(uuid) to authenticated;
grant execute on function public.admin_complete_erasure(uuid, text) to authenticated;
grant execute on function public.admin_decline_erasure(uuid, text) to authenticated;
revoke execute on function public.record_data_export(), public.request_erasure(text), public.cancel_erasure_request(),
  public.admin_erasure_preview(uuid), public.admin_complete_erasure(uuid, text), public.admin_decline_erasure(uuid, text) from anon, public;
