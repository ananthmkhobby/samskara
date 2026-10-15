-- The Samskara blog: a small, trusted "team" of authors (not family
-- members — no family_id, no connection to any family's data at all),
-- publishing posts that anyone can read without an account. Follows the
-- same security-definer helper-function + RLS convention as
-- current_family_id()/is_moderator() in 20260723180000_multitenant_schema.sql,
-- scoped to the blog instead of a family.

create table blog_authors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text,
  cover_image_path text,
  body_json jsonb not null,      -- Tiptap editor document — source of truth, re-editable
  body_html text not null,       -- rendered snapshot — served to readers and the SEO page
  language text,                 -- optional tag (e.g. "en", "kn") — informational only, not enforced
  status text not null default 'draft' check (status in ('draft', 'published')),
  author_user_id uuid not null references auth.users(id),
  author_display_name text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blog_posts_public_idx on blog_posts (status, published_at desc);

create or replace function public.is_blog_team()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from blog_authors where user_id = auth.uid());
$$;

alter table blog_authors enable row level security;
alter table blog_posts enable row level security;

-- blog_authors: the roster is internal — only the team itself needs to see
-- who else is on it (e.g. for a future "by so-and-so" author picker).
create policy "blog team reads own roster" on blog_authors for select using (is_blog_team());

-- blog_posts: a published post is public, full stop — no account, no family,
-- no demo-family-style carve-out needed, since "published" IS the public
-- condition. The team can read/write every post, not just their own
-- (shared ownership — matches a small trusted team, same reasoning as
-- any team member being able to promote a Member to Admin).
create policy "anyone reads published posts" on blog_posts for select using (status = 'published');
create policy "blog team reads all posts" on blog_posts for select using (is_blog_team());
create policy "blog team writes posts" on blog_posts for insert with check (is_blog_team());
create policy "blog team updates posts" on blog_posts for update using (is_blog_team());
create policy "blog team deletes posts" on blog_posts for delete using (is_blog_team());

-- A genuinely public bucket (unlike family-media's private+signed-URL
-- model) — blog posts and their media are meant to be read by anyone,
-- including a server-side crawler with no Supabase session at all.
insert into storage.buckets (id, name, public) values ('blog-media', 'blog-media', true);

create policy "public reads blog media" on storage.objects for select using (bucket_id = 'blog-media');
create policy "blog team writes blog media" on storage.objects for insert with check (bucket_id = 'blog-media' and is_blog_team());
create policy "blog team updates blog media" on storage.objects for update using (bucket_id = 'blog-media' and is_blog_team());
create policy "blog team deletes blog media" on storage.objects for delete using (bucket_id = 'blog-media' and is_blog_team());
