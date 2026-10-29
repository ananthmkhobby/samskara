# Samskara Guest-First Memory Experience

Requirements document (original PRD content) + engineering adaptation
notes + what was actually built. Source file: `Samskara_Guest_First_Memory_PRD_Technical_Design.docx`,
version 1.0, 29 October 2026.

## Part 1 — What the PRD asked for

Let an anonymous visitor choose a photo, add an optional story, and
preview it entirely in their browser — no account, no family, no module
tour. Authenticate only when they choose "Save." After authentication,
create a **private** memory owned by the authenticated user; family
placement, person tagging, and sharing are all optional later steps, never
required up front.

MVP scope: Gallery photo only, P0 requirements only (FR-01 through FR-10,
FR-13, FR-14 — see the source doc for the full FR list). P1 items
(FR-11: "Add to family"/"Tag people"/"Invite a relative" prompts, FR-12:
share-link generation from this flow) are partially covered — "Add to
family" shipped as a simple one-tap action; "Tag people" and the
Share-link hookup are left for later, same as the PRD's own phasing.

## Part 2 — Engineering adaptation notes

The PRD's own §2.3 and §17 list several things to reconcile against the
real codebase before building. Here's what was actually found:

### Auth is already inline, never a redirect

The PRD spends real effort (§9) on IndexedDB-based draft recovery because
it assumes auth might be a redirect-based flow that could lose in-memory
React state. This app's `AuthPanel.jsx` is already fully inline — but it
calls `window.location.reload()` unconditionally on every successful
login, signup, *and* family creation (same pattern as every other auth
transition in this app). So the draft still needs to survive one reload,
just not a cross-origin redirect. A single `localStorage` entry (the
already-resized photo as a data URL + the story text) is enough — no
IndexedDB needed. `FirstMemoryWizard.jsx` does exactly this.

### `contributions.family_id` is `NOT NULL` — resolved for free

The PRD's biggest open question (§17, item 1): can a memory exist without
a family? In this schema, no — every contribution needs a real
`family_id`. But this app already has a **separate, pre-existing**
mechanism for exactly this gap: `register_new_family()`, a security-definer
RPC a brand-new signup can call to create their own solo family
(`family_members.role = 'head'`), fully decoupled from invites. The
app-level `ACCOUNT_NEEDS_FAMILY` gate in `App.jsx` *already* intercepts
any signed-in-but-familyless user and shows the family-creation form,
regardless of which view they were trying to reach — and since that form
also reloads to the same URL on success, the whole thing round-trips
automatically: `/first-memory` (signed out) → inline auth → reload →
family-creation form (if needed) → reload → back at `/first-memory`,
now fully resolved. `FirstMemoryWizard.jsx` never needs to special-case
"no family yet" itself — it can only ever mount once that's already
settled, or while still fully signed out.

### "Private by default" is `contributions.visibility = 'private'`

Already exists, already powers the existing "Private to me" Gallery tab
(`TreasuryView.jsx`). No new table, no new column — this flow's save step
just sets `visibility: 'private'` on an ordinary `contributions` insert,
same table every other upload already uses.

### What's genuinely new

- The public, pre-auth entry point itself (`/first-memory`, linked from
  the login page's hero as the primary CTA).
- Local-only preview *before* any network call — every other contribute
  path in this app (`ContributeModal.jsx`) uploads immediately on submit;
  this is the first flow where picking a photo doesn't touch the network
  until the person has explicitly decided to save.
- The reload-surviving draft (localStorage, 24h expiry per the PRD's own
  suggestion, cleared the moment the real save succeeds).

### Known gap, left as-is deliberately

Photo contributions have no caption/story display anywhere in the
existing Gallery UI — `GalleryCard` renders the image and
contributor/date, nothing else. The optional story this flow collects is
stored (`contributions.body_text`, the same column `memory`-type
contributions already use) but isn't rendered yet. Fixing that means
touching `GalleryCard`, which is a real Gallery UI change — out of scope
here per the PRD's own "avoid a full redesign of Gallery" instruction.
The data isn't lost, just not surfaced yet.

### "Add to family" and the existing moderator-only UPDATE policy

`contributions`' UPDATE RLS policy already requires `is_moderator()` for
*any* edit, including a visibility change on your own row — a
pre-existing, consistent constraint, not something new here. A brand-new
solo-family user is automatically their own family's head (so this always
works for the PRD's primary persona), but an existing plain "member"
reusing this flow would hit the same RLS wall every other edit path
already hits for non-moderators. Handled the same way the rest of the app
does: a clear message ("ask a Head/Admin"), not a special-case fix.

## Part 3 — What's deferred

Person tagging on the saved memory (FR-11's "Tag people" — the existing
photo-tagging feature could be wired in later, same photo, same
contribution id), the Share-link hookup (FR-12 — the existing Share
Preview Service already covers "a Verified, shared photo"; this flow's
output starts private, so sharing would need the "Add to family" step
first, or a small adjustment), draft encryption-at-rest (the PRD mentions
it as a nonfunctional nicety — this is a single-user browser, not
cross-origin storage, so plain `localStorage` was judged sufficient for
MVP), and the full analytics event list (a representative subset shipped
— `first_memory_started/photo_selected/previewed/save_clicked/
auth_started/saved` — not every event the PRD lists, e.g. `auth_completed`
specifically is implied by the reload+resume rather than its own event).
