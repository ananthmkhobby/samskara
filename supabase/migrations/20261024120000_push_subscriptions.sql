-- Web Push subscriptions — one row per browser/device a user has granted
-- notification permission on (a user can have several: phone + laptop),
-- unlike whatsapp_connections' one-number-per-user shape. `endpoint` is
-- the push service URL the browser gave us (unique per subscription);
-- `p256dh`/`auth` are the two keys web-push needs to encrypt a payload to
-- it. No `family_id` here deliberately — a subscription belongs to a
-- user, not a family; which family's events it should receive pushes for
-- is resolved at send time via family_members, the same way an email
-- address isn't scoped to one family either.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;

-- Explicit grant ahead of Supabase's 2026-10-30 Data API cutover (new
-- public-schema tables stop auto-granting) — see
-- 20261017200000_whatsapp_nudge_optin.sql for the first time this was
-- caught and why it matters here too.
grant select, insert, delete on push_subscriptions to authenticated;

-- A signed-in user manages only their own subscriptions — same shape as
-- whatsapp_notification_prefs. No update policy: a subscription is
-- replaced (delete + insert), not edited, since its keys are opaque
-- browser-issued values with no meaningful partial update.
create policy "read own push subscriptions" on push_subscriptions
  for select using (user_id = auth.uid());
create policy "insert own push subscriptions" on push_subscriptions
  for insert with check (user_id = auth.uid());
create policy "delete own push subscriptions" on push_subscriptions
  for delete using (user_id = auth.uid());
