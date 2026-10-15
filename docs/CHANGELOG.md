# Changelog

One entry per production release — written when `master` is fast-forwarded
and tagged (see `docs/GIT_WORKFLOW.md`). This is the human-readable index;
the git tag on each entry's commit is the authoritative record.

Format: `## vYYYY.MM.DD — short summary`, then what changed, then what was
verified post-deploy.

<!-- Newest entries go at the top. -->

## Unreleased

## v2026.10.15 — Hotfix: invite-redemption crash on production

Found during a full-feature test pass of both environments
(`docs/test-cases/RESULTS.md`): redeeming an invite as a brand-new Member
crashed on `oursamskara.com` with a raw Postgres `NOT NULL` violation on
`family_members.user_id`, shown directly to the user — the account was
created but never attached to the family. Didn't reproduce on the test
environment; the underlying condition (no session yet right after
`signUp()`) is timing-sensitive, not deterministic.

- `JoinForm` (`src/components/AuthPanel.jsx`) now checks
  `supabase.auth.getSession()` before calling `redeemInvite()`. No session
  yet → shows a clear "confirm your email, then come back to this link and
  log in" message instead of calling the RPC. No RLS/RPC/schema change.
- Shipped via `docs/GIT_WORKFLOW.md`'s hotfix path: branched from `main`,
  not `dev` (which held unrelated unreleased work), PR'd and merged back
  into `main`, then merged back into `dev` so it isn't lost on the next
  regular release.
- **First release to go through the documented `master`
  fast-forward-and-tag step** — `master` didn't exist yet, so it was
  created pointing at this release rather than fast-forwarded from a prior
  one.
- Verified post-deploy: the fixed bundle is confirmed live on
  `oursamskara.com` (the new "Almost there…" message string present in the
  served JS). A live end-to-end re-test of the crash path itself was
  blocked by Supabase's own signup-email rate limit (hit twice today from
  repeated test signups) rather than disproving the fix; the identical
  code path was verified end-to-end on the test environment instead.

## 2026-10-15 — Production split: new Supabase + Vercel projects, real data migrated

The two-environment pipeline from `docs/SDLC.md`/`docs/GIT_WORKFLOW.md` went
from documented plan to actually running today:

- New Supabase project (`samskara-prod`, `ap-south-1`, Pro) created; all 56
  migrations replayed to build an identical, empty schema.
- New Vercel project (`samskara-prod`) created under the same team, tracking
  `main`, serving `oursamskara.com` (SSL auto-provisioned, verified live).
- Existing project's Production Branch repointed from `main` to `dev`, making
  it the test environment — zero downtime, confirmed by direct deployment
  inspection, not just visual check.
- Real data migrated via the new `scripts/migrate-to-prod.mjs`: 10 real
  families, 300 people, 100 marriages, 21 accounts (fresh passwords —
  `migration-output/*.csv`, distribute to each family's Admin then delete),
  304 contributions, 5 library books, 47 real media files. "Bhandari Family"
  and 3 orphaned test-redeem accounts confirmed as leftover test data and
  excluded; the pre-seeded public demo family was also excluded (it already
  exists in every environment via the schema migrations themselves).

**Real issues hit and fixed, worth remembering:**
- A loose `vercel alias set` pointer doesn't auto-follow new deploys the way
  a registered project domain does — `samskara-koaham.vercel.app` was
  re-registered properly. See `docs/ENVIRONMENTS.md`.
- Disabling "Automatically expose new tables" during Supabase project
  creation (recommended for a different reason at the time) blocks Postgres
  *grants* for every future migration's tables, for every role including
  `service_role` — not just API exposure. This would have silently broken
  real production signups, not only the migration script. Fixed with an
  explicit grant statement, including `alter default privileges` so it
  never recurs for a future migration's tables.
- `scripts/migrate-to-prod.mjs`'s original table order matched
  `docs/BACKUPS.md`'s documented order, which predates later migrations
  that added `family_members.person_id`, `invites.person_id`, and
  `contributions.book_id` as foreign keys — the actual safe order is now
  `families → people → marriages → family_members → family_books →
  book_ownership/book_readers → contributions → ...`.
- `family_books`, `contributions`, and four other tables use
  `generated always as identity` primary keys, which Postgres refuses an
  explicit value for outright — these get a fresh id on insert, with an
  old-id → new-id map threaded through for the tables that reference
  `family_books.id`.
- The script's "skip if already migrated" check must be scoped to the
  specific families/users being written, never a blind table-wide count —
  the destination's own pre-seeded demo data made a blind count look like
  "already done" when the real rows hadn't been written yet.
- A re-run must never unconditionally overwrite the generated-passwords
  report file — an early version did exactly that when a re-run created
  zero new accounts, briefly losing the real passwords from the first
  successful run (recovered by resetting those 21 accounts' passwords
  again via the admin API).

All of the above is now encoded directly in `scripts/migrate-to-prod.mjs`
itself (comments at each fix site), not just here.
