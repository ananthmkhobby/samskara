# Audit evidence bundle — requirement through deployment

Compiled 2026-10-15. This is the single entry point for an audit (ISO 27001,
SOC 2, or an ad-hoc security/process review) asking "show me how you know
this was done carefully, end to end." It doesn't duplicate the underlying
documents — it indexes them, phase by phase, and points at the specific
commits, PRs, tags, and test records that are the actual evidence.

Every claim below is checkable: a file path, a commit SHA, a PR number, or a
command to re-run. Where there's a real gap, it's named as a gap, not
papered over — an auditor finding an undocumented gap looks far worse than
a documented one with a plan (`docs/SDLC.md` already states this as policy,
not just for this document).

**Worked examples used throughout**, because an audit trail is most
convincing tied to real changes, not abstractions:

- **A — the 2026-10-15 production split and data migration**: creating a
  genuinely separate production environment and moving all real family data
  into it.
- **B — the 2026-10-15 invite-redemption hotfix**: a production bug found
  during full-feature testing, fixed, and released through the documented
  hotfix path (PR [#1](https://github.com/ananthmkhobby/samskara/pull/1),
  tag `v2026.10.15`).

---

## 1. Requirement

**Process**: `docs/SDLC.md` phase 1 — stated before code is written, as a
GitHub Issue for larger work, or the opening line of a PR description for a
small change.

**Current state, named honestly**: this project does not yet use GitHub
Issues (`gh issue list` returns none) — at this team's size, the
requirement is stated directly in the PR description instead. This is a
real, accepted gap for traceability at scale, not an oversight: worth
introducing Issues before a second contributor joins, so "why" has a home
independent of any one PR.

**Evidence**:
- A: the requirement was "stand up a genuinely isolated production
  environment and migrate real family data into it, without touching what's
  live" — stated in this session's working notes and realized directly as
  the commits and `docs/CHANGELOG.md` entry for 2026-10-15 ("Production
  split: new Supabase + Vercel projects, real data migrated").
- B: the requirement was discovered, not pre-specified — a full-feature
  test pass (`docs/test-cases/TEST_PLAN.md`) surfaced a real production
  defect, and the requirement became "fix it, without regressing the
  identical test-env path." Stated in [PR #1](https://github.com/ananthmkhobby/samskara/pull/1)'s
  description.

---

## 2. Review

**Process**: `docs/SDLC.md` phase 7 ("release approval") plus the PR
template's checklist (`.github/pull_request_template.md`), which is filled
in honestly as the act of review, not rubber-stamped after the fact.

**Current state**: self-review is the norm today (`docs/SDLC.md`'s "Roles"
section states this explicitly as the accepted model at this team's size) —
the value is in the checklist actually being worked through, not in having
a second named reviewer. [PR #1](https://github.com/ananthmkhobby/samskara/pull/1)
was explicitly approved by the repo owner before merge (GitHub shows the PR
as approved and merged, not force-pushed or admin-merged around the
check) — a genuine second-pair-of-eyes gate was used for this release, not
skipped.

**Evidence**:
- B: [PR #1](https://github.com/ananthmkhobby/samskara/pull/1)'s filled-in
  checklist — Security & privacy section marked "none of the above" with
  reasoning (client-side guard only, no RLS/RPC/schema change), Testing
  section citing the exact re-verification done, Performance section
  reasoned through explicitly rather than left blank.
- No branch protection currently enforces review before merge (see §11,
  Controls) — today this is discipline, not a GitHub-enforced gate. Named
  as a known gap in `docs/SDLC.md`, decided 2026-10-15 to defer rather than
  silently skip.

---

## 3. Design

**Process**: `docs/SDLC.md`'s design-note section sets the bar explicitly —
a short written plan before implementation, required only when a change
touches the data model, auth/RLS, money, or anything irreversible (a
delete, a migration). Not every change needs one; the bar itself is the
control, so it isn't applied inconsistently by feel.

**Evidence**:
- A met the bar (data model + irreversible data movement) and got a design
  pass: `scripts/migrate-to-prod.mjs` encodes the actual design decisions
  directly as code comments at each fix site — table dependency order,
  `generated always as identity` id-remapping strategy, per-family-scoped
  idempotency — so the design and the implementation can never drift apart
  silently. `docs/CHANGELOG.md`'s 2026-10-15 entry records the design
  decisions made *during* the work (e.g. the "Automatically expose new
  tables" / grants gotcha) as they were discovered, not reconstructed after
  the fact.
- B did not meet the bar on its own terms — it's a client-side ordering fix
  with no schema, RLS, or RPC change — so no separate design doc was
  written, consistent with the stated policy rather than an omission. The
  root-cause analysis and the chosen fix shape (`getSession()` guard before
  the RPC call, not a backend change) are recorded directly in
  `docs/test-cases/RESULTS.md` Finding 0 and the commit message of
  `988e878`.

---

## 4. Design review

**Process**: for a change that met the design bar, the plan is checked
against the implementation — today by the same self-review discipline as
code review (§2), since there is no second committer yet.

**Evidence**:
- A: the design (migration script) was exercised against the destination's
  real, pre-existing demo-seed data before being trusted — this caught the
  "blind table-wide count looks like already-migrated" bug *during* design
  review, before any real family data was touched, and the fix is recorded
  directly in the script's own comments plus `docs/CHANGELOG.md`.
- B: the alternative designs considered (a `setTimeout`/retry hack vs. an
  explicit session check) are implicit in the chosen fix's code comment in
  `src/components/AuthPanel.jsx` — the comment states *why* `getSession()`
  specifically, and *why* not `getUser()` (the latter can return stale data
  without confirming a live session), which is the design-review reasoning
  captured at the point of decision rather than reconstructed later.

---

## 5. Coding guidelines followed

**Enforced mechanically, not just stated**: `.github/workflows/ci.yml` runs
`npm run lint` (`oxlint`) and `npm run build` on every push and PR against
`dev`/`main` — this is the required CI status check referenced throughout
`docs/GIT_WORKFLOW.md`. A change that doesn't lint or doesn't build cannot
reach `main` through the normal path.

**House style, stated and largely self-enforcing**: comments explain *why*,
not *what* — visible throughout this codebase's existing comments (e.g.
`src/data/familyDb.js`'s RLS-vs-RPC posture comment, `AuthPanel.jsx`'s new
`getSession()`-vs-`getUser()` comment) and in this session's own commit
messages, which consistently state motivation over mechanics.

**Evidence**:
- A and B: both pass `npm run lint` and `npx vite build` cleanly — checked
  directly before every push in this session, and confirmed again by CI on
  [PR #1](https://github.com/ananthmkhobby/samskara/pull/1) (3 checks
  passing before merge).
- B specifically: the fix is the smallest change that closes the actual gap
  (a guard clause and a message), not a broader refactor — consistent with
  this project's stated anti-scope-creep norm (no abstractions beyond what
  the task requires).

---

## 6. Security considered

**Primary reference**: `SECURITY.md` — per-family isolation enforced by
Postgres RLS (not application code), no committed secrets, security headers
set at the edge, private-by-default storage with signed URLs, service-role
key server-side only, rate-limited anonymous endpoints, passwords never
retrievable after set.

**Evidence, tied to the worked examples**:
- A: the entire reason for a second, fully separate Supabase project (not
  a second schema in the same one) is a security/blast-radius decision —
  `docs/SDLC.md`'s "Why two fully separate environments" section states it
  directly: a mistake made while testing must never be able to touch real
  family data. The migration script explicitly excludes test-only accounts
  and the pre-seeded public demo family from ever reaching production
  (`EXCLUDE_FAMILY_IDS`, `EXCLUDE_EMAILS` in `scripts/migrate-to-prod.mjs`).
- B: the PR's Security & privacy checklist item was worked through
  explicitly, not skipped — "Touches secrets or environment variables?" and
  "Touches personal data?" both reasoned through and marked not applicable,
  with the reasoning stated rather than just the checkbox. The bug itself
  (an orphaned `auth.users` row with no family attachment) was treated as a
  data-hygiene issue, not just a UX one — the orphaned test accounts
  created while reproducing it were deleted via the admin API as part of
  cleanup, same standard applied to real user data.
- Independent verification this session, not just citation: `curl -I`
  against both `samskara-koaham.vercel.app` and `oursamskara.com` confirmed
  every header `SECURITY.md` claims (HSTS, CSP `frame-ancestors 'none'`,
  X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy) is actually present on both, not just documented.
  Cross-tenant RLS isolation was independently re-verified the same way —
  signed in as a real test user via the anon key (not the service role,
  which bypasses RLS and would give a false pass) against a genuinely
  private family on both environments: 0 rows returned, no error, the
  `families` row itself invisible. See `docs/test-cases/RESULTS.md` #37–38.

**Gaps**, named exactly as `SECURITY.md` and `docs/SDLC.md` already state
them: no automated test suite (so RLS correctness depends on manual
re-verification like the above, not a regression-proof check), no
dependency vulnerability scanning enabled, no error/incident monitoring,
no account/family deletion flow yet.

---

## 7. Test cases

**Primary reference**: `docs/test-cases/TEST_PLAN.md` — 38 numbered cases
across every feature area (onboarding, tree building, folio contributions
of every share type, Admin tools, WhatsApp, multi-family, auth variants,
legal pages, PWA, security headers, cross-tenant isolation), each with an
explicit **Method** (UI / Code-verified / API / HTTP check) so a case that
genuinely can't be driven by browser automation (audio/video capture, PDF
download via `window.print()`, the native "Add to Home Screen" gesture) is
marked as such rather than silently skipped or falsely claimed as tested.

**Area-specific logs**: `docs/test-cases/whatsapp.md` (WhatsApp contribution
flow, privacy choice, profile-pic shortcut), `docs/test-cases/exports.md`
(photobook/biography/Vamshavali PDF generation) — append-only logs per the
format `docs/test-cases/README.md` defines (date, change, steps, result,
environment).

**Coverage for this bundle's worked examples**:
- A: covered indirectly — the migration script's own idempotency and
  dependency-order logic was exercised against real data during the actual
  2026-10-15 migration run, and the full-feature pass (B's origin) later
  re-verified the destination (production) behaves identically to the
  source environment for every feature.
- B: test case #4 ("Redeem invite link as a new Member") is the exact case
  that caught this bug on production while passing on test — the plan's
  own value demonstrated directly: identical code, different environment,
  different result, caught because the plan runs on *both* environments
  rather than assuming parity.

---

## 8. Test results

**Primary reference**: `docs/test-cases/RESULTS.md` — the full results of
the 2026-10-15 feature-parity pass across both environments, executed
against every case in `TEST_PLAN.md`. Headline result: one
production-blocking defect found (invite-redemption crash, now Finding 0,
now fixed — this is worked example B), two pre-existing minor bugs
reconfirmed, one minor API design smell noted, and the two file-upload-only
cases (`Photo`/`Document` share, spreadsheet bulk import) explicitly marked
**not UI-tested** rather than falsely passed, because this session's
browser-automation tooling cannot drive a real OS file picker — the
underlying upload code path is shared and unchanged from paths already
proven end-to-end, stated as the actual reasoning rather than left implied.

**Methodological corrections recorded, not hidden**: two cases where the
first test attempt gave a misleading result were caught and redone rather
than reported as-is — invite redemption initially inherited an
already-signed-in session (same browser profile sharing per-origin
storage across tabs) and had to be redone after clearing session state;
cross-tenant isolation initially targeted the deliberately-public demo
family (not a bug) and was redone against a genuinely private family. Both
corrections are stated in `RESULTS.md` itself, because the audit trail is
more credible showing the correction than hiding the false start.

**Post-fix verification for B**: re-run end-to-end on the test environment
with a fresh disposable family/invite after the fix landed — new member
correctly created and attached (`role: "member"`). Production re-verified
by confirming the fixed code is actually present in the live served bundle
(`curl` against `oursamskara.com`'s JS asset, confirming the fix's new
user-facing string is live) after a live crash-path re-test was blocked by
Supabase's own signup-email rate limit — recorded as the reason, not
glossed over.

---

## 9. Release procedure

**Primary reference**: `docs/GIT_WORKFLOW.md` — the exact branch model and
command sequence, including the dedicated **Hotfix** path for a production
bug that can't wait for the normal `dev` → test → `main` cycle.

**Evidence — B followed the hotfix path exactly as documented**:
1. Branched from `main` (not `dev`, which held unrelated unreleased work) —
   `hotfix/invite-redemption-null-session`.
2. Fix committed, build verified (`npx vite build`), pushed.
3. PR opened against `main` with the template's checklist filled in
   honestly ([#1](https://github.com/ananthmkhobby/samskara/pull/1)).
4. CI ran and passed (3 checks, 0 failing) before merge was attempted.
5. An automated-agent merge was explicitly blocked by this session's own
   safety tooling ("Merge Without Review") until a human reviewed and
   approved the PR on GitHub — the control held, the merge did not happen
   until a person acted.
6. Merge triggered the production deploy automatically (Vercel, tracking
   `main`) — confirmed built and `Ready` before being called done.
7. Post-merge smoke test performed against the live `oursamskara.com`
   domain, not assumed from the build succeeding.
8. `master` fast-forwarded to `main` — this was the **first release ever
   to go through this step**, so `master` was created pointing at this
   release rather than fast-forwarded from a prior one (there was no prior
   one), recorded as such rather than silently backfilled.
9. Tagged `v2026.10.15`.
10. `main` merged back into `dev`, per the hotfix procedure's explicit
    final step, so the fix is not silently lost on the next regular
    `dev` → `main` release.
11. `docs/CHANGELOG.md` entry added, covering what changed, why, the exact
    path taken, and what was verified post-deploy — including the one
    verification step that couldn't be completed live (the rate limit) and
    why that doesn't weaken the result.

**Evidence — A followed the standard (non-hotfix) release shape** at the
infrastructure level: the production Vercel/Supabase projects themselves
were the deliverable, verified live (SSL auto-provisioned, confirmed
reachable) before the data migration was run against them, with the
migration script's `--apply` flag gating the real run behind an explicit,
separate step from the dry-run/verification pass.

---

## 10. Git branches

**Model**: `docs/GIT_WORKFLOW.md` — `dev` (anyone can push, auto-deploys to
test), `main` (PR-only, auto-deploys to production), `master` (fast-forward
only, a rollback anchor, never developed on directly).

**Current real state** (checked directly, not from memory):

| Branch | Tracks / deploys to | Push model | State as of this bundle |
|---|---|---|---|
| `dev` | `samskara-koaham.vercel.app` (test) | Direct push | Includes everything, including B's fix (merged back per the hotfix procedure) |
| `main` | `oursamskara.com` (production) | PR only (by convention, not yet GitHub-enforced — see §11) | Includes A and B |
| `master` | Nothing — rollback anchor only | Fast-forward only | Created 2026-10-15 alongside this release, pointing at `main` post-merge |
| `hotfix/invite-redemption-null-session` | — | Merged and left in place | Source branch for PR #1, now merged |

**Tags**: `v2026.10.15` on `main`, marking this release — the first
release to go through the documented tag step.

---

## 11. Controls in place

Stated as what's actually enforced mechanically vs. what's currently
discipline/convention, since conflating the two is exactly what an audit
is designed to catch:

**Mechanically enforced**:
- CI (`npm run lint` + `npx vite build`) on every push/PR to `dev`/`main`
  (`.github/workflows/ci.yml`) — a non-building or non-linting change
  cannot show green on a PR.
- Per-family data isolation via Postgres RLS, independently re-verified
  this session on both environments (§6).
- Secrets scoped per-Vercel-project, never committed (confirmed via
  `git ls-files | grep env` returning nothing) and never shared between
  test and production (`docs/ENVIRONMENTS.md`).
- Registered Vercel project domains (not loose aliases) auto-follow every
  new Production deployment — the opposite failure mode was hit and fixed
  2026-10-15, documented in `docs/ENVIRONMENTS.md` specifically so it
  isn't rediscovered the hard way again.
- Automated-agent merges require human review — demonstrated directly
  during B, not just claimed (§9, step 5).

**Discipline/convention, not yet GitHub-enforced** (named honestly,
matching `docs/SDLC.md`'s own gaps list rather than overstating anything
here):
- Branch protection on `main`/`master` is **not enabled** — direct pushes
  are technically still possible today. Decided 2026-10-15 to defer
  rather than overlook, with the exact dashboard steps to enable it
  already written down in `docs/SDLC.md`.
- Self-review is the norm, not a second named reviewer, by team-size
  necessity, not preference.
- No GitHub Issues tracker in use yet (§1).

**Operational controls**:
- `scripts/backup.mjs` — weekly off-platform snapshots (see
  `docs/BACKUPS.md`), explicitly on top of (not instead of) Supabase Pro's
  own daily backups, specifically because a silent delete/overwrite
  going unnoticed for weeks is the realistic failure mode, not
  infrastructure loss.
- Disposable test data discipline — every disposable test family, account,
  and invite created during this session's full-feature pass and the
  hotfix verification was deleted afterward, on both environments,
  recorded explicitly in `docs/test-cases/RESULTS.md`'s Cleanup section
  rather than left to rot as stale test data.

**Known gaps, carried forward as-is from `docs/SDLC.md` and `SECURITY.md`
rather than restated with different wording** (restating them differently
here would risk them silently drifting from the single source of truth):
no automated test suite, no error/incident monitoring, no dependency
vulnerability scanning, no account/family data-deletion flow, Supabase Auth
not covered by the backup script, test and production currently sharing
one WhatsApp number.

---

## Index of underlying documents

| Document | Covers |
|---|---|
| [`docs/SDLC.md`](SDLC.md) | The 10-phase lifecycle, roles, known gaps |
| [`docs/GIT_WORKFLOW.md`](GIT_WORKFLOW.md) | Branch model, release and hotfix commands |
| [`docs/ENVIRONMENTS.md`](ENVIRONMENTS.md) | Test vs. production, secrets, what's identical/different |
| [`SECURITY.md`](../SECURITY.md) | Security posture, checkable claims, scope |
| [`docs/BACKUPS.md`](BACKUPS.md) | Backup mechanism, schedule, restore procedure |
| [`docs/CHANGELOG.md`](CHANGELOG.md) | One entry per production release |
| [`docs/test-cases/TEST_PLAN.md`](test-cases/TEST_PLAN.md) | The 38-case full-feature test plan |
| [`docs/test-cases/RESULTS.md`](test-cases/RESULTS.md) | 2026-10-15 full-feature test results, both environments |
| [`docs/test-cases/whatsapp.md`](test-cases/whatsapp.md) | WhatsApp-specific test log |
| [`docs/test-cases/exports.md`](test-cases/exports.md) | PDF export test log |
| [`.github/pull_request_template.md`](../.github/pull_request_template.md) | The review checklist itself |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | The enforced CI gate |
| [PR #1](https://github.com/ananthmkhobby/samskara/pull/1) | Worked example B, in full |
| Tag `v2026.10.15` | The release this bundle documents |
