-- Share Preview Service (MVP: Gallery photo only, "members" audience
-- only) — see docs/SHARE_PREVIEW_SERVICE.md for the full requirements
-- doc and the engineering decisions behind this schema. A share link
-- (token) lets an owner generate a WhatsApp-rich-preview URL for one
-- Verified, shared photo; the token itself is a locator re-validated by
-- api/share.js on every use, never proof of authorization by itself —
-- same posture as invites.code / gallery_export_codes.code.

create table share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  content_type text not null check (content_type in ('gallery_photo')),
  content_id bigint not null,
  family_id uuid not null references families(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  -- Only 'members' is actually offered in the UI for MVP — the column
  -- stays open (not a hard enum of one value) so invite-only/anyone-with-
  -- link (PRD FR-11, explicitly P1) can be added later without a schema
  -- migration, same reasoning plan_limit_overrides stays jsonb instead of
  -- dedicated columns.
  audience text not null default 'members' check (audience in ('members')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table share_links enable row level security;
-- No client policies at all, deliberately — a share token must never be
-- reachable via a client-side select, even an authorized one. Every read
-- and write goes through api/share.js under the service role, same
-- posture this project already uses for notification_log /
-- whatsapp_connections.

create index share_links_token_idx on share_links (token) where status = 'active';
create index share_links_content_idx on share_links (content_type, content_id, owner_id) where status = 'active';

create table share_previews (
  share_id uuid primary key references share_links(id) on delete cascade,
  approved_title text not null,
  approved_description text not null,
  -- 'brand': og:image is the app's own generic mark, nothing uploaded.
  -- 'photo': the owner explicitly approved a derived (resized, not
  -- original) copy of the real photo — see preview_image_path.
  preview_image_mode text not null check (preview_image_mode in ('brand', 'photo')),
  preview_image_path text,
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now()
);
alter table share_previews enable row level security;
-- Same no-client-policy posture as share_links.

create table share_events (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references share_links(id) on delete cascade,
  event_type text not null check (event_type in (
    'share_created', 'share_opened', 'access_granted', 'access_denied',
    'share_wa_clicked', 'share_copied', 'share_revoked'
  )),
  occurred_at timestamptz not null default now()
);
alter table share_events enable row level security;
-- Same no-client-policy posture — written only by api/share.js
-- (including its public, unauthenticated log-event action), never read
-- by a client directly. No admin insights UI built yet (PRD FR-12's
-- insights half is P1) — this is pure groundwork for that.

create index share_events_share_idx on share_events (share_id, event_type);

-- Public bucket for owner-approved preview images only — never the
-- original photo or its real storage path. See docs/
-- SHARE_PREVIEW_SERVICE.md's "Preview images" section for why this is a
-- separate bucket from the private family-media one.
insert into storage.buckets (id, name, public)
values ('share-previews', 'share-previews', true)
on conflict (id) do nothing;

create policy "anyone can read share preview images" on storage.objects for select
  using (bucket_id = 'share-previews');

-- Same path-prefix-is-family-id convention as family-media's own upload
-- policy, so an uploader can only ever write under their own family's
-- prefix — even though the bucket is public to read, writes stay scoped.
create policy "family member can upload own share preview image" on storage.objects for insert
  with check (
    bucket_id = 'share-previews'
    and (storage.foldername(name))[1] = current_family_id()::text
  );
