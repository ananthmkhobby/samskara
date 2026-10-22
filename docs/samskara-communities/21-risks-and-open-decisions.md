# 21 — Risks and Open Decisions

**Status:** Draft v1 — written 2026-10-17, pending product-owner review

This is the canonical risk register for Samskara Communities. Other documents reference risks by number.

## Part A — The 10 critical design risks

### R1. WhatsApp-as-paid-distribution doesn't pencil out
- **Risk:** Outbound invites via WhatsApp Business API would likely be classified "Marketing" by Meta — est. ₹21–25k/yr for a 300-flat community with ~20 events/yr, more than the whole proposed subscription.
- **Why it matters:** It would make every customer unprofitable.
- **Decision:** Resolved by decision #1 — free link/QR shared by the association in its own WhatsApp groups; Samskara never sends outbound Business-API invites. Twilio/WhatsApp scoped to opted-in transactional utility messages only (Phase 2).
- **Residual:** Recorded as "why we didn't build X". Watch for Meta re-classifying "utility" templates as marketing.

### R2. No distribution moat vs. NoBrokerHood / MyGate
- **Risk:** They own distribution (18k–25k societies claimed) and could add an archive feature.
- **Why it matters:** We cannot win on speed or reach.
- **Mitigation:** Win on trust and continuity — the archive survives committee turnover and resident moves, unlike a volunteer's Google Photos account. Stay out of apartment management.
- **Residual:** Open — is integration/partnership with one of them an option to explore, or a threat to avoid? (OD-9)

### R3. Unvalidated willingness to pay
- **Risk:** ₹4,999–9,999/yr tiers are hypotheses; associations are documented as price-resistant (MyGate reportedly moved from per-flat to free).
- **Mitigation:** Decision #2 + doc 20's explicit price question near pilot end.
- **Residual:** Open until pilot completes.

### R4. Harder cold start than the family product
- **Risk:** Needs both a committee gatekeeper and resident adoption; no network-effect carryover from family users (different buyer).
- **Mitigation:** Single-pilot focus; Samskara-run onboarding; QR posters at events; frictionless link upload.
- **Residual:** Customer-acquisition path after the pilot is undefined (OD-10).

### R5. Children's-photo consent at scale is unsolved
- **Risk:** One event photo can capture many non-member children with no pre-established consent path. DPDP verifiable-parental-consent obligations bite ~May 2027.
- **Mitigation:** Decision #4 — child photos default to uploader + committee only until moderator approval; MVP also treats a skipped "contains children?" answer as yes and adds flag/takedown with immediate hide (doc 17 M8, M11).
- **Residual open questions:**
  - Photos already shown in person (e.g. on a screen at the event, or already posted in the WhatsApp group) before online moderation — the app can't undo that exposure; what do we tell committees and parents?
  - Photos the uploader marks "no children" but which do contain children — rely on moderator review of every item (current MVP), or add detection later (Phase 3, privacy-reviewed)?
  - What legal basis lets a committee moderator approve a photo of a *non-member* child for community visibility at all? Needs legal input before DPDP enforcement.
  - Moderator burden at festival scale (hundreds of photos per event).

### R6. Occupancy / household churn
- **Risk:** Owner vs. tenant, multi-year turnover; underbuilding leaks private household data across move-outs.
- **Mitigation:** Moved into MVP (doc 17 M10); membership periods with `active_to`; doc 19 §5 tests.
- **Residual:** Data-retention policy on move-out not fully decided (OD-4, OD-5). Who can initiate a move-out (committee, resident, both) and disputes (tenant says still living there).

### R7. Vercel 12/12 function ceiling
- **Risk:** Hobby plan was full; no new endpoint could ship.
- **Decision:** Resolved by decision #3 — upgrade to Vercel Pro, budgeted.
- **Residual:** Sequencing — doc 18 M0a must complete before any new serverless endpoint merges.

### R8. AI feature-creep
- **Risk:** Pressure to add blur detection / face clustering early; neither exists in-house, both need new infra with uncertain ROI; face clustering on children is a privacy hazard.
- **Mitigation:** Deferred to Phase 3; doc 18 scope guard requires ROI case + design doc + children's-privacy review to pull forward. Reuse only cheap existing pieces (dHash, Whisper).
- **Residual:** Enforcement depends on the product owner holding the line.

### R9. Reusing the literal `contributions` table
- **Risk:** Putting community photos in the family `contributions` table mixes two trust/privacy domains under one RLS surface.
- **Mitigation:** Structurally separate `community_contributions` table (doc 18 M5); doc 19 C9 verifies.
- **Residual:** An implementation-discipline risk — implementers must actually build the separate table and not take the shortcut under time pressure. Reviewers should treat a PR that writes community rows into `contributions` as a blocking privacy bug.

### R10. Manual JS/SQL plan-limit sync
- **Risk:** Already a documented gap on the family product (`src/lib/planTiers.js` vs SQL); a second tier system doubles it.
- **Mitigation:** Doc 18 M0c — single source of truth before any community tier work (hard prerequisite of P2e).
- **Residual:** Which mechanism (DB table vs generated file) is an engineering choice to make in M0c's design doc.

## Part B — Open product-owner decisions

| ID | Decision needed | Context / recommendation |
|---|---|---|
| **OD-1** | **Shared vs separate Twilio / Meta WhatsApp Business account from the family product** | Raised in the WhatsApp doc's scope (doc 13), not decided. Separate isolates quality-rating and template risk and keeps sender identity distinct; shared is cheaper/simpler. Needed before P2d. |
| OD-2 | Approve Vercel Pro spend now (before pilot) | Prerequisite to all build work (M0a). |
| OD-3 | Pilot terms: fully free vs. token discount; retention guarantee length | Doc 20 proposes free + 12-month retention guarantee. |
| OD-4 | Ownership of a moved-out resident's approved uploads | Proposed: stays with community, resident may request removal. Needs confirmation and alignment with doc 15. |
| OD-5 | Copies in a resident's personal family archive after move-out (Phase 2) | Proposed: they keep them. |
| OD-6 | Legal review of non-member children's-photo approval and DPDP readiness | See R5. Who pays / which counsel. |
| OD-7 | Whether to introduce automated RLS tests for community tables | Currently none exist; manual plan in doc 19. |
| OD-8 | Fix the pilot go/stop thresholds before the pilot starts | Doc 20 §5 proposes starting values. |
| OD-9 | Stance toward NoBrokerHood/MyGate: partner, integrate, or avoid | R2. |
| OD-10 | Post-pilot acquisition channel (direct sales, referrals from pilot, family-user referrals) | R4. |
| OD-11 | Whether personal-archive linking moving from MVP to Phase 2 is acceptable | Doc 17 §5 challenge to the brief. |
| OD-12 | Whether non-resident upload attempts are rejected outright or quarantined | Doc 19 U7. |
| OD-13 | Brand: "Samskara Communities" under the same app/domain or a separate entry point | Affects onboarding and trust messaging. |
| OD-14 | Who in a community may be a moderator (only elected committee, or delegated volunteers) | Affects children's-photo accountability. |
