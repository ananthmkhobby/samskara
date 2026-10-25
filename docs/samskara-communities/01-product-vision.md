# 01 — Product Vision

## Vision statement

> Every residential community keeps a living memory of its shared life, one that belongs to the community itself, survives committee turnover and household moves, and lets each family carry its part of that story into its own Samskara archive.

## The problem, stated honestly

A typical Indian society runs 15-25 events a year: Ganesh Chaturthi, Navratri/Durga Puja, Diwali, Holi, Independence Day, sports day, New Year. Hundreds of photos get taken at each one. Today they scatter across:

- dozens of personal phones,
- a WhatsApp group where media expires, gets compressed and can't be searched,
- at best, one volunteer's Google Photos or Drive album.

When that volunteer moves away, ten years of the society's history goes with them. Nobody's job is to prevent this, and none of the ops apps that societies already pay for even try.

## The five pillars, with the reasoning behind each

Each pillar from the original brief is kept only to the extent it serves the core claim (**institutional continuity**) and can be tested in a single-pilot MVP.

### 1. Community Memory Tree
**What:** A browsable structure of the society's history, arranged by year, then event, then album. There is also a light residential structure (society, tower/block, flat) used for membership, not for display.
**Why it holds up:** Year and event is how residents actually remember ("Diwali 2024"). Google Photos has no such structure. This is visible, explainable value on day one.
**Scope note:** The family-tree layout code (`src/lib/classicTreeLayout.js`) is **not** reused. The residential tree is a simple org chart and the memory tree is non-hierarchical (a timeline and grid). Both are new, deliberately simple visualizations. MVP: timeline plus event grid. A "tree" visual is a later polish item, not a pilot requirement.

### 2. Collective Event Memories
**What:** Each event gets a QR code and a link. Anyone the committee invites can upload. Uploads land in a moderation queue, and approved media goes into the event album.
**Why it holds up:** This is the core loop. If residents don't upload at the pilot's first festival, nothing else matters. QR and link distribution through the society's own WhatsApp groups costs us nothing and meets residents where they already are (decision #1).
**Scope note:** The upload entry is ephemeral and scoped to one event, modelled on the single-use `content_shares` pattern (`supabase/migrations/20260930120000_content_shares.sql`). It is *not* the standing phone-to-family link that the WhatsApp webhook uses.

### 3. Household / Family Connections
**What:** A resident can optionally link community media they appear in, or uploaded, into their personal Samskara family archive. This needs explicit permission and is never automatic.
**Why it holds up:** This is the only real bridge between the two products, and the reason Communities belongs inside Samskara rather than being a standalone gallery. It also gives a possible acquisition path from community users to the family product.
**Scope note:** Linking copies or references media into a family tenant. The community and family data **stay structurally separate** (a separate `community_contributions` table, separate RLS surface). For the MVP this is a single "save to my family archive" action, nothing more.

### 4. AI-Assisted Organization
**What:** Dedup of near-identical uploads, plus suggested captions and tags.
**Why it holds up, partly:** Dedup is a real need, because 40 people photograph the same aarti. It reuses `src/lib/imageHash.js` (dHash) as it is. Caption/tag suggestions can reuse the `callOpenAI` helper with some generalization.
**Explicitly deferred:** Blur detection and face clustering. Neither exists in the codebase. Face clustering in particular makes the children's-consent problem much worse. Both are Phase 2/3 and only happen if pilot data shows moderators are overwhelmed. AI feature creep is a named risk, and we resist it on purpose.

### 5. Cultural Continuity
**What:** Year-on-year comparison ("Ganesh Chaturthi 2023, 2024, 2025"), recurring event templates, and committee handover that keeps the archive intact.
**Why it holds up:** This is the long-term moat and the answer to "why pay when Google Photos is free". **For the MVP, only the handover mechanics are built** (committee role transfer, community-owned rather than person-owned data). Recurring-event templates and comparison views wait until there is more than one year of pilot data.

## What we are NOT building

| Not building | Why |
|---|---|
| Visitor/gate management | NoBrokerHood/MyGate's core; direct competition we would lose |
| Maintenance billing, dues, accounting | Same; also money-handling compliance |
| Parking, security, staff attendance | Same |
| Complaints/helpdesk, notices, polls | Ops-app territory; dilutes the memory focus |
| Outbound WhatsApp Business invites | Marketing-category cost exceeds revenue (see 02) |
| Face recognition / clustering (MVP) | Consent risk; no usage evidence yet |
| Public/social feed outside the society | Privacy; not the job to be done |

## What success looks like for the pilot

One society runs **one full festival cycle** on Samskara Communities. The committee creates the event, residents upload through QR/link, moderators clear the queue, the album is published, and the committee is asked whether they would pay, and how much.
