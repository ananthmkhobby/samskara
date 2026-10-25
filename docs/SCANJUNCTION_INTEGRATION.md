# Samskara ↔ ScanJunction gallery export

How ScanJunction's photo editor pulls a family's photos out of Samskara.
This is a one-way, read-only export — Samskara never calls into
ScanJunction, and nothing ScanJunction does can write back into a family's
archive.

## How it works, in short

1. Inside Samskara, a family's Head or Admin generates a short code
   (Admin → "Gallery export" — see their own in-app UI for this; not
   covered here).
2. They give that code to ScanJunction's editor — however that handoff
   happens on your side (pasted in, typed in, etc.).
3. Your editor calls the endpoint below with that code and gets back a
   list of the family's Verified, shared photos as temporary signed URLs.
4. The code can be redeemed more than once (it's not single-use) — each
   redemption returns fresh signed URLs, valid for 30 minutes. Treat it
   like a session token for as long as someone's actively using the
   editor, not a one-time secret.
5. A code expires 24 hours after it's created, or sooner if the family
   revokes it from their own Admin screen. After that, redeeming it
   returns a 404 — there's no way to tell from the response alone whether
   it expired, was revoked, or was never valid, by design.

## Endpoint

```
POST https://samskara-koaham.vercel.app/api/gallery-export   (test)
POST https://oursamskara.com/api/gallery-export               (production — not live yet, see below)
```

**Request**

```json
{ "code": "ABCD1234" }
```

- `code` — the string the family gave you, case-insensitive (we uppercase
  it server-side before matching).

**Response — 200 OK**

```json
{
  "photos": [
    {
      "photoUrl": "https://....supabase.co/storage/v1/object/sign/...",
      "contributor": "Prathima",
      "date": "2026-07-31",
      "personName": "Ramachandra Rao"
    }
  ]
}
```

- `photoUrl` — a signed URL, valid for **30 minutes** from the moment you
  redeem the code. Fetch/display it promptly; if your editor session runs
  longer than that, redeem the code again for fresh URLs rather than
  caching these.
- `contributor` — who added the photo to Samskara. Can be `null`.
- `date` — free-text date as entered by the contributor, not a strict
  `YYYY-MM-DD` guarantee. Can be `null`.
- `personName` — the family member the photo is tagged to, if any. Can be
  `null` (photo not tagged to a specific person).

**Error responses**

| Status | Body | Meaning |
|---|---|---|
| 400 | `{ "error": "Missing code." }` | No `code` in the request body |
| 403 | `{ "error": "Not an authorized origin." }` | Request didn't come from an allow-listed origin (see CORS, below) |
| 404 | `{ "error": "This code is invalid or has expired." }` | Wrong code, expired, or revoked — deliberately indistinguishable |
| 500 | `{ "error": "Something went wrong." }` | Our side broke; safe to retry |

There is no bearer token, API key, or auth header on this endpoint — the
code itself, checked against our database, is the entire authorization.
Don't build any header-based auth into your client for this call.

## CORS

This endpoint only answers requests whose `Origin` header matches an
allow-listed domain — currently `https://www.scanjunction.com` on test.
Calls from any other origin (including a bare `curl` with a spoofed
`Origin` header, or a different ScanJunction environment) get a 403. If
your editor runs on a different origin (staging, a different subdomain,
etc.), tell us and we'll add it — this is a one-line env var change on
our side, not a code change.

## What's only ever exposed

- Only photos (`type = "photo"`), never audio/video/documents/memories.
- Only **Verified** photos — anything still pending moderation never
  appears here.
- Only **shared** photos — anything a family member marked "private to
  me" is excluded, even if verified.
- Nothing outside the one family tied to the code — there's no way to
  enumerate or guess into another family's photos.

## Test vs. production

Only the **test** endpoint is configured right now
(`samskara-koaham.vercel.app`, allow-listing `https://www.scanjunction.com`).
Point your integration there first. The production endpoint
(`oursamskara.com`) doesn't have this feature turned on yet — once your
side is working against test, tell us and we'll configure the production
origin allow-list and env var, then switch you over to the production URL.
No request/response shape changes between the two — just the base URL.

## Trying it yourself

```bash
curl -X POST https://samskara-koaham.vercel.app/api/gallery-export \
  -H "Origin: https://www.scanjunction.com" \
  -H "Content-Type: application/json" \
  -d '{"code":"THECODEYOUWEREGIVEN"}'
```

This succeeds from `curl` because the server checks the `Origin` header
itself, not just relying on browser-enforced CORS. A real browser running
your editor's JavaScript will send its own `Origin` automatically — you
won't need to set it by hand there, it'll just work as long as the editor
is actually served from the allow-listed domain.
