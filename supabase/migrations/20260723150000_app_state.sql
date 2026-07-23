-- Shared app state, replacing the per-browser localStorage blobs that used
-- to hold contributions/overrides/additions/customFamily. One row per key,
-- shared across every device that opens the app, so a family's edits and
-- pending contributions become visible to everyone rather than trapped in
-- whichever browser made them.
create table if not exists app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_state enable row level security;

-- No real user accounts exist yet (the app's role system is an honor-system
-- client-side picker, not real auth), so the anon key is granted full
-- read/write for now, matching the app's current security model exactly.
-- Revisit this once real authentication is introduced.
create policy "anon read app_state" on app_state
  for select using (true);

create policy "anon write app_state" on app_state
  for insert with check (true);

create policy "anon update app_state" on app_state
  for update using (true) with check (true);
