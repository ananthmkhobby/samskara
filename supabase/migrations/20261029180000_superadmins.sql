-- Replaces the shared ADMIN_PROVISION_SECRET model for human superadmin
-- actions with real per-operator authentication (docs/ARCHITECTURE_REVIEW.md
-- §2/§9, action item #8). The shared secret gated every superadmin
-- endpoint (provision-family, manage-plan, broadcast, blog-team,
-- track-click, password-reset-requests) with one string that can't be
-- revoked for one person without breaking it for everyone, never expires,
-- and (being typed into a browser field and kept in sessionStorage) is
-- more exposed than a real session token needs to be.
--
-- CRON_SECRET is deliberately untouched — that one gates Vercel's own
-- scheduled GET request to api/broadcast.js, a service-to-service call
-- with no human operator behind it, so there's no "second admin" story
-- that applies to it the way there is for ADMIN_PROVISION_SECRET.
create table superadmins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table superadmins enable row level security;

-- Self-read only, mirroring family_members' own "no direct client write"
-- posture — this lets the UI check "am I a superadmin" with a plain RLS
-- query instead of a round trip to a serverless function, but granting
-- someone superadmin access is always a manual, direct-SQL action (there
-- is no in-app "make me a superadmin" flow, intentionally).
create policy "superadmin can read own row" on superadmins for select
  using (user_id = auth.uid());

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from superadmins where user_id = auth.uid());
$$;

grant execute on function public.is_superadmin() to authenticated;
