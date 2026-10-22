# Changelog

One entry per production release — written when `master` is fast-forwarded
and tagged (see `docs/GIT_WORKFLOW.md`). This is the human-readable index;
the git tag on each entry's commit is the authoritative record.

Format: `## vYYYY.MM.DD — short summary`, then what changed, then what was
verified post-deploy.

<!-- Newest entries go at the top. -->

## Unreleased

## v2026.10.21.3 — Branding uniformity and WhatsApp policy disclosures

[PR #14](https://github.com/ananthmkhobby/samskara/pull/14) — ahead of submitting "Samskara" for Meta's WhatsApp Business Display Name review. Fixes a real mismatch: the PWA's home-screen name (Android `short_name`, iOS `apple-mobile-web-app-title`) read "Vamsha Vruksha", dropping "Samskara" entirely — anyone with the app installed saw that name on their home screen while WhatsApp would show "Samskara." Both now say "Samskara."

Also adds what Meta's review expects: the Privacy Policy now names Meta/WhatsApp Business Platform directly (previously only named Twilio, the BSP relaying on Meta's behalf), and the Terms gain a dedicated WhatsApp integration section covering the connect flow, the separate explicit nudge opt-in, and that Meta's own terms apply too.

Verified on the test environment first (`samskara-koaham.vercel.app`): confirmed via the live manifest and HTML that both home-screen names read "Samskara," and that both new policy sections render correctly.

Verified post-deploy: production bundle updated (`index-erC0FJ0Z.js`), confirmed via the live manifest and HTML that both now read "Samskara," and both new Privacy Policy/Terms sections render correctly on `oursamskara.com`. No console errors.

## v2026.10.21.2 — WhatsApp enrollment, nudges, and chat command surface

[PR #13](https://github.com/ananthmkhobby/samskara/pull/13) — the WhatsApp number worked for anyone who already knew to message it, but nothing in the app itself said so; the only place it was written down was a doc meant to be manually shared. Adds a login-page banner, a Home promo card (shown only while the signed-in account has no connected number), a persistent MoreMenu entry, and an explainer page — all pointing at a new "before you connect" mode of `ConnectWhatsAppView`. Adds a separate, explicit opt-in (`whatsapp_notification_prefs`) for proactive nudges, since Meta requires distinct consent from "connecting a number," and wires up one nudge type: an opted-in Head/Admin gets pinged on WhatsApp the moment a family's pending-review count crosses 0→1 (not on every item — avoids spamming an active contribution day). No new cron or scheduled function; stays event-triggered off existing insert paths.

Also extends the webhook with new text commands: `update/set FIELD for NAME: VALUE` for folio edits (summary, places, location), `add to gallery for NAME` (photo caption only), `show photos of NAME`, and `remove photo N for NAME` — each following the same Verified/Pending split by role as every other WhatsApp path.

**Two real bugs found live while testing this on the test deployment, both fixed in this release:**
1. `WAITING_FOR_PRIVACY_CHOICE` was added to the conversation state machine without a matching migration widening `whatsapp_conversations`' `state` CHECK constraint — the exact bug class two earlier migrations (2026-10-03, 2026-10-06) already warned about in their own comments. The write was silently rejected by Postgres, and the webhook never checked that upsert's error, so a real user's conversation looped on the same "private or shared?" question forever while every message still logged "completed." Fixed: the migration, plus every `whatsapp_conversations` write now goes through a helper that logs a real error if a write is ever rejected again.
2. `add to gallery for NAME` sent as plain text (no photo attached — it only works as a photo caption) silently fell into the generic memory-capture flow, which then misread the next message as a person's name to search for, producing a confusing "I couldn't find that person" with no obvious connection to what was typed — caught from the same user's live testing. Fixed: now replies with a clear "attach the photo itself" instruction.

Also, ahead of Supabase's 2026-10-30 Data API cutover (new public-schema tables stop getting an automatic grant): `whatsapp_notification_prefs` was missing an explicit `GRANT` and relied on that auto-grant — added to its migration and applied directly to both the test and production databases.

Verified on the test environment first (`samskara-koaham.vercel.app`): enrollment UX end-to-end in the browser (promo card show/hide, nudge toggle persistence confirmed via reload, token redeem confirmed via DB), and the full chat command surface via genuinely Twilio-signed requests against the deployed webhook — not just code review. Full writeup in `docs/test-cases/2026-10-20-e2e-full-suite.md` ("Round 3"). `add to gallery for NAME`'s photo-caption path and actual nudge delivery (no `TWILIO_NUDGE_TEMPLATE_SID` configured yet) remain unexercised — both flagged explicitly rather than assumed working.

Verified post-deploy: production bundle updated (`index-mfwQ4Fww.js`), page loads with no console errors, login-page WhatsApp banner renders correctly. It shows the fallback placeholder text rather than a real number, since `VITE_WHATSAPP_DISPLAY_NUMBER` isn't set on the production Vercel project yet — expected, not a bug: the production Twilio/Meta number setup (a real number, Meta business verification, "Samskara" display name) is separate account-level work, still outstanding.

## v2026.10.21 — Fix: biography PDF export bypassed plan gating

[PR #12](https://github.com/ananthmkhobby/samskara/pull/12) — found during a round-2 subscription/gating test pass covering the real SuperAdmin UI, hard numeric limits, and PDF export across all three entry points. `BiographyOverlay.jsx`'s "Download PDF" button called `window.print()` unconditionally, with no plan check — unlike the matching export buttons in `FolioModal.jsx` and `VamshavaliView.jsx`, which both correctly gate on `pdfExportAllowed`. A Starter-plan family could export a biography PDF through this one entry point despite the plan not including PDF export.

Fixed to match the existing pattern: gated on `pdfExportAllowed` (via `getEffectiveLimits`), redirects to `/plans` and shows "Download PDF (upgrade to export)" when blocked, same as the other two buttons.

Same round also confirmed (no code change needed): the real SuperAdmin UI works end-to-end for setting plan tier, module flags, and limit overrides; the people-count hard limit (`enforce_people_limit` trigger) correctly blocks inserts past the family's effective limit with the right user-facing message. The AI-calls-per-month quota path was not exercised this round — the AI-guided interview entry point is currently hidden in production by the unrelated `SHOW_AI_FEATURES` kill switch, not a gating issue.

Verified on the test environment first (`samskara-koaham.vercel.app`, disposable `Gating Test ZZZ` family): confirmed the built bundle's "upgrade to export" string count went from 3 to 4 occurrences, confirming all three PDF entry points are now gated.

Verified post-deploy: production bundle on `oursamskara.com` updated (`index-hi9MnYw6.js`) and confirmed the same "upgrade to export" string count (4), confirming the fix is live.

## v2026.10.17 — Redesign the blog reading experience

[PR #11](https://github.com/ananthmkhobby/samskara/pull/11) — the blog looked plain next to the rest of the app and lengthy posts felt like an undifferentiated wall of text. Redesigned the list and post pages for a premium, editorial feel: a magazine-style featured post on the list page, a full hero cover with overlaid title on post pages, a reading-time estimate, an auto-built table of contents (from the post's own `<h2>`s) with scroll-spy highlighting, a sticky title bar that fades in once scrolled past the hero, section ornaments, pull-quote styling for blockquotes, and a back-to-top button.

**Bug found and fixed during review**: table-of-contents links didn't jump anywhere. Heading ids were being assigned by mutating `<h2>` DOM nodes in a `useEffect` after the body's `dangerouslySetInnerHTML` first rendered — any later re-render of the post (the reading-time update, the ToC's own item-list update, the scrollspy's active-id update, all of which live in the same component) handed React a fresh `dangerouslySetInnerHTML` object, which React re-applied, replacing those nodes and silently losing every id before a reader could click one. Fixed by stamping ids into the HTML string itself before it's ever rendered, so they survive every re-render deterministically.

Verified on the test environment first with 5 posts (1 real + 4 disposable demo posts, since-deleted) covering both the featured-hero and plain-grid list states, and a long multi-section post exercising the table of contents, scroll-spy, sticky title bar, and back-to-top button — then re-verified the ToC fix specifically (heading ids present, click jumps to the right section).

Verified post-deploy: production build `Ready` from the merge commit; `oursamskara.com/blog`'s real "What Is Samskara?" post (8 sections) shows the new hero, correct reading time, and working table-of-contents ids; no console errors.

## v2026.10.16.4 — Update support contact email to support@oursamskara.com

[PR #10](https://github.com/ananthmkhobby/samskara/pull/10) — replaces `whyvasupport@gmail.com` with `support@oursamskara.com` everywhere it appeared: Privacy Policy, Terms & Conditions, and `SECURITY.md`. A contact-info swap only — doesn't change what's collected/used/shared, so `POLICY_VERSION` wasn't bumped.

Verified post-deploy: both `oursamskara.com/privacy` and `oursamskara.com/terms` show the new address in every spot.

## v2026.10.16.3 — Fix: plan-gated buttons showing wrong state for every real family

[PR #9](https://github.com/ananthmkhobby/samskara/pull/9) — found via a direct report: Talakadu Kutumbha is on Legacy, but "Download family photobook" and Folio's "Download PDF" both said "upgrade to export." The family's DB row was correct (`plan_tier='legacy'`, no overrides) — this was a real client-side bug affecting **every real Rooted/Legacy family**, not just this one.

**Root cause**: `PDF_EXPORT_ALLOWED`/`AI_MODULE_ENABLED`/`PEOPLE_LIMIT` in `TreeView.jsx`, `FolioModal.jsx`, `VamshavaliView.jsx`, `FamilyBuilderView.jsx`, `FolioVoiceWizard.jsx` (plus `CAN_REQUEST_UPGRADE`/`SHOW_CURRENT_PLAN` in `PlansView.jsx`, found in a follow-up sweep) were declared as module-level constants — evaluated once when each module is first imported, before `initDataLayer()`'s async session fetch resolves. At that point `CURRENT_FAMILY_PLAN_TIER`/`MODULE_FLAGS` are still at boot-time defaults (`"starter"`/`{}`), and since ES module top-level code never re-runs, the gate froze there for the page's lifetime regardless of the family's actual plan. Starter only ever looked correct because `"starter"` happened to already be the frozen default. Fixed by moving each computation inside its component's function body, so it recomputes every render against the live session bindings — the same pattern several other files already used correctly.

Also includes two smaller fixes from the same `dev` push: Blog/Plans no longer briefly show a family's welcome-splash screen before loading (a gate-ordering bug), and the blog's "Listen to this post" read-aloud bar is now hidden (a separate feature from the editor's audio-upload button already hidden, and the actual gap in the original "hide audio" request).

Verified on the test environment first: reproduced the bug live on a fresh disposable Legacy-tier family *before* writing the fix, then re-verified fixed afterward (fresh session, cache cleared) — "Download family photobook (PDF)" and Folio's plain "Download PDF" both correct, `/plans` correctly badges "YOUR CURRENT PLAN."

Verified post-deploy: production build `Ready`, deployed from the exact merge commit; `oursamskara.com` loads correctly.

## v2026.10.16.2 — Fix: Blog/Plans landing on the family splash screen; hide blog read-aloud

[PR #8](https://github.com/ananthmkhobby/samskara/pull/8) — two bugs reported directly against the previous release, both fixed the same day:

**Blog going blank after showing a "family banner," every time, until refreshed.** Root cause: `App.jsx`'s `showFamilySplash` gate (defaults `true` on every mount, shown whenever a family has a logo/tagline) was checked *before* the `view === "blog"`/`"plans"` bypasses — so navigating straight to Blog from inside a family with a logo showed that family's own splash screen first, and the transition out of it went blank. Reordered so Blog/Plans — standalone public surfaces — always bypass the splash, same as they already bypass the login gate.

**"Listen to this post" still showing on the blog**, despite the Audio *upload* button already being hidden in an earlier release. These are two different features — the upload button in the editor vs. a browser-text-to-speech read-aloud bar on the published post. Now hidden behind its own flag (`SHOW_BLOG_READ_ALOUD` in `featureFlags.js`), matching the original request. Component and speed controls stay fully built for an easy re-enable later.

Verified on the test environment first (a disposable family with a tagline set, confirming the fix end-to-end), then post-deploy on production: `oursamskara.com` loads correctly, and the real published post no longer shows "Listen to this post."

## v2026.10.16 — Subscription tiers (Starter/Rooted/Legacy), hard enforcement, and a self-registration fix

[PR #7](https://github.com/ananthmkhobby/samskara/pull/7) — the largest release so far, built in stages across one long session:

**Subscription data model + public Plans page.** `families.plan_tier`/`plan_limit_overrides`, `src/lib/planTiers.js` as the single source of truth for Starter/Rooted/Legacy numbers, SuperAdmin's "Manage a family's plan" section, the public `/plans` page, and self-serve `plan_upgrade_requests`. Every pre-existing family was grandfathered to `'legacy'` in the enforcement migration (see below) so Phase 1's silent `'starter'` default never capped a real family — confirmed on production, all real families moved correctly.

**Real hard enforcement**, not just display: Postgres triggers on `people` and `storage.objects` enforce people/photos/recordings/videos counts across every existing insert/upload call site automatically; `api/_aiAuth.js` caps AI calls per family per month; `api/photobook.js` blocks PDF export for Starter. SuperAdmin can override every limit, including a tri-state `pdfExport` toggle.

**"Never hide a gated feature" policy.** Every gated surface (Treasury/Journey/Japa in the nav, AI buttons, PDF export, people-limit import) now shows visibly-disabled with the specific plan that unlocks it ("Included from Rooted") and a link to `/plans`, instead of silently disappearing or letting someone attempt something guaranteed to fail.

**A real enforcement bug found while building the above**: `isModuleEnabled()` read the raw `families.module_flags` column directly, never merged with the plan tier's own defaults — so Treasury/Journey/Japa had been fully enabled for every Starter family (including every self-registered one) since Phase 1 shipped, contradicting what `/plans` displayed. Fixed at session hydration (`src/data/people.js`) and the identical bug in `api/_aiAuth.js`'s module check.

**Self-registration was landing new users in the shared public demo family** instead of their own. Root cause: `App.jsx` never promoted `ACCOUNT_NEEDS_FAMILY` to a top-level gate the way it already did for the identical blog-author case — the actual family-creation RPC was always correct, it just never got shown first. Fixed with a proper top-level gate. Also fixed in the same pass: the Privacy Policy/Terms checkbox (both signup-time and post-login) is now disabled until both documents are actually opened, opening them no longer wipes in-progress signup form data, and both documents were updated for what's actually shipped (Blog, WhatsApp/Twilio, subscription plans) with `POLICY_VERSION` bumped.

**Blog/Admin sometimes needing a manual refresh to load**, diagnosed as a code-split-chunk-vs-service-worker race (`registerType: 'autoUpdate'` swaps precache manifests in the background, independent of when an already-open tab's own bundle reloads) — new `src/lib/lazyWithReload.js` wraps every lazy-loaded view to self-heal with one automatic reload instead of leaving a dead view on screen.

**Proactive media-usage indicators** — a new `family_media_usage()` RPC and `useMediaLimit` hook show "X/100 photos used" and disable the control at the limit, across every reachable upload surface, instead of only finding out via the (already-friendly) reactive error.

Verified extensively on the test environment throughout — all 6 enforcement limits, cross-member sharing (confirmed the cap is family-wide, not per-member), the upgrade-request flow, a genuine end-to-end self-registration test, the module-gating fix, and the media-usage indicator, each with disposable test data cleaned up after. Both migrations pre-applied to production ahead of this merge.

Verified post-deploy: production build `Ready`; `oursamskara.com` loads correctly, `/plans` and `/blog` both confirmed working with real content.

## v2026.10.15.6 — Email-redirect fix, confirmation emails; blog likes, share, reading redesign

Two pieces, both landed on the same `dev` → `main` PR ([#6](https://github.com/ananthmkhobby/samskara/pull/6)):

**Fix: real self-signups were broken.** Both Supabase projects' Auth Site URL had been left at the `localhost:3000` project-creation default since each project was created — every real self-registration confirmation email on production was pointing nowhere reachable, not a recent regression. The urgent part (both projects' Site URL/redirect allow-list) was corrected directly via the Management API the moment this was confirmed, ahead of any code deploy. This release adds the code-level half: `AuthPanel.jsx`'s two `signUp()` calls now pass `emailRedirectTo` explicitly, so a correct redirect no longer depends on the project setting staying right. Retested end-to-end on production with real confirmation links after the fix: sign-up → new family, and sign-up via invite → join existing family — both passed, DB state verified directly.

**Blog: likes, share, and a book-like reading redesign.**
- Likes — `like_count` + an atomic, `anon`-callable RPC (`increment_blog_post_likes`), matching the blog's own no-login-wall design. Verified working for a fully anonymous client with zero session.
- Share — native Web Share API plus Copy link and WhatsApp/X/Facebook/LinkedIn quick links.
- Reading redesign — scroll-progress bar, a manuscript-style divider, a drop cap on the opening paragraph, larger serif body type.

Verified post-deploy: production build `Ready`; a real published post on `oursamskara.com/blog` confirmed showing the new Like button and share row correctly.

## v2026.10.15.5 — Fix: blog-author sign-in card was unreachable without scrolling

Reported live from Srichand's real account: logged in, saw no editor, no sign the account worked. Root cause: the "signed in as a blog author" message only ever rendered via `AuthPanel`, embedded at the very bottom of `HomeDashboard` — below a full scroll of the public demo family's content (a blog-author session resolves `isDemo: true`, so the rest of the app has somewhere harmless to point at). Backend was correct the whole time — account, zero family rows, RLS self-read — confirmed directly before touching any code.

- Promoted to a real top-level gate in `App.jsx`, same tier as `needsConsent` — a blog author now sees this immediately, never the demo content, with a direct button to `/blog/editor`.
- Added a quiet "Samskara team? Write a post →" link on the public `/blog` page itself, so a team member browsing their own blog doesn't need a bookmarked URL to find the editor.

Verified post-deploy: logged in as Srichand's actual production account — the gate now appears immediately, confirmed before telling him it was fixed.

## v2026.10.15.4 — Grant blog access to an existing account, no new password

[PR #4](https://github.com/ananthmkhobby/samskara/pull/4): `api/create-member-login.js` gets a `mode: "grant"` branch alongside the original `kind: "blog"` create-a-new-login path — looks up an existing account by email and adds it to `blog_authors` directly, instead of always minting a new username/password. For a family member, or anyone who self-signs-up, this removes the credential-generation step entirely; they keep whatever login they already have. New "Add an existing account to the blog team" form in SuperAdmin, alongside the original.

Verified on `dev` before merge: grant against a real account (row created), re-grant on an already-granted one (correctly idempotent, no duplicate), grant against a non-existent email (clear error). All test data cleaned up.

Verified post-deploy: production build `Ready`; `oursamskara.com/blog` loads correctly.

## v2026.10.15.3 — The Samskara Blog ships to production

A new public, team-authored blog ([PR #3](https://github.com/ananthmkhobby/samskara/pull/3)) — built to drive traffic, separate from any family's data:

- `blog_authors` + `blog_posts`, RLS via a new `is_blog_team()` helper (no family scoping at all — a blog author has zero `family_members` rows by design). A genuinely public `blog-media` Storage bucket.
- Team logins via the existing admin-created-login pattern, folded into `api/create-member-login.js` (`kind: "blog"`) after the original separate endpoint pushed this project to 13 serverless functions — one over Vercel Hobby's 12-function cap.
- `/blog/editor` (Tiptap, image/audio/video upload, reached directly by URL like `/superadmin`), public `/blog` (search, author/date filtering) and `/blog/:slug` (server-rendered `<title>`/meta/OG tags via `api/blog-post.js`, browser-native read-aloud with adjustable speed).
- Four discovery points for every visitor, logged in or not: a persistent top-bar icon, a dismissible Home dashboard card, the More-menu footer, and a hero CTA on the login page.

**Pre-merge step worth recording**: the schema migration was applied to production via `supabase db query --linked` (the Management API) rather than `supabase db push`, since this session had no production database password — only the CLI's own authenticated access and the Supabase service-role key. Verified the tables/bucket exist and the migration is recorded in `supabase_migrations.schema_migrations` before the code merge, so the deploy wouldn't hit a missing-table error.

Verified post-deploy: production build `Ready`; `oursamskara.com/blog` loads correctly, empty state as expected (no posts published yet).

## v2026.10.15.2 — Documentation release: audit bundle, released via standard PR

Promoted `dev` → `main` ([PR #2](https://github.com/ananthmkhobby/samskara/pull/2))
through the normal (non-hotfix) release path — the first time that path
has been exercised end-to-end through this pipeline. No application
runtime code changed beyond what `v2026.10.15` already shipped; this
release carries:

- `docs/AUDIT_BUNDLE.md` — the full requirement-through-deployment audit
  evidence bundle, cross-referencing every other doc in this list.
- This changelog's own `v2026.10.15` hotfix entry, `docs/SDLC.md`,
  `docs/GIT_WORKFLOW.md`, `docs/ENVIRONMENTS.md`, `SECURITY.md`,
  the CI workflow and PR template, and `scripts/migrate-to-prod.mjs` —
  all previously on `dev`/`main` only, now also on `master`/tagged.
- Second release on the same calendar day as `v2026.10.15` — tagged
  `v2026.10.15.2` rather than colliding; `docs/GIT_WORKFLOW.md` updated
  with the same-day-release tagging convention this forced.

Verified post-deploy: CI green (5/5) before merge; production build
confirmed `Ready`; `oursamskara.com` loads correctly post-deploy
(unauthenticated landing page, as expected for a docs-only release).

## v2026.10.15 — Hotfix: invite-redemption crash on production

Found during a full-feature test pass of both environments
(`docs/test-cases/RESULTS.md`): redeeming an invite as a brand-new Member
crashed on `oursamskara.com` with a raw Postgres `NOT NULL` violation on
`family_members.user_id`, shown directly to the user — the account was
created but never attached to the family. Didn't reproduce on the test
environment; the underlying condition (no session yet right after
`signUp()`) is timing-sensitive, not deterministic.

- `JoinForm` (`src/components/AuthPanel.jsx`) now checks
  `supabase.auth.getSession()` before calling `redeemInvite()`. No session
  yet → shows a clear "confirm your email, then come back to this link and
  log in" message instead of calling the RPC. No RLS/RPC/schema change.
- Shipped via `docs/GIT_WORKFLOW.md`'s hotfix path: branched from `main`,
  not `dev` (which held unrelated unreleased work), PR'd and merged back
  into `main`, then merged back into `dev` so it isn't lost on the next
  regular release.
- **First release to go through the documented `master`
  fast-forward-and-tag step** — `master` didn't exist yet, so it was
  created pointing at this release rather than fast-forwarded from a prior
  one.
- Verified post-deploy: the fixed bundle is confirmed live on
  `oursamskara.com` (the new "Almost there…" message string present in the
  served JS). A live end-to-end re-test of the crash path itself was
  blocked by Supabase's own signup-email rate limit (hit twice today from
  repeated test signups) rather than disproving the fix; the identical
  code path was verified end-to-end on the test environment instead.

## 2026-10-15 — Production split: new Supabase + Vercel projects, real data migrated

The two-environment pipeline from `docs/SDLC.md`/`docs/GIT_WORKFLOW.md` went
from documented plan to actually running today:

- New Supabase project (`samskara-prod`, `ap-south-1`, Pro) created; all 56
  migrations replayed to build an identical, empty schema.
- New Vercel project (`samskara-prod`) created under the same team, tracking
  `main`, serving `oursamskara.com` (SSL auto-provisioned, verified live).
- Existing project's Production Branch repointed from `main` to `dev`, making
  it the test environment — zero downtime, confirmed by direct deployment
  inspection, not just visual check.
- Real data migrated via the new `scripts/migrate-to-prod.mjs`: 10 real
  families, 300 people, 100 marriages, 21 accounts (fresh passwords —
  `migration-output/*.csv`, distribute to each family's Admin then delete),
  304 contributions, 5 library books, 47 real media files. "Bhandari Family"
  and 3 orphaned test-redeem accounts confirmed as leftover test data and
  excluded; the pre-seeded public demo family was also excluded (it already
  exists in every environment via the schema migrations themselves).

**Real issues hit and fixed, worth remembering:**
- A loose `vercel alias set` pointer doesn't auto-follow new deploys the way
  a registered project domain does — `samskara-koaham.vercel.app` was
  re-registered properly. See `docs/ENVIRONMENTS.md`.
- Disabling "Automatically expose new tables" during Supabase project
  creation (recommended for a different reason at the time) blocks Postgres
  *grants* for every future migration's tables, for every role including
  `service_role` — not just API exposure. This would have silently broken
  real production signups, not only the migration script. Fixed with an
  explicit grant statement, including `alter default privileges` so it
  never recurs for a future migration's tables.
- `scripts/migrate-to-prod.mjs`'s original table order matched
  `docs/BACKUPS.md`'s documented order, which predates later migrations
  that added `family_members.person_id`, `invites.person_id`, and
  `contributions.book_id` as foreign keys — the actual safe order is now
  `families → people → marriages → family_members → family_books →
  book_ownership/book_readers → contributions → ...`.
- `family_books`, `contributions`, and four other tables use
  `generated always as identity` primary keys, which Postgres refuses an
  explicit value for outright — these get a fresh id on insert, with an
  old-id → new-id map threaded through for the tables that reference
  `family_books.id`.
- The script's "skip if already migrated" check must be scoped to the
  specific families/users being written, never a blind table-wide count —
  the destination's own pre-seeded demo data made a blind count look like
  "already done" when the real rows hadn't been written yet.
- A re-run must never unconditionally overwrite the generated-passwords
  report file — an early version did exactly that when a re-run created
  zero new accounts, briefly losing the real passwords from the first
  successful run (recovered by resetting those 21 accounts' passwords
  again via the admin API).

All of the above is now encoded directly in `scripts/migrate-to-prod.mjs`
itself (comments at each fix site), not just here.
