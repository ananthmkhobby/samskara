# Changelog

One entry per production release — written when `master` is fast-forwarded
and tagged (see `docs/GIT_WORKFLOW.md`). This is the human-readable index;
the git tag on each entry's commit is the authoritative record.

Format: `## vYYYY.MM.DD — short summary`, then what changed, then what was
verified post-deploy.

<!-- Newest entries go at the top. -->

## Unreleased

## v2026.10.31.3 — Fix a fresh signup sometimes landing on the demo family

[PR #31](https://github.com/ananthmkhobby/samskara/pull/31) — a user reported registering and seeing the full demo family's Home dashboard instead of the create/join prompt. Root cause: this project requires email confirmation (confirmed live — a real signup attempt hit Supabase's own confirmation-email rate limit, proving it's not auto-confirmed). Clicking the confirmation link is a fresh page load, but supabase-js's `detectSessionInUrl` resolves the magic-link token *asynchronously*; `initDataLayer()` (awaited before the app even mounts) can race ahead of that, see no session yet, and resolve the same anonymous/demo fallback a first-time visitor gets — with nothing re-checking afterward once the token actually finished processing.

Every other sign-in path in this app already reloads manually right after its own `signIn*()` call resolves; this was the one path with no corresponding call site, since no app code runs at the exact moment a magic link gets processed — only the `onAuthStateChange` listener does, and it previously only handled `PASSWORD_RECOVERY`. Fix: handle `SIGNED_IN` too, scoped to `NEEDS_LOGIN` so it fires only for the case that matters.

**Verified end-to-end on production** (full real-UI click-through, not just backend RPCs): sign up → accept consent → create a new family → generate an invite → a second member logs in and redeems it — correctly lands in the real family both times, never the demo. DB-confirmed afterward: 2 members, roles `head`/`member` exactly as expected, zero residue after cleanup.

**Not independently verified**: the specific magic-link race this fix targets wasn't click-tested against a real confirmation email (Supabase rate-limited further sends during testing) — applied from the confirmed race condition and the same reload pattern every other sign-in path in this codebase already uses, not from watching the exact repro resolve.

## v2026.10.31.2 — Fix "unable to check the consent box" + a sticky-positioning regression

[PR #30](https://github.com/ananthmkhobby/samskara/pull/30) — traced a real, ongoing user complaint to an actual bug. The Privacy Policy view is ~10,245px tall (about 12.6 phone screens) with only one "← Back" link, positioned at the very top. A real person reading through it has no way back to the form without scrolling the whole way back up — so the likely real behavior is reaching for the phone's physical back gesture instead, which (since the "reading" state is client-side React state, not a URL route) navigates away entirely, silently resetting whatever had been typed and which documents had been opened. Confirmed with a real user's screenshot mid-session: "Terms & Conditions ✓" checked, "Privacy Policy" not — exactly the asymmetric-loss pattern this produces (one document opened via the sticky-less in-app link survives; the other, exited via the phone's back gesture, doesn't).

Fix: made the "← Back" link `position: sticky` across all three places this flow exists (`ConsentGate.jsx`, and `AuthPanel.jsx`'s `SignUpForm`/`JoinForm`), so it stays pinned to the top of the viewport the entire way through scrolling the document.

**Found and fixed a second bug while verifying the first**: the mobile-overflow safety net from v2026.10.30 (`overflow-x: hidden` on html/body) had a side effect nobody caught at the time — per CSS2.1's overflow resolution, any non-`visible` `overflow-x` forces the browser to compute `overflow-y` as `auto` too, which turns html/body into a scroll container and silently breaks `position: sticky` for every descendant in the entire app, including the sticky back button just added. Caught by directly measuring the button's bounding rect on the test deployment: `position: sticky` computed correctly, but it sat ~2200px off its pinned position after scrolling. Fixed by switching to `overflow-x: clip`, which is exempt from that auto-coercion — same horizontal-overflow protection, without the side effect.

**Verified live on production** (not just test): sticky back button's bounding rect stays at `top: 12` after scrolling 3000px; full round-trip confirmed (open Privacy Policy → scroll → tap sticky Back → returns to form with "✓ Privacy Policy" correctly marked); `overflow-y` confirmed `visible` on both html and body.

Noted but explicitly out of scope for this fix: `ClassicTree.jsx` sets `document.body.style.overflow = "hidden"` unconditionally on mount rather than only during an active pan/zoom gesture — confirmed this doesn't affect the consent flow (no tree renders there), filed as a separate follow-up rather than scope-creeping this fix.

## v2026.10.31.1 — Rate limiting on public unauthenticated endpoints

[PR #29](https://github.com/ananthmkhobby/samskara/pull/29) — a full security review (all 40 tables' RLS policies compared byte-for-byte between test and production, every `api/` endpoint's authorization boundary, and a repo-wide sweep for the NULL-role-bypass bug class previously found and fixed in `reassign_parents()`/`resolve_workbench_task()`) found no live vulnerability, but flagged one real gap: three intentionally-public, unauthenticated endpoints had no abuse protection.

New `supabase/migrations/20261031120000_rate_limits.sql` — a generic atomic (bucket, time-window) counter, same shape as the existing `consume_anon_ai_call()`/`ai_usage_daily`. New `api/_rateLimit.js` — shared helper, IP-hashed bucket key, fails open on an unexpected DB error. Wired into `api/password-reset-requests.js`'s `submit` (5/hour/IP), `api/track-click.js`'s `track` (30/10min/IP, silent no-op over limit), and `api/gallery-export.js`'s code redemption (10/10min/IP — the one that matters most, since the code is that endpoint's entire authorization).

Also swept and manually verified two other functions matching the same vulnerable-looking string pattern (`update_family_name`, `update_family_tagline`/`update_family_logo`) — confirmed safe, both already had an explicit preceding null-role check. Proved this with a real exploit attempt (disposable zero-membership attacker account against a disposable victim family): blocked, as expected.

**Verified**: the rate-limit RPC on production allows exactly 5 calls against a limit of 5, then blocks calls 6–7; the anon key gets "permission denied" calling it directly, confirming only the service-role-backed endpoints can invoke it.

## v2026.10.31 — Branded WhatsApp/social link-preview image

[PR #28](https://github.com/ananthmkhobby/samskara/pull/28) — the app had no Open Graph image configured anywhere: the bare site link had no preview image at all (`index.html` carried zero OG tags), and the Share Preview Service's fallback (brand mode, or any missing/expired token) plus blog posts without a cover photo either fell back to the plain flat app icon or omitted `og:image` entirely — not catchy in a WhatsApp chat.

Added `public/og-image.png`, a designed 1200x630 card built from the app's own brand palette and visual language (the dotted jaali texture from the body background, the same conic-gradient tree mark as the top bar, maroon/gold tokens, Devanagari title + tagline), rendered once via a local Playwright script rather than generated per-request. Wired in as the default `og:image`/`twitter:image` for the homepage, `api/share.js`'s fallback, and `api/blog-post.js`'s no-cover-photo case.

**Verified**: `oursamskara.com/og-image.png` resolves correctly (200, image/png, 1200x630) and the homepage's HTML carries the new meta tags, post-deploy.

## v2026.10.30 — Fast Family Onboarding (Phase 1, pilot) + mobile layout overflow fix

[PR #27](https://github.com/ananthmkhobby/samskara/pull/27) — lets a joining member assert who they are relative to someone already in the family tree, even when the connecting people in between aren't known or don't exist yet, without ever fabricating a parent/grandparent/spouse. Ships opt-in only (`module_flags.fastOnboarding`, default off) behind a new per-family pilot flag — existing onboarding (`register_new_family`, `redeem_invite`'s non-FFO path, manual admin entry) is completely unchanged for every family that doesn't turn it on.

New schema: `family_members.placement_status`, `people.provisional_status`/`created_via`, `invites.proposed_person_name`, `relationship_path_claims`, `ffo_workbench_tasks` — plus three new security-definer RPCs (`submit_relationship_path_claim`, `create_provisional_person`, `resolve_workbench_task`) and a new admin "Connection Workbench" surface for resolving unlinked members, unresolved relationship claims, and provisional people, four tabs, never a dead end.

**Testing**: 65 scenarios in `docs/FAST_FAMILY_ONBOARDING_TEST_REPORT.md` plus a 41-check full-app regression pass in `docs/FULL_APP_REGRESSION_TEST_REPORT.md`, both run live against disposable accounts on the test database. Found and fixed 6 real defects during this cycle, the most serious being a cross-family authorization bypass in `resolve_workbench_task()` (a `NULL`-evaluates-to-false bug in the role check — the same bug class already fixed once before in `reassign_parents()` — that let an admin of one family resolve a workbench task belonging to a completely unrelated family). Confirmed via `gh pr view` that this was never live in production before this release.

Also in this release: a site-wide mobile layout fix for a long-standing "page loads zoomed in until you pinch-zoom-out once" bug, traced to the top bar's action cluster (record-memory/bell/blog/help/family-switcher) overflowing a 375px-wide phone's content width and dragging the whole page's layout viewport wider than the device — not Folio-specific, present on every page. Blog/Help (both already reachable via the More menu) and the role pill now hide below 430px width; added `overflow-x: hidden` on html/body as a standing safety net against any future recurrence.

**Post-deploy**: 7 pending migrations applied to production (`flvxeoawvuvrlondqnci`) via the Management API, including one (`media_size_caps`) left over from an earlier already-merged PR whose migration had never been applied. Verified live: `relationship_path_claims`/`ffo_workbench_tasks` tables exist, `resolve_workbench_task()`'s fixed null-role check is the live version, production site responds 200.

## v2026.10.29.5 — Document Meta Business verification + Twilio production setup

[PR #26](https://github.com/ananthmkhobby/samskara/pull/26) — closes action item #10 from `docs/ARCHITECTURE_REVIEW.md`. Docs-only, no code change: `docs/META_WHATSAPP_VERIFICATION.md` is a step-by-step checklist for Meta Business verification, Twilio WhatsApp Sender registration with the "Samskara" display name, Content Template submission, and the exact production-only env vars to set — account-level work on Meta's/Twilio's own platforms, not something further engineering resolves.

## v2026.10.29.4 — Lazy-load JourneyMapView to shrink the eager bundle

[PR #25](https://github.com/ananthmkhobby/samskara/pull/25) — closes action item #9 from `docs/ARCHITECTURE_REVIEW.md`. The two chunks the review originally flagged — `familyTemplate` (`xlsx`) and `BlogEditorView` (Tiptap) — turned out to already be correctly lazy-loaded. The real find: `JourneyMapView` pulled in `leaflet` + `react-leaflet` (~47KB gzipped) eagerly, despite Journey being a secondary feature most sessions never open.

Made it `lazy()` like its siblings — main bundle dropped from 190KB to 143KB gzipped. Functionally verified the map still renders correctly (pins, routes, generation filters) via the dev preview in demo mode.

**Post-deploy verified**: confirmed `leaflet` no longer appears in production's main bundle at all (0 matches), after confirming the new deploy had actually propagated (the first check caught the previous deploy's bundle still live — a timing gap, not a failure).

## v2026.10.29.3 — Cap recorded video/audio size and duration

[PR #24](https://github.com/ananthmkhobby/samskara/pull/24) — closes action item #7 from `docs/ARCHITECTURE_REVIEW.md`. A single in-browser recording had no cap at all — only a plan-tier COUNT limit on photos/recordings/videos existed, nothing stopped one very long recording from being disproportionately large.

Two layers: `family-media`'s Storage `file_size_limit` is now 250MB, enforced server-side by Supabase Storage itself before the object is ever written (verified directly — a service-role upload just over the limit is rejected, bypassing RLS but not this check); and `useMediaRecorder.js` auto-stops a recording at 10 minutes (video) / 20 minutes (audio), with a live countdown shown in `ContributeModal` and `ChitrashaleAddModal`.

**Post-deploy verified**: migration applied to production, `file_size_limit` confirmed set; new code confirmed present in the deployed bundle. The real-device click-through of a recording actually hitting the auto-stop wasn't practical to test in this session (no mic/camera, 10-20 minute wait) — worth a quick spot-check on a phone when convenient.

## v2026.10.29.2 — Replace shared admin secret with per-operator superadmin auth

[PR #23](https://github.com/ananthmkhobby/samskara/pull/23) — closes action item #8 from `docs/ARCHITECTURE_REVIEW.md`. Every human-operator superadmin endpoint (`provision-family`, `manage-plan`, `broadcast`, `blog-team`, `track-click`, `password-reset-requests`) was gated by one shared `ADMIN_PROVISION_SECRET` string, typed into a browser field and kept in `sessionStorage` — can't be revoked for one person without breaking it for everyone, never expires.

Adds a `superadmins` table (security-definer `is_superadmin()` helper, self-read-only RLS) and `api/_superadminAuth.js`'s `requireSuperadmin()`, authenticating via the caller's own bearer token instead — same posture as every other member-facing endpoint. `SuperAdminView.jsx`'s "enter the admin secret" field is gone; the view now checks the signed-in account against `superadmins` directly. `CRON_SECRET` deliberately untouched — it gates Vercel Cron's own service-to-service call, which has no human operator behind it.

**Post-deploy verified**: live check against the deployed endpoint (not just locally) — a real superadmin bearer token gets 200, a plain signed-in user gets 403, no token gets 401. Seeded `anantht@gmail.com` as the first production superadmin.

## v2026.10.29 — Blog stored-XSS fix, self-service account deletion/export, grievance redressal

[PR #22](https://github.com/ananthmkhobby/samskara/pull/22) — three changes, all out of a full architecture/security/compliance review (`docs/ARCHITECTURE_REVIEW.md`). Fixes a stored-XSS gap: blog `body_html` was written and rendered with zero sanitization (RLS gates who can write a post, never what the HTML contains) — adds `isomorphic-dompurify` in `blogDb.js`'s write path and `api/blog-post.js`'s render path as defense-in-depth. Verified a `<script>`/`onerror`/`javascript:` payload all come out stripped.

Adds self-service account deletion and data export (More → Account), closing a long-tracked `SECURITY.md` gap and a real DPDPA exposure — there was previously no way to exercise erasure/access rights except asking a human by hand. Several tables referenced `auth.users` with no delete action (defaults to `RESTRICT` in Postgres), which would have made a plain `deleteUser()` call fail for most active users — fixed with `ON DELETE SET NULL` across the affected FKs (migration `20261029160000_account_deletion.sql`). Deletion semantics (confirmed with the product owner): shared-family content stays but loses its identity link; a solo family is deleted entirely; a sole Head/Admin of a shared family is blocked until they promote someone else. Verified against three disposable test accounts covering each branch before cleanup, applied to both Supabase projects.

Also publishes a Grievance Officer line in the Privacy Policy (DPDPA requirement — name is currently a placeholder, flagged in `docs/ACCOUNT_DELETION.md`) and documents the manual, human-verified fallback for someone who can't sign in to use the self-service flow. `POLICY_VERSION` bumped.

**Post-deploy verified**: `/api/account` live on production, returns the expected "Not signed in." for an unauthenticated call; `/blog` and `/` both responding 200; both new RPCs (`request_account_deletion`, `export_my_data`) confirmed present on production.

## v2026.10.28 — Photo tagging, Share Preview Service, and serverless function cleanup

[PR #21](https://github.com/ananthmkhobby/samskara/pull/21) — three changes. Adds photo tagging: point at a spot in a Gallery photo and label who's there, an existing family member or free text for someone not identified yet — a lightweight, removable annotation (`photo_tags`), not a commitment to add anyone to the tree. Verified end to end: a tag's position survives a full reload and lands in exactly the right spot; delete works and actually removes the row.

Adds the Share Preview Service MVP — a members-only, WhatsApp-rich-preview link for one Gallery photo. Full requirements doc at `docs/SHARE_PREVIEW_SERVICE.md`, including the Next.js→Vite/Vercel adaptation notes (this is a client-rendered SPA, so the OG-tag landing page reuses the same hybrid server-render trick `api/blog-post.js` already uses, and the real photo is resolved client-side under the same Postgres RLS that gates every other read in this app — no bespoke authorization code needed). Along the way, found and fixed a service-worker bug where an already-installed user's browser would serve a stale cached shell for a share link instead of the real per-share preview.

Also splits four serverless functions — `push.js`, `manage-plan.js`, `broadcast.js`, `blog-team.js` — out of files they'd been folded into purely to stay under Vercel's old Hobby-plan 12-function cap, now that the project is on Pro. Every function body moved verbatim; no behavior changes. `provision-family.js` and `create-member-login.js` are back to doing one thing each, matching their names again.

Verified on the test environment first (`samskara-koaham.vercel.app`): photo tagging's full create/persist/reload/delete cycle tested live in the browser; the share landing page's OG tags confirmed correct via a real WhatsApp crawler user-agent (not just a generic curl check); the split endpoints build/lint clean with every frontend call site updated. Migrations for both new tables applied directly to both test and production databases in this same change.

Verified post-deploy: confirmed live on `oursamskara.com` — `photo_tags` and `share_links` tables present, `api/push.js` responding correctly (not a 404) to a probe request.

## v2026.10.27.3 — Default both notification categories on when push is enabled

[PR #20](https://github.com/ananthmkhobby/samskara/pull/20) — found while testing the new prompt on a real device: the two automated-notification opt-ins (reengagement, photo-prompt) defaulted off even after subscribing, requiring a separate trip to the settings page that most people would never make. `enablePush()` now defaults both on the moment someone turns notifications on at all, from any entry point (the full-screen prompt, the settings page, or the superadmin test panel all share this one function) — someone who wants only one can still turn the other back off right after.

Verified post-deploy: confirmed live on `oursamskara.com`.

## v2026.10.27.2 — One-time full-screen notification prompt

[PR #19](https://github.com/ananthmkhobby/samskara/pull/19) — the rotating Home promo card from the same day's earlier release was easy to scroll past entirely. Adds `NotificationPrompt.jsx`, a real full-screen gate (same tier as `FamilySplash`/`ConsentGate`) shown once per app open for a signed-in account that hasn't turned on push yet — one clear choice, "Turn on notifications →" or "Maybe later." Stops reappearing once the account actually subscribes, or once the OS permission comes back denied (nothing this screen does can fix a denial). The Home promo card stays too, for anyone who picks "Maybe later" and changes their mind later from Home.

Also fixed, same day: `ADMIN_PROVISION_SECRET` was discovered stored as an empty string on the production Vercel project — the live deployment only still worked because it was built before that got cleared; the next production deploy would have silently broken every superadmin tool at once (provisioning, plan management, blog team, password resets, and the broadcast panel from the prior release). Restored to its real value and confirmed working.

Verified on the test environment first (`samskara-koaham.vercel.app`): confirmed the prompt renders correctly (had to temporarily force-render it in isolation, since the automated test tooling's sandboxed browser is permanently stuck at a denied OS notification permission and can never reach the real "unsubscribed" state that triggers it) — reverted that test hook cleanly before committing. Separately verified the restored superadmin broadcast end to end on production itself: a real test push sent and received on a physical device.

Verified post-deploy: confirmed live on `oursamskara.com` — the new bundle includes the prompt's copy, no console errors.

## v2026.10.27 — Superadmin broadcast, ScanJunction docs, and rotating promo banner

[PR #18](https://github.com/ananthmkhobby/samskara/pull/18) — three changes. Adds a superadmin-wide recurring push broadcast: the `/superadmin` screen gets a "Platform notification" panel to compose one custom message sent to every subscribed person across every family, on an editable days-based frequency (a daily Vercel Cron — Hobby's actual floor — checks whether the interval has elapsed), plus a manual "send now" for testing. Folded into the existing `provision-family.js` endpoint rather than a new file, same 12/12 Hobby-cap workaround used throughout this project; the send logic itself was extracted into a shared `api/_push.js` rather than duplicated a third time. A same-day follow-up fixed the panel not rendering until the admin secret was typed in — inconsistent with every other section on that page.

Adds `docs/SCANJUNCTION_INTEGRATION.md`, documenting the gallery-export endpoint (already built, now discovered during this cycle) for ScanJunction's engineering team — request/response shape, every error case, the CORS model, and what's guaranteed to never be exposed.

Replaces the login page's dense WhatsApp paragraph and Home's two separate always-on promo cards with one shared `PromoCarousel` — a small rotating "ad slot" that crossfades between short slides every few seconds instead of showing everything at once. The login page cycles two static awareness slides (WhatsApp, notifications — neither actionable pre-auth); Home's version checks real connection/subscription state and only includes whichever slide is still relevant for that account.

Verified on the test environment first (`samskara-koaham.vercel.app`): full broadcast pipeline end to end (save, manual send delivered 1/1, frequency gate correctly blocking a second send with the right next-due timestamp, cron auth path checked with both wrong and correct secrets); migration applied directly to both test and production databases in this same change, not left stranded on one side; promo carousel rotation confirmed on both the login page and Home.

Verified post-deploy: confirmed live on `oursamskara.com` — the new bundle includes the promo carousel styling, and the cron auth gate correctly rejects a wrong secret. No console errors.

## v2026.10.25.2 — Google Search Console site verification

[PR #17](https://github.com/ananthmkhobby/samskara/pull/17) — adds the `google-site-verification` meta tag to `index.html` so the site can be verified in Search Console (lets Search Console data link into GA4, and enables sitemap submission/crawl monitoring). One line, no behavior change.

Verified post-deploy: the meta tag's content is present in the live page source on `oursamskara.com`.

## v2026.10.25 — Push notifications, Share Target, and Google Analytics

[PR #16](https://github.com/ananthmkhobby/samskara/pull/16) — the biggest batch of this cycle. Ships a full Web Push pipeline: a real "Notifications" settings page (subscribe/unsubscribe, per-category opt-ins), an admin broadcast composer (everyone/admins/specific people), and an automated "add a story to this photo" prompt (manual trigger for now — a real Verified photo with no sibling Verified memory, excluded once already prompted via `notification_log`). Fixes a real bug found during live testing: a photo-prompt notification's `?person=` deep link went nowhere, since nothing in the app actually read that query param — `App.jsx` now seeds `selectedPersonId` from it on load, the same read-once-before-replaceState pattern as its sibling URL params.

Also adds Web Share Target support (Android/Chrome only — iOS Safari has never implemented it): Samskara now shows up in the OS share sheet for photos, text, and links. `src/sw.js`'s `fetch` listener intercepts the share POST (only a service worker can), stashes the payload in Cache Storage, and redirects into a new `ShareTargetLanding` component that hands it to the existing contribute flow, now extended to pre-fill from a shared photo or text.

Finally, adds Google Analytics (gtag.js) sitewide via `index.html` — the app's one real HTML entry point, so the base snippet covers every route automatically. Since navigation past the first load is client-side (pushState/popstate, no real page load), `App.jsx` also fires a `page_view` event on every subsequent view change, so GA sees in-app navigation, not just the one initial hit.

Verified on the test environment first (`samskara-koaham.vercel.app`): full push pipeline tested end to end on a real device (subscribe → send → receive → click-through lands on the right folio); admin composer targeting confirmed to respect family isolation; GA confirmed to fire exactly one `page_view` per view change with no duplicate on initial load. Share Target itself can't be exercised by the automated browser preview at all (needs a real Android device) — deployment and manifest/service-worker wiring verified directly instead.

Verified post-deploy: confirmed live on `oursamskara.com` — the GA measurement ID (`G-S8NX35R8Y7`) renders in the page source, and both the share-target manifest entry and the service worker's POST handler are present in the deployed `manifest.webmanifest`/`sw.js`. No console errors.

## v2026.10.22 — Migration-sync CI check and Kannada font fix

[PR #15](https://github.com/ananthmkhobby/samskara/pull/15) — two real changes. Adds a CI job (`check-migrations-synced`) that fails if `supabase/migrations/` isn't actually applied to the relevant Supabase project — built after discovering the prior release's migrations had reached the test database but never production, silently breaking a shipped feature until a user hit it. Currently a loud no-op until `SUPABASE_ACCESS_TOKEN` is added as a repo secret (documented in `docs/ENVIRONMENTS.md`). Also self-hosts a Kannada-script font subset (`Noto Serif Kannada`, ~120KB, unicode-range scoped) after a Kannada blog post was found rendering in a visibly different typeface than its English sibling, since none of the existing font stacks cover the Kannada Unicode block.

This release also closes out a same-day infrastructure detour, unrelated to the app code: a GitHub-wide incident paused webhook deliveries, which stalled the test project's auto-deploy; disconnecting/reconnecting the Vercel Git integration as a response (a reasonable thing to try) had the side effect of silently resetting the test project's Production Branch tracking from `dev` back to the default `main`, even though `samskara-koaham.vercel.app` stayed assigned as a Production domain. Both fully diagnosed and fixed at the infrastructure level (Vercel dashboard → Settings → Environments → Production → Branch Tracking → `dev`) — confirmed afterward that production's own branch/domain config (`main` → `oursamskara.com`) was never touched, and that both Supabase projects have all 63 migrations in sync.

Verified on the test environment first (`samskara-koaham.vercel.app`): confirmed the Kannada font loads (`document.fonts` reports it `loaded`) and renders correctly on the live Kannada post.

Verified post-deploy: production bundle updated (`index-1kgPO5DG.js`), no console errors, Kannada font confirmed loaded on the live post (`/blog/-`), title still shows only once (the duplicate-title content fix from the prior release held).

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
