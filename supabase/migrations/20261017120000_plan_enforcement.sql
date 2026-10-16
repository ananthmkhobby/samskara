-- Phase 2: hard enforcement of the limits already displayed on /plans and
-- editable in SuperAdminView (Phase 1, 20261016120000_subscription_plans.sql).
--   (a) grandfather every pre-existing family to 'legacy' so Phase 1's
--       silent 'starter' default never caps a real family that already existed
--   (b) a small SQL-side mirror of the numeric limits in src/lib/planTiers.js,
--       for the two things only Postgres triggers can see (people rows,
--       storage.objects rows) — JS can't run inside a trigger
--   (c) people-count and storage-media-count enforcement via triggers
--   (d) a parameterized monthly AI-call counter, mirroring
--       consume_anon_ai_call's shape, for the one thing a JS chokepoint
--       (api/_aiAuth.js) already computes the right limit for
-- PDF export (the sixth limit) is gated entirely from JS in api/photobook.js
-- — no SQL needed there, see that file.

-- ---------------------------------------------------------------------
-- (a) Grandfather every family that exists right now to 'legacy', one-time.
-- Anything created after this runs still defaults to 'starter' normally.
update families set plan_tier = 'legacy' where plan_tier = 'starter';

-- ---------------------------------------------------------------------
-- (b) SQL-side mirror of PLAN_TIERS' numeric limits, for people/photos/
-- recordings/videos only (aiCallsPerMonth and pdfExport are handled from
-- JS, see api/_aiAuth.js and api/photobook.js — no SQL copy needed there).
-- KEEP THESE NUMBERS IN SYNC WITH src/lib/planTiers.js BY HAND. There is no
-- automated sync; a tier limit change needs an edit here too, or trigger
-- enforcement silently drifts from what /plans and SuperAdminView display.
create table plan_tier_limits (
  plan_tier text primary key,
  people int,       -- null = unlimited
  photos int,
  recordings int,
  videos int
);

insert into plan_tier_limits (plan_tier, people, photos, recordings, videos) values
  ('starter', 25,   100,   3,    1),
  ('rooted',  null, 5000,  100,  10),
  ('legacy',  null, 20000, null, 50);

alter table plan_tier_limits enable row level security;
-- No policies on purpose — only trigger functions (security definer,
-- below) read this; no client should ever see or need it directly.

-- Looks up the effective limit for one family + one key, applying
-- plan_limit_overrides exactly the way getEffectiveLimits() in
-- src/lib/planTiers.js does (override key present, even null, wins over
-- the tier default). security definer so it can be called from a
-- BEFORE INSERT trigger regardless of who's doing the write.
create or replace function public.family_effective_limit(p_family_id uuid, p_key text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_tier text;
  v_overrides jsonb;
  v_override_val jsonb;
  v_limit int;
begin
  select plan_tier, plan_limit_overrides into v_tier, v_overrides
    from families where id = p_family_id;
  if not found then
    return null; -- family vanished mid-check; let the caller's own FK fail instead
  end if;

  if v_overrides ? p_key then
    v_override_val := v_overrides -> p_key;
    if jsonb_typeof(v_override_val) = 'null' then
      return null; -- override explicitly sets "unlimited"
    end if;
    return (v_override_val)::int;
  end if;

  execute format('select %I from plan_tier_limits where plan_tier = $1', p_key)
    into v_limit using v_tier;
  return v_limit;
end;
$$;

revoke execute on function public.family_effective_limit(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- (c1) people count cap.
--
-- Fires BEFORE INSERT FOR EACH ROW. For a multi-row bulkInsertFamily()
-- statement, Postgres advances the command counter between row-trigger
-- firings within the same statement, so count(*) here correctly sees rows
-- already inserted earlier in the SAME statement, not just prior
-- statements.
create or replace function public.enforce_people_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limit int;
  v_count int;
begin
  v_limit := family_effective_limit(NEW.family_id, 'people');
  if v_limit is null then
    return NEW; -- unlimited
  end if;
  select count(*) into v_count from people where family_id = NEW.family_id;
  if v_count >= v_limit then
    raise exception 'This family''s plan allows up to % people in the tree. Ask a Head/Admin to upgrade the plan to add more.', v_limit
      using errcode = '23514';
  end if;
  return NEW;
end;
$$;

create trigger people_plan_limit
  before insert on people
  for each row execute function public.enforce_people_limit();

-- ---------------------------------------------------------------------
-- (c2) storage.objects cap for family-media uploads: photos, recordings
-- (audio), videos, keyed off the uploaded object's MIME type. Demo family
-- (00000000-0000-0000-0000-000000000001) is explicitly exempt.
--
-- Scoped to bucket_id = 'family-media' only — family-exports (photobook
-- PDFs) and any other bucket are untouched.
--
-- Fires on both INSERT and UPDATE OF metadata as a safety net, in case a
-- given Supabase storage code path populates mimetype via a later UPDATE
-- rather than at INSERT time — verify which actually happens per
-- docs/test-cases (Phase 2 verification) before relying on this in prod.
create or replace function public.enforce_media_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_family_id uuid;
  v_mimetype text;
  v_kind text;       -- 'photos' | 'recordings' | 'videos' | null (don't care)
  v_limit int;
  v_count int;
begin
  if NEW.bucket_id <> 'family-media' then
    return NEW;
  end if;

  -- First path segment is the family id by this bucket's own convention
  -- (see supabase/migrations/20260723180100_storage_bucket.sql).
  begin
    v_family_id := (storage.foldername(NEW.name))[1]::uuid;
  exception when others then
    return NEW; -- not a path this bucket's policies expect; let it through, RLS already governs writes
  end;

  if v_family_id = '00000000-0000-0000-0000-000000000001'::uuid then
    return NEW; -- demo family is never capped
  end if;

  v_mimetype := NEW.metadata ->> 'mimetype';
  if v_mimetype is null then
    -- metadata not populated yet on this code path at this trigger timing —
    -- fail open rather than block a legitimate upload on something we can't
    -- classify yet (the UPDATE OF metadata trigger below is the safety net
    -- for when it arrives later).
    return NEW;
  elsif v_mimetype like 'image/%' then
    v_kind := 'photos';
  elsif v_mimetype like 'audio/%' then
    v_kind := 'recordings';
  elsif v_mimetype like 'video/%' then
    v_kind := 'videos';
  else
    return NEW; -- some other content type (e.g. a PDF) — not limited today
  end if;

  v_limit := family_effective_limit(v_family_id, v_kind);
  if v_limit is null then
    return NEW; -- unlimited
  end if;

  select count(*) into v_count
    from storage.objects
    where bucket_id = 'family-media'
      and (storage.foldername(name))[1] = v_family_id::text
      and metadata ->> 'mimetype' like
        (case v_kind when 'photos' then 'image/%' when 'recordings' then 'audio/%' else 'video/%' end);

  -- Same bound for INSERT and UPDATE: on an UPDATE firing, this row's old
  -- metadata didn't yet match the MIME pattern (that's why it's
  -- transitioning), so v_count (current matching rows, excluding this one)
  -- at >= limit means this row would become the (limit+1)th match.
  if v_count >= v_limit then
    raise exception 'This family''s plan allows up to % %. Ask a Head/Admin to upgrade the plan to add more.', v_limit, v_kind
      using errcode = '23514';
  end if;

  return NEW;
end;
$$;

create trigger media_plan_limit_insert
  before insert on storage.objects
  for each row execute function public.enforce_media_limit();

create trigger media_plan_limit_update
  before update of metadata on storage.objects
  for each row execute function public.enforce_media_limit();

-- ---------------------------------------------------------------------
-- (d) Monthly AI-call counter, parameterized the same way
-- consume_anon_ai_call(p_limit int) is — the caller (api/_aiAuth.js)
-- computes the effective limit via getEffectiveLimits() in JS and passes
-- it in; no plan lookup happens in SQL for this one.
create table family_ai_usage_monthly (
  family_id uuid not null references families(id) on delete cascade,
  usage_month date not null, -- always the 1st of the month, e.g. 2026-10-01
  calls int not null default 0,
  primary key (family_id, usage_month)
);

alter table family_ai_usage_monthly enable row level security;
-- No policies on purpose, same posture as ai_usage_daily — only the
-- service-role-backed serverless functions touch this.

create or replace function public.consume_family_ai_call(p_family_id uuid, p_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_month date := date_trunc('month', current_date)::date;
begin
  insert into family_ai_usage_monthly (family_id, usage_month, calls) values (p_family_id, v_month, 1)
    on conflict (family_id, usage_month) do update set calls = family_ai_usage_monthly.calls + 1
    returning calls into v_count;
  return v_count <= p_limit;
end;
$$;

revoke execute on function public.consume_family_ai_call(uuid, int) from public, anon, authenticated;
