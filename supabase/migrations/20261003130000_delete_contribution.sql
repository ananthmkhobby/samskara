-- Lets a moderator delete a contribution outright — previously the only
-- state changes available were approve/reject (status updates), with no
-- delete path at all. Needed specifically for WhatsApp-sourced content: a
-- casual or mis-sent photo/message should be removable even after it's
-- already Verified and showing on the folio, not stuck there forever.
-- Mirrors the existing "moderator can delete own or demo media" policy on
-- storage.objects (20260723180100_storage_bucket.sql) and the shape of
-- this table's own "update own or demo contributions" policy exactly.
create policy "moderator can delete own or demo contributions" on contributions for delete
  using ((family_id = current_family_id() and is_moderator()) or family_id = '00000000-0000-0000-0000-000000000001');
