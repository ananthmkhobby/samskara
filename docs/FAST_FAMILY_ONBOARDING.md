# Fast Family Onboarding (FFO) — Phase 1

Built 2026-10-29 from a 20-section, 94-edge-case PRD
(`Samskara_Fast_Family_Onboarding_Relationship_Integrity_PRD_v2_2.docx`).
This is a **scoped Phase 1 MVP**, not the full spec — the PRD describes a
multi-week case-management system (13 case categories, dispute/escalation
workflows, encrypted legal-name infrastructure, multi-reviewer approval).
Phase 1 delivers the actual goal — admin's bulk tree-entry burden reduced,
zero members left stuck with no path forward, admin can always fix
anything — using the architecture that already existed, and explicitly
defers the rest. See "Explicitly deferred" below.

## The problem this solves

Before this, connecting a new member to their tree entry was entirely
manual and unprompted: an inviter could pre-pick an *existing* person for
an invite (`invites.person_id`), but there was no way to say "this is for
someone not in the tree yet," and the only way to fix a missed link
afterward was a bare dropdown buried in Admin → Roster
(`set_member_person_link`) — nothing surfaced which members were still
unlinked, and nothing nudged anyone to go fix it. A backfill run on this
migration found **14 of 25 members on the test database were already in
this state** — a real, pre-existing gap this feature makes visible and
actionable for the first time, not a new problem it introduces.

## Non-negotiables

- **Never fabricate a parent/grandparent/spouse.** A missing link stays
  missing and visible; nothing here ever auto-creates ancestry to make a
  tree look connected. A provisional person is a specifically named real
  individual, never a generic placeholder, and never gets `parents`/
  `spouse` set until an admin explicitly confirms it.
- **No member is ever left with no path forward.** Every unresolved state
  (unlinked member, unresolved claim, unclaimed provisional person) is
  visible in the admin "Needs Connection" workbench with a real resolving
  action — never a dead end.
- **Admin's existing full-edit power is never narrowed.** The workbench
  and new RPCs are a convenience layer on top of what already existed —
  `people`'s moderator-only RLS, `EditModal.jsx`, `EditRelationshipsCard`/
  `reassign_parents()` are all completely untouched. A provisional person
  is just an ordinary `people` row with one extra flag; admin can always
  edit it through the exact same tools used for any other person, with or
  without ever opening the workbench.
- **Existing onboarding is completely untouched.** `redeem_invite()`,
  `register_new_family()`, `create-member-login.js`, and the Admin
  Roster's manual linking behave byte-for-byte identically whether or not
  a family has the flag on.

## Rollout

Gated by a new `module_flags` key, `fastOnboarding` — **default `false`
in every plan tier** (`src/lib/planTiers.js`), unlike every other gatable
module (which are opt-*out*, enabled unless explicitly disabled). This
one is opt-*in*: a superadmin turns it on per family from `/superadmin` →
`ManagePlanSection`'s checkboxes (`fastOnboarding` added to
`GATABLE_MODULES` in `SuperAdminView.jsx`) — no new admin infrastructure.

Kill switch = flip the flag back off. Anything already created (claims,
provisional people, workbench tasks, placement statuses) stays exactly as
it is and remains visible/resolvable in the workbench regardless of the
flag — turning the feature off stops *new* entry into the flow, it never
strands something already in progress.

## Schema (all additive)

- `family_members.placement_status` (`UNANCHORED` | `ANCHORED_UNRESOLVED`
  | `PLACED_CONFIRMED`, default `PLACED_CONFIRMED`) — backfilled to match
  reality exactly: `PLACED_CONFIRMED` wherever `person_id` was already
  set, `UNANCHORED` wherever it was null. Zero behavior change for any
  existing member; it only makes the gap visible.
- `people.provisional_status` (`PROVISIONAL` or null, default null) and
  `people.created_via` — null is a completely ordinary person, exactly
  like every row that existed before this migration.
- `invites.proposed_person_name` — lets an inviter name someone not yet
  in the tree at invite-creation time (`InviteCard` in `AdminView.jsx`'s
  "name someone not in the tree yet" option, flag-gated).
- `relationship_path_claims` and `ffo_workbench_tasks` — new tables, see
  the migration (`20261029200000_fast_family_onboarding.sql`) for full
  column definitions and RLS. Both read-restricted to `is_moderator()` of
  that family, plus a self-only read for a member's own claims; neither
  has a client write policy — every write goes through the RPCs below.

## The three new RPCs

All security-definer, same pattern as the existing `reassign_parents()`/
`delete_person()`/`set_member_person_link()`:

- **`submit_relationship_path_claim()`** — any active member, self-only
  (resolves the caller's own `family_members` row from `auth.uid()`
  server-side; there's no way to submit a claim "for" someone else).
  Never writes to `people`/`parents` — only records an assertion and
  flips the caller's own `placement_status` to `ANCHORED_UNRESOLVED`.
- **`create_provisional_person()`** — any active member, hard-enforces
  one provisional person per claim (`relationship_path_claims
  .provisional_person_created`, a real DB check, not just a UI
  convention). The new person never gets `parents`/`spouse` set here —
  it cannot silently become a real tree edge.
- **`resolve_workbench_task()`** — admin-only, checked against the
  *task's own* `family_id` (not `current_family_id()`), same
  cross-family-safety reasoning `reassign_parents()` already uses for a
  multi-family admin account. One action-dispatched RPC
  (`link_existing_person`, `confirm_provisional`, `invite_missing_person`,
  `close_unresolved`, `mark_duplicate`) rather than five separate
  endpoints. `invite_missing_person` reuses the **existing**
  `invites.person_id`/`proposed_person_name` mechanism — no new invite
  infrastructure needed.

## Role mapping

- **Member**: can submit a claim about themselves, create one provisional
  person tied to their own claim. Cannot open the workbench or resolve
  anyone's task. `set_member_person_link()` is unchanged — a member can
  still link *themselves* to an *existing* person directly, same as
  before this feature existed.
- **Admin and Head**: identical rights for every FFO action (matches how
  `is_moderator()` already treats them everywhere else in the app) — both
  can view the workbench and resolve any task, including confirming a
  provisional person into a real tree edge. No new head-only gate.

## UI surfaces

- **`RelationshipPathBuilder.jsx`** — shown automatically **once**, right
  after `redeem_invite()`/`register_new_family()` succeeds and reloads,
  only when the family has the flag on and the joiner's resulting
  placement is `UNANCHORED`. Bounded to anchor pick → relationship type →
  at most two optional follow-ups (side, named missing person) → optional
  one provisional person. "Not sure" / skip is always a complete, valid
  answer at every step. Deliberately **not** shown automatically again on
  a later login once a member has engaged (`ANCHORED_UNRESOLVED`) — that
  would turn "admin handles exceptions, member keeps using the app
  meanwhile" into a nag screen. Reachable again deliberately via the Home
  card below.
- **`FinishConnectionCard.jsx`** (Home) — dismissible promo card, same
  pattern as `BlogPromoCard.jsx`, shown whenever the signed-in member's
  placement isn't `PLACED_CONFIRMED`. The standing re-entry point for
  anyone who skipped the builder or wants to retry/add detail — routes to
  `RelationshipPathBuilder` via the normal nav (`view ===
  "relationshipPathBuilder"`, `/my-connection`), not the full-screen
  forced gate.
- **`ConnectionWorkbenchView.jsx`** (MoreMenu → "Needs Connection",
  admin/head only, flag-gated) — four tabs: Unlinked members (derived
  live from `placement_status`, not its own task type), Unresolved paths,
  Provisional people, Possible duplicates (placeholder — automatic
  detection is deferred). Every row has a real resolving action; "confirm
  provisional → real person" reuses `EditRelationshipsCard`'s exact
  interaction shape (pick, call the RPC, full reload).

## Duplicate-account scenario (one person, two logins)

A real case considered during design: someone self-registers (becoming
Head of their own new family), then a relative separately invites the
*same person* into a different family. If redeemed while still signed
into the first account, this is already fully handled by multi-family
membership (unrelated to this feature, already in production) — it just
adds a second `family_members` row under the same account. The actual
risk is only if the invite is redeemed as a **fresh signup** instead,
genuinely creating a second Supabase Auth account for the same human.

This can't be safely automated — Supabase Auth already blocks two
accounts sharing one email, so a true duplicate only happens across two
different emails/credentials, and there's no reliable signal to detect
"these are the same person" without risking exactly the kind of
auto-merge-on-a-guess this feature explicitly forbids for `people`
records, applied to something higher-stakes (account access).

**Phase 1 ships prevention UX only**: `AuthPanel.jsx`'s `JoinForm` toggle
("I'm new here" vs "I already have an account") now **defaults to "I
already have an account"** instead of defaulting to sign-up — removing
the silent trap where someone who already has a login doesn't notice the
toggle and ends up creating a duplicate by default. This is a general
safety fix, not scoped to the `fastOnboarding` flag.

When a duplicate has already happened: the existing self-service account
deletion (`request_account_deletion()`, built 2026-10-29) already
handles the common case — if the abandoned account's family is empty,
they can just delete it and keep the other. If real content exists under
the account they want to abandon, there is **no self-service path** for
moving it to the other account — that's a known, documented gap, not an
oversight. If it comes up, it needs a manual, support-mediated
reassignment of `family_members`/`contributions.contributor_user_id`/
`person_id` ownership between the two UUIDs via direct Supabase access,
at the same caution level as every other identity-sensitive operation in
this app.

## Explicitly deferred to a later phase

- The PRD's full 13-category case taxonomy (`IDENTITY_CONFLICT`,
  `AFFINITY_UNRESOLVED`, `SAFETY_REVIEW`, etc.) — Phase 1's 4 task types
  cover the common real cases; more can be added as new `task_type`
  values later without a schema rewrite.
- Dispute/escalation/admin-succession workflows, second-reviewer
  requirement for sensitive changes, the `PLACEMENT_DISPUTED` state.
- Encrypted/restricted private legal-name field infrastructure — not
  something the current `people` schema has at all; a real sub-project
  of its own.
- Automatic duplicate-*person* detection (fuzzy name matching) — Phase 1
  ships a manual "mark possible duplicate" admin action only (the
  "Possible duplicates" tab is currently a placeholder).
- Multi-path graph preservation, minors/guardian-specific safeguards,
  WhatsApp/notification digests for stale tasks, full analytics
  instrumentation.
- A self-service account-reassignment tool for the duplicate-account
  scenario above.

## Verification performed (test database, 2026-10-29)

Full RPC chain tested end-to-end with disposable accounts before any UI
was built on top:
- Member submits a claim → own `placement_status` flips to
  `ANCHORED_UNRESOLVED`, `UNRESOLVED_PATH` task created.
- Member creates one provisional person tied to that claim — confirmed
  it has no `parents`/`spouse` set, correctly flagged `PROVISIONAL`.
- A second provisional-person attempt on the *same* claim is correctly
  blocked ("A provisional person was already created for this claim.").
- A non-admin member cannot call `resolve_workbench_task()`.
- Admin (Head) confirms the provisional person into the real tree — flag
  cleared, linked member's `placement_status` updated to
  `PLACED_CONFIRMED`.
- Admin resolves a task via `invite_missing_person` — confirmed the
  created invite is correctly pre-linked to the provisional person via
  the existing `invites.person_id` mechanism.
- Migration backfill confirmed correct against real test data (14/25
  members on test correctly identified as `UNANCHORED`, matching their
  actual `person_id = null` state).
All disposable test data cleaned up after.
