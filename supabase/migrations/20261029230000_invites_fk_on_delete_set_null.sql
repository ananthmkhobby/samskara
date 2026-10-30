-- Found while cleaning up test data: invites.used_by/created_by have no
-- ON DELETE action (defaults to RESTRICT), a gap the account-deletion
-- migration (20261029160000_account_deletion.sql) fixed for several
-- other tables but missed this one — deleting an auth.users row that has
-- ever created or redeemed an invite fails outright. invites are a
-- historical/audit record (never deleted on use, per
-- 20260803120200_member_display_name_and_invite_revoke.sql's own "kept
-- as historical record" comment), so losing the identity link on account
-- deletion is the same acceptable trade-off already applied elsewhere,
-- not new policy.
alter table invites drop constraint if exists invites_created_by_fkey;
alter table invites add constraint invites_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table invites drop constraint if exists invites_used_by_fkey;
alter table invites add constraint invites_used_by_fkey
  foreign key (used_by) references auth.users(id) on delete set null;

alter table invites alter column created_by drop not null;
