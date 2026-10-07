-- Interim stopgap: no SMTP provider is configured yet, so the existing
-- "Forgot password?" email flow (and self-registration's lack of email
-- verification) can leave someone — especially a self-registered Head, who
-- has no Admin above them to reset them in-app — with no recovery path at
-- all. This table just captures a request for a human (the app owner, via
-- /superadmin) to act on manually; it does not send or reset anything
-- itself. Revisit once real email (or a WhatsApp-based recovery path)
-- exists.
create table password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  note text,
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table password_reset_requests enable row level security;
-- No policies at all: closed to both anon and authenticated clients. There
-- is no family_id to scope by (the submitter isn't signed in and may not
-- know which family they belong to) — every read/write goes through the
-- two service-role, shared-secret-gated endpoints instead, the same trust
-- model api/provision-family.js already uses.
