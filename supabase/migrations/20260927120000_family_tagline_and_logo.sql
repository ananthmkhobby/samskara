-- Two new, purely additive pieces of family identity: a short tagline shown
-- under the family's name on Home, and an uploaded emblem shown alongside
-- it. Both empty/null by default — nothing changes for a family that never
-- sets either.
alter table families add column tagline text;
alter table families add column logo_path text;

-- Same reasoning as update_family_name: an RPC rather than a plain UPDATE
-- policy on `families`, so a moderator can only ever touch the one column
-- each function names, never flame_streak or anything else on the row.
create or replace function public.update_family_tagline(p_family_id uuid, p_tagline text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_clean text;
begin
  v_clean := nullif(trim(p_tagline), '');
  if v_clean is not null and length(v_clean) > 200 then
    raise exception 'That tagline is too long (200 characters maximum).';
  end if;
  select role::text into v_role
    from family_members
   where user_id = auth.uid() and family_id = p_family_id;
  if v_role is null then
    raise exception 'You do not belong to that family.';
  end if;
  if v_role not in ('head', 'admin') then
    raise exception 'Only a Head or Admin can change the family tagline.';
  end if;
  update families set tagline = v_clean where id = p_family_id;
end;
$$;

-- logo_path holds a Storage object path (same private family-media bucket
-- and {family_id}/... convention as every other upload — see
-- uploadFamilyMedia), not the image itself, so this is a plain text column
-- update exactly like the tagline above, no Storage policy changes needed.
create or replace function public.update_family_logo(p_family_id uuid, p_logo_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  select role::text into v_role
    from family_members
   where user_id = auth.uid() and family_id = p_family_id;
  if v_role is null then
    raise exception 'You do not belong to that family.';
  end if;
  if v_role not in ('head', 'admin') then
    raise exception 'Only a Head or Admin can change the family logo.';
  end if;
  update families set logo_path = nullif(trim(p_logo_path), '') where id = p_family_id;
end;
$$;

grant execute on function public.update_family_tagline(uuid, text) to authenticated;
grant execute on function public.update_family_logo(uuid, text) to authenticated;
