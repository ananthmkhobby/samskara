-- In-app admin promotion. Previously the only way to make someone an Admin
-- was a direct database edit (documented as a real gap on the Help page).
-- Restricted to the Family Head, same reasoning as "head can delete own
-- people" — deliberately no demo-family exception here, unlike most other
-- policies: role changes are sensitive enough that even the open demo
-- shouldn't allow arbitrary role edits from anonymous/unauthenticated
-- traffic.
create policy "head can update own roster" on family_members for update
  using (family_id = current_family_id() and current_family_role() = 'head')
  with check (family_id = current_family_id() and current_family_role() = 'head');

-- redeem_invite() never stored a display name, even though the join form
-- already collects one at signup — every invited member showed up as
-- unnamed, which made a roster view for promotion useless. Adds an
-- optional p_display_name (default null keeps old 1-arg callers working)
-- and stores it on the new membership row.
drop function if exists public.redeem_invite(text);
create function public.redeem_invite(p_code text, p_display_name text default null)
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

  insert into family_members (family_id, user_id, role, display_name)
  values (v_invite.family_id, auth.uid(), 'member', nullif(trim(p_display_name), ''));

  update invites set used_by = auth.uid(), used_at = now() where id = v_invite.id;

  insert into user_preferences (user_id, active_family_id) values (auth.uid(), v_invite.family_id)
    on conflict (user_id) do update set active_family_id = excluded.active_family_id;

  return query select v_invite.family_id, 'member'::family_role;
end;
$$;

grant execute on function public.redeem_invite(text, text) to authenticated;
