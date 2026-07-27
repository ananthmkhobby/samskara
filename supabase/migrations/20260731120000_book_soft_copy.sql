-- Lets a book on the shelf carry a downloadable soft copy (PDF/ePub/etc.)
-- alongside its cover photo, stored the same way — a path into the private
-- family-media bucket, resolved to a signed URL at boot just like cover_path
-- and every other media path in the app.
alter table family_books add column if not exists file_path text;
alter table family_books add column if not exists file_name text;
