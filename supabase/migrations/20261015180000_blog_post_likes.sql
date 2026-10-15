-- Likes for blog posts — the blog has no accounts for ordinary readers
-- (it's deliberately public, no login wall), so there's no real identity
-- to dedupe a "like" against server-side. Same honor-system trust level
-- already documented for the public demo family: the RPC lets anyone
-- bump a published post's count by exactly one per call, atomically — the
-- client additionally remembers "already liked" per browser (localStorage)
-- to stop an accidental double-click, not to stop real abuse. Good enough
-- for a lightweight engagement signal, not a vote you'd build fraud
-- detection around.
alter table blog_posts add column like_count integer not null default 0;

create or replace function public.increment_blog_post_likes(p_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  update blog_posts set like_count = like_count + 1
  where id = p_post_id and status = 'published'
  returning like_count into new_count;
  return new_count;
end;
$$;

-- Deliberately callable by anon (not just authenticated) — same reasoning
-- as blog_posts' own "anyone reads published posts" policy: a reader
-- liking a post never needed to be signed in to read it in the first
-- place.
grant execute on function public.increment_blog_post_likes(uuid) to anon, authenticated;
