-- Records that a specific account accepted a specific version of the Privacy
-- Policy and Terms, and when.
--
-- The point of this table is evidence, not UI state: under the DPDP Act you
-- have to be able to *demonstrate* consent, so a ticked checkbox that lives
-- only in React is worth nothing. Deliberately append-only — there are select
-- and insert policies below and no update or delete policy at all, so a
-- consent record can never be rewritten after the fact through the API.
--
-- Keyed by policy version rather than a plain boolean so that a future
-- material change to the policy can ask everyone again: bump POLICY_VERSION
-- in src/lib/policy.js and every account is prompted once more, while the
-- older acceptance stays on record.

create table if not exists user_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null,
  accepted_at timestamptz not null default now(),
  -- Recorded alongside the consent because "which document did they actually
  -- agree to" is the question that matters later, and the wording lives in
  -- the app rather than the database.
  documents text not null default 'privacy-policy,terms-of-service',
  unique (user_id, policy_version)
);

alter table user_consents enable row level security;

-- A person can see their own record (so the app knows whether to prompt) and
-- create their own. Nobody can read anyone else's, including family admins:
-- consent is between the account holder and the service, not a family matter.
create policy "user reads own consents" on user_consents
  for select using (user_id = auth.uid());

create policy "user records own consent" on user_consents
  for insert with check (user_id = auth.uid());

create index if not exists user_consents_user_idx on user_consents (user_id);
