# WhatsApp contribution flow

### 2026-10-09 — privacy choice, profile-pic shortcut *(backfilled)*

**Change:** `23fe6cd` — add WhatsApp privacy choice and profile-pic shortcut

**Steps:** Simulated WhatsApp webhook POSTs end-to-end against a disposable
test family: photo → person match → story → `WAITING_FOR_PRIVACY_CHOICE`
prompt → both `PRIVATE` and `SHARE` replies. Verified a `PRIVATE`
contribution's `visibility` column and that it was excluded from the
family's shared Gallery/Folio for a different test member, reusing the
same cross-user RLS checks already proven for the web upload path.
Separately simulated a photo sent with the caption "profile pic" for a
phone number linked to a test person with an existing `photo_path`:
confirmed the photo updated immediately and the old photo appeared as a
new private contribution under that same member's "Private to me" tab.

**Result:** pass

**Environment:** local dev server (pre-split pipeline)

**Cleanup:** disposable test family, WhatsApp connections, and Storage
objects removed after verification.
