-- Two independent fixes:
--
-- 1. An invite can now optionally name which person in the tree it's for.
--    redeem_invite() carries that through to the new family_members row, so
--    joining via that link auto-highlights the right node in Tree — no
--    separate manual step in Admin -> Roster needed (that picker still
--    exists as the fallback/self-correction path).
--
-- 2. "Born"/"Died" values that only ever had a year (bulk xlsx import, the
--    quick +Add family member flow, the Family Builder wizard) were being
--    silently stored as `YYYY-01-01`, indistinguishable from a real January
--    1st date — the Dates Vault then faithfully listed every one of them as
--    a real day. Adds an explicit year-only flag so the Vault can tell the
--    difference.

alter table invites add column person_id text;
alter table invites
  add constraint invites_person_id_fkey
  foreign key (family_id, person_id) references people(family_id, id) on delete set null;

alter table people add column born_year_only boolean not null default false;
alter table people add column died_year_only boolean not null default false;

-- Best-effort backfill for what's already in the database: can't be 100%
-- certain (a handful of people really are born on January 1st), but leaving
-- already-fabricated dates rendering as real ones in the Vault is worse.
update people set born_year_only = true where born is not null and to_char(born, 'MM-DD') = '01-01';
update people set died_year_only = true where died is not null and to_char(died, 'MM-DD') = '01-01';

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

  -- Only carry the invite's person link through if nobody else in this
  -- family has already claimed that person (e.g. two invites targeting the
  -- same person, or a manual Roster link made in the meantime) — a
  -- redundant unlinked join is a much smaller problem than blocking someone
  -- from joining their own family over a stale link.
  -- Bare `family_id` here would be ambiguous against this function's own
  -- `returns table(family_id uuid, ...)` OUT parameter (the exact bug a
  -- prior migration fixed for the pre-existing "already a member" check) —
  -- the table alias avoids it.
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
