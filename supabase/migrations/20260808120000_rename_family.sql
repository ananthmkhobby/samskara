-- A family's name was fixed at provisioning time and could never be changed
-- afterward — not by an Admin, not even by the Head. `families` had read
-- policies only, so a typo at setup ("Talkadu Kutumba" vs "Kutumbha") became
-- a permanent support request to the operator.
--
-- Same shape and reasoning as update_member_display_name(): an RPC rather
-- than a plain UPDATE policy on `families`, because a row-level policy would
-- also expose flame_streak/flame_last_date, letting a moderator quietly game
-- the family's contribution streak. This touches only `name`.
create or replace function public.update_family_name(p_family_id uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_clean text;
begin
  v_clean := nullif(trim(p_name), '');
  if v_clean is null then
    raise exception 'A family name cannot be empty.';
  end if;
  if length(v_clean) > 80 then
    raise exception 'That family name is too long (80 characters maximum).';
  end if;
  -- Checked against the caller's own membership of the TARGET family, not
  -- current_family_id() — an account can belong to several families, and
  -- being an Admin of one must never confer rights over another.
  select role::text into v_role
    from family_members
   where user_id = auth.uid() and family_id = p_family_id;
  if v_role is null then
    raise exception 'You do not belong to that family.';
  end if;
  if v_role not in ('head', 'admin') then
    raise exception 'Only a Head or Admin can rename the family.';
  end if;
  update families set name = v_clean where id = p_family_id;
end;
$$;

grant execute on function public.update_family_name(uuid, text) to authenticated;
