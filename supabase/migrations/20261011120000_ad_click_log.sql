-- Operator-level marketing analytics — not scoped to any family, so unlike
-- almost every other table in this schema there is no family_id and no RLS
-- policy at all. Only the service-role api/track-click.js endpoint writes;
-- only the admin-secret-gated list action (same endpoint) reads. Same
-- trust model as password_reset_requests.
create table ad_click_log (
  id uuid primary key default gen_random_uuid(),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  user_agent text,
  landing_path text,
  country text,
  region text,
  city text,
  latitude text,
  longitude text,
  -- One-way hash of the request IP, never the raw address — exists so
  -- repeated clicks from the same visitor in a short window (a clear sign
  -- of invalid/bot clicks on a paid CPC campaign) can be detected later
  -- without storing anything personally identifying.
  ip_hash text,
  created_at timestamptz not null default now()
);
alter table ad_click_log enable row level security;
