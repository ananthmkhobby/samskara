# Samskara Communities — Blueprint Index

This is the 21-document product and technical blueprint for **Samskara Communities**: a new vertical of the Samskara family-archive app that lets residential societies (pilot scope 100–500 flats) preserve shared event and festival photos and community history, moderated by the association committee. The core strategic correction from the original brief is distribution cost: WhatsApp Business API invites would likely be billed as Marketing (est. ₹21–25k/yr for a 300-flat society), more than the whole proposed subscription, so invites are free links/QR codes the association shares in its own WhatsApp groups. Rather than building the brief's full feature list and then finding a customer, the plan is to build a tight MVP for **one pilot community through one festival cycle**, ask directly whether they would pay, and gate Phase 2 on that answer. Children's photos default to unpublished (uploader + committee only) until a moderator approves them.

All documents: **Draft v1 — written 2026-10-17, pending product-owner review.**

| # | Document | Summary |
|---|---|---|
| 00 | [Executive summary](00-executive-summary.md) | The product, the four locked decisions, and the pilot-first approach on one page |
| 01 | [Product vision](01-product-vision.md) | Durable community memory that outlives committees and resident moves; what it is not (apartment management) |
| 02 | [Market and competitor analysis](02-market-and-competitor-analysis.md) | NoBrokerHood/MyGate distribution, Google Photos failure mode, price resistance, WhatsApp cost math |
| 03 | [Personas and user journeys](03-personas-and-user-journeys.md) | Committee admin, moderator, owner/tenant residents, long-time residents; key journeys |
| 04 | [Functional requirements](04-functional-requirements.md) | What the system must do, per feature area |
| 05 | [Non-functional requirements](05-non-functional-requirements.md) | Privacy, performance on mobile data, retention, availability |
| 06 | [Community tree design](06-community-tree-design.md) | Residential structure visualisation (blocks/flats/households) — full design is Phase 2 (M6); MVP ships a plain year/event list instead |
| 07 | [Memory tree design](07-memory-tree-design.md) | Recommends a yearbook grid + timeline toggle for Phase 2 (M6); MVP ships a simpler list/grid grouped by year then event |
| 08 | [Information architecture](08-information-architecture.md) | Navigation, entities and how they relate |
| 09 | [UI/UX specifications](09-ui-ux-specifications.md) | Screens and interaction details, mobile-first upload flow |
| 10 | [Technical architecture](10-technical-architecture.md) | Stack, multi-tenant extension, reuse vs. new components |
| 11 | [Database design](11-database-design.md) | `communities`, `community_members`, `current_community_id()`, `community_contributions`, RLS |
| 12 | [API design](12-api-design.md) | Endpoints, upload tokens, auth helpers |
| 13 | [WhatsApp integration](13-whatsapp-integration.md) | Free link/QR distribution; opt-in transactional messages only |
| 14 | [Media processing strategy](14-media-processing-strategy.md) | Generalised upload/storage, dHash dedup, deferred AI features |
| 15 | [Security and privacy](15-security-and-privacy.md) | Children's-photo default, DPDP readiness, move-out handling, takedowns |
| 16 | [Monetization and cost model](16-monetization-and-cost-model.md) | Hypothesised ₹4,999–9,999/yr tiers, Vercel Pro and other cost lines |
| 17 | [MVP scope](17-mvp-scope.md) | Single-pilot MVP vs. Phase 2 vs. Phase 3, and where it departs from the brief |
| 18 | [Development roadmap](18-development-roadmap.md) | Dependency-ordered milestones starting with Vercel Pro and identity; no fabricated estimates |
| 19 | [Test and acceptance plan](19-test-and-acceptance-plan.md) | Manual pre-pilot checklist on the test stack, mirroring SDLC/GIT_WORKFLOW |
| 20 | [Pilot validation plan](20-pilot-validation-plan.md) | Pilot selection, terms, metrics, explicit price question, go/iterate/stop gate |
| 21 | [Risks and open decisions](21-risks-and-open-decisions.md) | Canonical register of the 10 design risks plus open product-owner decisions |
| — | Index (this file) | Entry point to the blueprint |
