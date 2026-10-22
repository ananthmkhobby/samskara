# 19 — Test and Acceptance Plan

**Status:** Draft v1 — written 2026-10-17, pending product-owner review

## 1. Approach

The codebase has **no automated test suite** (per `docs/SDLC.md`). This plan is therefore a **manual pre-release verification checklist**, following the existing discipline in `docs/SDLC.md` and `docs/GIT_WORKFLOW.md`:

1. Every change is verified on the **test** Vercel + Supabase stack first, using **disposable data** (seeded fake community, fake flats, fake residents, stock/non-real photos — never real children's photos).
2. Migrations are append-only; a migration is verified on test before it ever runs on prod.
3. Only after the checklist passes on test is the change promoted to prod, followed by a short smoke check on prod.

We are not introducing a new QA methodology. Adding automated RLS tests would be valuable but is an engineering decision outside this blueprint (see doc 21 OD-7).

### Test fixtures (create on test stack)
- Community A (≈20 flats) and Community B (≈5 flats).
- Accounts: A-admin, A-moderator, A-resident-owner, A-resident-tenant, A-resident-2, B-resident, family-only user (existing Samskara family), anonymous browser.
- At least one user who is both a family member and an A-resident.

## 2. Event creation

| # | Scenario | Expected |
|---|---|---|
| E1 | A-admin creates event with title/date/category | Event appears in A timeline under correct year |
| E2 | A-resident tries to create event | Denied |
| E3 | A-admin edits/deletes event with no media | Succeeds |
| E4 | A-admin deletes event with approved media | Requires confirmation; behaviour per doc 12 (soft-delete) |
| E5 | B-resident requests A's event by ID | Not found / denied |
| E6 | Admin who created event is removed from committee | Event and media remain, owned by community |

## 3. QR / link upload

| # | Scenario | Expected |
|---|---|---|
| U1 | Resident scans QR from WhatsApp group on mid-range Android, uploads 10 photos | All land `pending`; progress shown; works on mobile data |
| U2 | First-time uploader not yet a member | Join flow tied to a household; committee approval required per doc 05 rules |
| U3 | Token for Event X used against Event Y | Rejected |
| U4 | Revoked / expired token | Rejected with clear message |
| U5 | Duplicate photo uploaded twice | dHash dedup flags/merges |
| U6 | Oversized video | Rejected with size message |
| U7 | Upload link forwarded to a non-resident outside the society | Cannot complete upload without membership (or lands in a quarantine queue, per doc 13 decision) |
| U8 | Confirm no outbound WhatsApp Business API message is sent anywhere in the flow | Twilio logs show zero outbound messages |

## 4. Moderation, including the children's-photo path

| # | Scenario | Expected |
|---|---|---|
| C1 | Uploader marks "contains children" | Visible only to uploader + committee |
| C2 | Uploader **skips** the children question | Treated as contains-children (C1 behaviour) |
| C3 | Uploader marks "no children" | Still `pending` until moderated (all uploads are moderated) |
| C4 | Moderator approves child photo for community visibility | Visible to active A-residents only |
| C5 | Moderator rejects | Hidden from everyone except committee; uploader sees "not approved" |
| C6 | A-resident-2 guesses storage URL / item ID of a pending child photo | Denied (both DB row and storage object) |
| C7 | B-resident or family-only user tries same | Denied |
| C8 | Any resident flags an approved photo ("my child is in this") | Hidden immediately pending review |
| C9 | Verify `community_contributions` is a separate table; family `contributions` contains zero community rows | Confirmed by direct query |
| C10 | Family-product moderation regression | Family contributions flow unchanged |

## 5. Move-out data handling

| # | Scenario | Expected |
|---|---|---|
| O1 | Committee marks A-resident-tenant moved out | Access ends immediately (fresh session and existing session) |
| O2 | Moved-out resident's approved community photos | Remain in community archive (per agreed policy, doc 21 OD-4) |
| O3 | Moved-out resident's pending/rejected items | Removed from committee queue or anonymised per policy |
| O4 | New tenant joins same flat | Sees community archive; sees **nothing** private from previous occupant (pending items, personal links, household profile fields) |
| O5 | Owner remains while tenant moves out | Owner access unaffected |
| O6 | Moved-out resident requests deletion of their uploads | Process per doc 15 works end-to-end |

## 6. Personal-archive linking (Phase 2 — scenarios retained so design isn't lost)

| # | Scenario | Expected |
|---|---|---|
| L1 | Resident with family archive copies an approved event photo into it | Copy appears in family archive; community original unchanged |
| L2 | Attempt to copy a pending/child-restricted photo | Denied |
| L3 | Other community members cannot see anything in the resident's family archive | Confirmed |
| L4 | Resident moves out | Previously copied photos stay in their family archive (decision pending, OD-5); link to community removed |

## 7. Access, roles and regression

- R1: Anonymous browser cannot load any community page or media.
- R2: Committee handover — new admin gains rights, old admin loses them, audit log records both.
- R3: Usage stats (doc 17 M9) match manual counts on fixtures.
- R4: Full family-product smoke test (login, tree, gallery, WhatsApp ingest, photobook) after each community migration.
- R5: Function count on Pro plan — new endpoints deploy on both stacks.

## 8. Pilot go-live sign-off

Before the pilot community goes live on prod, all of §2–§5 and §7 pass on test, a prod smoke test of E1/U1/C1/C6/O1 passes with a throwaway event that is then deleted, the committee has signed the pilot agreement and privacy notice (doc 15), and the product owner records go/no-go.
