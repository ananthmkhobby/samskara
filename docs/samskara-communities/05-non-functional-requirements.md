# 05 — Non-Functional Requirements

Context: residents on mid-range Android phones, patchy 4G at a crowded festival venue (hundreds of devices on one cell), and WhatsApp as the entry point (in-app browser). Targets are sized for **one pilot community** (100-500 flats), not a hypothetical fleet.

## 1. Performance (mobile-first, low bandwidth)

### 1.1 Upload pipeline
- **NFR-P1** Images are resized on the client before upload (`src/lib/imageResize.js`): long edge ≤ 2048 px, JPEG quality ~0.82. Target ≤ 600 KB median per photo. EXIF GPS is stripped. Orientation and capture date are kept.
- **NFR-P2** dHash is computed on the client (`src/lib/imageHash.js`) in ≤ 150 ms per image on a mid-range Android device. Hashing must not block the UI thread for more than 50 ms at a time.
- **NFR-P3** Uploads go into a queue: at most 2 concurrent transfers, each file retried up to 5 times with exponential backoff (2s, 4s, 8s, 16s, 32s plus jitter). The queue is kept in IndexedDB so that closing the WhatsApp in-app browser or losing signal doesn't lose the selection. Queued items resume when the page reopens with the same session.
- **NFR-P4** Videos over 20 MB use chunked/resumable upload (Supabase Storage TUS or equivalent). Images may upload in a single request.
- **NFR-P5** Each queued item shows its own status (queued / uploading % / done / failed-retrying / failed). A failed item can be retried by hand without re-selecting files.
- **NFR-P6** Duplicate submission is idempotent: retrying an item that the server already received doesn't create a second contribution (a client-generated UUID per item).

### 1.2 Viewing
- **NFR-P7** Album grids load thumbnails (≤ 400 px, ≤ 40 KB) lazily. Full images load only when opened.
- **NFR-P8** On a simulated "Fast 3G" profile (1.6 Mbps, 150 ms RTT): first contentful paint of the community timeline ≤ 3 s, and first row of album thumbnails ≤ 4 s.
- **NFR-P9** Timeline and album queries are paginated (≤ 60 items per page) and return in ≤ 500 ms p95 server time at pilot data volume.
- **NFR-P10** The upload page reached from the QR (J4) works in the WhatsApp/Instagram in-app browser and in Chrome/Safari without installation. JS for that route is ≤ 200 KB gzipped.

### 1.3 Moderation
- **NFR-P11** The moderation queue renders 500 pending items with duplicate grouping in ≤ 3 s on a laptop/desktop, and bulk actions on 500 items finish in ≤ 10 s.

## 2. Security and privacy baseline

- **NFR-S1** Tenant isolation: every community table has RLS enabled, keyed on `community_members` through `current_community_id()`/membership checks. Community and family RLS surfaces never reference each other (see FR MB-9, PL-2). An automated RLS test suite covers: non-member, pending member, former member, guest, resident, moderator, admin.
- **NFR-S2** `community_contributions` is a structurally separate table from `contributions`. It shares no FKs or policies with it.
- **NFR-S3** Storage buckets/paths are separated by tenant type. Media is served only via short-lived signed URLs (≤ 1 hour). There are no public bucket URLs.
- **NFR-S4** Event upload tokens and guest sessions are high-entropy (≥ 128 bits), time-boxed, revocable, and stored hashed. Their design follows `supabase/migrations/20260930120000_content_shares.sql` and `20260930120100_content_share_single_use.sql`.
- **NFR-S5** Guest OTP endpoints are rate-limited: ≤ 5 OTP requests per phone per hour and ≤ 30 per IP per hour.
- **NFR-S6** Server-side operations use the existing `serviceClient()` pattern only in API routes, never in the client. Twilio inbound requests are signature-validated with the existing helper.
- **NFR-S7** Children's protection (decision #4): restricted media is never shown in thumbnails, covers, counts, AI calls, search results or share links to anyone outside uploader + moderators. This is enforced at the RLS/storage layer, not only in the UI.
- **NFR-S8** DPDP readiness (enforcement around May 2027): store notice/consent acknowledgements with policy version; support erasure of a person's uploads within 30 days of request; keep audit logs for 2 years; follow a documented breach-notification runbook. Verifiable parental consent isn't built for the MVP. The restricted-by-default flow is the interim control, to be revisited before May 2027.
- **NFR-S9** EXIF location data is stripped before storage (see P1).
- **NFR-S10** A design doc is approved under `docs/SDLC.md` before the first migration. Migrations are append-only and follow `docs/GIT_WORKFLOW.md` (dev → main → master).

## 3. Scalability assumptions (pilot-sized)

| Dimension | Pilot assumption | Design headroom |
|---|---|---|
| Communities | 1 (possibly 2-3) | 10 without changes |
| Members | ≤ 1,000 accounts | 5,000 |
| Events / year | ~20 | 50 |
| Uploads / big festival | 1,000-3,000 items | 10,000 |
| Peak concurrent uploaders | ~100 during the event | 300 |
| Storage / year | ~20-40 GB (images at ~600 KB + some video) | 200 GB |

- **NFR-SC1** No sharding, queues, CDN rewrites or background-worker infrastructure beyond what Supabase plus Vercel already provide.
- **NFR-SC2** Serverless functions: Vercel Pro is assumed (decision #3). New community endpoints may add functions. The design should still group related routes per file, to keep things simple rather than because of the cap.
- **NFR-SC3** Storage and bandwidth costs at the volumes above go into the cost model, together with the Vercel Pro fee and the Utility-only WhatsApp cost (~₹3-3.5k/year).

## 4. Availability and durability
- **NFR-A1** Durability is the product promise. No hard-delete of published media except through an explicit, logged admin erasure action. Rejected items are soft-deleted and purged after 30 days.
- **NFR-A2** Supabase daily backups are enabled. Restore of the database plus storage manifest is tested once before the pilot festival.
- **NFR-A3** There is no formal uptime SLA for the pilot. Planned downtime must avoid the pilot's festival dates (published to ops in advance).

## 5. Accessibility and usability
- **NFR-U1** WCAG 2.1 AA for colour contrast, focus visibility and labelled controls on the upload, timeline and moderation screens.
- **NFR-U2** Tap targets ≥ 44×44 px. The upload flow takes at most 3 taps from QR scan to file picker for a signed-in member.
- **NFR-U3** UI strings are externalized. The pilot ships English plus the pilot society's dominant regional language if the pilot needs it (decided once the pilot society is chosen).
- **NFR-U4** It works with system font scaling up to 200% without hiding critical controls.
- **NFR-U5** Usable without an app install (PWA/web). Native app parity isn't required for the pilot.

## 6. Observability
- **NFR-O1** Logged per event: QR scans, upload starts/completions/failures (with retry count), moderation throughput (items per moderator hour), time from upload to publish, and resident views. These are the pilot's validation metrics.
- **NFR-O2** Logs contain no media content or phone numbers in plain text.

## 7. Explicit non-goals
- Multi-community admin consoles, self-serve billing, or automated society verification.
- Horizontal scale beyond the table above. No load testing beyond ~300 concurrent uploaders.
- Blur detection, face clustering and face recognition (Phase 2/3, only with pilot evidence).
- Native iOS/Android apps for Communities.
- Offline viewing of albums.
- Any outbound promotional messaging infrastructure.
- Any ops-app functionality (visitor, billing, parking, security).
