-- Dedicated bucket for generated, disposable exports (the family photobook
-- PDF) — distinct from family-media, which holds permanent family archive
-- content. Only ever touched by the service role (api/photobook.js), which
-- bypasses RLS entirely for upload, delete, and signing alike — so unlike
-- family-media, this needs zero RLS policies: the browser never talks to
-- this bucket directly, only receives an already-signed URL from the server.
insert into storage.buckets (id, name, public)
values ('family-exports', 'family-exports', false)
on conflict (id) do nothing;
