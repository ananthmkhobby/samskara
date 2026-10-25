-- Shared groundwork for automated push notifications (last-activity
-- re-engagement, "tell us more about this photo" prompts) — two tables,
-- service-role only, no new RPCs yet since nothing calls them until the
-- actual cron jobs exist.

-- Records every automated send, so a future job can check "have I already
-- nudged this person recently" before sending again, and so there's an
-- audit trail for debugging — same spirit as whatsapp_messages. Not used
-- for the admin composer or the test-push action (those are one-off,
-- deliberate sends, not something that needs a repeat-suppression check).
-- No client policies at all: only a server-side cron job ever reads or
-- writes this, same posture as whatsapp_connections.
create table notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('reengagement', 'photo_prompt')),
  -- Deliberately text, not a typed FK: 'photo_prompt' references a
  -- contributions.id (bigint today), 'reengagement' has no reference at
  -- all. A loosely-typed column here is simpler than two nullable FK
  -- columns for two mutually-exclusive cases.
  reference_id text,
  sent_at timestamptz not null default now()
);
alter table notification_log enable row level security;

-- The lookup every future cron run needs: "has this user already gotten
-- a notification of this type (optionally for this exact reference)
-- recently?" — covers both "don't re-nudge within N days" and "don't
-- ask about the same photo twice" in one index.
create index notification_log_user_type_sent_idx on notification_log (user_id, type, sent_at desc);

-- Per-user opt-in for each automated category, deliberately separate
-- columns rather than one blanket toggle — same reasoning as
-- whatsapp_notification_prefs splitting "connected" from "wants nudges":
-- someone might want a photo-detail prompt but not a come-back-and-login
-- nudge, or vice versa. Both default off; nothing sends until a user
-- explicitly turns one on.
create table push_notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reengagement_enabled boolean not null default false,
  photo_prompt_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table push_notification_prefs enable row level security;

-- Explicit, ahead of Supabase's 2026-10-30 Data API cutover — see
-- 20261017200000_whatsapp_nudge_optin.sql for the first time this was
-- caught. A user needs to read/write their own prefs directly (an
-- eventual settings toggle, same shape as the WhatsApp nudge toggle).
grant select, insert, update on push_notification_prefs to authenticated;

create policy "read own push notification prefs" on push_notification_prefs
  for select using (user_id = auth.uid());
create policy "write own push notification prefs" on push_notification_prefs
  for insert with check (user_id = auth.uid());
create policy "update own push notification prefs" on push_notification_prefs
  for update using (user_id = auth.uid());
