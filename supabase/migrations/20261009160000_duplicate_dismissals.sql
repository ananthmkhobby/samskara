-- Remembers a pair of photo contributions an Admin/Head already looked at
-- and decided aren't duplicates, so the Admin "Duplicates" tab doesn't keep
-- resurfacing it every time it's opened. Always stored with the lower id
-- first (enforced below) so the client can dedupe regardless of comparison
-- order.
create table duplicate_dismissals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  contribution_id_a bigint not null references contributions(id) on delete cascade,
  contribution_id_b bigint not null references contributions(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  dismissed_by uuid references auth.users(id),
  constraint ordered_pair check (contribution_id_a < contribution_id_b),
  constraint unique_pair unique (family_id, contribution_id_a, contribution_id_b)
);
alter table duplicate_dismissals enable row level security;

create policy "moderator can read own dismissals" on duplicate_dismissals for select
  using (family_id = current_family_id() and is_moderator());
create policy "moderator can create dismissal" on duplicate_dismissals for insert
  with check (family_id = current_family_id() and is_moderator() and dismissed_by = auth.uid());
