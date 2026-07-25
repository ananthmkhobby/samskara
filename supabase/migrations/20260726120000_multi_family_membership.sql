-- Multi-family membership: one login can now belong to more than one
-- family (e.g. a person who's a Member of both their dad's and mom's
-- trees) and switch between them, while each family's data stays fully
-- isolated exactly as it was for a single-family account.
--
-- The mechanism is a server-verified "active family" pointer per user,
-- not a client-supplied value or a JWT claim — switching is a single
-- verified database write (via set_active_family below), not a re-login,
-- and current_family_id() can never resolve to a family the caller isn't
-- actually a member of.

create table user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_family_id uuid references families(id) on delete set null
);
alter table user_preferences enable row level security;
create policy "user can read own preferences" on user_preferences for select
  using (user_id = auth.uid());
-- No client insert/update policy — written only via set_active_family()
-- and redeem_invite(), both security definer, mirroring family_members'
-- own no-direct-write posture.

-- Was: unique(user_id) — "one family per user; no family-switching, by
-- design". Relaxed to one row per (user, family) pair so a login can hold
-- multiple memberships, while still preventing a duplicate join to the
-- same family twice.
alter table family_members drop constraint if exists family_members_user_id_key;
alter table family_members add constraint family_members_user_id_family_id_key unique (user_id, family_id);

-- A user can already read any row in their *active* family's roster (see
-- "member can read own roster" below, unchanged) — this adds the ability
-- to read their *own* rows across every family they belong to, which the
-- family switcher needs to list them. Does not expose anyone else's rows
-- in a family that isn't currently active.
create policy "user can read own memberships" on family_members for select
  using (user_id = auth.uid());

-- current_family_id() now picks, among the caller's own membership rows,
-- whichever matches their stored preference — or their earliest
-- membership if no preference is set (or the stored preference no longer
-- matches any of their rows, e.g. after being removed from that family).
-- This is a pure reordering of the caller's own rows, so it can never
-- return a family they aren't a member of, and every existing
-- single-family account behaves exactly as before with zero migration.
create or replace function public.current_family_id()
returns uuid language sql stable security definer set search_path = public as $$
  select fm.family_id
  from family_members fm
  where fm.user_id = auth.uid()
  order by
    (fm.family_id = (select up.active_family_id from user_preferences up where up.user_id = auth.uid())) desc,
    fm.created_at asc
  limit 1;
$$;

-- is_moderator()/current_family_role() previously picked an arbitrary
-- membership row (limit 1, no ordering) — harmless when a user could only
-- ever have one row, but a real privilege bug once they can have several:
-- a Head in Family A who's merely a Member in Family B could have been
-- evaluated as a moderator while viewing Family B. Both now key off
-- current_family_id() so role checks always apply to the active family.
create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','head') from family_members where user_id = auth.uid() and family_id = public.current_family_id()), false);
$$;

create or replace function public.current_family_role()
returns text language sql stable security definer set search_path = public as $$
  select role::text from family_members where user_id = auth.uid() and family_id = public.current_family_id();
$$;

-- The only way the active-family pointer ever changes: verifies real
-- membership first, so a switch can never be pointed at a family the
-- caller doesn't belong to.
create or replace function public.set_active_family(p_family_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from family_members where user_id = auth.uid() and family_id = p_family_id) then
    raise exception 'You are not a member of that family.';
  end if;
  insert into user_preferences (user_id, active_family_id) values (auth.uid(), p_family_id)
    on conflict (user_id) do update set active_family_id = excluded.active_family_id;
end;
$$;

grant execute on function public.set_active_family(uuid) to authenticated;
