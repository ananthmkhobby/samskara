-- Private bucket for family media (photos, audio, video). Path convention:
-- {family_id}/{person_id}/{uuid}.{ext} — the first path segment is the
-- family id, so policies can check membership straight from the path
-- without a second table lookup.
insert into storage.buckets (id, name, public)
values ('family-media', 'family-media', false)
on conflict (id) do nothing;

create policy "read own or demo media" on storage.objects for select
  using (
    bucket_id = 'family-media'
    and (
      (storage.foldername(name))[1] = current_family_id()::text
      or (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001'
    )
  );

create policy "upload own or demo media" on storage.objects for insert
  with check (
    bucket_id = 'family-media'
    and (
      (storage.foldername(name))[1] = current_family_id()::text
      or (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001'
    )
  );

create policy "moderator can delete own or demo media" on storage.objects for delete
  using (
    bucket_id = 'family-media'
    and (
      ((storage.foldername(name))[1] = current_family_id()::text and is_moderator())
      or (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001'
    )
  );
