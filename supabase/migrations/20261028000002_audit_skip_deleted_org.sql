-- Deleting a whole company cascades to its bookings and fines. The audit trigger then
-- tried to log those deletions for a company that no longer exists, which failed the
-- foreign key and blocked the deletion. Skip logging when the company itself is gone.

create or replace function private.write_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_row jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  new_row jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  org uuid := coalesce(new_row ->> 'organization_id', old_row ->> 'organization_id')::uuid;
  diff jsonb := '{}'::jsonb;
  k text;
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations where id = org) then
    return null;
  end if;
  for k in select jsonb_object_keys(old_row || new_row) loop
    if k not in ('updated_at', 'created_at')
       and (old_row -> k) is distinct from (new_row -> k) then
      diff := diff || jsonb_build_object(k, jsonb_build_object('old', old_row -> k, 'new', new_row -> k));
    end if;
  end loop;
  if diff <> '{}'::jsonb then
    insert into public.audit_log (organization_id, actor_id, table_name, record_id, action, changes)
    values (org, auth.uid(), tg_table_name, coalesce(new_row ->> 'id', old_row ->> 'id')::uuid, tg_op, diff);
  end if;
  return null;
end $$;
