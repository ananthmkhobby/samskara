-- Self-service account deletion + data export (DPDPA erasure/access
-- rights — see docs/ARCHITECTURE_REVIEW.md §6/§9). Before this migration,
-- several tables referenced auth.users with no ON DELETE action, which
-- defaults to RESTRICT — a plain supabase.auth.admin.deleteUser() call
-- would fail outright for anyone who had ever contributed a photo,
-- written a blog post, or created a share/export/invite code, which is
-- most active users. Decision (confirmed with the product owner,
-- 2026-10-29): shared family content a departing member contributed to
-- stays in the archive — it's collaborative family history, not solely
-- theirs — but loses its link to their (now-deleted) account. A solo
-- family with no other members is deleted entirely, since nothing in it
-- is shared with anyone else.

-- contributor_user_id/dismissed_by were already nullable but RESTRICT by
-- default; these just need the ON DELETE action changed.
alter table contributions drop constraint if exists contributions_contributor_user_id_fkey;
alter table contributions add constraint contributions_contributor_user_id_fkey
  foreign key (contributor_user_id) references auth.users(id) on delete set null;

alter table family_books drop constraint if exists family_books_contributor_user_id_fkey;
alter table family_books add constraint family_books_contributor_user_id_fkey
  foreign key (contributor_user_id) references auth.users(id) on delete set null;

alter table practice_logs drop constraint if exists practice_logs_contributor_user_id_fkey;
alter table practice_logs add constraint practice_logs_contributor_user_id_fkey
  foreign key (contributor_user_id) references auth.users(id) on delete set null;

alter table duplicate_dismissals drop constraint if exists duplicate_dismissals_dismissed_by_fkey;
alter table duplicate_dismissals add constraint duplicate_dismissals_dismissed_by_fkey
  foreign key (dismissed_by) references auth.users(id) on delete set null;

-- These were NOT NULL — all five hold "who did this" on what's really an
-- ephemeral or administrative record (a 24h/30d-expiring code, a plan
-- upgrade request, a blog post's byline), never a field anyone else's
-- RLS or UI logic depends on being non-null. Dropping NOT NULL lets the
-- row survive the author's account deletion instead of being orphaned by
-- a hard RESTRICT failure.
alter table content_shares alter column created_by drop not null;
alter table content_shares drop constraint if exists content_shares_created_by_fkey;
alter table content_shares add constraint content_shares_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table gallery_export_codes alter column created_by drop not null;
alter table gallery_export_codes drop constraint if exists gallery_export_codes_created_by_fkey;
alter table gallery_export_codes add constraint gallery_export_codes_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table plan_upgrade_requests alter column requested_by drop not null;
alter table plan_upgrade_requests drop constraint if exists plan_upgrade_requests_requested_by_fkey;
alter table plan_upgrade_requests add constraint plan_upgrade_requests_requested_by_fkey
  foreign key (requested_by) references auth.users(id) on delete set null;

-- blog_posts.author_display_name is a separate, independent text column
-- (set at publish time, never derived from the author row) — a post
-- keeps its byline text even once author_user_id is nulled out.
alter table blog_posts alter column author_user_id drop not null;
alter table blog_posts drop constraint if exists blog_posts_author_user_id_fkey;
alter table blog_posts add constraint blog_posts_author_user_id_fkey
  foreign key (author_user_id) references auth.users(id) on delete set null;

alter table share_previews alter column approved_by drop not null;
alter table share_previews drop constraint if exists share_previews_approved_by_fkey;
alter table share_previews add constraint share_previews_approved_by_fkey
  foreign key (approved_by) references auth.users(id) on delete set null;

-- The actual prep step, run (as the caller, via their own session — not
-- the service role) right before a serverless endpoint calls
-- supabase.auth.admin.deleteUser(). Everything this touches is scoped to
-- auth.uid(), so it can only ever act on the caller's own memberships —
-- it cannot be pointed at anyone else's account.
--
-- Order matters: block-check first (raises and aborts before anything is
-- written), then delete solo families outright (cascades handle their
-- contributions/people/etc — every family_id FK in this schema is
-- already ON DELETE CASCADE), then drop the caller's remaining
-- (shared-family) memberships. auth.users itself is deleted afterwards
-- by the calling endpoint via the Admin API, which also tears down
-- sessions/identities/refresh tokens correctly — this function
-- deliberately never touches auth.users directly.
create or replace function public.request_account_deletion()
returns void language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
  blocked record;
begin
  if caller is null then
    raise exception 'Not signed in.';
  end if;

  -- Block: caller is the only head/admin of a family that still has
  -- other members. Named per the user-facing message this surfaces as.
  select f.id, f.name into blocked
  from family_members fm
  join families f on f.id = fm.family_id
  where fm.user_id = caller
    and fm.role in ('head', 'admin')
    and exists (select 1 from family_members other where other.family_id = fm.family_id and other.user_id <> caller)
    and not exists (
      select 1 from family_members other
      where other.family_id = fm.family_id and other.user_id <> caller and other.role in ('head', 'admin')
    )
  limit 1;

  if blocked.id is not null then
    raise exception 'You''re the only Head or Admin of "%". Promote another member to Head before deleting your account, so the family isn''t left without one.', blocked.name;
  end if;

  -- Solo families (caller is the only member): delete the family outright
  -- — nothing in it is shared with anyone else.
  delete from families f
  where f.id in (
    select fm.family_id from family_members fm
    where fm.user_id = caller
    and not exists (select 1 from family_members other where other.family_id = fm.family_id and other.user_id <> caller)
  );

  -- Remaining memberships are in genuinely shared families — just drop
  -- the caller's own membership row; their past contributions stay
  -- (now anonymized by the FK changes above once auth.users is deleted).
  delete from family_members where user_id = caller;
end;
$$;

-- Pure read, scoped to auth.uid() throughout — the self-service "export
-- my data" side of this, independent of deletion. Callable by any
-- signed-in user directly (no serverless function needed), same posture
-- as every other security-definer RPC in this app.
create or replace function public.export_my_data()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'exported_at', now(),
    'memberships', (
      select coalesce(jsonb_agg(jsonb_build_object('family_name', f.name, 'role', fm.role, 'joined_at', fm.created_at)), '[]'::jsonb)
      from family_members fm join families f on f.id = fm.family_id where fm.user_id = auth.uid()
    ),
    'contributions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'type', c.type, 'title', c.title, 'content', c.content, 'body_text', c.body_text,
        'status', c.status, 'date', c.date, 'created_at', c.created_at
      )), '[]'::jsonb)
      from contributions c where c.contributor_user_id = auth.uid()
    ),
    'blog_posts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'title', b.title, 'status', b.status, 'published_at', b.published_at
      )), '[]'::jsonb)
      from blog_posts b where b.author_user_id = auth.uid()
    ),
    'consents', (
      select coalesce(jsonb_agg(uc.*), '[]'::jsonb) from user_consents uc where uc.user_id = auth.uid()
    )
  );
$$;

grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.export_my_data() to authenticated;
