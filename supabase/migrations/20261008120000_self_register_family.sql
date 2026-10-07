-- Lets a brand-new, authenticated-but-familyless user start their own
-- family archive without an invite — the second sanctioned write path onto
-- families/family_members/user_preferences alongside redeem_invite() below
-- it in history. Mirrors redeem_invite()'s hardening exactly (security
-- definer, search_path pinned) and its trust model: the caller can only
-- ever act as auth.uid(), never assert a different user or role.
--
-- 'head' is a literal in the insert below, never a parameter — this is
-- deliberate: the client can never request a role, only trigger one of two
-- fixed outcomes (this function, or redeem_invite's hardcoded 'member').
create function public.register_new_family(p_family_name text, p_display_name text default null)
returns table(family_id uuid, role family_role)
language plpgsql security definer set search_path = public as $$
declare
  v_family_id uuid;
  v_head_count int;
begin
  if coalesce(trim(p_family_name), '') = '' then
    raise exception 'Please enter a family name.';
  end if;

  select count(*) into v_head_count from family_members where user_id = auth.uid() and role = 'head';
  if v_head_count >= 5 then
    raise exception 'You have reached the maximum number of families you can create. Contact support if you need more.';
  end if;

  insert into families (name) values (trim(p_family_name)) returning id into v_family_id;

  insert into family_members (family_id, user_id, role, display_name)
  values (v_family_id, auth.uid(), 'head', nullif(trim(p_display_name), ''));

  insert into user_preferences (user_id, active_family_id) values (auth.uid(), v_family_id)
    on conflict (user_id) do update set active_family_id = excluded.active_family_id;

  return query select v_family_id, 'head'::family_role;
end;
$$;

grant execute on function public.register_new_family(text, text) to authenticated;
