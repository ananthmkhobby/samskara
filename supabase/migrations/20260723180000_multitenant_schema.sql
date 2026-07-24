-- Multi-tenant rearchitecture: replaces the single-shared-family whole-blob
-- model (app_state) with real per-family, per-row tables so 100-200
-- independent families can each be fully isolated via RLS, and so an edit
-- to one field no longer requires reading/rewriting an entire shared blob.
--
-- Fixed id for the public demo tenant (today's "Rao family" sample data,
-- seeded by a follow-up migration) — kept viewable/editable without login,
-- matching the app's original honor-system behavior, while every other
-- family is fully private.
-- demo family id: 00000000-0000-0000-0000-000000000001

create extension if not exists pgcrypto;

create type family_role as enum ('head', 'admin', 'member');

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role family_role not null default 'member',
  display_name text,
  created_at timestamptz not null default now(),
  unique (user_id) -- one family per user; no family-switching, by design
);

-- security definer: lets these be called from RLS policies on OTHER tables
-- without those policies needing (and recursing through) their own access
-- to family_members.
create or replace function public.current_family_id()
returns uuid language sql stable security definer set search_path = public as $$
  select family_id from family_members where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','head') from family_members where user_id = auth.uid()), false);
$$;

create or replace function public.current_family_role()
returns text language sql stable security definer set search_path = public as $$
  select role::text from family_members where user_id = auth.uid() limit 1;
$$;

create table people (
  family_id uuid not null references families(id) on delete cascade,
  id text not null,
  name text not null,
  gen int not null,
  born date,
  died date,
  spouse text,
  parents text[] not null default '{}',
  rashi text,
  gotra text,
  is_legacy boolean not null default false,
  trust text not null default 'approx' check (trust in ('verified','elder','approx')),
  geo_origin jsonb,
  geo jsonb,
  summary text,
  places text[],
  life_lesson jsonb,
  chapters jsonb not null default '[]',
  timeline jsonb not null default '[]',
  photo_path text, -- Storage object path (bucket is private), not a URL
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (family_id, id),
  -- deferrable: lets bulk-inserting a whole tree (mutually-referencing
  -- spouses) succeed within one transaction, unlike a plain immediate FK.
  foreign key (family_id, spouse) references people(family_id, id) deferrable initially deferred
);

create table marriages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  a text not null,
  b text not null,
  date date,
  created_at timestamptz not null default now(),
  foreign key (family_id, a) references people(family_id, id) on delete cascade,
  foreign key (family_id, b) references people(family_id, id) on delete cascade
);

create table contributions (
  id bigint generated always as identity primary key,
  family_id uuid not null references families(id) on delete cascade,
  person_id text,
  new_person_name text,
  type text not null check (type in ('memory','audio','video','photo','document','date','edit','newPerson','interview')),
  field text,
  field_label text,
  content text,
  contributor text,
  contributor_user_id uuid references auth.users(id),
  status text not null default 'Pending' check (status in ('Pending','Verified','Rejected')),
  date date not null default current_date,
  exp_category text,
  anchor_person_id text,
  relation text,
  name text,
  birth_year text,
  geo jsonb,
  title text,
  body_text text, -- maps the app's `text` field (interview chapter body) — avoids the bare word "text" as a column name
  created_at timestamptz not null default now(),
  foreign key (family_id, person_id) references people(family_id, id) on delete set null,
  foreign key (family_id, anchor_person_id) references people(family_id, id) on delete set null
);

create table experience_entries (
  id bigint generated always as identity primary key,
  family_id uuid not null references families(id) on delete cascade,
  person_id text not null,
  type text not null,
  caption text,
  media_path text,
  source_contribution_id bigint references contributions(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (family_id, person_id) references people(family_id, id) on delete cascade
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  code text not null unique default encode(gen_random_bytes(5), 'hex'),
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_by uuid references auth.users(id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table families enable row level security;
alter table family_members enable row level security;
alter table people enable row level security;
alter table marriages enable row level security;
alter table contributions enable row level security;
alter table experience_entries enable row level security;
alter table invites enable row level security;

-- families / family_members: read-only for members of that family.
-- No client insert/update policy at all — the only ways a row is ever
-- created are the developer's provisioning script (service role, bypasses
-- RLS) and the redeem_invite() function below (security definer).
create policy "member can read own family" on families for select
  using (id = current_family_id());
create policy "member can read own roster" on family_members for select
  using (family_id = current_family_id());

-- people: any member (or anonymous, for the demo family) reads; only a
-- moderator of their own family may write, except the demo family, which
-- stays fully open to match the app's original honor-system behavior.
create policy "read own or demo people" on people for select
  using (family_id = current_family_id() or family_id = '00000000-0000-0000-0000-000000000001');
create policy "write own or demo people" on people for insert
  with check ((family_id = current_family_id() and is_moderator()) or family_id = '00000000-0000-0000-0000-000000000001');
create policy "update own or demo people" on people for update
  using ((family_id = current_family_id() and is_moderator()) or family_id = '00000000-0000-0000-0000-000000000001')
  with check ((family_id = current_family_id() and is_moderator()) or family_id = '00000000-0000-0000-0000-000000000001');
create policy "head can delete own people" on people for delete
  using (family_id = current_family_id() and current_family_role() = 'head');

create policy "read own or demo marriages" on marriages for select
  using (family_id = current_family_id() or family_id = '00000000-0000-0000-0000-000000000001');
create policy "write own or demo marriages" on marriages for insert
  with check ((family_id = current_family_id() and is_moderator()) or family_id = '00000000-0000-0000-0000-000000000001');
create policy "update own or demo marriages" on marriages for update
  using ((family_id = current_family_id() and is_moderator()) or family_id = '00000000-0000-0000-0000-000000000001')
  with check ((family_id = current_family_id() and is_moderator()) or family_id = '00000000-0000-0000-0000-000000000001');

-- contributions: any member reads and inserts (a plain member can only
-- insert as Pending — they can't self-verify); only moderators can update
-- (approve/reject) status. Demo family stays fully open.
create policy "read own or demo contributions" on contributions for select
  using (family_id = current_family_id() or family_id = '00000000-0000-0000-0000-000000000001');
create policy "insert own or demo contributions" on contributions for insert
  with check (
    family_id = '00000000-0000-0000-0000-000000000001'
    or (family_id = current_family_id() and (is_moderator() or status = 'Pending'))
  );
create policy "update own or demo contributions" on contributions for update
  using ((family_id = current_family_id() and is_moderator()) or family_id = '00000000-0000-0000-0000-000000000001')
  with check ((family_id = current_family_id() and is_moderator()) or family_id = '00000000-0000-0000-0000-000000000001');

-- experience_entries: any member reads; only moderators write (mirrors
-- "approved becomes live" for the family's experience grid). Demo open.
create policy "read own or demo experience" on experience_entries for select
  using (family_id = current_family_id() or family_id = '00000000-0000-0000-0000-000000000001');
create policy "write own or demo experience" on experience_entries for insert
  with check ((family_id = current_family_id() and is_moderator()) or family_id = '00000000-0000-0000-0000-000000000001');
create policy "update own or demo experience" on experience_entries for update
  using ((family_id = current_family_id() and is_moderator()) or family_id = '00000000-0000-0000-0000-000000000001');
create policy "delete own or demo experience" on experience_entries for delete
  using ((family_id = current_family_id() and is_moderator()) or family_id = '00000000-0000-0000-0000-000000000001');

-- invites: only moderators generate/see codes for their own family.
create policy "moderator can read own invites" on invites for select
  using (family_id = current_family_id() and is_moderator());
create policy "moderator can create invite" on invites for insert
  with check (family_id = current_family_id() and is_moderator() and created_by = auth.uid());

-- Invite redemption: security definer so it can insert into family_members
-- (which otherwise has no client-facing insert policy) after validating
-- the code itself.
create or replace function public.redeem_invite(p_code text)
returns table(family_id uuid, role family_role)
language plpgsql security definer set search_path = public as $$
declare
  v_invite invites%rowtype;
begin
  if exists (select 1 from family_members where user_id = auth.uid()) then
    raise exception 'You already belong to a family.';
  end if;

  select * into v_invite from invites where code = p_code for update;
  if v_invite.id is null then
    raise exception 'Invalid invite code.';
  end if;
  if v_invite.used_at is not null then
    raise exception 'This invite has already been used.';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'This invite has expired.';
  end if;

  insert into family_members (family_id, user_id, role)
  values (v_invite.family_id, auth.uid(), 'member');

  update invites set used_by = auth.uid(), used_at = now() where id = v_invite.id;

  return query select v_invite.family_id, 'member'::family_role;
end;
$$;

grant execute on function public.redeem_invite(text) to authenticated;
