# 15 — Security and Privacy

**Status:** Design for MVP. Not legal advice — §11 lists where a lawyer's review is needed before any public pilot.
**Extends:** the existing family product's Privacy Policy (`src/components/PrivacyPolicyView.jsx`) and Terms of Service (`src/components/TermsOfServiceView.jsx`). Nothing here weakens those; it adds what a community setting needs.

---

## 1. What changes when we go from families to communities

The family product's privacy story is simple, and the existing policy says it plainly: every family's data is isolated from every other family, the people who can see it are the people in that family, and you own what you contribute. Children appear in the family product, but always inside an adult relative's own tree — the household has, in effect, already decided they belong there.

A community is different in three ways:

1. **The people in the photos mostly didn't upload them, and many aren't Samskara users at all.** A Navratri garba photo can contain forty people, a dozen of them children, none of whom have ever heard of us.
2. **The audience is neighbours, not family.** Residents share a building, not a household. Someone being comfortable with relatives seeing their child's photo says nothing about whether they're comfortable with 600 neighbours seeing it.
3. **Control changes hands.** Committees are elected and replaced. The people who run a community archive this year won't be the people running it in three years.

Everything below is organised around those three facts.

---

## 2. Children's photos — the core control

**Any photo or video that contains a child is unpublished by default.** It's visible only to the person who uploaded it and to the community's moderators until a moderator explicitly approves wider visibility.

This is the product's primary privacy mitigation, not a setting buried in an admin page.

### How it works

- **The uploader tags it.** Every upload asks one question: *"Are there children in any of these photos?"* (Yes / No / Not sure.) "Yes" and "Not sure" both go to the moderation queue. This is a per-batch question with per-photo override, so a 60-photo upload isn't 60 prompts.
- **Default for the unsure case is "held".** If an uploader skips the question, the batch is held. We'd rather a moderator approve a photo of adults than publish a photo of a child by accident.
- **Moderators approve to a scope, not to "public".** Approving moves the photo to a visibility scope (§5) — typically *Event attendees* or *Community members*. Approving to the open guest-viewable link is a separate, deliberate action.
- **A parent can always pull it back.** Any resident can flag a photo as "this is my child, please remove" (§9). That flag immediately re-hides the photo pending moderator action — we don't wait for review before un-publishing.
- **No automated detection decides for us in MVP.** We don't run face detection to find children. The tag-and-hold flow is the control. (See §13.4 on why face recognition is ruled out entirely.)

### What moderators see

The moderation queue shows held items with the uploader's name, the event, and the uploader's "children" answer. Moderators can approve to a scope, keep it committee-only, or remove it. Every decision is logged with who made it and when (§7).

### Why so strict

Because the children in community photos have no consent path. Their parents didn't sign up, weren't asked, and may not know the photo exists. A hold-by-default means the first people to see a child's photo outside the uploader are a small, named, accountable group — and nothing reaches the wider community without one of them deciding it should.

---

## 3. Who can contribute: residents vs. guests

| | Authenticated resident | Guest contributor (via event link / QR) |
|---|---|---|
| How they get in | Invited to the community, signed in | Scans QR or opens link, enters a name; no account |
| Upload limit | Per community plan (doc 16) | **Small cap per event** (suggested 30 items, 200 MB) |
| Default visibility of uploads | Per §2 / §5 rules | **Always held for moderation**, children or not |
| Can view | Whatever their scope allows | Only the specific event page, and only items approved to guest-viewable |
| Can delete own uploads | Yes, any time (§6) | Only during the same browser session, via a one-time token; after that, via a removal request (§8) |
| Can opt into WhatsApp notifications | Yes (doc 13 §4) | No |

Guests make events easier — the visiting grandparents, the caterer's photographer — but they're unaccountable, so everything they upload is reviewed before anyone else sees it. Guest uploads are rate-limited per IP and per event link, and committees can switch guest uploads off for any event.

---

## 4. Consent to contribute

When someone uploads, they're confirming three things, shown in plain language at upload time (not just in the Terms):

1. They took these photos, or have the right to share them.
2. They understand that the people in them — including anyone who isn't a Samskara user — will be visible to whoever the community's moderators allow.
3. They've answered the children question honestly.

This mirrors the family Terms ("You own what you contribute" / "You're responsible for what you upload") and adds the community-specific point: you're sharing into a space other people control.

Uploaders keep ownership of their photos. Contributing grants the community a licence to display them inside Samskara at the scope moderators choose — not to sell, print, or use them outside the community archive. If paid print products ever ship (doc 16, Phase 2+), using a photo in one requires a fresh consent step, not this one.

---

## 5. Visibility scopes

Every item lives at exactly one scope. Scope only widens by a moderator's action; uploaders can always narrow their own items.

| Scope | Who can see | Typical use |
|---|---|---|
| **Uploader only** | The uploader | Private drafts; anything they've withdrawn |
| **Committee only** | Uploader + moderators | The held/moderation state; committee working files |
| **Event attendees** | Residents who RSVP'd or checked in to that event | Default approved scope for photos with children |
| **Community members** | All authenticated residents of the community | Default approved scope for adult-only photos |
| **Guest-viewable** | Anyone with the event link | Only by explicit moderator action, per item or per album |

**Personal-archive linking.** A resident can link a community photo into their own family archive (e.g., "add this Pongal photo to our family's 2026 memories"). This creates a *reference* in their family tree, not a copy:

- It can only be linked if the resident can already see it.
- Family members who aren't in the community see it only through that reference, and only while the source item stays at a scope the linking resident can see.
- If the item is removed or narrowed in the community, the family-archive reference disappears too. The community's decision wins; a link can't become a backdoor around moderation.
- Linking does not tag or identify anyone in the photo.

Family data never flows the other way: nothing from a family's archive becomes visible to a community unless someone uploads it there deliberately. The family product's "every family's data is isolated" promise stays intact.

---

## 6. Contributor controls

- **Delete your own upload — yes, any time.** Residents can delete anything they uploaded, at any scope, without asking a moderator. Deletion removes it from the community and from any family-archive links.
- **Narrow your own upload's visibility** — yes (e.g., Community members → Event attendees). Widening needs a moderator.
- **Edit captions, remove your name as credit** — yes.
- **Withdraw everything when leaving the community** — when a resident leaves (or moves out), they're offered: keep my uploads in the archive with credit, keep them anonymised, or delete them all. Default: keep with credit, because community archives lose their value if every departure strips years of photos — but the choice is theirs.

Deleted items go to a 30-day recoverable state (so an accidental delete isn't permanent), then are hard-deleted from storage. This matches how the family product treats deletion.

---

## 7. Moderation permissions

Roles, smallest to largest:

| Role | Can |
|---|---|
| **Resident** | Upload, view per scope, delete/narrow own items, flag any item |
| **Moderator** | Everything a resident can, plus: see the moderation queue, approve to a scope, hide or remove any item, act on removal requests |
| **Community admin** | Everything a moderator can, plus: manage members and roles, community settings, guest-upload switches, start an ownership transfer (§9) |

Rules:

- A community must have **at least two admins** at all times. One person shouldn't be able to lock everyone else out, or take the archive with them.
- Moderators can't permanently delete someone else's upload — they can remove it from view; hard deletion of others' content follows the 30-day path and is logged.
- **Every moderation action is logged** (who, what, when, from which scope to which). Admins can see the log; it can't be edited.
- Moderators can't see residents' household details beyond what §8 allows everyone else.

---

## 8. Household directory privacy

The community knows which flat a resident lives in — that's how invites and membership work. That doesn't mean the community should see it.

- **By default, residents see each other's display names only.** Unit number, household members, and phone numbers are visible to admins (for membership management) and to the resident themselves.
- **A resident can choose** to show their unit number and/or household members to other residents. Opt-in, per field.
- **Children in a household are never shown in the directory** to anyone except that household and admins, regardless of settings.
- **Phone numbers are never shown** to other residents by the product. WhatsApp numbers linked for notifications (doc 13) are used only by our send path and never displayed.
- There's no "browse all households" view for residents. The directory exists to make membership work, not to be a lookup tool.

---

## 9. Removal requests

Anyone can ask for a photo to be taken down — including people who aren't Samskara users.

- **From inside the app:** every item has "Request removal". Reasons: *this is me*, *this is my child*, *I didn't consent to this being shared*, *other*.
- **From outside:** a removal-request form linked from every guest-viewable page and the privacy policy, plus the privacy contact email. Requesters don't need an account.
- **"This is my child" re-hides the item immediately**, before review (§2). Other reasons hide it from guest-viewable scope immediately and queue it for moderators.
- **Moderators must act within 7 days.** If they don't, it escalates to Samskara support, who can act directly.
- **The requester is told the outcome.**
- Samskara itself can remove content that breaks the Terms or the law, regardless of moderator decisions.

---

## 10. Retention

| Data | Kept for |
|---|---|
| Approved community media | For the life of the community, unless deleted by its uploader or removed |
| Held items never approved | **180 days**, then automatically deleted. Unreviewed photos of children shouldn't sit indefinitely |
| Deleted items | 30 days recoverable, then hard-deleted from storage |
| Guest uploader names / session tokens | 90 days after the event, then the name is reduced to "Guest" |
| Moderation and access logs | 2 years |
| WhatsApp opt-in records (doc 13) | While opted in, plus 1 year after opt-out (proof of consent) |
| A community that's closed | Admins get 60 days to export, then everything is deleted |

Resident accounts follow the family product's existing account-deletion rules.

---

## 11. Community ownership transfer

Committees change, usually after an annual election. The archive belongs to the community, not to whoever happened to set it up.

- **Transfer is a two-sided handover.** An outgoing admin nominates a new admin; the new admin must accept from their own signed-in account. No transfer by email alone.
- **A 7-day notice period.** All current admins are notified, and any of them can object during that window, which pauses the transfer for Samskara support to review.
- **Outgoing admins are demoted to resident, not removed.** They keep their own uploads and normal access.
- **The two-admin minimum (§7) applies throughout.** A transfer can't leave the community with fewer than two.
- **Orphaned communities.** If every admin leaves or is unreachable, a resident can request recovery. Samskara support verifies against the association's own records (e.g., a letter on association letterhead or the registered society's office-bearer list) before granting admin rights. This process will need tightening once we've seen real cases.
- Every transfer is recorded in the moderation log.

---

## 12. Security basics

Inherited from the family product, applied per community:

- **Row-level security on every community table**, keyed on community membership and role — the same model that isolates families today. A community can never read another community's data.
- **Media served via short-lived signed URLs**, scoped by the viewer's permission; guest-viewable items included. No permanent public bucket URLs.
- **Original-file metadata (EXIF GPS location) stripped on upload.** Event photos taken in someone's flat shouldn't carry their coordinates.
- **Service-role keys only on the server**, as with the WhatsApp webhook (`api/_whatsappAuth.js`).
- **Guest upload links are revocable** and expire (default: 7 days after the event).
- Data stored in the same Supabase region as the family product; see the existing policy's "Where your data is stored".

---

## 13. DPDP Act (India) — where we stand

> This section identifies obligations and decisions. It isn't legal advice.

### 13.1 The timeline

- **DPDP Rules 2025** were notified around November 2025, with a staggered rollout:
  - Data Protection Board provisions: in effect immediately.
  - Consent-manager registration: around November 2026 (some sources say the date is still to be confirmed).
  - **Core obligations** — notice and consent, security safeguards, breach reporting, retention limits, and **verifiable parental consent for anyone under 18** — enforced roughly 18 months after notification, **around May 2027**.

### 13.2 What matters most for us

- **A "child" is anyone under 18.** Not 13. Teenagers at a society Holi event count.
- **Processing a child's data needs verifiable parental consent.** The Rules allow mechanisms like a virtual token from an authorised entity, but the ecosystem for this is still maturing.
- **Tracking, behavioural monitoring, and targeted advertising aimed at children are restricted.**

### 13.3 Build ahead of enforcement

The core obligations aren't enforced until ~2027. We're building the primitives now anyway, deliberately:

- The children's-photo hold (§2) means no child's image reaches a broader audience without a named, accountable person deciding it should — the natural hook for attaching parental consent later.
- Visibility scopes (§5) and the "my child" removal path (§9) give parents control that already works, even before formal consent mechanisms exist.
- Retention limits (§10) and logs (§7) are already in place.
- Retrofitting consent and visibility onto a live archive full of unconsented photos would be much harder than starting with them.

What we haven't solved: **a real verifiable parental consent flow** for children who appear in photos but whose parents aren't users. The moderation hold reduces risk; it isn't consent. Before May 2027 we need either a workable consent mechanism or a clear legal position on how event photos of non-user children are treated.

### 13.4 Ruled out: face recognition and clustering

No face detection, face recognition, "find photos of me", or face clustering — in MVP or as a planned feature. It's outside the product's MVP scope, and for a community archive full of other people's children it would amount to exactly the kind of tracking the DPDP Rules restrict. Any future proposal to revisit this needs a fresh privacy review first.

### 13.5 Legal review needed before a public pilot

A qualified Indian data-protection lawyer should review, at minimum:

1. Whether the association, Samskara, or both are the "data fiduciary" for community media, and what the agreement with the association needs to say.
2. Whether the children's-photo hold plus removal path is an adequate interim position before parental-consent mechanisms mature.
3. The guest-contributor flow (no account, no notice beyond the upload screen).
4. The notice text residents see at sign-up and at upload.
5. Breach-notification procedures specific to community data.
6. The orphaned-community recovery process (§11).

A closed pilot with one friendly community can go ahead on this design. A public launch should not happen without that review.

---

## 14. Changes needed to the existing policy and terms

When Communities launches, the existing Privacy Policy and Terms need new sections (not rewrites) covering: community data and who controls it; guest contributors; the children's-photo hold; removal requests from non-users; household directory defaults; and ownership transfer. The family sections stay as they are.
