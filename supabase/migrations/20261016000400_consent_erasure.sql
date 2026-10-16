-- Consent records are append-only for everyone, but they must not block account erasure
-- (Data Protection Act 2019 data-subject requests). Allow deletes only when they cascade
-- from the user's account being deleted.
create or replace function public.consent_records_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from auth.users u where u.id = old.user_id) then
    return old; -- the owning account is being erased
  end if;
  raise exception 'consent_records is append-only';
end;
$$;

drop trigger consent_records_immutable on public.consent_records;
create trigger consent_records_immutable before update or delete on public.consent_records
  for each row execute function public.consent_records_guard();
