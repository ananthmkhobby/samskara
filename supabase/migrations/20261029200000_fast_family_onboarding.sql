-- Fast Family Onboarding (FFO) Phase 1 — see docs/FAST_FAMILY_ONBOARDING.md
-- for the full design. Lets a joining member assert who they are relative
-- to someone already in the tree, even when the people in between aren't
-- known yet, without ever inventing a parent/grandparent/spouse to force a
-- connected-looking tree — and gives admin a single "Needs Connection"
-- queue instead of a silent, unsurfaced gap. Entirely additive: every new
-- column is nullable/safely defaulted, every new table is new, and every
-- existing RPC (redeem_invite, register_new_family, create-member-login,
-- set_member_person_link, reassign_parents) is untouched.

-- Today, placement is implicit: a nonzero family_members.person_id means
-- "connected," null means "not" — with no visibility into which members
-- are stuck that way. Making it an explicit column lets the admin
-- workbench query it directly. Backfilled to match today's reality exactly
-- (PLACED_CONFIRMED wherever person_id is already set, UNANCHORED where
-- it's null) — this changes nothing about any existing member's actual
-- access or behavior, it only makes a gap that already existed visible.
alter table family_members add column placement_status text;
update family_members set placement_status = case when person_id is not null then 'PLACED_CONFIRMED' else 'UNANCHORED' end;
alter table family_members alter column placement_status set not null;
-- 'UNANCHORED', not 'PLACED_CONFIRMED' — the backfill above used
-- PLACED_CONFIRMED for EXISTING rows because that matched their reality
-- (person_id already set), but a fail-safe default for NEW rows going
-- forward has to be the opposite: assume NOT connected unless a write
-- path explicitly says otherwise. redeem_invite() below is updated to set
-- this explicitly when an invite carries a pre-picked person_id;
-- register_new_family() and create-member-login.js correctly fall
-- through to this default (no person link at creation = genuinely
-- unanchored, not a gap to accidentally mark confirmed).
alter table family_members alter column placement_status set default 'UNANCHORED';
alter table family_members add constraint family_members_placement_status_check
  check (placement_status in ('UNANCHORED', 'ANCHORED_UNRESOLVED', 'PLACED_CONFIRMED'));

-- null (the default) = an ordinary confirmed person, exactly like every
-- existing row today — zero behavior change for anything that already
-- exists. 'PROVISIONAL' flags a named-but-unclaimed placeholder created
-- through create_provisional_person() below; it is never auto-promoted —
-- an admin must explicitly confirm it via resolve_workbench_task().
alter table people add column provisional_status text check (provisional_status is null or provisional_status = 'PROVISIONAL');
alter table people add column created_via text;

-- Lets an inviter say "this is for my cousin Ramesh, who isn't in the tree
-- yet" at invite-creation time — today's invites.person_id only supports
-- picking an EXISTING person. Purely additive to the existing invites row.
alter table invites add column proposed_person_name text;

-- Re-creates redeem_invite() to (a) correctly set the new
-- placement_status column (PLACED_CONFIRMED only when the invite
-- actually carried a surviving person_id link, UNANCHORED otherwise) and
-- (b) hand back proposed_person_name so the joiner's RelationshipPathBuilder
-- can pre-fill it — a client-side member has no SELECT access to invites
-- at all (moderator-only read policy), so the only way to surface this
-- without a new RLS hole is to return it from here, where the invite row
-- is already loaded under security-definer privileges. The return TYPE
-- is changing (one more column), which Postgres doesn't allow via a bare
-- CREATE OR REPLACE, hence the explicit DROP first. Everything else is
-- byte-for-byte identical to the version from
-- 20260803120100_fix_redeem_invite_person_link_ambiguity.sql — no
-- existing behavior changes for any caller.
drop function if exists public.redeem_invite(text, text);
create function public.redeem_invite(p_code text, p_display_name text default null)
returns table(family_id uuid, role family_role, proposed_person_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_invite invites%rowtype;
  v_person_id text;
begin
  select * into v_invite from invites where code = p_code for update;
  if v_invite.id is null then raise exception 'Invalid invite code.'; end if;
  if v_invite.used_at is not null then raise exception 'This invite has already been used.'; end if;
  if v_invite.expires_at < now() then raise exception 'This invite has expired.'; end if;
  if exists (select 1 from family_members fm where fm.user_id = auth.uid() and fm.family_id = v_invite.family_id) then
    raise exception 'You already belong to this family.';
  end if;

  v_person_id := v_invite.person_id;
  if v_person_id is not null and exists (
    select 1 from family_members fm2 where fm2.family_id = v_invite.family_id and fm2.person_id = v_person_id
  ) then
    v_person_id := null;
  end if;

  insert into family_members (family_id, user_id, role, display_name, person_id, placement_status)
  values (v_invite.family_id, auth.uid(), 'member', nullif(trim(p_display_name), ''), v_person_id,
          case when v_person_id is not null then 'PLACED_CONFIRMED' else 'UNANCHORED' end);

  update invites set used_by = auth.uid(), used_at = now() where id = v_invite.id;

  insert into user_preferences (user_id, active_family_id) values (auth.uid(), v_invite.family_id)
    on conflict (user_id) do update set active_family_id = excluded.active_family_id;

  return query select v_invite.family_id, 'member'::family_role, v_invite.proposed_person_name;
end;
$$;
grant execute on function public.redeem_invite(text, text) to authenticated;

-- One flat row per claim — Phase 1's relationship questions are bounded
-- (anchor -> relationship type -> optional side/named-missing-person, at
-- most two follow-ups), so this doesn't need the ordered multi-step
-- sub-table a deeper version of this feature might eventually want.
create table relationship_path_claims (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  family_member_id uuid not null references family_members(id) on delete cascade,
  anchor_person_id text,
  asserted_relationship text not null,
  branch_side text,
  connecting_person_name text,
  provisional_person_created boolean not null default false,
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED', 'CLOSED_UNRESOLVED')),
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (family_id, anchor_person_id) references people(family_id, id) on delete set null
);
alter table relationship_path_claims enable row level security;

-- No insert/update policy at all — same posture as family_members and
-- invites: rows are only ever written through the security-definer RPCs
-- below, which do their own targeted authorization.
create policy "moderator can read claims" on relationship_path_claims for select
  using (family_id = current_family_id() and is_moderator());
create policy "member can read own claims" on relationship_path_claims for select
  using (exists (select 1 from family_members fm where fm.id = family_member_id and fm.user_id = auth.uid()));

-- The single queue the admin "Needs Connection" workbench reads from.
-- Phase 1 covers the 4 cases that actually matter in practice; more
-- task_type values can be added later without a schema rewrite.
create table ffo_workbench_tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  family_member_id uuid references family_members(id) on delete set null,
  path_claim_id uuid references relationship_path_claims(id) on delete set null,
  provisional_person_id text,
  task_type text not null check (task_type in ('UNLINKED_MEMBER', 'UNRESOLVED_PATH', 'PROVISIONAL_PERSON', 'POSSIBLE_DUPLICATE')),
  status text not null default 'OPEN' check (status in ('OPEN', 'SNOOZED', 'RESOLVED', 'CLOSED_UNRESOLVED')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  foreign key (family_id, provisional_person_id) references people(family_id, id) on delete set null
);
alter table ffo_workbench_tasks enable row level security;

-- Moderator-only read — this is the admin queue, not something a member
-- needs direct row access to (their own placement_status is already
-- visible to them via the existing roster read policy on family_members).
create policy "moderator can read workbench tasks" on ffo_workbench_tasks for select
  using (family_id = current_family_id() and is_moderator());

-- Any ACTIVE member can assert a claim about THEMSELVES — never
-- moderator-gated, since this only records an assertion, it never writes
-- to people/parents directly. The caller's own family_members row is
-- resolved server-side from auth.uid() + current_family_id(); there is no
-- way to submit a claim "for" someone else's membership.
create or replace function public.submit_relationship_path_claim(
  p_anchor_person_id text, p_relationship text, p_branch_side text default null, p_connecting_person_name text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_family_id uuid := current_family_id();
  v_member_id uuid;
  v_claim_id uuid;
begin
  if v_family_id is null then
    raise exception 'You are not currently in a family.';
  end if;
  select id into v_member_id from family_members where family_id = v_family_id and user_id = auth.uid();
  if v_member_id is null then
    raise exception 'No membership found for your account in this family.';
  end if;
  if coalesce(trim(p_relationship), '') = '' then
    raise exception 'Choose a relationship.';
  end if;
  if p_anchor_person_id is not null and not exists (select 1 from people where family_id = v_family_id and id = p_anchor_person_id) then
    raise exception 'That person is not in this family.';
  end if;

  insert into relationship_path_claims (family_id, family_member_id, anchor_person_id, asserted_relationship, branch_side, connecting_person_name)
  values (v_family_id, v_member_id, p_anchor_person_id, trim(p_relationship), nullif(trim(p_branch_side), ''), nullif(trim(p_connecting_person_name), ''))
  returning id into v_claim_id;

  update family_members set placement_status = 'ANCHORED_UNRESOLVED' where id = v_member_id;

  insert into ffo_workbench_tasks (family_id, family_member_id, path_claim_id, task_type)
  values (v_family_id, v_member_id, v_claim_id, 'UNRESOLVED_PATH');

  return v_claim_id;
end;
$$;
grant execute on function public.submit_relationship_path_claim(text, text, text, text) to authenticated;

-- Any ACTIVE member can propose ONE named, specific real person tied to
-- their own claim — never a generic "unknown parent" placeholder (the
-- caller supplies a name; there is no "auto-create ancestor" path
-- anywhere). Hard-enforces the one-provisional-person-per-claim limit via
-- relationship_path_claims.provisional_person_created, not just a UI
-- convention. The new person NEVER gets parents/spouse set here — it
-- cannot silently become a real tree edge; only resolve_workbench_task's
-- confirm_provisional action (admin-only) can do that. Deliberately does
-- NOT loosen people's existing moderator-only RLS — this RPC does its own
-- narrow check instead, same reasoning as reassign_parents().
create or replace function public.create_provisional_person(p_path_claim_id uuid, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_claim relationship_path_claims%rowtype;
  v_family_id uuid;
  v_base text;
  v_id text;
  v_n int := 2;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Enter a name.';
  end if;

  select * into v_claim from relationship_path_claims where id = p_path_claim_id for update;
  if v_claim.id is null then
    raise exception 'No such claim.';
  end if;
  if not exists (select 1 from family_members fm where fm.id = v_claim.family_member_id and fm.user_id = auth.uid()) then
    raise exception 'That is not your claim.';
  end if;
  if v_claim.provisional_person_created then
    raise exception 'A provisional person was already created for this claim.';
  end if;

  v_family_id := v_claim.family_id;
  v_base := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'person'; end if;
  v_id := v_base;
  while exists (select 1 from people where family_id = v_family_id and id = v_id) loop
    v_id := v_base || '-' || v_n;
    v_n := v_n + 1;
  end loop;

  insert into people (family_id, id, name, gen, trust, provisional_status, created_via)
  values (v_family_id, v_id, trim(p_name), 0, 'approx', 'PROVISIONAL', 'ffo_provisional');

  update relationship_path_claims set provisional_person_created = true where id = p_path_claim_id;

  insert into ffo_workbench_tasks (family_id, path_claim_id, provisional_person_id, task_type)
  values (v_family_id, p_path_claim_id, v_id, 'PROVISIONAL_PERSON');

  return v_id;
end;
$$;
grant execute on function public.create_provisional_person(uuid, text) to authenticated;

-- Admin-only (checked against the TASK's own family_id, not
-- current_family_id() — same cross-family-safety reasoning as
-- reassign_parents/delete_person: being Admin/Head of one family must
-- never confer rights over another for a multi-family account). One
-- action-dispatched RPC rather than five separate endpoints, keeping the
-- API surface small while still giving admin a real resolving action for
-- every task type.
create or replace function public.resolve_workbench_task(p_task_id uuid, p_action text, p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_task ffo_workbench_tasks%rowtype;
  v_role text;
  v_person_id text;
begin
  select * into v_task from ffo_workbench_tasks where id = p_task_id for update;
  if v_task.id is null then
    raise exception 'No such task.';
  end if;

  select role::text into v_role from family_members where user_id = auth.uid() and family_id = v_task.family_id;
  if v_role not in ('head', 'admin') then
    raise exception 'Only an Admin or the Family Head can resolve this.';
  end if;

  if p_action = 'link_existing_person' then
    v_person_id := p_payload ->> 'person_id';
    if v_person_id is null or not exists (select 1 from people where family_id = v_task.family_id and id = v_person_id) then
      raise exception 'That person is not in this family.';
    end if;
    update family_members set person_id = v_person_id, placement_status = 'PLACED_CONFIRMED' where id = v_task.family_member_id;

  elsif p_action = 'confirm_provisional' then
    if v_task.provisional_person_id is null then
      raise exception 'This task has no provisional person to confirm.';
    end if;
    update people set provisional_status = null
      where family_id = v_task.family_id and id = v_task.provisional_person_id;
    if v_task.family_member_id is not null then
      update family_members set person_id = v_task.provisional_person_id, placement_status = 'PLACED_CONFIRMED'
        where id = v_task.family_member_id;
    end if;

  elsif p_action = 'invite_missing_person' then
    -- Reuses the EXISTING invites.person_id/proposed_person_name
    -- mechanism — no new invite infrastructure needed. The invite is
    -- created under the task's family, pre-linked to the provisional
    -- person if one exists for this task.
    insert into invites (family_id, created_by, person_id, proposed_person_name)
    values (v_task.family_id, auth.uid(), v_task.provisional_person_id, nullif(trim(p_payload ->> 'proposed_name'), ''));

  elsif p_action = 'close_unresolved' then
    if v_task.path_claim_id is not null then
      update relationship_path_claims set status = 'CLOSED_UNRESOLVED', resolution_note = p_payload ->> 'note', resolved_at = now()
        where id = v_task.path_claim_id;
    end if;
    -- Closing unresolved never changes active membership — the member
    -- stays exactly as connected (or not) as they already were.

  elsif p_action = 'mark_duplicate' then
    null; -- status transition only, handled below; no data mutation here

  else
    raise exception 'Unknown action.';
  end if;

  update ffo_workbench_tasks
    set status = case when p_action = 'close_unresolved' then 'CLOSED_UNRESOLVED' else 'RESOLVED' end,
        resolved_by = auth.uid(), resolved_at = now(), updated_at = now(),
        note = coalesce(p_payload ->> 'note', note)
    where id = p_task_id;
end;
$$;
grant execute on function public.resolve_workbench_task(uuid, text, jsonb) to authenticated;
