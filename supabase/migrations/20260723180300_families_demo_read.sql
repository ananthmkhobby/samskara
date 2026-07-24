-- The original "read own family" policy on `families` had no demo-tenant
-- exception (unlike every other table), which would silently block the
-- frontend from ever fetching the family's own display name (needed so a
-- real family sees "The Sharma Family's..." instead of a hardcoded label).
drop policy "member can read own family" on families;
create policy "read own or demo family" on families for select
  using (id = current_family_id() or id = '00000000-0000-0000-0000-000000000001');
