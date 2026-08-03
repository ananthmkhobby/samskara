-- Japa/chanting counters: a member logs a count of a practice (Hanuman
-- Chalisa, Vishnu Sahasranama, a mala round, or a custom one) against
-- themselves or any family member (an elder who doesn't use the app
-- herself can still have her chanting logged by a grandchild — same
-- "record on someone's behalf" spirit as memories/photos elsewhere).
--
-- Deliberately NOT routed through `contributions`: there's nothing to
-- moderate here — a practice count isn't contested content the way a
-- memory or a proposed edit is, so it applies instantly for everyone,
-- Member or Admin alike, with no Pending/Verified step.
create table practice_logs (
  id bigint generated always as identity primary key,
  family_id uuid not null references families(id) on delete cascade,
  person_id text not null,
  practice_key text not null,
  practice_label text not null,
  count int not null check (count > 0),
  logged_date date not null default current_date,
  contributor text,
  contributor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (family_id, person_id) references people(family_id, id) on delete cascade
);

alter table practice_logs enable row level security;

create policy "family members can read own family practice logs" on practice_logs
  for select using (family_id = current_family_id() or family_id = '00000000-0000-0000-0000-000000000001');

create policy "family members can log practice counts" on practice_logs
  for insert with check (family_id = current_family_id() or family_id = '00000000-0000-0000-0000-000000000001');

create index practice_logs_family_idx on practice_logs (family_id);
