-- Lets the app-wide superadmin (not a family role — the /superadmin
-- secret-gated screen) compose one recurring push notification sent to
-- every subscribed user across every family, on a frequency they can
-- change any time. Deliberately a singleton table (id is always `true`,
-- enforced by the check constraint) — there's exactly one configured
-- broadcast, edited in place, not a list of campaigns. Service-role only,
-- no client policies at all: only api/provision-family.js's
-- adminSecret-gated actions (and the cron trigger) ever touch this.
create table superadmin_broadcast (
  id boolean primary key default true check (id),
  title text not null default '',
  body text not null default '',
  url text not null default '/',
  frequency_days integer not null default 7 check (frequency_days >= 1),
  enabled boolean not null default false,
  last_sent_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table superadmin_broadcast enable row level security;

insert into superadmin_broadcast (id) values (true);
