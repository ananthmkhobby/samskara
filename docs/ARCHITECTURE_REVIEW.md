# Samskara — Architecture, Security, Scalability & Compliance Review

Version 1.0 — 29 October 2026. A from-scratch review of the system as it
actually exists today (not a restatement of `SECURITY.md`'s own claims —
this cross-checks them against the real code and adds what that document
doesn't cover: performance, scalability, DPDPA, and Meta/WhatsApp
compliance). Every finding below is tied to a real file, migration, or
observed incident — nothing here is generic advice.

## 1. System architecture, as built

**Frontend**: a Vite-built React SPA, no server-side rendering, with
exactly two deliberate exceptions — `api/blog-post.js` and `api/share.js`,
both using the same hand-rolled trick (read the built `dist/index.html`,
inject per-resource `<title>`/OG meta tags via string replacement, return
that HTML) so a crawler sees real per-page metadata without a real SSR
framework. Every other route is the same static shell; client-side
routing is a hand-built `view` state machine in `App.jsx`, not a router
library.

**Backend**: Supabase (managed Postgres + Auth + Storage) as the primary
backend, with ~15 Vercel serverless functions (`api/*.js`) for anything
that genuinely needs the service-role key or third-party secrets (Twilio,
OpenAI, admin actions). The overwhelming majority of reads/writes go
**directly from the browser to Supabase** via `supabase-js`, authorized
entirely by Postgres Row Level Security — the serverless functions are the
exception, not the rule.

**Multi-tenancy**: every tenant-scoped table carries a `family_id`;
`current_family_id()` (a `security definer` SQL function resolving from
`family_members` + `user_preferences.active_family_id`) is the single
source of truth every RLS policy keys off. This is consistently applied —
genuinely the strongest architectural property of this codebase. A
front-end bug cannot leak cross-family data; the database refuses the
query regardless of what the client asks for.

**Hosting split**: two fully separate Supabase projects (test:
`idopzbqxrpiatumxneak`, production: `flvxeoawvuvrlondqnci`, Mumbai region
— `ap-south-1`) and two Vercel projects (`samskara` / `samskara-prod`),
deliberately never sharing data. Now on Vercel Pro (upgraded 2026-10-28),
which removed the 12-serverless-function Hobby cap that shaped a lot of
earlier engineering decisions (see §7).

## 2. Security — the real findings, ranked by severity

### ✅ Fixed (29 Oct 2026): stored XSS via the blog, with session-theft implications

`src/data/blogDb.js`'s `insertPost`/`updatePost` write `body_html`
(whatever a Tiptap editor's `getHTML()` call returns) straight to the
database with **no server-side sanitization** — RLS gates *who* can write
(`is_blog_team()`), never *what*. At render time it's trusted just as
completely: `BlogView.jsx:526` hands it directly to
`dangerouslySetInnerHTML`, and `api/blog-post.js:96` splices it into
server-rendered HTML with **zero escaping** (contrast with the same
file's own `escapeHtml()` calls for the title/description two lines
above — the inconsistency is itself a tell).

The installed Tiptap extensions (`starter-kit`, `extension-link`,
`extension-image`) don't include a raw-HTML node, so a normal editing
session is unlikely to produce a `<script>` tag. But that's a UI
constraint, not a security boundary — any `blog_authors` account (there
can be more than one; `api/blog-team.js` grants access to existing
accounts too) can call the Supabase REST API directly with an arbitrary
`body_html` string, bypassing the editor entirely. Because this app's
auth tokens live in `localStorage`, not an `httpOnly` cookie (standard
for Supabase-js, not a bug by itself — see §2's note below), a successful
injection could exfiltrate **any visitor's session token**, not just
deface the page. The blog is fully public — no sign-in needed to view a
published post — so the exposure is every visitor, not just the family
members this app otherwise protects well.

**Fix shipped**: `isomorphic-dompurify` sanitization (allow-listing the
exact tag/attribute set the installed Tiptap extensions can actually
produce — `p`/`br`/`strong`/`em`/`s`/`u`/`code`/`pre`/`blockquote`/
`h1-h3`/`ul`/`ol`/`li`/`a`/`img`/`hr`, with `href`/`src` restricted to
`https`/`mailto`/relative URLs, no `javascript:`) was added in
`sanitizeBodyHtml()` in `src/data/blogDb.js`, called from both
`createPost` and `updatePost` before anything reaches the database — the
one place both write paths funnel through, so a direct REST call with a
hand-crafted `body_html` is sanitized exactly the same as an editor save.
A second, independent application of the same allow-list was added in
`api/blog-post.js` right before `post.body_html` is spliced into the
server-rendered page, as defense-in-depth for any row written before
this fix (or by a future direct SQL edit) — verified directly: a payload
containing `<script>alert(1)</script>`, an `<img onerror=...>`, and an
`<a href="javascript:...">` all come out stripped to inert markup.
`BlogView.jsx`'s client render was left as `dangerouslySetInnerHTML`
(correct, since the string is already sanitized at write time) but its
comment was corrected — it previously claimed RLS alone made this safe,
which was the actual root cause of the gap.

### 🟠 Medium: two real production incidents this cycle, root cause never pinned down

Twice in the same week, critical production secrets were found stored as
**empty strings** in Vercel — `ADMIN_PROVISION_SECRET` first, then (more
seriously) all three of `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/
`SUPABASE_SERVICE_ROLE_KEY` together. In both cases the *live* deployment
kept working only because it predated whichever moment the dashboard
value was cleared — the next redeploy would have broken production
outright, with no warning. Investigated: not caused by any CI/CD script
in this repo, not another team member (the Vercel team has exactly one
human member), not a connected integration (zero are configured). That
leaves an undiagnosed manual dashboard slip or a platform-side anomaly —
genuinely unresolved. Both were restored and verified functionally, but
**the cause was never found**, which means it can recur.

**Mitigation shipped**: none beyond restoring the values. **Recommended**:
keep an out-of-band backup of every production secret (a password
manager entry, not "it's in Vercel") so a recurrence is a five-minute
fix, not a forensic investigation; consider Vercel's team Audit Log
(Enterprise-tier — the API returned `404` on the current plan when this
was checked) if this happens a third time.

### 🟠 Medium: a service-role key was printed to a terminal transcript earlier this session, rotation never confirmed

Flagged in the moment, recommended rotation via the Supabase dashboard,
**never confirmed done**. This is an open item independent of the review
— worth closing out explicitly rather than letting it age further.

### 🟡 Low-medium: shared-secret model for every admin/cron action

`ADMIN_PROVISION_SECRET` gates every superadmin action
(`api/provision-family.js`, `api/manage-plan.js`, `api/broadcast.js`,
`api/blog-team.js`) and `CRON_SECRET` gates the daily broadcast cron —
both are single shared strings, not per-operator credentials. Fine at
the current one-operator scale; worth replacing with real per-admin
authentication (a `superadmins` table checked against `auth.uid()`,
mirroring `is_moderator()`'s pattern) before adding a second person with
this access, since a shared secret can't be revoked for one person
without breaking it for everyone, and never expires.

### 🟢 What's genuinely solid

- **RLS as the real authorization boundary**, not application code —
  confirmed consistently applied across every tenant table checked this
  session (`contributions`, `people`, `photo_tags`, `share_links`,
  `push_subscriptions`, and more). A frontend bug cannot leak cross-family
  data.
- **Storage is private by default**, signed URLs only; the two public
  buckets (`blog-media`, `share-previews`) are deliberately scoped to
  hold only already-public or explicitly-consented derived content,
  never originals or private family media.
- **Service-role key never reaches the browser bundle** — confirmed by
  the `VITE_` prefix convention being correctly respected everywhere
  checked.
- **Security headers are real, not defaults**: HSTS (2yr, preload),
  `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors
  'none'`, `X-Content-Type-Options: nosniff`, a `Permissions-Policy`
  that denies geolocation/payment/USB — all set at `vercel.json`'s edge
  layer.
- **OG-tag injection is properly escaped** in both `api/blog-post.js`
  and `api/share.js` (the `body_html` gap in §2 is the one place this
  discipline wasn't applied).
- **Share tokens and invite-style codes are never client-readable** —
  `share_links`/`gallery_export_codes`/invite tokens all have zero
  client-facing RLS SELECT policy; every redemption goes through a
  server-side lookup that re-validates on every use, treating the token
  as a locator, never as proof of authorization by itself.

### Session/auth model, stated plainly

Supabase Auth, JWT-based, stored in `localStorage` (the Supabase-js
default) — not a security flaw by itself (this is how the large majority
of SPA+Supabase apps work), but it does mean the blog XSS gap above is
higher-stakes than it would be with `httpOnly` cookies, since any
successful script injection can read the token directly. No MFA option
exists for any account type. Password reset for no-email ("username")
logins is fully manual (a Head/Admin resets and hand-delivers a new
password) — reasonable for the current scale, doesn't scale past a
handful of such accounts per family without real friction.

## 3. Data validation

Mixed, file-by-file rather than a single consistent layer:

- **Client-side**: file type/size checks before upload (`ContributeModal.jsx`,
  `FirstMemoryWizard.jsx` — JPEG/PNG/WebP, size caps), username format
  regex, password length (`≥6` chars — notably short by modern standards;
  worth raising to 8+ with a strength hint), text length caps on share
  previews (100/300 chars) and family broadcasts (65/240 chars).
- **Server-side**: present but inconsistent — `api/share.js` validates
  content ownership and status before allowing a share; `api/push.js`'s
  `send_family_notification` validates length; many other write paths
  (e.g. `blogDb.js`'s `insertPost`) pass client input through with only a
  database `NOT NULL`/`CHECK` constraint as the backstop.
- **Database constraints as the real backstop**: `photo_tags`' `x`/`y`
  range checks, `share_links.audience` enum, `superadmin_broadcast
  .frequency_days >= 1` — a genuinely good pattern where it's used, worth
  extending to more tables (e.g. a length cap on `contributions.body_text`
  at the schema level, not just wherever a particular UI happens to
  enforce one).

**Recommendation**: no single input ever gets validated in exactly two
places by policy — pick a rule (client validates for UX, server/DB
validates for truth) and apply it consistently, since right now whether a
given field is truly protected depends on which code path you're reading.

## 4. Performance

- **Code-splitting**: real and used — most views are `lazy()`-loaded.
  Caught one real production bug this cycle *because* of this (a
  module-level `window.location.search` read inside a lazy-loaded
  component lost a timing race against the app's own boot-time URL
  cleanup — fixed by moving the read to the always-synchronous root
  module instead).
- **Build output has real bloat**: the build consistently warns "chunks
  larger than 500 kB after minification" — the main `index-*.js` bundle
  is ~650KB gzipped-to-~185KB, and `familyTemplate`/`BlogEditorView`
  chunks are 400KB+ each. Worth a real pass at splitting `familyTemplate`
  (likely seed/demo data bundled where it shouldn't need to be) and
  confirming `BlogEditorView` (Tiptap + its extensions) never loads for
  a visitor who isn't a blog author.
- **Image pipeline is disciplined**: every photo is resized to 1600px
  max / JPEG quality 0.85 client-side before upload — predictable,
  bounded file sizes (confirmed via direct DB inspection: real uploaded
  photos cluster well under 1MB). This does **not** extend to video/audio
  — flagged as a real gap in an earlier review this session, still open:
  zero duration/size cap on recorded video/audio, only a *count* cap per
  plan tier, meaning one long recording could be disproportionately
  large relative to the plan's intent.
- **Signed URLs with a 1-year TTL** for media reduces re-signing overhead
  at the cost of a very long-lived credential per photo — reasonable
  trade-off for a private-by-default app, worth noting as the trade-off
  it is.
- **Service worker caching** is a double-edged sword, observed
  repeatedly this session: genuinely good for repeat-visit performance,
  but has caused real, recurring "looks broken, isn't" incidents during
  testing (stale cached bundles surviving a fresh deploy). The
  `/api/`, `/s/` denylist exclusions in `src/sw.js` are correct and
  narrow; the underlying staleness risk is inherent to
  `registerType: 'autoUpdate'` and isn't fully solved by that
  configuration alone.

## 5. Scalability

- **Database**: Supabase-managed Postgres, vertical scaling within
  Supabase's tiers — appropriate for a family-archive product (bounded,
  predictable per-tenant data volume), not a high-throughput
  user-generated-content firehose. No read replicas or sharding, and
  none needed at any scale this product is likely to reach in the
  foreseeable future.
- **Serverless functions**: Vercel Pro removes the function-count ceiling
  that drove real architectural compromises earlier this cycle (multiple
  unrelated features crammed into one file purely to stay under Hobby's
  12-function cap — since split apart into their own files:
  `api/push.js`, `api/manage-plan.js`, `api/broadcast.js`,
  `api/blog-team.js`). Execution-time/concurrency limits are the next
  ceiling, not function count — not yet a concern at current traffic.
- **Push notification fan-out**: `Promise.allSettled` over every
  subscription in a single request (`api/_push.js`'s `sendToUserIds`) —
  fine at tens-to-hundreds of recipients, would need batching/a real
  queue (not a single serverless invocation) in the thousands-plus range.
  The superadmin broadcast is explicitly app-wide (every family, every
  subscriber) and shares this same unbounded-loop implementation — the
  one path most likely to hit this ceiling first.
- **Storage cost scaling**: linear with usage, no surprises — but see §4's
  video/audio cap gap, since that's the one place actual storage spend
  could grow faster than the plan-tier model intends.
- **Multi-tenancy overhead**: negligible — `current_family_id()` is a
  single indexed lookup, not a per-request heavy computation.

## 6. DPDPA (Digital Personal Data Protection Act, 2023) — India

- **Consent**: genuinely well-built. `ConsentGate.jsx` requires opening
  *both* the Privacy Policy and Terms at least once before the checkbox
  even enables, starts unticked, and re-triggers on every policy version
  bump (`POLICY_VERSION` in `src/lib/policy.js`) — this is real,
  specific, affirmative consent, not a pre-ticked box or a passive
  "by continuing" line. This is the single strongest DPDPA-alignment
  property in the app.
- **Data residency**: production Supabase project is hosted in
  `ap-south-1` (Mumbai) — good alignment with DPDPA's data-localization
  expectations for Indian personal data, though worth confirming this
  was a deliberate choice documented somewhere, not an accident of which
  region happened to be selected at signup.
- **Purpose limitation / data minimization**: the private-visibility
  model (`contributions.visibility = 'private'`) and the new photo-tag
  free-text option (no forced identity resolution for someone not in the
  tree) both genuinely support minimizing what's captured — good
  architectural fit, not bolted on.
- **🔴 Gap — Data Principal rights (erasure/correction/access)**: no
  self-service "delete my account" or "export my data" flow exists
  anywhere in the app (confirmed via `SECURITY.md`'s own tracked gap
  list, and via a direct grep this review ran independently — zero
  matches for an account-deletion code path). DPDPA gives data
  principals a right to erasure and correction; today, fulfilling that
  request would be a manual, by-hand operation (consistent with how
  password resets already work, but data erasure is a materially higher
  legal-exposure gap than a password reset ever was).
- **🔴 Gap — Grievance Officer / Consent Manager**: DPDPA requires a
  named grievance officer and a clear redressal mechanism be published;
  `support@oursamskara.com` (from `SECURITY.md`) covers vulnerability
  reports specifically, not a general data-protection grievance channel.
  Worth a dedicated line in the Privacy Policy naming this explicitly,
  not assuming the security contact doubles as it.
- **🟡 Gap — children's data**: the PRD for the Guest-First Memory feature
  explicitly flagged "children's data safeguards" as something needing
  legal review before relying on it — that review was never actually
  done; this app has no age gate or parental-consent flow anywhere, and
  family archives by nature often include photos/data about minors
  contributed by adults. Worth explicit legal review before this scales
  beyond the current pilot stage, not treated as covered by general
  consent alone.
- **Breach notification readiness**: no incident-response runbook or
  monitoring exists (also tracked in `SECURITY.md`'s own gap list) —
  DPDPA has breach-notification timelines; without monitoring, the
  "we didn't know in time to notify" failure mode is a real risk, not
  hypothetical.

## 7. Meta / WhatsApp Business Platform compliance

- **Current state**: Twilio WhatsApp integration exists and works, but
  **only on the Sandbox number** — confirmed this session that
  production's `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/
  `TWILIO_WHATSAPP_FROM` have been empty since the production project's
  original setup (2026-10-15) and were never filled in. **WhatsApp has
  never actually worked on `oursamskara.com`** — this isn't a regression,
  it's an incomplete rollout that's been silently sitting there.
- **The real compliance work was already scoped, not built**: an earlier
  planning pass (`curious-riding-pudding.md`, referenced but not executed
  this cycle) correctly identified that Meta requires separate, explicit
  consent for any business-initiated message outside the 24-hour
  reply window, categorizes messages as Utility vs. the costlier/riskier
  Marketing tier, and requires Business verification + a reviewed Content
  Template per message type before any of it can go out on a real
  number. None of that account-level work (Meta Business verification,
  Twilio Sender registration, template submission) has happened yet —
  it's explicitly account/business-side work, not something further
  engineering alone resolves.
- **What IS built and compliant today**: the existing nudge system
  (`whatsapp_notification_prefs`/`push_notification_prefs`) already
  separates "connected a number" from "agreed to receive proactive
  messages" as two distinct, auditable consent records — exactly the
  separation Meta's own policy expects, built correctly ahead of actually
  needing it.
- **Recommendation**: before any production WhatsApp send goes out,
  complete (in order) Meta Business verification → Twilio Sender
  registration with the "Samskara" display name → template submission
  for every message type that isn't a direct reply within 24 hours. This
  is a business-process checklist, not a code change — flagging it here
  so it isn't lost as "already done" simply because the code path exists.

## 8. Testing, CI, and operational maturity

- **CI** (`.github/workflows/ci.yml`): lint + build on every push, plus a
  migration-sync check that's been a **silent no-op since it was built**
  — it requires a `SUPABASE_ACCESS_TOKEN` repo secret that was never
  added, so it currently emits a warning and passes regardless of
  whether migrations are actually in sync. This exact gap already caused
  a real incident once (a migration reached test but not production,
  silently broke a shipped feature) — the check exists specifically to
  prevent a repeat, and currently cannot.
- **No automated test suite** — acknowledged directly in the CI file's
  own comments as a known, not-yet-filled gap. Every verification this
  session was manual (live database queries, real browser interaction,
  functional round-trip checks) — thorough in the moment, but nothing
  regresses automatically if a future change breaks one of these flows
  silently.
- **No dependency vulnerability scanning** (e.g. `npm audit` in CI,
  Dependabot) — not configured.
- **No error/incident monitoring** (e.g. Sentry) — confirmed absent;
  the only way a production error surfaces today is a user reporting it
  or someone manually checking Vercel function logs.

## 9. Prioritized action list

Ordered by severity × how cheap the fix is — not every `🔴` here is
equally urgent, but the top three are genuinely worth doing before the
next feature push, not deferred further:

1. ✅ ~~Sanitize `body_html` before it's ever written~~ — **fixed 29 Oct
   2026**, see §2.
2. **Confirm the earlier-exposed service-role key was actually rotated**
   — a loose end from before this review, not resolved by anything
   built since.
3. **Add `SUPABASE_ACCESS_TOKEN` as a repo secret** so the
   migration-sync CI check stops being a silent no-op — it already
   exists, it just needs the one missing input to start actually
   enforcing anything.
4. Back up all five production secrets (Supabase URL/anon/service-role,
   `ADMIN_PROVISION_SECRET`, `CRON_SECRET`) somewhere durable outside
   Vercel's own dashboard.
5. ✅ ~~Build a minimal self-service account-deletion/export flow~~ —
   **fixed 29 Oct 2026**, see `docs/ACCOUNT_DELETION.md`.
6. 🟡 Partially done — a Grievance Officer line now exists in the
   Privacy Policy (29 Oct 2026), but with a **placeholder name**; a real
   named individual still needs to be published (DPDPA requires a name,
   not just a role-based email). See `docs/ACCOUNT_DELETION.md`.
7. ✅ ~~Add a duration/size cap on recorded video/audio~~ — **fixed 29
   Oct 2026**: `family-media`'s Storage `file_size_limit` set to 250MB
   (`20261029190000_media_size_caps.sql`, verified it actually rejects an
   oversized upload server-side, bypassing RLS), plus a client-side
   recording-duration cap with a visible countdown and auto-stop (10 min
   video / 20 min audio, `src/hooks/useMediaRecorder.js`).
8. ✅ ~~Move `ADMIN_PROVISION_SECRET` off a shared-string model~~ —
   **fixed 29 Oct 2026**: every human-operator superadmin endpoint now
   authenticates via the caller's own session + a `superadmins` table
   (migration `20261029180000_superadmins.sql`,
   `api/_superadminAuth.js`). `CRON_SECRET` deliberately kept as-is — see
   `docs/ENVIRONMENTS.md`.
9. Address the 500KB+ bundle-size warnings — `familyTemplate` and
   `BlogEditorView` are the two worth a direct look first.
10. Complete the Meta/Twilio business-verification checklist before any
    production WhatsApp send — a business-process task, not engineering,
    but blocking real use of an already-built feature.
