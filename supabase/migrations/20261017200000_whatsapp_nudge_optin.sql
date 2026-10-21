-- Opt-in for proactive ("nudge") WhatsApp messages — deliberately a
-- separate fact from whatsapp_connections. Meta requires its own explicit
-- opt-in for any business-initiated message sent outside the 24h window
-- after the recipient's last message; connecting a number (so Samskara can
-- receive photos/stories from them) is not, by itself, permission to also
-- message them proactively. Keeping these as two tables/columns means each
-- consent is independently auditable and revocable, matching what Meta's
-- own guidance expects (separate consent per message category).
create table whatsapp_notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nudges_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table whatsapp_notification_prefs enable row level security;

-- Explicit, not relied-on-by-default: Supabase stops auto-granting Data
-- API access to new public-schema tables from 2026-10-30 onward. Every
-- earlier migration in this repo got away with the implicit grant because
-- it predates that cutoff (or, like whatsapp_connections, never needed
-- client access at all — RLS alone denies everything there). This table
-- does need direct supabase-js access (the policies below reference
-- auth.uid()), so it needs its own explicit grant regardless of when this
-- migration actually runs. RLS still enforces which rows, same as always
-- — this only grants the API operation.
grant select, insert, update on whatsapp_notification_prefs to authenticated;

-- A signed-in user manages only their own preference — same single-row,
-- own-row shape as user_preferences' active_family_id column elsewhere in
-- this app, just its own table since this one didn't exist yet.
create policy "read own notification prefs" on whatsapp_notification_prefs
  for select using (user_id = auth.uid());
create policy "write own notification prefs" on whatsapp_notification_prefs
  for insert with check (user_id = auth.uid());
create policy "update own notification prefs" on whatsapp_notification_prefs
  for update using (user_id = auth.uid());

-- Lets the Home dashboard show/hide the "Connect on WhatsApp" promo card
-- without ever exposing whatsapp_connections itself to the client (that
-- table deliberately has no client policies at all, see its own migration)
-- — this returns only a boolean about the caller's own connection, nothing
-- about the phone number or anyone else's.
create or replace function public.is_whatsapp_connected()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from whatsapp_connections where user_id = auth.uid());
$$;
grant execute on function public.is_whatsapp_connected() to authenticated;
