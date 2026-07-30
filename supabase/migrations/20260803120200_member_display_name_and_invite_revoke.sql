-- Members page (Head/Admin): let a moderator fix a member's display name
-- (typo, or never set at signup) without a raw RLS update policy, since
-- that would need to apply to every column on family_members including
-- role/person_id — this RPC mirrors set_member_person_link()'s shape and
-- touches only display_name, so an Admin (not just Head) can safely use it
-- without gaining any role-change ability.
create or replace function public.update_member_display_name(p_member_id uuid, p_display_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_family_id uuid;
begin
  select family_id into v_family_id from family_members where id = p_member_id;
  if v_family_id is null then
    raise exception 'No such member row.';
  end if;
  if v_family_id != public.current_family_id() then
    raise exception 'That member is not in your active family.';
  end if;
  if not public.is_moderator() then
    raise exception 'Only a Head or Admin can rename a member.';
  end if;
  update family_members set display_name = nullif(trim(p_display_name), '') where id = p_member_id;
end;
$$;

grant execute on function public.update_member_display_name(uuid, text) to authenticated;

-- Members page: a moderator can see (already had select) and now revoke an
-- invite they generated for their own family, but only before it's been
-- redeemed — an already-used invite is historical record of who joined
-- through it, not something to delete out from under that membership.
create policy "moderator can delete own unused invites" on invites for delete
  using (family_id = current_family_id() and is_moderator() and used_at is null);
