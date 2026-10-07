-- Perceptual hash (dHash, 64-bit, hex-encoded — see src/lib/imageHash.js)
-- for duplicate-photo detection in the Admin "Duplicates" tab. Only ever
-- populated for type = 'photo'; null for every other contribution type and
-- for photos uploaded before this column existed (until the one-off
-- backfill script, scripts/backfill-image-hashes.mjs, runs). No RLS change
-- needed — existing `contributions` row-level policies already cover this
-- column, since RLS is row-level, not column-level.
alter table contributions add column image_hash text;
