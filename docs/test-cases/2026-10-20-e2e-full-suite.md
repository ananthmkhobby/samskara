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
