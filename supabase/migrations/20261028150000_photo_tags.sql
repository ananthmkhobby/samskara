-- Lets any family member point at a specific spot in a Gallery photo and
-- label who that is — either an existing person in the tree (person_id)
-- or a free-text label for someone not identified/added yet
-- ("Grandpa's friend from the army", "unknown — ask Amma"). Deliberately
-- NOT an "add to the tree" flow — a tag is a lightweight annotation on
-- the photo, not a commitment to create a real person record. Position
-- is stored as a percentage (0-100) of the image's width/height, not
-- pixels, so a tag stays correctly placed whether the photo is shown as
-- a small Gallery thumbnail or full-screen in the lightbox.
create table photo_tags (
  id uuid primary key default gen_random_uuid(),
  contribution_id bigint not null references contributions(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  person_id text,
  label text,
  x numeric(5,2) not null check (x >= 0 and x <= 100),
  y numeric(5,2) not null check (y >= 0 and y <= 100),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint photo_tags_person_or_label check (person_id is not null or label is not null)
);
alter table photo_tags enable row level security;

create index photo_tags_contribution_idx on photo_tags (contribution_id);

-- Explicit grant ahead of Supabase's 2026-10-30 Data API cutover — see
-- 20261017200000_whatsapp_nudge_optin.sql for the first time this was
-- caught and why it matters here too.
grant select, insert, delete on photo_tags to authenticated;

create policy "read own or demo photo tags" on photo_tags for select
  using (family_id = current_family_id() or family_id = '00000000-0000-0000-0000-000000000001');

-- Any family member can tag a photo — collaborative, low-stakes metadata,
-- same trust level as adding most other content in this app. No
-- moderation queue: easily correctable/removable rather than worth a
-- Pending/Verified step.
create policy "family member can tag own or demo photo" on photo_tags for insert
  with check (
    (family_id = current_family_id() and exists (select 1 from family_members where family_id = current_family_id() and user_id = auth.uid()))
    or family_id = '00000000-0000-0000-0000-000000000001'
  );

-- The tag's own creator can remove it (fixing their own mistake), or a
-- moderator can remove anyone's (same posture as "moderator can delete
-- own or demo media" for family-media storage).
create policy "creator or moderator can delete own or demo photo tag" on photo_tags for delete
  using (
    (family_id = current_family_id() and (created_by = auth.uid() or is_moderator()))
    or family_id = '00000000-0000-0000-0000-000000000001'
  );
