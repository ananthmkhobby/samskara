# Samskara — Full App Regression: Test Scenarios & Results

**Date:** 2026-10-29
**Scope:** Login/auth, roles (Head/Admin/Member), Fast Family Onboarding, regular onboarding, invite links, tree construction, share, tag, gallery, plan/subscription, login page & first-memory capture, Parampare, Library, and the other module-gated features (Treasury, Journey, Japa, AI features).
**Environment:** Test Supabase project (`idopzbqxrpiatumxneak`), disposable `zzz-*@samskara-test.invalid` accounts and `ZZZ`-prefixed families, all cleaned up after each run (verified zero residue).
**Companion document:** [FAST_FAMILY_ONBOARDING_TEST_REPORT.md](FAST_FAMILY_ONBOARDING_TEST_REPORT.md) — 65 scenarios + 6 defects (all fixed) specific to FFO; not repeated here except where it feeds into a cross-feature check.

**Method key:**
- **LIVE** — executed against the real test database through the actual RPC/RLS path (anon client signed in as a real disposable auth user, service-role client only for setup/verification), in this session.
- **CODE** — verified by reading the implementation; not click-tested in a live browser this round. Noted explicitly wherever this is the case so it isn't mistaken for a live pass.

---

## 1. Login & Authentication

| ID | Scenario | Method | Result |
|----|----------|--------|--------|
| L1 | Sign up with new email + password | LIVE (via `register_new_family` path, same `auth.signUp` underneath) | PASS |
| L2 | Sign up with an email already registered | LIVE | PASS — Supabase rejects: "A user with this email address has already been registered" |
| L3 | Sign in with correct password | LIVE | PASS |
| L4 | Password reset request (`resetPasswordForEmail`) | CODE — `AuthPanel.jsx:142` | Implemented; not live-tested (would require real email delivery) |
| L5 | Self-registered Head with no admin above them, needs help recovering access | CODE — `callApi("/api/password-reset-requests")`, `AuthPanel.jsx:156` | Implemented fallback path exists |
| L6 | Admin-created no-email member login, username+password sign-in | CODE — `usernameToEmail()` round-trip between `AuthPanel.jsx:21-23` and `api/_memberAuth.js:56-58`; duplicate-username handling at `api/create-member-login.js:57-60`; rollback of orphaned auth user on `family_members` insert failure (`:65-68`) | Implementation reviewed, logic is sound and symmetric; not live-tested this round (covered functionally by L2/A3's duplicate-identity check, which exercises the same underlying constraint) |
| L7 | Google OAuth sign-in | CODE — `AuthPanel.jsx:35-37` | Implemented, lands in same `ACCOUNT_NEEDS_FAMILY`/`ConsentGate` funnel as email signup |
| L8 | Logout | CODE — `handleSignOut()`, full reload after `supabase.auth.signOut()` | Implemented |
| L9 | Session restore on reload | CODE — relies on supabase-js's own persisted session, no custom code | Standard library behavior, not separately re-tested |
| L10 | Sign-up with no session returned (email confirmation required) | CODE — `pendingConfirmation` state, `AuthPanel.jsx:255,281-286` | Handled distinctly from the normal "signed in immediately" path |
| L11 | Privacy/Terms consent checkboxes — must open both before Accept enables | CODE, fixed earlier this session — numbered-step framing + per-document checkmarks in `ConsentGate.jsx` and both consent blocks in `AuthPanel.jsx` | Fixed in response to a real user-reported confusion bug; not re-tested live this round |

## 2. Roles — Head / Admin / Member

| ID | Scenario | Method | Result |
|----|----------|--------|--------|
| R1 | New family's creator is assigned `head` | LIVE (A2) | PASS |
| R2 | Member cannot create an invite (RLS) | LIVE (A4) | PASS — "new row violates row-level security policy for table \"invites\"" |
| R3 | Head can create an invite | LIVE (A5) | PASS |
| R4 | Member cannot call `reassign_parents` | LIVE (T6) | PASS — "Only an Admin or the Family Head can edit relationships." |
| R5 | Admin (not Head) cannot call `delete_person` — Head-only by design | LIVE (T8) | PASS — "Only the Family Head can remove someone from the tree." |
| R6 | Head can call `delete_person` | LIVE (T9) | PASS |
| R7 | Admin and Head have identical rights on FFO's `resolve_workbench_task` | LIVE — see FFO report, re-confirmed in the final FFO regression pass | PASS |
| R8 | A caller with **zero membership** in the target family is blocked from `resolve_workbench_task` and `reassign_parents` (the null-role bypass class) | LIVE — see FFO report Defect #6 and `reassign_parents`'s own earlier fix | PASS (both fixed; the `resolve_workbench_task` one was found and fixed in this testing arc) |
| R9 | A member can set only their own display name (`set_my_display_name`), not act on another member | LIVE (A13 exercises the self-only path; RPC resolves caller from `auth.uid()` server-side per code review — no member-id parameter exists to spoof) | PASS |

## 3. Fast Family Onboarding (FFO)

Covered exhaustively in the companion report — 65 scenarios across admin invite generation, Workbench resolution, relationship-path claims, provisional people, multi-family isolation, and orphan-safety. All passing as of the latest fix (`resolve_workbench_task` cross-family bypass). This round added one further LIVE regression: a full 3-generation dynamic tree build (brand-new member with no pre-existing person → admin creates person → places via `reassign_parents` → links via Workbench → a second joiner anchors against the first's newly-placed person → gen cascades correctly 0→1→2 → an ancestor added above the root afterward without disturbing the cascade already below it). No new defects found.

## 4. Regular (non-FFO) Onboarding & Invite Links

| ID | Scenario | Method | Result |
|----|----------|--------|--------|
| O1 | `register_new_family` creates family + head membership | LIVE (A1, A2) | PASS |
| O2 | Invalid invite code rejected | LIVE (A6) | PASS — "Invalid invite code." |
| O3 | Valid invite redemption creates `member` row | LIVE (A7) | PASS |
| O4 | Reusing an already-redeemed code is rejected | LIVE (A8) | PASS — "This invite has already been used." |
| O5 | Redeeming a second invite into a family you already belong to is rejected | LIVE (A9) | PASS — "You already belong to this family." |
| O6 | Expired invite code rejected | LIVE (A10) | PASS — "This invite has expired." |
| O7 | A moderator cannot delete an already-redeemed invite (historical record preserved) | LIVE (A11) | PASS — row still exists after attempted delete |
| O8 | A moderator CAN delete an unused invite | LIVE (A12) | PASS |
| O9 | `AddFamilyMemberModal` — non-admin submission goes to Pending, admin/head submission applies immediately | CODE — `canModerate` branch in `AddFamilyMemberModal.jsx` | Reviewed, matches the moderation-queue pattern used everywhere else; not live browser-tested this round |
| O10 | `AddFamilyMemberModal` — empty name / geocode failure blocks submit | CODE | Reviewed, inline error paths present |

## 5. Family Tree Construction

| ID | Scenario | Method | Result |
|----|----------|--------|--------|
| T1 | `reassign_parents` enforces max 2 parents | LIVE | PASS — "A person can have at most two parents on record." |
| T2 | Self-as-parent rejected | LIVE | PASS — "Someone cannot be their own parent." |
| T3 | Valid reassignment succeeds | LIVE | PASS |
| T4 | `gen` computed correctly from parent's `gen` | LIVE | PASS |
| T5 | Cycle rejected (attempting to make an ancestor a descendant of their own descendant) | LIVE | PASS — "That would create a loop in the family tree — the chosen parent is already a descendant of this person." |
| T6 | Non-moderator blocked from reassigning | LIVE | PASS |
| T7 | `delete_person` blocked when the person has recorded children | LIVE | PASS — names the blocking child, matches existing UX pattern |
| T8 | `delete_person` is Head-only | LIVE | PASS |
| T9 | Head can delete a leaf (childless, spouseless) person | LIVE | PASS |
| T10 | Deleting a person nulls references across `contributions`, `family_members`, `book_ownership`, `invites`, and the two FFO tables rather than crashing or cascading unexpectedly | LIVE — confirmed in the FFO report's defect-finding pass (the composite-FK `ON DELETE SET NULL` bug class, now fixed for all 6 tables) | PASS |
| T11 | `EditRelationshipsCard` blocks picking the same parent twice client-side | CODE — `AdminView.jsx` ~line 810 | Reviewed |
| T12 | Tree rendering (`ClassicTree`/`IllustratedTree`/`FocusTreeView`/auto-pick by size) | CODE — not exercised live (requires browser) | Not tested this round — recommend a browser click-through if a release is imminent |

## 6. Share Feature

| ID | Scenario | Method | Result |
|----|----------|--------|--------|
| SH1 | Content share (Parampare) created with source family + required fields | LIVE | PASS — found and fixed a test-script issue (missing `field` column), not a product bug; the actual constraint doing its job correctly |
| SH2 | First redemption of a content-share code marks `redeemed_by_family_id`/`redeemed_at` | LIVE | PASS |
| SH3 | Single-use enforcement — a second redemption attempt sees the code as already consumed | LIVE | PASS — `.is("redeemed_at", null)` guard correctly excludes the consumed row |
| SH4 | Gallery photo share (`api/share.js`) — only `Verified` + `visibility:"shared"` photos may be shared | CODE — `api/share.js:151-154`, re-reads the row server-side rather than trusting the client | Reviewed, authorization logic is sound: re-derives `family_id`/status from the DB, then calls `requireMember` |
| SH5 | Share revoke — only the share's own `owner_id` may revoke | CODE — `api/share.js:198`, 403 otherwise | Reviewed |
| SH6 | Public `/api/share` preview page never serves the real photo, only an approved resized copy or brand card | CODE — `api/share.js` GET handler | Reviewed; matches the documented "never distinguish wrong/revoked/expired token" posture |
| SH7 | `resolve` action discloses nothing readable on its own (real photo query runs client-side under the visitor's own RLS session) | CODE | Reviewed |

## 7. Tag Feature (Photo Tags)

| ID | Scenario | Method | Result |
|----|----------|--------|--------|
| G1 | Any family member can add a photo tag (collaborative, no moderation queue) | LIVE | PASS |
| G2 | A tag requires either `person_id` or `label` — neither is rejected by a DB check constraint | LIVE | PASS — "violates check constraint \"photo_tags_person_or_label\"" |
| G3 | A member who did not create the tag, and is not a moderator, cannot delete it | LIVE | PASS |
| G4 | The tag's own creator OR a moderator can delete it | LIVE | PASS (moderator-delete path confirmed; creator-delete path follows the identical RLS clause by code inspection) |

## 8. Gallery

| ID | Scenario | Method | Result |
|----|----------|--------|--------|
| GA1 | Only `Verified` contributions of gallery types appear in the grid; Pending stays out until moderated | CODE — `TreasuryView.jsx:83` (this is the actual Gallery screen despite the component name) | Reviewed |
| GA2 | "Private to me" tab shows only the signed-in user's own private uploads | CODE | Reviewed |
| GA3 | Upload path convention enforces family-scoped Storage RLS (`{familyId}/{personId}/{uuid}.ext`) and a separate private-to-me path | CODE — `src/lib/mediaUpload.js` | Reviewed |
| GA4 | Plan-tier media limits enforced server-side via Postgres trigger, with a friendly re-derived error message client-side (Storage API swallows the real trigger text) | LIVE — verified the equivalent `people`-limit trigger fires correctly (P1 below); the media trigger is the same `enforce_media_limit` mechanism from the same migration, not separately re-tested live this round since it requires a real Storage upload rather than a table insert | PASS by direct analog, not independently exercised |
| GA5 | Gallery export codes (`api/gallery-export.js`) | CODE — not read in full depth, not tested | Flagged as present; recommend a dedicated pass if export is actively used |
| GA6 | Chitrashale "memory room" (separate themed consumer of the same contribution/media pipeline) | CODE | Reviewed structurally, not click-tested |

## 9. Plan / Subscription

| ID | Scenario | Method | Result |
|----|----------|--------|--------|
| P1 | Starter-tier people limit enforced by DB trigger, not just client-side | LIVE | PASS — inserted 25 people successfully, 26th rejected with "This family's plan allows up to 25 people in the tree. Ask a Head/Admin to request an upgrade from the Plans page." |
| P2 | `getEffectiveModules()` — an explicit `false` family override always wins over the tier default | CODE — `planTiers.js:73-76` | Reviewed |
| P3 | SuperAdmin's `savePlan()` / "provision new family" module-flag save bug | LIVE, fixed earlier this session — previously silently dropped any attempt to turn ON an opt-in module; fixed to write an explicit flag only when it differs from the tier's own default | PASS (post-fix) |
| P4 | No real payment gateway exists — plans/limits are set manually by SuperAdmin only | CODE — confirmed no "stripe"/"razorpay" integration anywhere in `src` | Confirmed as current architecture, not a defect — just worth knowing when scoping any future billing work |
| P5 | `extractPlanLimitMessage` correctly parses the trigger's Postgres error text for display | LIVE (P1's error message is exactly what the UI's parser expects — same marker string "This family's plan allows up to") | PASS |

## 10. Login Page & First-Memory Capture

| ID | Scenario | Method | Result |
|----|----------|--------|--------|
| M1 | `LoginPage.jsx` composes `AuthPanel` + `PromoCarousel` + hero imagery for logged-out visitors | CODE | Reviewed |
| M2 | "Capture memory" ≡ `FirstMemoryWizard.jsx` — a separate, fully anonymous flow (not on the login page itself) letting a visitor capture a photo/story before ever signing in, then prompting sign-in to attach it to a family | CODE — route `firstMemory` → `/first-memory`, analytics events tracked at each step | Reviewed; not click-tested live this round |
| M3 | Anonymous capture → sign-in → family-attach handoff does not lose the captured content | CODE — not independently verified live | Recommend a live click-through before a release that touches this path |

## 11. Parampare (Lineage)

| ID | Scenario | Method | Result |
|----|----------|--------|--------|
| PA1 | Verified `contributions` of type `parampara` render in the feed, filterable by category | CODE | Reviewed |
| PA2 | `field === "lineage"` entries render as a distinct `LineageCard` (gotra/pravara/veda/shakha/guru/generations) | CODE | Reviewed |
| PA3 | Cross-family content share (text fields only, never the photo) — create & single-use redemption | LIVE (SH1-SH3 above exercise the exact same `content_shares` table/constraint this feature uses) | PASS |
| PA4 | Admin-only "import a shared story" (`redeemContentShare`) | CODE | Reviewed |

## 12. Library

| ID | Scenario | Method | Result |
|----|----------|--------|--------|
| LB1 | Book categories, ownership states (owned/gifted/read/recommended) | CODE — `src/lib/library.js` | Reviewed |
| LB2 | "Grandfather's Shelf" — a book becomes a read-only memorial once its last recorded owner has died | CODE — `isGrandfathersShelf()`, depends on `BOOK_OWNERSHIP` chain | Reviewed; not live-tested (would need a full death-date + ownership-chain scenario) |
| LB3 | Library view gated by `module_flags.library` | CODE — matches the same `VIEW_GATE_KEYS` pattern as every other gated module | Reviewed |

## 13. Other Module-Gated Features

| ID | Scenario | Method | Result |
|----|----------|--------|--------|
| MO1 | Treasury ("wisdom" repository) gated by `module_flags.treasury` | CODE | Reviewed |
| MO2 | Journey (life-location map, Leaflet-based) gated by `module_flags.journey` | CODE | Reviewed |
| MO3 | Japa (chanting/practice log) gated by `module_flags.japa` | CODE | Reviewed |
| MO4 | AI features (interview, photo-scan, translate) gated by `module_flags.aiFeatures`, feature-level rather than a standalone view | CODE | Reviewed |
| MO5 | A disabled module's view is blocked both by direct-URL route gating (`App.jsx`'s `VIEW_GATE_KEYS`) and by being hidden from navigation (`MoreMenu.jsx`) — two independent layers, not just a hidden link | CODE | Reviewed |

---

## Defects found this round

**None new.** Every LIVE check passed on the first or (for the one script bug — a missing required `field` column in a test insert, not a product defect) second attempt. All defects found earlier in this testing arc (see the FFO report's Defects Log, 6 entries, all fixed and verified) remain fixed and were not reproduced by this broader pass.

## Explicitly not covered this round (recommend before a production release)

- Any UI interaction requiring an actual browser click-through (tree rendering modes, Gallery/Chitrashale upload UI, Library shelf UI, First-Memory Wizard's anonymous→signed-in handoff, Journey map rendering, Japa logging UI) — everything marked **CODE** above was verified by reading the implementation, not by operating the running app.
- Email delivery (password reset, sign-up confirmation) — these depend on a real mail provider and weren't exercised.
- `api/gallery-export.js` in depth.
- Google OAuth's actual browser redirect round-trip (the code path was reviewed, not driven through a real Google consent screen).

## Status

Everything tested in this pass — regular onboarding, invites, roles, tree construction, plan limits, tags, and cross-family content shares — is **working correctly** against the test database, with no regressions from the FFO-era fixes already shipped to `dev`. PR #27 (Fast Family Onboarding) remains open and unmerged; nothing in this report changes that status or requires new action beyond what's already pending your merge confirmation.
