-- The previous migration's new "is this person already claimed" check used
-- a bare `family_id` column reference inside the EXISTS subquery, which is
-- ambiguous against this function's own `returns table(family_id uuid, ...)`
-- OUT parameter — the exact class of bug a much earlier migration
-- (20260726120200_fix_redeem_invite_ambiguous_column.sql) already fixed once
-- for the pre-existing "already a member" check. Caught via a live
-- end-to-end test (a real redeem_invite() call failed with "column
-- reference family_id is ambiguous"). Table-aliasing the subquery fixes it.

drop function if exists public.redeem_invite(text, text);
create function public.redeem_invite(p_code text, p_display_name text default null)
returns table(family_id uuid, role family_role)
language plpgsql security definer set search_path = public as $$
declare
  v_invite invites%rowtype;
  v_person_id text;
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

  v_person_id := v_invite.person_id;
  if v_person_id is not null and exists (
    select 1 from family_members fm2 where fm2.family_id = v_invite.family_id and fm2.person_id = v_person_id
  ) then
    v_person_id := null;
  end if;

  insert into family_members (family_id, user_id, role, display_name, person_id)
  values (v_invite.family_id, auth.uid(), 'member', nullif(trim(p_display_name), ''), v_person_id);

  update invites set used_by = auth.uid(), used_at = now() where id = v_invite.id;

  insert into user_preferences (user_id, active_family_id) values (auth.uid(), v_invite.family_id)
    on conflict (user_id) do update set active_family_id = excluded.active_family_id;

  return query select v_invite.family_id, 'member'::family_role;
end;
$$;

grant execute on function public.redeem_invite(text, text) to authenticated;
