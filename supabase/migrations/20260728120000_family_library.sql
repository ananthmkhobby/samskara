-- Family Library: a shared bookshelf, not per-person — books that survive
-- across generations, who owned/gifted/read them, what each family member
-- makes of them, and the conversations they sparked.
--
-- Unlike Parampara, a book is a real entity other rows need to reference
-- (readers, ownership chain, wisdom/memory/discussion entries all point at
-- one), so it gets its own table rather than living entirely inside
-- `contributions`. New-book proposals still flow through the existing
-- review-queue pipeline, the same way a new person does: a Pending
-- contribution, and only on approval does the app insert the real row
-- (mirrors addPerson exactly — see applyContributionEffects). That insert
-- only ever runs while the acting session is a moderator (either
-- submitting directly, or approving someone else's proposal), so the
-- plain "moderator can insert" RLS policy below is sufficient — no
-- security-definer function needed, same reasoning as `people`'s own
-- insert policy.

create table family_books (
  id bigint generated always as identity primary key,
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  category text not null,
  cover_path text,
  story text,
  contributor text,
  contributor_user_id uuid references auth.users(id),
  status text not null default 'Pending' check (status in ('Pending','Verified','Rejected')),
  created_at timestamptz not null default now()
);

-- The "owned by -> gifted to -> read by -> recommended to" chain shown on
-- a book's Story tab. Not moderated like narrative content — closer to a
-- lightweight, self-reported fact any member can add (same reasoning as
-- book_readers below), with sort_order giving the family control over the
-- chain's displayed sequence when years are missing or ambiguous.
create table book_ownership (
  id bigint generated always as identity primary key,
  family_id uuid not null references families(id) on delete cascade,
  book_id bigint not null references family_books(id) on delete cascade,
  person_id text,
  person_name text,
  action text not null check (action in ('owned','gifted','read','recommended')),
  year int,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  foreign key (family_id, person_id) references people(family_id, id) on delete set null
);

-- Who's read a book / is reading it — a reading map, not a review. Direct
-- member-write (no Pending step): marking yourself as a reader carries
-- none of the moderation weight a story or memory does.
create table book_readers (
  id bigint generated always as identity primary key,
  family_id uuid not null references families(id) on delete cascade,
  book_id bigint not null references family_books(id) on delete cascade,
  person_id text not null,
  status text not null check (status in ('read','reading')),
  created_at timestamptz not null default now(),
  unique (book_id, person_id),
  foreign key (family_id, person_id) references people(family_id, id) on delete cascade
);

-- Wisdom (one lesson per reader), Memories (why this copy matters), and
-- Discussions (family Q&A) all reuse the same contributions
-- Pending -> Verified pipeline as everything else narrative in the app —
-- just tagged with a book via the new column below and a new type.
alter table contributions add column if not exists book_id bigint references family_books(id) on delete cascade;
alter table contributions drop constraint if exists contributions_type_check;
alter table contributions add constraint contributions_type_check
  check (type in ('memory','audio','video','photo','document','date','edit','newPerson','interview','parampara','newBook','library_entry'));

alter table family_books enable row level security;
alter table book_ownership enable row level security;
alter table book_readers enable row level security;

create policy "read own or demo books" on family_books for select
  using (family_id = current_family_id() or family_id = '00000000-0000-0000-0000-000000000001');
create policy "moderator can insert own or demo books" on family_books for insert
  with check ((family_id = current_family_id() and is_moderator()) or family_id = '00000000-0000-0000-0000-000000000001');
create policy "moderator can update own or demo books" on family_books for update
  using ((family_id = current_family_id() and is_moderator()) or family_id = '00000000-0000-0000-0000-000000000001')
  with check ((family_id = current_family_id() and is_moderator()) or family_id = '00000000-0000-0000-0000-000000000001');

create policy "read own or demo ownership" on book_ownership for select
  using (family_id = current_family_id() or family_id = '00000000-0000-0000-0000-000000000001');
-- The family_id/book_id pairing is checked explicitly, not just family_id
-- alone — otherwise a row could claim membership in one family while
-- pointing book_id at a book that actually belongs to another.
create policy "member can write own or demo ownership" on book_ownership for insert
  with check (
    (family_id = current_family_id() or family_id = '00000000-0000-0000-0000-000000000001')
    and exists (select 1 from family_books fb where fb.id = book_id and fb.family_id = book_ownership.family_id)
  );
create policy "moderator can delete own or demo ownership" on book_ownership for delete
  using ((family_id = current_family_id() and is_moderator()) or family_id = '00000000-0000-0000-0000-000000000001');

create policy "read own or demo readers" on book_readers for select
  using (family_id = current_family_id() or family_id = '00000000-0000-0000-0000-000000000001');
create policy "member can write own or demo readers" on book_readers for insert
  with check (
    (family_id = current_family_id() or family_id = '00000000-0000-0000-0000-000000000001')
    and exists (select 1 from family_books fb where fb.id = book_id and fb.family_id = book_readers.family_id)
  );
create policy "member can update own or demo readers" on book_readers for update
  using (family_id = current_family_id() or family_id = '00000000-0000-0000-0000-000000000001')
  with check (family_id = current_family_id() or family_id = '00000000-0000-0000-0000-000000000001');
