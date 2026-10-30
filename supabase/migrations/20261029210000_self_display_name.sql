-- Real gap found while testing Fast Family Onboarding: there was no
-- self-service way for a member to set or correct their own display name
-- at all. update_member_display_name (familyDb.js) is Head-only by RLS
-- ("head can update own roster"); the only other place a name gets set is
-- redeem_invite()'s optional p_display_name at signup time, which is easy
-- to miss (e.g. the "I already have an account" path never shows that
-- field) or simply never asked for someone created via
-- create-member-login.js. RelationshipPathBuilder.jsx now asks for and
-- confirms this directly, backed by this RPC.
create or replace function public.set_my_display_name(p_display_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_family_id uuid := current_family_id();
begin
  if v_family_id is null then
    raise exception 'You are not currently in a family.';
  end if;
  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'Enter a name.';
  end if;
  update family_members set display_name = trim(p_display_name)
    where family_id = v_family_id and user_id = auth.uid();
end;
$$;
grant execute on function public.set_my_display_name(text) to authenticated;
