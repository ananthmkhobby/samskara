-- Lets a family's Head/Admin generate a short, reusable, revocable code
-- that an external, loginless partner (ScanJunction's photo editor) can
-- redeem against api/gallery-export.js to pull that family's own Verified
-- photos as signed URLs. Deliberately NOT the invites pattern: invites are
-- single-use and perform an account action (join a family); this is
-- reusable within its validity window and strictly read-only — redeeming
-- it never touches family_members or auth.users.
create table gallery_export_codes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table gallery_export_codes enable row level security;

create policy "moderator can read own gallery export codes" on gallery_export_codes for select
  using (family_id = current_family_id() and is_moderator());
create policy "moderator can create gallery export code" on gallery_export_codes for insert
  with check (family_id = current_family_id() and is_moderator() and created_by = auth.uid());
-- New kind of policy for this codebase: invites has no update policy at
-- all (used_by/used_at are only ever written by the security-definer
-- redeem_invite() RPC). Here a moderator revokes directly from the client,
-- so this needs an update policy — scoped to rows in their own family.
-- Postgres RLS can't restrict *which columns* an UPDATE touches, only
-- which rows qualify, so this alone doesn't stop a crafted client update
-- from also touching expires_at/code — acceptable given only an
-- already-authenticated moderator of that family can reach it (same trust
-- level invites already extend for revocation), and familyDb.js's own
-- revokeGalleryExportCode() only ever sends {revoked_at}. A security-
-- definer revoke() RPC is a possible later hardening step, not needed now.
create policy "moderator can revoke own gallery export code" on gallery_export_codes for update
  using (family_id = current_family_id() and is_moderator())
  with check (family_id = current_family_id() and is_moderator());
