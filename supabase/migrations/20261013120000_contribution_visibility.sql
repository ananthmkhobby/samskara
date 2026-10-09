-- Private photos/contributions: visible only to whoever uploaded them, not
-- even an Admin, and skipping the review queue entirely (nothing to
-- moderate if no one else will ever see it). Enforced at two levels, not
-- just in the app's display filters — see the migration's two policy
-- changes below for why the app-layer filter alone (fetchFamilyData
-- excluding visibility <> 'shared') isn't sufficient on its own.

-- Defaults every existing row to 'shared' — nothing changes for any
-- contribution that exists today.
alter table contributions add column visibility text not null default 'shared' check (visibility in ('shared', 'private'));

-- Table-level defense in depth: the existing policy let any family member
-- read ANY contributions row regardless of status (Pending/Rejected
-- included) — "Verified-only" was purely an app-layer convention. Without
-- this, a direct query (today's app code, or any future one) could still
-- read another member's private row.
drop policy "read own or demo contributions" on contributions;
create policy "read own or demo contributions" on contributions for select
  using (
    (family_id = current_family_id() or family_id = '00000000-0000-0000-0000-000000000001')
    and (visibility = 'shared' or contributor_user_id = auth.uid())
  );

-- Storage-level enforcement: the old policy only checked the family_id
-- path segment, with no idea which contributions row a file belonged to
-- or what visibility it had — so even with the table fixed, anyone who
-- learned a private file's path could still get a signed URL for it. A
-- private upload instead gets a reserved second path segment,
-- "__private__" (src/lib/mediaUpload.js's uploadPrivateFamilyMedia) —
-- never collides with a real person id, since slugify only ever produces
-- [a-z0-9-], no underscores — followed by the uploader's own user id as
-- the third segment, which is what this policy checks. Every existing
-- path shape (second segment = a real person id) is completely untouched.
drop policy "read own or demo media" on storage.objects;
create policy "read own or demo media" on storage.objects for select
  using (
    bucket_id = 'family-media'
    and (
      (storage.foldername(name))[1] = current_family_id()::text
      or (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001'
    )
    and (
      (storage.foldername(name))[2] is distinct from '__private__'
      or (storage.foldername(name))[3] = auth.uid()::text
    )
  );
