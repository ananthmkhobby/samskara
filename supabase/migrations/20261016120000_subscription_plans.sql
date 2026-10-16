-- Subscription tiers — Phase 1: data model only, zero enforcement yet (see
-- the plan this was built from). Every new family already gets 'starter'
-- via the column default, so self-registration needs no code change to
-- "fall under the free plan."
alter table families add column plan_tier text not null default 'starter'
  check (plan_tier in ('starter', 'rooted', 'legacy'));

-- Per-family numeric overrides, same "absent = use default" semantics
-- module_flags already uses for booleans — {} means "use plan_tier's
-- defaults for everything." Tier defaults themselves live in
-- src/lib/planTiers.js for now (Phase 1 doesn't need them in the database
-- — nothing server-side enforces a limit yet).
alter table families add column plan_limit_overrides jsonb not null default '{}'::jsonb;

-- Self-serve "I'd like to upgrade" — logged by the family's own head/admin,
-- reviewed by superadmin. No payment flow exists yet, so this is the whole
-- "upgrade" UX until one does. Same shape as the existing
-- password-reset-request flow (api/password-reset-requests.js).
create table plan_upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  requested_tier text not null check (requested_tier in ('rooted', 'legacy')),
  requested_by uuid not null references auth.users(id),
  note text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table plan_upgrade_requests enable row level security;

create policy "head or admin requests upgrade for own family" on plan_upgrade_requests
  for insert with check (family_id = current_family_id() and is_moderator());

create policy "head or admin reads own family's requests" on plan_upgrade_requests
  for select using (family_id = current_family_id());

-- No update/delete policy for ordinary members — only the service role
-- (superadmin, via api/provision-family.js) resolves these, same posture
-- as password_reset_requests.
