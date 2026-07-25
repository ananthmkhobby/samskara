-- fetchMyFamilies() joins family_members -> families(name) to list every
-- family a user belongs to (for the switcher). The existing "member can
-- read own family" policy on `families` only allows reading the currently
-- *active* family (id = current_family_id()) — so that embedded join came
-- back null for every other membership, falling back to a generic
-- placeholder name in the switcher instead of the real family name.
--
-- This adds read access to the `families` row (currently just id/name/
-- created_at) for any family the caller is actually a member of, active
-- or not — mirrors the "user can read own memberships" policy already
-- added to family_members for the same reason. Does not touch people/
-- marriages/contributions/etc, which still gate strictly on
-- current_family_id() — only the family's own name becomes visible
-- across memberships, not its data.
create policy "user can read families they belong to" on families for select
  using (id in (select family_id from family_members where user_id = auth.uid()));
