# Samskara Share Preview Service

Requirements document (original PRD, verbatim) + engineering adaptation
notes + what was actually built. MVP scope only: one Gallery photo,
members-only audience, branded-or-approved-photo preview. Everything
marked Phase 2/3 or P1 in the original PRD is explicitly deferred.

## Part 1 — Original PRD (verbatim, 28 October 2026, v1.0)

> Decision: build a reusable, privacy-first sharing platform, launch first
> with one existing Gallery photo, then expand to Folios, Challenges,
> Tributes and Events.

See the full original document pasted into this session for the complete
text (executive summary, goals/non-goals, user stories, FR-01 through
FR-12, privacy/security policy, reference architecture, data model, API
design, Gallery MVP journey, work breakdown, acceptance criteria,
analytics, phase gates, and open decisions). The sections below record
what changed on contact with this actual codebase, and why.

## Part 2 — Engineering adaptation notes

### The central mismatch: this is not a Next.js app

The PRD's whole metadata/OG strategy (`generate-metadata`, streamed
metadata, Next.js App Router) assumes a server-rendering framework. This
app is a **Vite SPA**: one `index.html` shell, one client bundle, every
route rewritten to that same shell by `vercel.json` (`/((?!api/).*)` →
`/index.html`). There is no server-side rendering anywhere in this
project today, with one precedent: `api/blog-post.js`, a Vercel
serverless function that reads the built `dist/index.html`, injects
per-post `<title>`/OG meta tags via string replacement, and serves that
to whoever asked — crawler or human, same response.

**Decision: the share landing page reuses this exact pattern.**
`GET /api/share?type=g&token=...` (routed from `/s/g/:token` via a new
`vercel.json` rewrite, placed *before* the catch-all SPA rewrite so it
matches first) reads `dist/index.html`, injects `og:title`/`og:description`/
`og:image`/`og:url` from the share's **approved** preview fields, and
returns that HTML. A crawler (WhatsApp, Facebook, etc.) that never
executes JS sees exactly the approved preview and nothing else — FR-03 and
AC-01 satisfied the same way blog posts already satisfy them.

**Why there's no server-rendered photo body** (unlike blog-post.js, which
*does* server-render the full article): a blog post is fully public by
design — there is nothing to authorize. A shared photo is not. Rendering
anything beyond the pre-approved preview metadata server-side would mean
either (a) querying the original private photo with no way to check *who's
asking* (this endpoint has no access to the visitor's Supabase session —
auth here is bearer-token/localStorage-based, not cookies, so a bare GET
request genuinely cannot know who's visiting), or (b) skipping
authorization entirely, which the PRD explicitly forbids (FR-04, AC-03,
AC-04, AC-10). So the server only ever hands back the **approved preview**
— never the real photo — and the real photo is resolved **client-side**,
after the SPA boots, using the same authenticated Supabase client and the
same Postgres RLS policies that already gate every other read in this app.

This also answers PRD §7's "content adapter" question for free, for MVP
scope: `contributions` already has RLS scoped to `current_family_id()`.
A signed-in visitor's own browser queries `contributions` for the shared
photo's row by id; Postgres returns it if and only if they're a real
member of that family. No bespoke `authorizeViewer()` function needed —
the database already *is* that function. (A future content type — Folio,
Challenge — would reuse this same shape: approved preview server-side,
real content resolved client-side under existing RLS.)

### Where things live

| PRD concept | This codebase |
|---|---|
| `POST /api/shares` | `POST /api/share` with `action: "create"` |
| `GET /api/shares/{id}` | `POST /api/share` with `action: "status"` (looked up by content, not share id — the UI only ever needs "does an active share already exist for this photo") |
| `PATCH /api/shares/{id}` | not built for MVP — editing an approved preview is explicitly P1 (FR-10) |
| `POST /api/shares/{id}/revoke` | `POST /api/share` with `action: "revoke"` |
| `GET /s/{type}/{token}` | `GET /api/share?type=g&token=...`, routed via `vercel.json` |
| `GET /api/shares/{id}/insights` | not built for MVP — P1 (FR-12's admin/insights half) |
| `share_grants` table | not built for MVP — "invite-only" audience is P1 (FR-11); MVP ships "members only" (any signed-in member of the owner's family) only |

### The Hobby-plan question, resolved

Every other feature shipped this cycle (push, the superadmin broadcast,
ScanJunction's export) got folded into an existing serverless function to
stay under Vercel's Hobby-plan 12-function cap. This feature got its own
file, `api/share.js` — a public token resolver mixed into an unrelated
admin endpoint would have hurt clarity more than the fold was worth, and
the project moved to Vercel Pro specifically to make room for it.

### Preview images: a new public bucket, never the original

The PRD is explicit that the real photo must never be reachable via a
public/signed URL in OG metadata (§6), and that nothing should be copied
into publicly-readable storage without explicit per-share consent (FR-08).
This app already has exactly this precedent: `family-media` is private,
`blog-media` is public, and nothing in the private bucket is ever exposed
through the public one.

A new bucket, **`share-previews`** (public), holds only what an owner
explicitly approved for exactly this one share:

- **Brand mode** (default): no upload at all. The landing page's `og:image`
  points at the app's existing `/icon-512.png` — a generic Samskara mark,
  never a family photo.
- **Photo mode** (explicit opt-in — PRD's "Use this photo" checkbox): the
  browser resizes the chosen photo client-side (same canvas-based approach
  `imageResize.js` already uses for ordinary uploads — nothing new there)
  and uploads *that derived copy* to `share-previews`, never the original
  file or its real storage path. Revoking the share does not delete this
  copy for MVP (a known, accepted gap — see §6 of the PRD: "a revocation
  blocks future app access... external cached thumbnails may persist,"
  and the same logic applies to this one derived asset sitting in public
  storage even after revoke).

### Data model actually shipped

Three tables, `supabase/migrations/20261028120000_share_preview_service.sql`:

- **`share_links`** — token (plain, unique, high-entropy — see below),
  content_type/content_id, family_id, owner_id, audience (`'members'`
  only for MVP, column kept open for later), status, expiry, timestamps.
  **No client RLS policies at all** — every read/write goes through
  `api/share.js` under the service role, same posture this project already
  uses for `notification_log`/`whatsapp_connections`. A share token must
  never be reachable via a client-side `select`, even an authorized one.
- **`share_previews`** — one row per share: approved title/description,
  preview mode, preview image path. Same no-client-policy posture.
- **`share_events`** — `share_created` / `share_opened` / `access_granted`
  / `access_denied` / `share_wa_clicked` / `share_copied` /
  `share_revoked` (`content_contribution` deferred — nothing in this MVP
  distinguishes a contribution that originated from a share click yet).
  Minimal columns only (no device/referrer granularity — that's P1).

**Token storage**: plain text, not an HMAC/hash as the PRD suggests. This
matches every other token-as-locator pattern already in this codebase
(`invites.code`, `gallery_export_codes.code`, WhatsApp link tokens) — all
stored in plaintext, all treated as a locator re-validated server-side on
every use, never as proof of authorization by themselves. 16 random bytes,
base64url-encoded (`crypto.randomBytes(16).toString("base64url")`,
~128 bits of entropy, matching the PRD's own suggestion), satisfies AC-07's
anti-enumeration requirement without needing a second hashed column.

### What's explicitly out of scope for this round

Everything the PRD itself marks Phase 2/3 or P1: Folio/Challenge/Tribute/
Event content types, invite-only and anyone-with-link audiences, editing
an approved preview with cache-busting, rate limiting/abuse reporting,
admin insights dashboard, password/PIN-gated sharing, and deleting the
public preview-image copy on revoke. The data model and API shape were
built to make adding these later straightforward (the content-type/token
split already generalizes), but none of it is implemented now.

## Part 3 — Acceptance criteria actually verified

See the implementation PR / changelog entry for which of the PRD's
AC-01 through AC-11 were verified end-to-end before shipping, and which
don't apply because the underlying feature (P1 items above) wasn't built.
