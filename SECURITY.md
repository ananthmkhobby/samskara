# Security

## Reporting a vulnerability

Email **support@oursamskara.com**. This is a small project — expect a
personal reply, not an automated ticket system.

## What's already in place

Stated plainly, with where to verify each claim in the actual code, since a
security doc nobody can check is worth nothing:

- **Per-family data isolation is enforced by Postgres Row Level Security,
  not application code.** Every tenant-scoped table's policies key off
  `current_family_id()` (`supabase/migrations/20260723180000_multitenant_schema.sql`),
  so a bug in the frontend cannot leak one family's data to another — the
  database refuses the query regardless of what the app asks for.
- **No secret is ever committed.** `.env.local` is git-ignored; confirmed
  empty result from `git ls-files | grep env`. All real secrets live in
  Vercel's environment variables, scoped per project (see
  `docs/ENVIRONMENTS.md`) and never shared between test and production.
- **Security headers are set at the edge**, not left to defaults —
  `vercel.json`: HSTS (`Strict-Transport-Security`, 2-year max-age,
  preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Content-Security-Policy: frame-ancestors 'none'`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy`
  that denies geolocation/payment/USB outright.
- **Storage is private by default.** Photos, recordings, and documents are
  never served from a public URL — every read goes through a signed,
  time-limited URL issued server-side with the service-role key. The one
  deliberate exception (`api/gallery-export.js`, the ScanJunction
  partner integration) is a reusable, revocable, read-only code — not a
  bearer token — checked against the database on every use.
- **The service-role key, which bypasses RLS entirely, only ever runs
  server-side** (Vercel serverless functions), never shipped to the
  browser bundle.
- **Anonymous/public endpoints are rate-limited deliberately** — the public
  demo's AI features are capped per day for unauthenticated callers
  (`api/_aiAuth.js`, `supabase/migrations/20260807120000_ai_usage_cap.sql`),
  an atomic increment-and-check so concurrent requests can't race past the
  limit.
- **Passwords are never visible to an Admin after the moment they're set** —
  shown once on-screen during a reset, never stored or logged in plaintext
  anywhere the app controls.

## Known gaps

Tracked openly in `docs/SDLC.md` rather than left implicit: no automated
test suite yet, no error/incident monitoring, no dependency vulnerability
scanning enabled, no account-deletion flow, and Supabase Auth accounts
aren't covered by the backup script (`docs/BACKUPS.md`).

## Scope

This covers the application and its direct infrastructure (Vercel,
Supabase, Twilio, OpenAI). It does not cover the security practices of
those providers themselves — see their own published security
documentation for that.
