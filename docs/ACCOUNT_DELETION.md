# Account deletion & data export

Built 2026-10-29 to close a long-tracked gap (`SECURITY.md`'s own "Known
gaps" list) and a real DPDPA exposure flagged in
`docs/ARCHITECTURE_REVIEW.md` §6/§9: there was no way for someone to
exercise their erasure or access rights except asking a human to do it
by hand.

## Two paths, by design

### 1. Self-service, in-app (primary path)

**More → Account**, for anyone currently signed in
(`src/components/AccountSettingsView.jsx`). Two actions:

- **Download my data** — calls `export_my_data()`, a `security definer`
  SQL RPC scoped entirely to `auth.uid()`, returning a JSON bundle of the
  caller's own contributions, blog posts, family memberships, and
  consent history. Pure read, no account change.
- **Delete my account** — behind a typed `DELETE` confirmation. Calls
  `api/account.js` (`action: "delete_account"`), which:
  1. Identifies the caller from their own bearer token (same pattern as
     every other member-facing endpoint — never the shared admin
     secret; this is "you are signed in as the account in question,"
     not a superadmin action).
  2. Calls `request_account_deletion()` **as the caller** (an anon
     Supabase client carrying their access token, so `auth.uid()`
     resolves correctly inside the function) — see "Deletion semantics"
     below for exactly what this does.
  3. Only if that succeeds, calls `supabase.auth.admin.deleteUser()`
     with the service-role client — the one step that genuinely needs
     admin privileges, and the one step `request_account_deletion()`
     deliberately never does itself, since the Admin API also tears
     down sessions/identities/refresh tokens correctly, which a raw
     `DELETE FROM auth.users` would not.

This is the preferred path precisely because the person is already
authenticated via their own session — there's no identity-verification
problem to solve.

### 2. Manual, human-verified fallback (email)

For someone who's lost access to their account entirely (forgotten
password, no recovery path, can't sign in) and has no way to reach the
self-service flow. Documented in the Privacy Policy
(`PrivacyPolicyView.jsx`, "Deleting your account or your family's data")
as: email `support@oursamskara.com`.

**Deliberately not automated.** An endpoint that deletes an account on
the strength of an email alone is a real account-takeover vector —
anyone can send an email claiming to be someone else and ask for their
account to be removed. This fallback is a process, not a feature:

1. The request arrives at `support@oursamskara.com`.
2. A human verifies identity by a reasonable means available for the
   account in question (matches the email on file, can describe family
   details only the real account holder would know, etc.) — judgment
   call, not a fixed checklist, since the app supports both email-based
   and username-only (no-email) logins.
3. Preferred resolution: help them regain access (password reset) and
   point them at the self-service flow above, so the actual deletion
   still goes through the audited, automatic path.
4. Only if that's not possible: a maintainer runs the equivalent steps
   by hand — call `request_account_deletion()` for that user via the
   Supabase SQL editor (as that user, or with an equivalent manual
   check of the same "sole head of a shared family" block condition),
   then `supabase.auth.admin.deleteUser()` via the dashboard or
   Management API.

This same email is also published as the DPDPA **Grievance Officer**
contact (Privacy Policy, "Grievance redressal") — closing both gaps
with one channel, since a data-protection grievance and a stuck
deletion request are the same kind of ask. **The published Grievance
Officer name is currently a placeholder** (`[Grievance Officer name —
to be designated]` in `PrivacyPolicyView.jsx`) — DPDPA requires a real,
named individual be published, not just a role-based email. Replace
this before relying on it as the actual compliance disclosure.

## Deletion semantics (`request_account_deletion()`)

Decided with the product owner, 2026-10-29 — see
`supabase/migrations/20261029160000_account_deletion.sql` for the full
implementation and reasoning:

- **Shared family content stays.** Anything the departing member
  contributed to a family that still has other people in it — photos,
  memories, blog posts, share links, library entries — remains in the
  archive; it's collaborative family history, not solely theirs. Every
  relevant foreign key was changed from the implicit `RESTRICT` default
  to `ON DELETE SET NULL`, so the row survives with its identity link
  removed rather than blocking the deletion outright (which is what
  would have happened before this change — several tables referenced
  `auth.users` with no delete action specified, which defaults to
  `RESTRICT` in Postgres).
- **A solo family is deleted entirely.** If the departing member was the
  only person ever in a family (e.g. someone who signed up via the
  Guest-First-Memory flow and never invited anyone), nothing in it is
  shared with anyone else, so the family and everything in it is
  removed, not left as an orphaned shell with no members.
- **Blocked if they're the only Head/Admin of a family with other
  members still in it.** Surfaced as: "You're the only Head or Admin of
  '[family]'. Promote another member to Head before deleting your
  account, so the family isn't left without one." Prevents a family
  losing all moderator-level access with no recovery path.

Verified directly against the test database (2026-10-29) with three
disposable accounts covering each branch — solo-family cascade delete,
shared-family anonymize-and-keep, and the sole-head block — then cleaned
up; see the PR for the exact test transcript.

## What this does not yet cover

- **Media files in Storage** — the anonymization above only touches
  database rows; a photo/audio/video file the deleted account uploaded
  stays in Storage exactly as it did before (it's still referenced by
  the now-anonymized contribution row, so this is consistent with "the
  content stays," not an oversight — flagging it explicitly so it isn't
  mistaken for one later).
- **Backups** — `scripts/backup.mjs` already excludes Auth user records
  (`docs/BACKUPS.md`); a deleted account's prior contributions may still
  appear, correctly anonymized, in a backup snapshot taken before
  deletion. Not a gap this feature needs to solve — DPDPA erasure
  applies going forward, not retroactively to already-taken backups.
