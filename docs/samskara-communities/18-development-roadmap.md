# 18 — Development Roadmap

**Status:** Draft v1 — written 2026-10-17, pending product-owner review

## About effort estimates

This roadmap deliberately contains **no engineering-hours or calendar estimates**. Effort depends on engineering capacity, availability, and codebase familiarity, none of which are visible to the authors of this blueprint. What *is* knowable is dependency order, so milestones are expressed as a sequence with explicit prerequisites. Once capacity is known, the owner should attach estimates per milestone.

## Process rules that apply to every milestone

- `docs/SDLC.md`: anything touching data model, auth, money or privacy needs a design doc. This 21-document blueprint covers the MVP build; each Phase 2+ feature still gets its own focused design doc.
- `docs/GIT_WORKFLOW.md`: migrations are **strictly append-only**. Every milestone ships to the **test** Vercel + Supabase stack with disposable data first, then promotes to prod.
- No automated test suite exists; acceptance criteria below are verified via the manual checklist in doc 19.

## Dependency graph (summary)

```
M0a Vercel Pro ─┐
M0b Identity ───┼─> M1 Community+roles ─> M2 Households/move-out ─┐
M0c Plan SoT ───┘ (parallel, before any tier work)                │
                         M3 Media generalisation ─> M4 Events+QR upload ─> M5 Moderation (community_contributions)
                                                                         ─> M6 Gallery+timeline ─> M7 Usage visibility
                                                                         ─> M8 Takedown ─> M9 Pilot hardening/launch
Phase 2 (gated on doc 20): P2a archive linking, P2b trees, P2c yearbooks, P2d notifications, P2e billing ...
```

---

## M0a — Vercel Pro upgrade (blocking prerequisite)

- **Objective:** Remove the 12/12 serverless-function ceiling on the Hobby plan (risk #7, decision #3).
- **Dependencies:** Product-owner approval of the recurring cost (line item in doc 16).
- **Reuse:** Existing `api/` layout unchanged.
- **New:** None in code. Upgrade both test and prod projects; confirm the deploy is run from the app directory (a wrong cwd previously created a stray project and put the live site behind a login wall).
- **Acceptance:** Both projects show Pro; a dummy 13th function deploys on test and is then removed; prod site remains publicly reachable.
- **Rule:** No milestone that adds a serverless endpoint may merge before M0a is complete.

## M0b — Multi-tenant identity extension

- **Objective:** Add `communities`, `community_members`, and `current_community_id()` mirroring `family_members` / `current_family_id()`.
- **Dependencies:** None (database-only; can run in parallel with M0a).
- **Reuse:** Existing `family_members` RLS pattern and `current_family_id()` function; `api/_memberAuth.js` auth-helper shape.
- **New:** Append-only migration; RLS policies; a user with both a family and a community membership must resolve each independently.
- **Acceptance:** On test: a user in Community A cannot read any Community B row; a family-only user sees nothing in community tables; existing family product behaviour is unchanged (regression pass of family login, tree, gallery).

## M0c — Plan-limit single source of truth (do before any second tier system)

- **Objective:** Fix the existing manual JS/SQL plan-limit sync gap before Communities doubles it (risk #10).
- **Dependencies:** None technically; must precede P2e (billing/tiers).
- **Reuse:** `src/lib/planTiers.js` and its SQL counterpart.
- **New:** One canonical definition (e.g. a DB table or generated file) that both JS and SQL read; a check that fails loudly on drift.
- **Acceptance:** Changing a family-plan limit in one place changes both enforcement points on test. Not strictly needed for a free pilot, so it may slip behind M9 — but it may **not** slip behind P2e.

## M1 — Community provisioning and committee roles

- **Objective:** Samskara staff can create a community and appoint committee admins; admins can add/remove other admins and moderators.
- **Dependencies:** M0a (new endpoint), M0b.
- **Reuse:** `api/provision-family.js`, `api/create-member-login.js` as patterns.
- **New:** `provision-community` endpoint; role management UI; audit log of role changes (committee handover evidence).
- **Acceptance:** Admin handover leaves all events/media owned by the community; removed admin loses moderation rights immediately.

## M2 — Households, occupancy, and move-out

- **Objective:** Residents join via a household/flat with `active_from`/`active_to`, owner/tenant flag; move-out ends access and cleans up per doc 17 M10.
- **Dependencies:** M1.
- **Reuse:** None directly — structurally new.
- **New:** `community_households` + membership-period columns; move-out action (committee- or resident-initiated); RLS honouring `active_to`.
- **Acceptance:** See doc 19 §5 move-out scenarios — all pass.

## M3 — Media pipeline generalisation

- **Objective:** Upload/storage that works for both family and community buckets/paths.
- **Dependencies:** M0b.
- **Reuse:** `src/lib/imageResize.js` and `src/lib/imageHash.js` as-is; `src/lib/mediaUpload.js` / storeMedia generalised with bucket + path parameters.
- **New:** Community storage bucket with community-scoped storage policies.
- **Acceptance:** Family uploads still work unchanged (regression); community uploads land under the community path and cannot be fetched by a non-member.

## M4 — Events and QR/link upload

- **Objective:** Admins create events; each event has a shareable link + QR that residents use to upload.
- **Dependencies:** M0a, M1, M3.
- **Reuse:** Nothing from WhatsApp ingest (`api/_whatsappMedia.js`, `api/whatsapp-webhook.js`) — identity-resolution shape mismatch.
- **New:** Event CRUD; event-scoped upload-token service (single-use-link-token pattern, expiry, revocation); QR generation; mobile-first upload page; first-time-uploader join flow tied to a household.
- **Acceptance:** Link shared in a WhatsApp group leads a resident from tap to completed upload on a mid-range Android phone; revoked/expired token rejects; token for Event X cannot upload to Event Y.

## M5 — Moderation with children's-photo default

- **Objective:** All uploads pending; children's-photo default per decision #4.
- **Dependencies:** M4.
- **Reuse:** Moderation **pattern** from the family `contributions` flow only.
- **New:** Structurally separate `community_contributions` table with its own RLS (risk #9 — the literal `contributions` table must not be used; reviewers should reject any PR that does). "Contains children?" prompt where skipping = treated as yes. Moderator queue.
- **Acceptance:** doc 19 §3 all pass, including skip-the-question and direct-URL-access cases.

## M6 — Gallery and year-wise timeline

- **Dependencies:** M5. **Reuse:** existing gallery components as UI reference; `api/gallery-export.js` pattern for later export. **New:** community gallery, year→event timeline.
- **Acceptance:** Only approved items shown to residents; uploader sees own pending items marked as pending.

## M7 — Committee usage visibility

- **Dependencies:** M5, M2. **New:** simple stats view (doc 17 M9); these are the metrics doc 20 relies on.
- **Acceptance:** Numbers match a manual count on test data.

## M8 — Flag / takedown

- **Dependencies:** M5. **New:** flag action, auto-hide on flag, moderator resolution, takedown latency recorded.
- **Acceptance:** Flagged item disappears from all resident views immediately.

## M9 — Pilot hardening and launch

- **Dependencies:** M0a–M8 (M0c may trail).
- **Work:** full doc 19 checklist on test; privacy notice + committee agreement (doc 15); prod promotion; pilot onboarding (doc 20).
- **Acceptance:** Every doc 19 checklist item signed off; product owner go/no-go.

---

## Phase 2 milestones (gated on the doc 20 decision — do not start before)

| ID | Milestone | Key dependency | Note |
|---|---|---|---|
| P2a | Household → personal-archive linking | M2, own design doc | Highest cross-domain privacy risk; consent both ways |
| P2b | Community/Memory Tree visualisations (docs 06–07) | M6 | New layout code, not `banyanLayout.js` / `classicTreeLayout.js` |
| P2c | Yearbooks | M6 | Generalise `api/_photobook.js` |
| P2d | Opt-in transactional WhatsApp notifications | M0a; account decision (doc 21 OD-1) | Reuse Twilio signature validation / `serviceClient()` only |
| P2e | Self-serve onboarding + plan tiers + billing | **M0c** | Pricing informed by doc 20 result |
| P2f | Similar-photo grouping, highlight curation | M6 | |
| P2g | Whisper oral-history clips | M3 | Reuse existing Whisper plumbing |

## Scope guard (risk #8)

Blur detection, face clustering, AI classification and video highlights are **Phase 3**. A request to pull any of them forward requires: a written ROI case, a separate design doc, and (for face clustering) a dedicated children's-privacy review. "It would be cool for the pilot" is not sufficient.
