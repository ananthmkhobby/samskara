# 17 — MVP Scope

**Status:** Draft v1 — written 2026-10-17, pending product-owner review

## 1. Governing principle

The MVP is optimised for **one real pilot community (100–500 flats) through one full festival cycle** (decision #2). It is not a down-scoped version of the original brief's full feature list; it is the smallest product that lets us answer two questions:

1. Will a committee and its residents actually use a durable shared archive instead of (or alongside) their WhatsApp groups and a volunteer's Google Photos account?
2. Will the association say "yes" when asked directly whether it would renew at a stated price?

Anything that does not help answer those questions, or that is not needed to run the pilot *safely* (privacy, children's photos, move-outs), is out of MVP.

## 2. MVP feature list (in scope)

| # | Feature | Why it is in MVP | Notes / constraints |
|---|---|---|---|
| M1 | **Community creation** (Samskara-operated provisioning for the pilot) | Nothing exists without a tenant | Pilot community is provisioned by us, not self-serve. Self-serve signup is Phase 2. |
| M2 | **Admin / committee authorization** | The committee is the gatekeeper and moderator | Roles: `committee_admin`, `committee_moderator`, `resident`. Stored in `community_members`; resolved via `current_community_id()`. Committee handover (adding/removing admins) must work — committee turnover is the core durability claim. |
| M3 | **Event creation** | Archive is organised by event | Title, date, category (festival / sports / cultural / civic / other), cover photo. Events are owned by the community, never by the creating admin's account. |
| M4 | **QR / link-based media upload** | The single adoption path; replaces "send it to the WhatsApp group" | One link + QR per event, shared by the committee **in their own WhatsApp groups** (decision #1). Single-use-style upload tokens scoped to one event; no Business-API outbound messaging. Photo upload required; short video optional with a hard size cap. |
| M5 | **Collaborative event gallery** | The visible payoff for contributors | Approved media only; uploader sees their own pending items. dHash dedup on upload (existing `imageHash.js`). |
| M6 | **Basic year-wise timeline** | Delivers the "history" promise without the full Community Tree | Simple list/grid grouped by year then event. Not the richer residential/memory tree visualisations from docs 06–07. |
| M7 | **Private community access** | Trust is the whole proposition | Every read is RLS-gated on community membership. No public galleries, no public share links in MVP. |
| M8 | **Upload moderation with children's-photo default** | Core privacy control (decision #4) | All uploads land `pending`. Any item the uploader marks "contains children" — **and any item from an uploader who skips the question** — stays visible only to uploader + committee until a moderator explicitly approves it for community visibility. Moderator can approve, reject, or approve-with-restriction. Stored in the new `community_contributions` table, never the family `contributions` table (risk #9). |
| M9 | **Basic committee usage visibility** | Needed for pilot measurement (doc 20) and for the committee to feel ownership | Per event: uploads, distinct contributors, pending queue size, approval latency. Community-wide: joined households vs. total flats. Plain table, no dashboards. |
| M10 | **Household membership + move-out handling (minimum viable)** | Risk #6: underbuilding this leaks private data | Each resident membership is tied to a flat/household with `active_from`/`active_to`. Move-out ends access immediately; the resident's *community-contributed approved* media stays with the community; their *pending/rejected* items and any personal-archive links are removed from community view. Owner vs. tenant recorded as a field; no richer occupancy history UI. |
| M11 | **Removal / takedown request** | A parent who sees their child in a photo must be able to get it pulled, fast | Any member can flag any item; flagged items are hidden pending moderator review. |

### Explicitly *not* in MVP even though tempting
- Optional personal-archive linking (household → personal Samskara family archive). See §4 — this is a deliberate change from the brief.
- Paid plans / billing. The pilot is free or heavily discounted; plan-tier enforcement is not needed until a second paying community exists (but see doc 18, M-0c on fixing the plan-limit source of truth first).
- Any WhatsApp Business API messaging. Transactional opt-in notifications are Phase 2.
- Blur detection, face clustering, AI classification (risk #8 scope guard).

## 3. Phase 2 (only if the pilot passes the gate in doc 20)

- **Household-to-family linking** — permission-based link from a household's membership to that resident's personal Samskara family archive (copy-to-my-archive of approved event photos; never the reverse direction by default).
- **Richer residential Community Tree** (doc 06) and Memory Tree (doc 07) visualisations — new, simpler layout code; existing family-tree layout (`banyanLayout.js`, `classicTreeLayout.js`) is not reused.
- **Similar-photo grouping** (beyond exact/near-duplicate dHash).
- **Yearbooks** (generalise `api/_photobook.js` / `api/photobook.js`).
- **Highlight curation** by committee.
- **Opt-in transactional WhatsApp notifications** (e.g. "your photo was approved"), reusing the Twilio signature-validation / `serviceClient()` pattern only.
- **Self-serve community onboarding** and **plan tiers / billing**.
- **Whisper transcription** of oral-history clips from long-time residents (cheap, reusable).
- Each Phase 2 feature touching data model/auth/money/privacy gets its own focused design doc per `docs/SDLC.md`.

## 4. Phase 3

- AI activity/event classification (GPT vision, generalised).
- Video highlight reels.
- Blur detection and face clustering (new infra; see risk #8 — needs its own ROI case, and face clustering on children's faces needs a separate privacy review before it is even prototyped).
- Multi-community features (federations, cross-society events, a resident belonging to several communities with a switcher).
- Wider verticals (schools, alumni groups, temples, clubs).

## 5. Where this challenges the original brief's phasing

1. **Personal-archive linking moved from MVP to Phase 2.** The brief treated it as a headline differentiator. But (a) the buyer is the association, not existing Samskara family users, so there is no network-effect carryover to justify it early (risk #4); (b) it crosses two privacy domains and is the most likely place for a cross-tenant data bug; (c) the pilot can validate willingness-to-pay without it. We will *ask* pilot residents whether they want it (doc 20) rather than build it speculatively. Test scenarios for it are still written in doc 19 so the design is not lost.
2. **Move-out handling moved *into* MVP.** The brief listed occupancy/churn as critical but not as a launch feature. A pilot running a full festival cycle will almost certainly see at least one move-out; shipping without it risks a real privacy leak in front of the only customer we have.
3. **Takedown/flagging added to MVP.** Not in the brief. Required because the children's-photo default (decision #4) does not cover photos the uploader never flagged (risk #5).
4. **Year-wise timeline kept, full tree deferred.** The timeline delivers the "history" value; the tree visualisations are new work with no reusable code and are not needed to measure adoption.
5. **Agreed with the brief:** AI features stay in Phase 3; multi-community stays in Phase 3.

## 6. MVP exit definition

The MVP is "done" when every item in M1–M11 passes the pre-pilot checklist in doc 19 on the test environment, and the production stack has been promoted per `docs/GIT_WORKFLOW.md`.
