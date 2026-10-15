# Software development lifecycle

How a change gets from an idea to running in production, and what each step
leaves behind as evidence — for ordinary debugging, and for any future audit
(ISO 27001, SOC 2, or a security review) that asks "show me how you know
this was done carefully."

The process is sized for how this project is actually built today — a small
team, moving fast — but every phase below produces something real and
checkable, not a form filled in for its own sake.

## The phases

| Phase | What happens | Evidence it leaves behind |
|---|---|---|
| 1. Change request | What's changing and why, stated before code is written | A GitHub Issue, or for a small change, the opening line of the PR description |
| 2. Design | For anything touching data model, auth, money, or privacy — a short written plan before implementation | A note in `docs/designs/`, or the plan this conversation already produces for substantial work |
| 3. Implementation | The actual change, on `dev` | Commit history — this repo's own commit messages already explain *why*, not just *what*; keep doing that |
| 4. Security & privacy review | Does this touch PII, auth, RLS, secrets, or payment? If yes, called out explicitly | The PR template's checklist (`.github/pull_request_template.md`) |
| 5. Testing | Automated checks where they exist; a logged manual pass where they don't | CI run output + an entry in `docs/test-cases/` |
| 6. Staging validation | Verified against real-shaped data on the test domain before it can go further | The `dev` deploy itself, plus the PR's "what I checked" notes |
| 7. Release approval | A deliberate decision to promote `dev` to `main`, not an automatic one | The PR approval/merge on `dev` → `main` |
| 8. Deployment | Vercel builds and deploys from the merged commit | Vercel's own deployment log — immutable, timestamped, tied to a commit SHA — plus the git tag `docs/GIT_WORKFLOW.md` describes |
| 9. Post-deploy verification | A short smoke test against the real production URL, right after | Logged in the release PR or `docs/CHANGELOG.md` |
| 10. Monitoring | Ongoing — currently the weakest phase, see Gaps below | — |

See `docs/GIT_WORKFLOW.md` for the exact branch and command sequence phases
3–9 map to.

## Why two fully separate environments

Before this, test and production would have meant two domains sharing one
Supabase project — technically simpler, but it means a mistake made while
testing (a bad migration, a bulk-delete script, a bug in new code) lands
directly on real family data, with no isolation at all. Separate Supabase
projects per environment (see `docs/ENVIRONMENTS.md`) is the actual control
that makes "test freely" and "production is safe" both true at once.

## Design note: what "design" means at this size

Not every change needs a design doc. The bar: does it change the data
model, touch who can see or do what (RLS, roles, auth), handle money, or
handle something irreversible (a delete, a migration)? If yes, write the
plan down before the code — even three sentences — because that plan is
what a reviewer (today, that's self-review; later, possibly someone else)
checks the implementation against, and what an auditor reads to understand
*intent*, not just *output*.

## Known gaps (named honestly, not hidden)

An auditor finding an undocumented gap looks far worse than a documented
one with a plan. Current state, as of this document:

- **No automated test suite.** Highest-value first targets: RLS policies
  (the actual data-isolation guarantee the whole privacy story depends on),
  the entitlement/plan-gating logic once built, and the spreadsheet
  bulk-import parser (`src/lib/familyTemplate.js`) — the places where a
  silent bug has the worst blast radius.
- **No error or incident monitoring.** Today, a production bug is
  discovered when a family member reports it, not by the system. Worth
  adding before running two environments makes this harder to notice.
- **No dependency vulnerability scanning.** GitHub Dependabot alerts are a
  one-time settings toggle on a public repo and currently aren't enabled.
- **No account/family data-deletion flow.** Not an oversight to fix
  silently — a decision to make deliberately and document when made.
- **Supabase Auth isn't covered by the backup script** — already known and
  documented in `docs/BACKUPS.md`; matters more now that production holds
  the real data.
- **GitHub branch protection on `main` and `master` isn't enabled yet** —
  decided 2026-10-15 to defer rather than overlook: for now, direct pushes
  to either are still technically possible, relying on `docs/GIT_WORKFLOW.md`
  being followed by discipline rather than enforced by GitHub. Enable via
  Settings → Branches → require a PR and the CI status check before merge,
  no force-push, no direct push — before this project has more than one
  committer, or sooner if convenient.
- **Test and production currently share one WhatsApp Business number**
  (decided 2026-10-15, not an oversight) — both environments' WhatsApp
  traffic flows through the same Twilio sender. Revisit if test traffic
  volume ever makes this noisy, or before onboarding real production
  families in volume.

## Roles, at this team's current size

- **Author/reviewer** — today, often the same person. Self-review is still
  real review when the PR checklist is actually worked through, not
  rubber-stamped — the value is in the act of checking, not in having a
  second person.
- **Release approver** — whoever merges `dev` → `main`. This is the one
  step that should never be casual, since it's the only gate between any
  change and real family data.
