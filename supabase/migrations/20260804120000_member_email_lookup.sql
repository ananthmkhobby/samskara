-- Members page: a Head/Admin often finds out someone "forgot their
-- password" really means they forgot which email they signed up with in
-- the first place — self-service reset is useless until they know that.
-- auth.users is never directly queryable by clients, so this is a
-- security-definer RPC (same posture as every other family_members write
-- in this codebase) rather than a view or relaxed RLS: it returns exactly
-- one email, only for a member row already confirmed to be in the
-- caller's own active family, and only to a Head/Admin of that family.
create or replace function public.get_member_email(p_member_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_family_id uuid;
  v_user_id uuid;
  v_email text;
begin
  select family_id, user_id into v_family_id, v_user_id from family_members where id = p_member_id;
  if v_family_id is null then
    raise exception 'No such member row.';
  end if;
  if v_family_id != public.current_family_id() then
    raise exception 'That member is not in your active family.';
  end if;
  if not public.is_moderator() then
    raise exception 'Only a Head or Admin can look up a member''s email.';
  end if;
  select email into v_email from auth.users where id = v_user_id;
  return v_email;
end;
$$;

grant execute on function public.get_member_email(uuid) to authenticated;
