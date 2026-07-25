-- Fix: the added already-a-member check referenced the bare column name
-- `family_id`, which is ambiguous against this function's own
-- `returns table(family_id uuid, ...)` output column of the same name —
-- PL/pgSQL raised "column reference family_id is ambiguous" on every call.
-- Qualifying it with the table name resolves it.
create or replace function public.redeem_invite(p_code text)
returns table(family_id uuid, role family_role)
language plpgsql security definer set search_path = public as $$
declare
  v_invite invites%rowtype;
begin
  select * into v_invite from invites where code = p_code for update;
  if v_invite.id is null then
    raise exception 'Invalid invite code.';
  end if;
  if v_invite.used_at is not null then
    raise exception 'This invite has already been used.';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'This invite has expired.';
  end if;
  if exists (select 1 from family_members fm where fm.user_id = auth.uid() and fm.family_id = v_invite.family_id) then
    raise exception 'You already belong to this family.';
  end if;

  insert into family_members (family_id, user_id, role)
  values (v_invite.family_id, auth.uid(), 'member');

  update invites set used_by = auth.uid(), used_at = now() where id = v_invite.id;

  insert into user_preferences (user_id, active_family_id) values (auth.uid(), v_invite.family_id)
    on conflict (user_id) do update set active_family_id = excluded.active_family_id;

  return query select v_invite.family_id, 'member'::family_role;
end;
$$;
