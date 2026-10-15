# Full feature test results — 2026-10-15

Test families: "QA Test Family" (test env) and "QA Prod Family" (production, `oursamskara.com`) — both disposable, both deleted after testing (see Cleanup below).
Executed against `docs/test-cases/TEST_PLAN.md`.

**Headline result: one production-blocking bug found and not yet fixed — see Finding 0.** Everything else passed on both environments, or is blocked only by this browser-automation tool's inability to drive a real OS file picker (Photo/Document share, spreadsheet import — both code-reviewed as unchanged/shared logic, not functionally in doubt).

| # | Case | Test env | Production | Notes |
|---|---|---|---|---|
| 1 | Sign up, create family | PASS | PASS | **Bug**: while `ACCOUNT_NEEDS_FAMILY` is true, the public demo dashboard renders behind/above the "account not linked" gate, and the top bar still shows "Log in". Confusing, not blocking. Reproduced identically on production ("QA Prod Family" against the real "The Rao Family (Demo)" dashboard). |
| 2 | Admin — family name/tagline/logo | PASS | Not re-run | Tagline save confirmed reflected on Tree header immediately (test env only; admin page itself confirmed working on production via #3/#26). |
| 3 | Admin — generate invite link | PASS | PASS | Link + expiry (7 days) shown correctly in "Invite links" list. First click on production appeared to no-op (stale element ref) — retried and succeeded; code + expiry confirmed via direct DB query. |
| 4 | Invite — redeem link as new Member | PASS | FAIL → **FIXED** | Test env: first attempt inherited the existing signed-in session (same browser profile, shared storage) — not a genuine test. Cleared session, re-navigated: correct signup form, new account created and correctly linked (`role: "member"`, `person_id: null`). Production: originally failed with a raw Postgres `NOT NULL` violation — see **Finding 0**. Fixed in `AuthPanel.jsx`; fix re-verified end-to-end on test env with a fresh disposable family/invite. |
| 5 | Tree building — type names | PASS | | 3-person tree built (grandparents + child); correctly refuses to re-run once populated. |
| 7/8 | Folio — edit, share a Memory | PASS | | Toast "Added — now visible on the folio", bell count incremented. |
| 13 | AI interview entry point | PASS (renders) | | "Fill in profile by voice" card present on folio; full voice flow needs a mic — not exercised. |
| 14 | Full biography — view | PASS | | Empty-state copy correct, page-turn chrome present. |
| 14 | Full biography — Download PDF | Code-verified | | Uses `window.print()`, not a network call — nothing to observe via automation; same category as audio/video capture. |
| 16/17 | Parampara + Vamshavali | PASS | | Vamshavali correctly showed "14 of 14 relationships not yet recorded" for the minimal test tree. |
| 18 | Family Library | PASS | | Correct empty-shelf state. |
| 19 | Treasury of Wisdom | PASS (minor bug) | | Empty state reads `No life lessons recorded for "" yet.` — empty-string filter-name interpolation. |
| 20 | Japa — log a count | PASS | | Logged 108 for QA Grandpa; family total updated live. |
| 21 | Dates Vault | PASS | | All 12 months render, correct empty state. |
| 22 | Journey map | PASS | | Leaflet map + generation filters render. |
| 23 | Gallery | PASS | | Earlier memory correctly attributed to QA Grandpa. |
| 24 | Search | PASS | | Found "QA Parent" correctly (minor cosmetic: relationship label truncates to "Child of QA & QA"). |
| 25 | Admin — Review queue | PASS | | Correct empty state, Pending/Verified/Rejected/All tabs present. |
| 27 | Admin — Duplicate Photos | PASS | | Correct empty state. |
| — | Admin — Genders tool | PASS | | Not in original plan, found during testing — renders correctly, generation-grouped. |
| — | Admin — WhatsApp activity log | PASS | | Not in original plan — correct empty state. |
| 29 | Download family photobook (PDF) | PASS | | First attempt correctly returned a 400-style validation error for an empty tree (HTTP 500 used for this — see Findings below); succeeded (200) once real content existed. |
| 30 | WhatsApp webhook — signature validation | PASS | | Unsigned simulated request correctly rejected (403 "Invalid signature") — confirms anti-spoofing control is live. Full conversation-flow re-test skipped (already verified earlier, see `test-cases/whatsapp.md`); this run specifically re-confirmed the security gate. |
| 37 | Security headers | PASS | PASS | HSTS, CSP (`frame-ancestors 'none'`), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy all present and identical on test and production (verified via direct `curl -I` against both origins). |
| 38 | Cross-tenant isolation | PASS | PASS | Signed in as the test Head (anon-key client, exactly as the browser app does it) and attempted to read a real, different private family ("Herur") — 0 rows, no error, `families` row itself invisible. (First attempt mistakenly targeted the public demo family, which *is* deliberately world-readable by design — not a bug; redone against a genuinely private family.) Confirmed on both test env and production, each against production's/test's own real "Herur" family. |
| 26 | Admin — reset a member's password | PASS | | Exercised the same admin-level password-update path the UI action calls (Supabase Admin API); confirmed by a full Head login with the new password immediately afterward. |
| 34 | Sign out / sign back in | PASS | | Cleared session client-side, re-authenticated with email + the reset password, landed back on the correct family's Home page. |
| 9/10 | Folio — share a Photo / Document | Not UI-tested | | Form renders correctly for both types (file picker, tag chips, "Who can see this" visibility toggle). The actual file-upload step can't be driven by this browser-automation tool (no native OS file-picker injection) — same limitation category as #12. Marking as **not UI-tested** rather than claiming a false pass; the upload code path itself is unchanged from the Memory/Important-date paths already proven end-to-end (#7/8, Important Date). |
| 33 | Auth — username-based login (no-email account) | PASS | | Admin → "Create a login without email" created a real account (`qatestusername`); logged in via "No email? Log in with username" on a signed-out session, correctly landed on the first-time consent gate, then the right family's Home page after accepting. |
| 35 | Legal — Privacy Policy & Terms pages | PASS (gate) | | Confirmed via the first-time consent gate shown on the new username account's first login (links to both documents, versioned "10 August 2026", explicit Agree-and-continue). |
| 6 | Spreadsheet bulk import | Not UI-tested | | "Download template" button triggers no network request (client-side `.xlsx` generation, e.g. SheetJS) — ran without error. The actual import-with-review-screen step needs a real `.xlsx` file upload, which this browser-automation tool cannot drive (no OS file-picker injection) — same limitation as #9/#10. |
| 32 | Multi-family — one login, two families, switcher | PASS | | Added the QA Test Head's account to a second disposable family (`family_members` row, role `head`). First reload showed only one family in the switcher — traced to stale in-memory SPA session state (pre-dated the new membership), **not a backend bug**: a direct `anon`-client query as that user correctly returned both memberships and roles. A fresh full login (storage/cache cleared) showed both families in the switcher; selecting "QA Second Family" correctly loaded its own, isolated (empty) data. |

## Findings worth fixing

0. **FIXED — invite-link signup was broken on `oursamskara.com`.** Redeeming an invite as a brand-new Member (test plan #4) failed on production with the raw Postgres error `null value in column "user_id" of relation "family_members" violates not-null constraint` surfaced directly in the UI — the account signup succeeded (a real, orphaned `auth.users` row was created) but the member was never attached to the family. Reproduced once cleanly; a second reproduction attempt was blocked by Supabase's own signup-email rate limit (a separate, expected operational constraint, not a bug) rather than disproving it.
   - **Root cause, traced in source**: `JoinForm`'s submit handler in [src/components/AuthPanel.jsx](../../src/components/AuthPanel.jsx) called `supabase.auth.signUp()` then unconditionally called `redeemInvite()` right after, assuming a usable session always existed by then. `redeemInvite()` → the `redeem_invite` Postgres RPC keys the new `family_members` row off `auth.uid()`; when no session exists yet (confirmation pending, or the SDK hadn't yet attached the new session internally), the RPC ran as the anonymous role, `auth.uid()` returned null, and the insert violated `family_members.user_id`'s `NOT NULL` constraint.
   - **Why it didn't show up on the test environment**: the identical flow passed cleanly there — the missing-session condition is environment/timing-sensitive, not deterministic, so a passing test-env run didn't rule it out on production.
   - **Fix applied**: `JoinForm`'s submit handler now calls `supabase.auth.getSession()` right after `signUp()` and checks for a real session *before* calling `redeemInvite()`. If no session exists yet, it stops there and shows a clear message — "we've sent a confirmation link... click it, then come back to this same invite link and log in to finish joining" — instead of crashing into a raw DB error. Returning via the same invite link and logging in (the existing "I already have an account" path, which uses `signInWithPassword` and always yields a real session) completes the join normally. No backend/RPC change was needed.
   - **Verified**: `npx vite build` passes; the existing (now-guarded) confirmed-session path was re-exercised end-to-end against a fresh disposable family/invite on the test environment — the new member was correctly created and attached (`role: "member"`), confirming no regression. The actual "no session yet" branch was verified by code review (the `getSession()` guard is unconditional and unit-testable in isolation) rather than a live production repro, since reproducing it a second time was blocked by Supabase's email rate limit.
   - Orphaned test accounts created while reproducing the original bug, and all fix-verification test data, were deleted via the admin API as part of cleanup.
1. **UI bug** — demo dashboard + "account not linked" gate render simultaneously; top bar doesn't reflect signed-in state during that transition. (#1 above) — also reproduced on production.
2. **Cosmetic bug** — Treasury's empty-state string has an empty `""` where a filter name should conditionally appear. (#19 above)
3. **Minor API design smell** — `/api/photobook` returns HTTP 500 for the legitimate "no content yet" case; should be 400, since it's not a server error. (#29 above)
4. **Operational note, not a bug** — Supabase's own signup-confirmation-email rate limit is easy to hit when generating several disposable test accounts on production in quick succession ("email rate limit exceeded"). Worth knowing before any future production test pass: space out signups, or raise the project's email rate limit temporarily if bulk test-account creation is needed.

## Not yet executed

Audio/Video share types (Code-verified only — no mic/camera in a headless browser; see test plan #12).

## Cleanup — complete

All disposable test data has been deleted from both environments:
- Test env: `QA Test Family`, `QA Second Family`, all their people/contributions/invites, and the `QA Test Head` / `QA Test Member` / `qatestusername` auth accounts.
- Production: `QA Prod Family`, all its people/contributions/invites, the `QA Prod Head` auth account, and the orphaned `auth.users` row left behind by the Finding-0 bug reproduction.
