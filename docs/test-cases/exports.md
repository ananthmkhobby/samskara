# PDF exports (photobook, biography, Vamshavali)

### 2026-10-09 — family photobook for large families *(backfilled)*

**Change:** `23fe6cd` — fix family photobook PDF for large families

**Problem:** the photobook was built in memory and streamed as one HTTP
response — Vercel caps every serverless response at 4.5MB regardless of
plan, so a family with enough real photos would fail with a raw platform
error, not a readable one. `MAX_FAMILY_BOOK_PEOPLE = 80` had been a proxy
cap for this, already exceeded by at least one real family on the live
archive.

**Steps:** Routed the finished PDF through a new private `family-exports`
Storage bucket (service-role only, no RLS policies needed) instead of the
response body; the endpoint now returns a small signed-URL JSON payload.
Removed the people-count cap, since the real constraint — response size —
no longer applies. Seeded a disposable test family above the old 80-person
cap and confirmed the download now returns `{url}` and that URL serves a
real, complete PDF.

**Result:** pass

**Environment:** local dev server (pre-split pipeline)
