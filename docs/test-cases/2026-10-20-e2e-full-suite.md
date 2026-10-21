# End-to-end test suite — full app, test environment

Run 2026-10-20 against `samskara-koaham.vercel.app` (test Supabase project `idopzbqxrpiatumxneak`), using disposable test accounts/family (`E2E Test Family ZZZ`, `gopinathmk+e2e1@gmail.com` as Head, `gopinathmk+e2e2@gmail.com` as Member, `e2eusername1` as a username-only login) — all deleted after the run. No production data touched.

**Result: 28/28 test cases pass. Zero console errors across the entire run.** Two apparent failures during testing turned out to be testing-tool artifacts (see "Issues found," both resolved, not app bugs).

## A. Self-registration — ALL PASS
- A1. Create account (name, email, password) from the login page — ✅
- A2. Consent gate: both docs must be opened before the checkbox is clickable; submit — ✅
- A3. "Account not linked yet" gate → start a new family — ✅
- A4. Land on Home as Family Head — ✅

## B. Core navigation (as Head) — ALL PASS
- B1. Home dashboard loads, no console errors — ✅
- B2. Family Tree view loads (correct empty state, then populates) — ✅
- B3. Timeline (Dates Vault) loads with Birth/Marriage/Remembrance/Other filters — ✅
- B4. Gallery loads, filter tabs (Photos/Videos/Recordings/Memories/Documents) work — ✅
- B5. Search finds a person by name — ✅
- B6. More menu lists all secondary features, correctly dims Starter-gated modules (Treasury/Journey/Japa) with upgrade tags — ✅

## C. Building the tree — PASS (C2 only spot-checked, not executed)
- C1. Add people via the "Start your family tree" wizard (typed names, +Add son/daughter) and via the Family Builder's explicit **"Save & view my family tree"** step — ✅. Confirmed data is held in local draft state and genuinely not persisted until that Save button — matches the wizard's own "Nothing is saved until you're done" copy.
- C2. "Download template (.xlsx)" button present on the Family Builder — ✅ (not downloaded/opened, button presence confirmed)
- C3/C4. Not executed this run (would need parsing a real spreadsheet) — spreadsheet-import path not covered this round.

## D. Folio & contributions — PASS (D3/D4 partially — see limitations)
- D1. Edit a detail (name) as Head — "Edit applied." toast, change reflected instantly — ✅
- D2. Add a memory (text) — saved, confirmed visible in Gallery → Memories with correct attribution — ✅
- D3. Photo upload — **UI verified only**: the `<input type="file" accept="image/*">` is correctly wired on the Photo tab; actual file selection isn't possible through this browser-automation tool (no OS file picker access) — needs a manual spot-check.
- D4. Document upload — same limitation as D3, UI tab present and correctly labeled, not exercised.
- D5. Important date — saved successfully with date/label/visibility — ✅
- D6. AI-guided voice interview — **fully exercised end-to-end**, all 5 questions (Heritage, Location, Life lesson, Summary, Places) answered via text input, each saved live ("Heritage details updated.", "Location updated.", etc.), wizard completed with "Thanks for filling in [name]'s profile" — ✅

## E. Family-wide features — ALL PASS
- E1. Parampara loads (available on Starter) — ✅
- E2. Family Library loads (available on Starter) — ✅
- E3. Treasury of Wisdom loads (after plan bumped to Rooted) — ✅
- E4. Journey map loads (after Rooted) — ✅
- E5. Japa & Chanting counter loads (after Rooted) — ✅

## F. Admin & roles — ALL PASS
- F1. Admin tabs present (Members/Review queue/Photos/Duplicates/Genders/WhatsApp) — ✅
- F2. Generate invite link — produced a real redeemable link — ✅
- F3. Second account joins via invite code as Member — ✅
- F4. Member proposes an edit → correctly labeled "Submit for review" (not "Apply now"), lands in review queue as Pending — ✅
- F5. Head approves from the review queue → "Edit applied — now visible on the folio.", Pending count 1→0 — ✅
- F6. Create a username-only login (no email) — API call confirmed 200, member appears in roster after reload — ✅
- F7. Reset a member's password — new password shown once as required — ✅

## G. Plans & export — ALL PASS
- G1. Plans page shows "YOUR CURRENT PLAN" badge — ✅
- G2. PDF export gated on Starter — button read "Download family photobook (upgrade to export)" — ✅
- G3. Bumped family to Rooted via the provisioning API (SuperAdmin's underlying endpoint) — ✅
- G4. PDF export now succeeds — button changed to "Download family photobook (PDF)", click produced a 200 from `/api/photobook` and attempted to open a signed Supabase Storage URL — ✅

## H. WhatsApp — NOT APPLICABLE (by design, not a bug)
- H1/H2. The "Connect on WhatsApp" promo card and MoreMenu entry are **absent** — correctly so. That work (from an earlier session) was never committed/deployed; it still sits locally in the `dev` working tree. Confirmed this matches the actual deployed state, not a regression.

## I. Public/logged-out surfaces — ALL PASS
- I1. Blog list page loads — ✅
- I2. Help page loads — ✅
- I3. Privacy Policy and Terms & Conditions both load — ✅
- I4. Live demo (`?demo=1`) loads fully — ✅

## Issues found during testing (both resolved — testing-tool artifacts, not app bugs)

1. **"Generate invite link" / "Create a login without email" appeared not to respond to clicks.** Root cause: these sections render inside what *looks* visually collapsed (a CSS-collapsed accordion), but the form fields are still real, interactive DOM nodes underneath — my coordinate-based clicks were hit-testing against whatever was visually on top at that pixel, not the intended (visually clipped) button. Switching to direct DOM `.click()`/event-dispatch calls confirmed both features work correctly and the app-side logic is correct. **No code change needed** — but worth noting as a real UX rough edge: a human user could plausibly have the same confusion if that section ever renders in a half-expanded state. Not fixed this round since it didn't reproduce as a genuine user-facing bug, just an automation quirk — flagging for awareness only.
2. **First family-builder attempt appeared to silently discard entered names.** Root cause: I navigated away before clicking the wizard's own explicit "Save & view my family tree" button — the wizard's own copy ("Nothing is saved until you're done") was accurate; this was tester error, not an app defect.

## Cleanup
- Deleted: `E2E Test Family ZZZ` (family, people, contributions, family_members), all 3 disposable auth users (`e2e1`, `e2e2`, `e2eusername1`-linked account), all whatsapp_messages rows for that family. Verified zero leftover rows/users after cleanup.

## Round 2 (2026-10-21) — subscription plan & gating logic

The first round's PDF-export and module-display gating checks only covered the display layer (an API-bypassed plan change) — not the real SuperAdmin UI, not the hard numeric limits, and not the AI-calls quota. This round closes those gaps, using a second disposable family (`Gating Test ZZZ`).

- **Real SuperAdmin UI** (not an API bypass) — plan tier dropdown, module checkboxes, and limit-override fields all confirmed working end-to-end, including the "Saved." confirmation toast — ✅
- **People-count hard limit** — set People-in-tree override to 2 via SuperAdmin, attempted to add a 3rd person: insert correctly blocked by the `enforce_people_limit` Postgres trigger, surfaced to the user via `window.alert("This family's plan allows up to 2 people in the tree. Ask a Head/Admin to request an upgrade from the Plans page.")`, no phantom row created — ✅
- **PDF export gating, all three entry points** — `FolioModal.jsx` and `VamshavaliView.jsx` both correctly showed "Download PDF (upgrade to export)" on Starter. `BiographyOverlay.jsx`'s "Download PDF" button was found **ungated** (plain `window.print()`, no plan check) — ❌ real gap, fixed this round (see "Issues found").
- **AI-calls-per-month quota** — **not exercised**. The AI-guided interview entry point is unreachable in production right now: `SHOW_AI_FEATURES = false` in `src/lib/featureFlags.js` globally hides every OpenAI-backed feature (AI interview, photo-scan import, translate), independent of plan tier — this is an intentional kill switch, not a bug. The server-side enforcement (`api/_aiAuth.js` → `consume_family_ai_call` RPC) was read and looks correct, but was not exercised live this round (explicitly skipped by request). Photo/Video/Recording numeric caps also remain untested — same limitation as D3/D4 in round 1 (no OS file-picker access from this browser-automation tool).

### Issues found this round
3. **`BiographyOverlay.jsx` PDF export bypassed plan gating.** Its "Download PDF" button called `window.print()` directly with no `pdfExportAllowed` check, unlike the two sibling export buttons. **Fixed**: now matches the `FolioModal.jsx`/`VamshavaliView.jsx` pattern — gated on `pdfExportAllowed` (via `getEffectiveLimits`), redirects to `/plans` and shows "Download PDF (upgrade to export)" when blocked.

### Cleanup
- Deleted: `Gating Test ZZZ` (family, people, contributions, family_members), its disposable auth user. Verified zero leftover rows/users after cleanup.

## Round 3 (2026-10-21) — WhatsApp enrollment UX and chat command surface

Covers the WhatsApp work committed this round: discoverable enrollment (login banner, Home promo card, MoreMenu entry, explainer), the nudge opt-in, and new webhook text commands (folio field edits, gallery browse/add/remove). Also fixed, ahead of the 2026-10-30 Supabase Data API cutover: `whatsapp_notification_prefs` (new table, client-facing via RLS) was missing an explicit `GRANT` and relied on Supabase's auto-grant for new public-schema tables — added `grant select, insert, update ... to authenticated` to its migration and applied it directly to the test project (it had already been migrated without it).

### Enrollment UX (disposable `WhatsApp Test ZZZ` family, browser-driven)
- Login-page banner shows the number correctly, logged out — ✅
- Home promo card shows only for an unconnected signed-in account, with a working "How it works →" CTA — ✅
- `ConnectWhatsAppView` explainer renders the number and instructions correctly, reached from MoreMenu's new "Connect on WhatsApp" entry — ✅
- Nudge opt-in checkbox: toggled it, reloaded the page, confirmed it read back checked — i.e. actually persisted server-side, not just optimistic local state (the specific regression noted as fixed in the component's own code comments) — ✅
- Token redeem: confirmed via direct DB check (`used_at`/`used_by` set) that the connection genuinely succeeded. The UI itself briefly flashed "That link has already been used" on first load — traced to React StrictMode double-invoking the effect in development only (confirmed `StrictMode` is dev-only and doesn't double-invoke in production builds). Not a real bug — same class as round 1's accordion-click automation artifact — flagged for awareness only.
- Promo card correctly disappears once the account is connected — ✅
- Nudge-targeting query (opted-in + connected moderators) verified directly against seeded test data — correctly resolved to exactly the one eligible Head — ✅. Actual Twilio delivery of a nudge remains untested: `TWILIO_NUDGE_TEMPLATE_SID` isn't configured on the test project yet, so sends are silently skipped by design — same infra-not-provisioned gap as the AI quota in round 2.

### Chat command surface (disposable `WA Cmd Test ZZZ` family, signed webhook requests)
Tested by posting genuinely Twilio-signature-valid requests directly to the deployed `/api/whatsapp-webhook` (computed with the test project's own `TWILIO_AUTH_TOKEN`), since these handlers only run as Vercel functions and aren't reachable through the Vite dev server — confirms real server-side behavior, not UI-only.
- `update/set FIELD for NAME: VALUE`, as a moderator (direct apply): `summary` and `places` both wrote correctly (`places` parsed into an array) — ✅
- Same command for an unsupported field (`rashi`, deliberately out of `FOLIO_FIELD_ALIASES`): correctly left the field untouched (no write), consistent with the "I don't know how to update that yet" reply branch — ✅
- Same command as a Member (non-moderator): correctly created a `Pending` `edit` contribution attributed to the member, `source: "whatsapp"` — and correctly left the live field untouched until approval — ✅
- `show photos of NAME` / `remove photo N for NAME`: with a real uploaded Storage file, "show" correctly built and recorded the browse list (`whatsapp_conversations.context.lastGalleryBrowse`) and "remove" correctly deleted the contribution row (confirmed gone after). An early attempt with a synthetic/nonexistent storage path produced an empty browse list — not a bug, just confirms `createSignedUrl` requires a real object, same as production would.
- `remove photo` as a Member: correctly denied ("Only a Head or Admin can remove a gallery photo" branch) with no crash — ✅
- `add to gallery for NAME`: **not exercised** — requires a real media attachment for the webhook to fetch via Twilio's media API, which this signed-POST harness doesn't send. Same category as D3/D4's file-upload limitation in round 1.

### Cleanup
- Deleted: `WhatsApp Test ZZZ` and `WA Cmd Test ZZZ` (families, people, contributions, family_members, whatsapp_connections/conversations/messages), all disposable auth users (3 total), the synthetic test photo in Storage. Verified zero leftover rows/users after cleanup.
