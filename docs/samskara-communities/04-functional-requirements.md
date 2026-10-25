# 04 — Functional Requirements

Derived from the pillars in 01 and journeys J1-J9 in 03. Priority: **P0** = required for the pilot festival cycle, **P1** = pilot-nice-to-have, **P2** = post-pilot (listed only to mark the boundary). "Moderator" includes `community_admin` unless stated otherwise.

## CM — Community Management

- **CM-1 (P0)** A signed-in user can create a community with name (required, 3-120 chars), city (required) and approximate flat count (optional integer 1-5000). The creator is inserted into `community_members` with role `community_admin`, status `active`.
- **CM-2 (P0)** Creating a community sets it as the creator's active community through `set_active_community()`. `current_community_id()` then returns it. The functions mirror `current_family_id()`/`set_active_family()` in `supabase/migrations/20260726120000_multi_family_membership.sql`.
- **CM-3 (P0)** A user can belong to N communities and N families at the same time. Changing the active community doesn't change the active family.
- **CM-4 (P0)** An admin can create, rename and delete towers/blocks. A tower can't be deleted while any active member is assigned to it.
- **CM-5 (P1)** An admin can bulk-import flats from a CSV (`tower,flat_number`). Invalid rows are reported per line, and valid rows are imported.
- **CM-6 (P0)** Community creation is blocked until the admin acknowledges the children's-photo policy. The acknowledgement (user, timestamp, policy version) is stored.
- **CM-7 (P0)** An admin can archive a community that has zero published media. Archived communities don't appear in any member's community list.
- **CM-8 (P0)** Community settings include: `trust_join_link` (bool, default false), `allow_downloads` (bool, default true), `guest_uploads_enabled` (bool, default true).

## MB — Membership

- **MB-1 (P0)** Each community has exactly one active join link/QR. An admin can rotate it, and the previous token stops working at once (returns an "invalid or expired link" error).
- **MB-2 (P0)** A user opening a valid join link, after authentication, must choose a tower and flat number and a household relationship (`owner` | `tenant` | `family_member`) to submit a join request.
- **MB-3 (P0)** With `trust_join_link=false`, join requests are created with status `pending`. Pending members can't read any community media.
- **MB-4 (P0)** A moderator can approve or reject a pending join request. Approval sets status `active`, role `resident`.
- **MB-5 (P1)** When a second household claims a flat that already has an active member, the moderator sees a "flat already claimed" indicator on the request. The request isn't blocked.
- **MB-6 (P0)** An admin can change any member's role among `community_admin`, `moderator`, `resident`. The system rejects any change that would leave the community with zero active `community_admin` members.
- **MB-7 (P0)** A member or admin can mark the member as `former`. Former members lose all read and write access to the community at once. Their contributed media keeps its current status.
- **MB-8 (P0)** All role and status changes are written to an audit log (actor, target, old value, new value, timestamp), which admins can read.
- **MB-9 (P0)** Community membership RLS is evaluated only against `community_members`. No policy on a community table may reference `family_members`, and the reverse also holds.

## EV — Events

- **EV-1 (P0)** A moderator can create an event with name (required), start date (required), end date (optional, ≥ start), type (`festival` | `sports` | `cultural` | `civic` | `other`), and a description (optional, ≤ 2000 chars).
- **EV-2 (P0)** Each event's year is derived from its start date and determines where it sits in the timeline.
- **EV-3 (P0)** Creating an event generates an event upload token. The default validity runs from event creation until 7 days after the end date (or the start date). The token is shown as a link and a QR code.
- **EV-4 (P0)** A moderator can extend, shorten or revoke an event upload token. Uploads using a revoked or expired token are rejected server-side with a clear message.
- **EV-5 (P0)** A moderator can download a printable QR poster (PDF or PNG, A4) showing the event name and the QR code.
- **EV-6 (P1)** A moderator can create named sub-albums within an event (for example "Night 3"). Media without a sub-album belongs to the event's default album.
- **EV-7 (P0)** A moderator can edit event metadata at any time. They can delete an event only when it has no published media.
- **EV-8 (P0)** The system never sends an outbound WhatsApp or SMS message to invite anyone to an event. (Negative requirement, decision #1.)

## MA — Media & Albums

- **MA-1 (P0)** An active member opening an event link uploads with attribution to their user ID.
- **MA-2 (P0)** With `guest_uploads_enabled`, a non-member opening a valid event link can upload after entering a display name and verifying a phone number with OTP. The guest gets an upload session scoped to that one event, valid no longer than the event token, and is **not** added to `community_members`.
- **MA-3 (P0)** A guest session can list only the guest's own uploads and their statuses. Requests for any other community data return 403/empty.
- **MA-4 (P0)** The client resizes images before upload using `src/lib/imageResize.js` (target values in 05) and computes a dHash using `src/lib/imageHash.js`. The hash is stored with the contribution.
- **MA-5 (P0)** Supported types: JPEG, PNG, HEIC (converted client-side or server-side to JPEG), MP4/MOV video ≤ 100 MB and ≤ 3 minutes. Other types are rejected client-side with a message.
- **MA-6 (P0)** Each upload batch requires an answer to "Does this include children?" with options Yes / No / Not sure, defaulting to Not sure. Yes and Not sure set `child_flag=true` on every item in the batch.
- **MA-7 (P0)** Every new upload is inserted into `community_contributions` with status `pending`. RLS permits INSERT only with status `pending` (the insert-as-Pending-only pattern from the family `contributions` table). This is a **separate table** from `contributions`.
- **MA-8 (P0)** Storage paths are scoped by community: `communities/{community_id}/events/{event_id}/...`. The generalized `storeMedia`/`mediaUpload` must take a tenant type plus ID and must never write community media under a family path.
- **MA-9 (P0)** An approved resident can view all `published` media of their community, grouped by year, event and album.
- **MA-10 (P0)** If `allow_downloads=true`, residents can download the original stored resolution of published media. If false, the download control is hidden and the signed-URL endpoint refuses download disposition.
- **MA-11 (P1)** A moderator can set an event cover image from published, non-child-flagged media.

## MO — Moderation

- **MO-1 (P0)** Contribution states: `pending`, `restricted`, `published`, `rejected`. Allowed transitions follow the state machine in 03 §J5. Any other transition is rejected by the database.
- **MO-2 (P0)** Only moderators can change contribution status. Uploaders can delete their own `pending` items.
- **MO-3 (P0)** Approving an item with `child_flag=true` moves it to `restricted`, never directly to `published`.
- **MO-4 (P0)** `restricted` media is visible only to the uploader and the community's moderators.
- **MO-5 (P0)** Moving `restricted` to `published` needs a separate, explicit "Approve child visibility" action. It records moderator ID and timestamp, and can apply per item or to a multi-selection with a confirmation dialog stating the count.
- **MO-6 (P0)** A moderator can set or clear `child_flag` on any item. Setting it on a `published` item moves the item to `restricted` at once.
- **MO-7 (P0)** Any active resident can report a published item (reason: "my child", "my family / privacy", "inappropriate", "other"). A report on the grounds "my child" or "my family / privacy" hides the item from everyone but moderators and the uploader until a moderator resolves it.
- **MO-8 (P0)** The moderation queue groups items whose dHash Hamming distance is ≤ the configured threshold (default 10/64) and allows bulk approve/reject of a group.
- **MO-9 (P0)** The moderation queue supports bulk approve/reject of a selection of up to 500 items in one action.
- **MO-10 (P0)** Every status change is logged (item, actor, from, to, timestamp), and moderators can read the log.
- **MO-11 (P1)** A moderator can request AI caption/tag suggestions for an item or album through the generalized `callOpenAI` helper. Suggestions are never applied without moderator confirmation, and child-flagged items are not sent to the AI provider.
- **MO-12 (P2)** Blur detection, face clustering. **Not in MVP.**

## MT — Memory Timeline

- **MT-1 (P0)** The community home shows years in descending order. Each year lists its events by start date, with cover image and published-item count.
- **MT-2 (P0)** A resident can filter the timeline by event type and search events by name (case-insensitive substring).
- **MT-3 (P0)** Published history stays visible to all active members regardless of when they joined.
- **MT-4 (P0)** Counts and covers shown to a viewer include only items that viewer is allowed to see.
- **MT-5 (P2)** Year-over-year comparison of recurring events, recurring event templates.

## PL — Personal-Archive Linking

> **Reconciliation note (added after the full blueprint was assembled):** doc 17 (MVP Scope) deliberately moved this entire feature to Phase 2 — the buyer is the association, not existing Samskara family users, so there's no network-effect reason to build it before the pilot validates willingness to pay, and it's the single most likely place for a cross-tenant privacy bug (risk #9 in doc 21). The requirements below are kept at full detail so the design isn't lost, but every item is **P1/P2 (Phase 2), not P0** — overriding any P0 marking that conflicts with doc 17. Doc 19's test plan still covers this so it's verified whenever it's actually built.

- **PL-1 (P1)** On a `published` item, an active resident who belongs to at least one family can choose "Save to my family archive" and select the target family when they belong to more than one.
- **PL-2 (P1)** Saving creates a family-scoped record under the family's storage path and RLS, with provenance (`source_community_id`, `source_contribution_id`, event name). No family-table RLS policy grants access based on community membership.
- **PL-3 (P1)** `restricted` items can be saved only by their own uploader. `pending` and `rejected` items can't be saved.
- **PL-4 (P1)** Deleting the family copy doesn't change the community item. A community takedown doesn't delete existing family copies (pending product confirmation, see open questions).
- **PL-5 (P2)** A resident without a family gets a "Create your family archive" call to action in place of the save action.
- **PL-6 (P1)** Community-to-family linking never runs automatically or in bulk without an explicit user action on each item or selection.

## NT — Notifications (transactional only)

- **NT-1 (P1)** A user who has explicitly opted in can receive a WhatsApp Utility-category message when their contributions are moderated or when an event album is published. Messages go through the existing Twilio helpers.
- **NT-2 (P0)** No Marketing-category messages are sent, ever (see EV-8).
- **NT-3 (P0)** In-app indicators: moderators see a pending-queue count, and uploaders see the status of each upload.

## PT — Plan tier

- **PT-1 (P1)** A `community` plan tier is defined using the pattern in `src/lib/planTiers.js` and `supabase/migrations/20261017120000_plan_enforcement.sql`. The pilot community runs on a pilot/free tier with limits set high enough not to be hit.
- **PT-2 (P1)** Tier limits for communities come from a single source definition that generates both the JS and SQL values. They are not hand-synced (this addresses the documented sync risk).
