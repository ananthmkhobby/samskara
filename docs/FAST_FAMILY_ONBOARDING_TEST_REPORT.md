# Fast Family Onboarding — Test Scenarios & Results

Test analyst report, 2026-10-29. Covers the admin-side onboarding
workflow and the member-side signup/join/relationship-declaration
workflow for Fast Family Onboarding (FFO) Phase 1, plus the edge cases
around dependent nodes (anchors, provisional people) being present,
absent, or changing state while other onboarding is in progress.

**Environment**: test Supabase project + test Vercel deployment
(`samskara-koaham.vercel.app`), feature flag `fastOnboarding` on for the
test family used. All scenarios run against real disposable accounts
(`zzz-*@samskara-test.invalid`), never the production database. All test
data removed after each run — verified zero residue after every pass.

**Method**: RPC/database-level verification for the full scenario
matrix (reliable, scriptable, repeatable), cross-checked with real
browser click-throughs for the user-facing screens (signup form,
Relationship Path Builder, admin Workbench, invite list) to confirm the
UI actually reflects what the database shows.

**Result summary**: 65 scenarios documented, all passing as of the final
run. **6 real defects found and fixed during this testing cycle** — see
the Defects Log at the end, including one **critical cross-family
security bypass** (Defect #6) found specifically by testing the
multi-family scenario. Most were found by deliberately testing "could
this leave someone orphaned/stuck/crashed/exposed," not the happy path.

---

## 1. Admin perspective

### 1.1 Invite generation

| ID | Scenario | Steps | Expected | Actual |
|---|---|---|---|---|
| A01 | Generate an "open" invite (no person picked) | Admin → Members → Invite & create logins → leave picker on default → Generate | Link created; list shows "Open invite" | ✅ Pass |
| A02 | Generate an invite pre-linked to an **existing** tree person | Pick a real person from the dropdown → Generate | Link created; list shows "For [Name]" | ✅ Pass |
| A03 | Generate an invite naming someone **not yet in the tree** | Select "— name someone not in the tree yet —" → type a name → Generate | Link created; list shows "For [Name] (not yet in tree)" | ✅ Pass (feature was dead-on-arrival until fixed — see Defect #1) |
| A04 | Invite list distinguishes pending vs. used vs. expired | Generate several invites, redeem one, let one expire | Correct status badge and metadata line per invite | ✅ Pass |
| A05 | Revoke an unused invite | Click Revoke on a pending invite | Invite removed from list, code no longer redeemable | ✅ Pass (pre-existing feature, unaffected by FFO) |
| A06 | Only Head/Admin can generate an invite | Attempt invite creation as a plain member (direct RLS check) | Blocked — `invites` INSERT policy requires `is_moderator()` | ✅ Pass (pre-existing, unchanged) |

### 1.2 Admin "Needs Connection" Workbench

| ID | Scenario | Steps | Expected | Actual |
|---|---|---|---|---|
| A07 | Workbench entry only visible to Head/Admin, only when flag is on | Check MoreMenu as member / as admin, flag on / off | Entry shown only for admin role + flag on | ✅ Pass |
| A08 | "Unlinked members" tab | Open tab with a genuinely unlinked member present | Member listed with a working "pick who they are" linker | ✅ Pass |
| A09 | Link an unlinked member to an existing person | Pick person from dropdown → Link | `placement_status` → `PLACED_CONFIRMED`, `person_id` set | ✅ Pass |
| A10 | "Unresolved paths" tab shows claim detail | Member submits a claim with anchor + relationship + connecting name | Row shows exact claim text, not a generic placeholder | ✅ Pass |
| A11 | Resolve an unresolved path via "Invite missing person" | Click action on a path-claim task | New invite created, pre-linked to the named/provisional person if one exists | ✅ Pass |
| A12 | Resolve an unresolved path via "Close unresolved" | Click action | Task closes; claim marked `CLOSED_UNRESOLVED`; **membership untouched** | ✅ Pass |
| A13 | "Provisional people" tab | Member creates a named provisional person | Row shows the name, with Confirm / Invite / Close actions | ✅ Pass |
| A14 | Confirm a provisional person into the real tree | Click "Confirm into the tree" | `provisional_status` cleared; person becomes ordinary — **does not auto-set parents** (admin must separately use Fix Relationships) | ✅ Pass (confirmed intentional, see §3.3) |
| A15 | Admin uses existing "Fix relationships" tool after confirming | Pick parents for the now-real person | `parents` set, `gen` correctly recomputed and cascaded via `reassign_parents()` | ✅ Pass — confirms FFO composes cleanly with the pre-existing tool, not a replacement |
| A16 | "Possible duplicates" tab | Open tab | Placeholder shown — automatic detection explicitly deferred (documented, not a gap) | ✅ Pass (as designed) |
| A17 | Non-admin cannot call any resolve action | Member attempts `resolve_workbench_task` directly | Blocked with "Only an Admin or the Family Head can resolve this." | ✅ Pass |
| A18 | Concurrent resolution of the same task by two requests | Fire two `resolve_workbench_task` calls on the same task simultaneously | No crash, no corruption; task lands in one consistent final state (row-level `for update` lock) | ✅ Pass |

### 1.3 Admin — deletion safety (the "don't orphan anything" check)

| ID | Scenario | Steps | Expected | Actual |
|---|---|---|---|---|
| A19 | Delete a person who is an **open claim's anchor** | `delete_person()` on someone referenced by `relationship_path_claims.anchor_person_id` | Claim survives with anchor reference nulled, not deleted | ❌ **FAIL on first run** → Fixed → ✅ Pass (Defect #3) |
| A20 | Delete a **provisional person** referenced by an open workbench task | `delete_person()` on a not-yet-confirmed provisional person | Task survives with reference nulled; workbench stays readable | ❌ **FAIL on first run** → Fixed → ✅ Pass (Defect #3) |
| A21 | Delete an account that has created or redeemed an invite | `request_account_deletion()` → `auth.admin.deleteUser()` | Succeeds; invite row survives with `created_by`/`used_by` nulled | ❌ **FAIL on first run** → Fixed → ✅ Pass (Defect #2) |

---

## 2. Member / new-registrant perspective

### 2.1 Entry paths

| ID | Scenario | Steps | Expected | Actual |
|---|---|---|---|---|
| M01 | Brand-new signup, no invite at all | `register_new_family()` | Becomes Head of a new family, `placement_status = UNANCHORED` (no tree entry for themselves either — correctly not force-created) | ✅ Pass |
| M02 | Fresh signup redeeming an **open** invite | Sign up, no person pre-picked | Joins as member, `UNANCHORED`, display name carried from signup form | ✅ Pass |
| M03 | Fresh signup redeeming an invite **pre-linked to an existing person** | Sign up via that link | Joins **already** `PLACED_CONFIRMED`, correctly linked, path builder never shown | ✅ Pass |
| M04 | Fresh signup redeeming an invite with a **proposed name** | Sign up via that link | Name pre-fills the "connecting person" field later in the flow | ❌ **FAIL on first run** (value never reached the UI) → Fixed → ✅ Pass (Defect #1) |
| M05 | Existing account redeems an invite into a **second** family | Already-signed-in user opens a different family's invite | Adds a second, independent `family_members` row; second family's placement is `UNANCHORED` on its own, unaffected by the first family's status | ✅ Pass |
| M06 | Existing account opens an invite for a family it's **already in** | Redeem the same family's invite twice | Blocked: "You already belong to this family." (this is the correct, intended `JoinFamilyModal` behavior for a signed-in user, not an error state) | ✅ Pass — confirmed as a real-user-reported point of confusion, not a bug; root cause communicated clearly |
| M07 | Admin creates a login directly (no self-signup) | `create-member-login.js`, no person picked | New account, correctly `UNANCHORED`; gate triggers normally on their first real login | ✅ Pass |
| M08 | Expired invite | Redeem a code past `expires_at` | Blocked: "This invite has expired." | ✅ Pass |
| M09 | Already-used invite | Redeem a code with `used_at` already set | Blocked: "This invite has already been used." | ✅ Pass |
| M10 | Invalid/garbage invite code | Redeem a nonexistent code | Blocked: "Invalid invite code." | ✅ Pass |
| M11 | Family has the flag **off** | Any of the above, flag-off family | Behaves **byte-for-byte identically** to pre-FFO — confirmed no path builder ever renders, no new columns affect anything existing code reads | ✅ Pass — release-blocking check |

### 2.2 The Relationship Path Builder (post-join)

| ID | Scenario | Steps | Expected | Actual |
|---|---|---|---|---|
| M12 | Name step skipped when already known | Signup form already captured a name | Builder opens directly on the anchor step | ✅ Pass |
| M13 | Name step shown and required when not known | Simulate a join with no prior name | Builder's first step asks for and saves the name before continuing | ✅ Pass |
| M14 | Pick a known anchor | Select an existing person | Step 2 names them directly ("How are you related to **Narasimha Rao**?"), not a vague "them" | ✅ Pass (fixed UX defect, see session notes) |
| M15 | "Not sure / no one I recognize" | Leave anchor blank, continue | Step 2 explicitly explains the general-terms framing instead of using a broken pronoun | ✅ Pass |
| M16 | Relationship requiring a branch-side follow-up (cousin, cousin's spouse, in-law) | Select "cousin" | "Which side?" question appears | ✅ Pass |
| M17 | Relationship **not** requiring a side (parent, child, sibling, spouse) | Select "parent" | No side question shown — bounded to at most 2 follow-ups as designed | ✅ Pass |
| M18 | "Not sure" as the relationship itself | Select "not sure" | Still a complete, valid, submittable answer — never forces a guess | ✅ Pass |
| M19 | Offer to name a connecting person, decline | Type nothing in the optional name field | Claim submitted with no connecting name — no provisional person created | ✅ Pass |
| M20 | Name a connecting person, create provisional record | Type a name, click "+ Add them as a named person" | One provisional `people` row created, **zero `parents`/`spouse` set** | ✅ Pass |
| M21 | Attempt a second provisional person on the **same** claim | Call `create_provisional_person` twice on one claim | Blocked: "A provisional person was already created for this claim." | ✅ Pass |
| M22 | Second provisional person on a **different** claim (same member) | Submit a new claim, create another provisional person | Allowed — the limit is per-claim, not a lifetime member cap | ✅ Pass |
| M23 | Fully blank submission (no anchor, "not sure," no name) | Walk through doing nothing but clicking through | Still accepted; member remains a complete, fully-functional member | ✅ Pass |
| M24 | Auto-shown gate fires exactly once | Fresh `UNANCHORED` join, reload the app | Builder shows automatically on first load only; does **not** reappear on later logins once the member has engaged | ✅ Pass — deliberately not a nag screen |
| M25 | Deliberate re-entry via Home card | Click "Add more detail" from an already-submitted state | Reopens the builder via normal navigation (not the forced full-screen gate); submitting again creates an **additional** claim, visible to admin, nothing silently overwritten or lost | ✅ Pass |
| M26 | Home card copy reflects actual status | Compare card text for `UNANCHORED` vs `ANCHORED_UNRESOLVED` | Distinct, status-accurate messaging ("Let us know who you are" vs. "We've got what you told us — nothing's stuck") | ❌ **FAIL on first run** (identical copy both times) → Fixed → ✅ Pass (Defect, UX) |
| M27 | Member can use the rest of the app while unresolved | Insert a contribution (photo/memory) while `ANCHORED_UNRESOLVED` | Succeeds — placement status never gates ordinary app usage | ✅ Pass |

---

## 3. Dependent-node & dynamic-tree edge cases

This section specifically targets the brief: relationships with the
other party present or absent, and whether the tree correctly
reconstructs as members join dynamically, without ever fabricating a
connection.

### 3.1 Anchor present vs. absent

| ID | Scenario | Expected | Actual |
|---|---|---|---|
| E01 | Anchor is a real, already-confirmed person | Claim references them directly by ID | ✅ Pass |
| E02 | Anchor is a **provisional, not-yet-confirmed** person | A second joiner can still name the provisional person as *their* anchor — e.g. "I'm their child" — before anyone has confirmed the first provisional person at all | ✅ Pass — chained/dependent provisional references work correctly |
| E03 | Anchor is deleted entirely while a claim about them is still open | Claim survives, anchor reference nulled, admin can still resolve (e.g. close unresolved) — never a dead end | ❌ **FAIL on first run** → Fixed → ✅ Pass (Defect #3) |
| E04 | No anchor at all, ever (declined at every step) | Claim and member both remain valid, fully functional, visibly flagged for admin attention | ✅ Pass |

### 3.2 Multiple, independent relationship paths

| ID | Scenario | Expected | Actual |
|---|---|---|---|
| E05 | Two different members separately claim the same provisional person as a relative, via different relationships (one as "child," one later linking directly) | Both resolve independently; no forced single path, no duplicate person created | ✅ Pass |
| E06 | A member submits more than one claim over time (e.g. revises their answer) | Each submission is its own claim/task — admin sees the full history, nothing is silently replaced | ✅ Pass |

### 3.3 Dynamic tree reconstruction as members join

| ID | Scenario | Expected | Actual |
|---|---|---|---|
| E07 | Confirming a provisional person does **not** by itself attach them to the tree | `parents`/`spouse` stay empty after "Confirm into the tree" — this is by design, not a bug: confirmation only promotes PROVISIONAL → ordinary, the actual graft onto the tree is a separate, deliberate admin action | ✅ Pass (verified, documented) |
| E08 | Admin then uses the **existing** "Fix relationships" tool to graft the confirmed person onto the tree | `parents` set correctly; `gen` recomputed and cascaded to any descendants automatically via the pre-existing `reassign_parents()` RPC — FFO's new tooling and the old tooling compose correctly, not two parallel systems | ✅ Pass |
| E09 | After grafting, the tree shows correct generation numbers with no manual gen math needed by admin | Verified `gen = parent's gen + 1` | ✅ Pass |
| E10 | Throughout every scenario above, zero fabricated parent/grandparent/spouse edges appear anywhere | Queried `people` after every test run: no provisional or confirmed person ever has `parents`/`spouse` set except through an explicit admin action | ✅ Pass, every run — this is the single non-negotiable the whole feature was built around |

### 3.4 Multi-family & role boundaries

Prompted directly by a real-world scenario: the same person belongs to
two or more families (e.g. birth family and in-law family), each with
its own, different admin, and commonly goes by a different name
(nickname, short name, married name) in each. Tested explicitly, not
assumed — this round caught the most serious defect of the whole
testing cycle (Defect #6).

| ID | Scenario | Expected | Actual |
|---|---|---|---|
| E11 | A multi-family admin cannot resolve another family's task | `resolve_workbench_task()` checks role against the **task's own** `family_id` | ❌ **FAIL** — a Head of a *completely different* family, with zero membership in the task's family, could successfully resolve it → Fixed → ✅ Pass (**Defect #6, critical**) |
| E12 | A member's placement status in Family A is fully independent of their status in Family B | Confirmed via direct multi-family redemption test | ✅ Pass |
| E13 | `display_name` is genuinely independent per family — a nickname in one family never leaks into or overwrites the legal/full name used in another | Same person redeems invites into two families with two different names ("Priya Lakshmi Narasimhan" vs. "Lakshmi") | ✅ Pass — `family_members.display_name` is a per-row field, no shared/global identity record exists to conflict |
| E14 | Submitting a claim in one family never touches the other family's placement status | Member submits a claim while active-family is A | ✅ Pass — B stays untouched |
| E15 | Each family's admin only ever sees *their own* family's Workbench tasks, never the other's | Cross-checked both directions (admin A reading/resolving B's task, and vice versa) | ✅ Pass once Defect #6 was fixed |
| E16 | A provisional person created in Family B is not visible or queryable from Family A's namespace | Checked directly under Family A admin's own session | ✅ Pass — `people` is strictly family-scoped, no cross-family person directory exists by design |
| E17 | Switching active family (`FamilySwitcher`) correctly re-evaluates the FFO gate for the *new* family, with no leftover "already dismissed" state leaking from the previous family | Confirmed `FamilySwitcher` always does a full page reload on switch, which resets the in-memory "skipped the gate" state — so a dismissal in Family A can never suppress the gate in Family B | ✅ Pass (verified by code inspection + the reload mechanism, consistent with every other family-switch behavior in the app) |

**Answering the question directly**: the same person being in two or
more families, each with a different admin and possibly a different
name, is **fully and safely supported** — by the pre-existing
multi-family architecture (separate `family_members` row per family,
independent `display_name`/`role`/`person_id` per row), not by anything
new FFO had to build. FFO's own state (`placement_status`, claims,
provisional people, Workbench tasks) correctly inherits that same
per-family isolation. The one place it *wasn't* actually isolated
correctly — a different family's admin being able to resolve your
family's Workbench tasks — was a real bug, found by this exact
question, and is now fixed and verified in both directions.

---

## Defects Log

| # | Found via | Defect | Fix | Verified |
|---|---|---|---|---|
| 1 | M04 | `invites.proposed_person_name` was written at invite creation but never read back anywhere — the "name someone not in the tree yet" feature was a complete dead end | `redeem_invite()` now returns the name; client carries it across the mandatory post-redeem reload via `sessionStorage`; `App.jsx` reads and passes it through once | Live browser test — name now pre-fills correctly |
| 2 | A21 | `invites.used_by`/`created_by` had no `ON DELETE` action (implicit `RESTRICT`) — deleting any account that had ever created or redeemed an invite failed outright, including through the account-deletion feature | Changed to `ON DELETE SET NULL`, matching the treatment already given to similar columns elsewhere | Direct test — deletion now succeeds, invite survives anonymized |
| 3 | A19, A20, E03 | `delete_person()` crashed with a NOT NULL constraint violation when deleting anyone referenced by `relationship_path_claims.anchor_person_id` or `ffo_workbench_tasks.provisional_person_id` — same composite-FK trap the function's own original migration had already documented and fixed for four *other* tables, just not updated for these two new ones | Added the same explicit null-out pattern for both new tables | Direct test — both deletion paths now succeed cleanly |
| 4 (UX) | M26 | Home "Finish My Connection" card showed identical "tell us who you are" copy whether a member had never engaged or had already fully submitted — reads as if the submission vanished | Card now takes `placementStatus` and shows distinct, reassuring copy once a claim is already in | Visual browser confirmation |
| 5 (UX) | — | Admin invite list never showed the proposed person's name, even though it was being collected at creation time | `fetchInvites()`/`InvitesList` now surface it (`For X (not yet in tree)`) | Visual browser confirmation |
| 6 (critical) | E11 | **`resolve_workbench_task()` had a cross-family authorization bypass**: `if v_role not in ('head','admin')` evaluates to SQL `NULL` (not true) when the caller has no `family_members` row in that family at all, and PL/pgSQL treats `if null then` as false — so the exception never fired. A Head of a completely *different* family, with zero membership in the task's actual family, could successfully resolve it. This is the exact same bug class this codebase had already hit and fixed once before, in `reassign_parents()` — reproduced here without being carried over to the new function | `v_role is null or v_role not in (...)`, the same safe pattern already used everywhere else | Direct test, both directions: the unrelated family's Head is now blocked with the correct error; the task's real admin still works |

All six were found and fixed within this testing cycle, before shipping to production. **Defect #6 was never exposed in production** — it only ever existed on the `dev`/test branch; the PR introducing the whole FFO feature had not yet been merged when it was found and fixed.

## What's explicitly out of scope for this report

Per `docs/FAST_FAMILY_ONBOARDING.md`'s own deferred list — not tested here because not built: automatic duplicate-person detection, dispute/escalation workflows, the `PLACEMENT_DISPUTED` state, encrypted legal-name handling, minors/guardian-specific flows, and notification digests for stale Workbench tasks. These remain tracked, intentional gaps, not untested surface area.
