// Vercel serverless function — the first cross-origin-callable, no-session
// endpoint in this project. Lets an external, loginless partner (today:
// ScanJunction's photo editor) redeem a family's gallery_export_codes
// code and get back that family's Verified photos as signed URLs, with
// nothing else exposed. There is no bearer token here at all — the code
// itself, checked against the DB (unrevoked, unexpired), is the entire
// authorization. See the gallery_export_codes migration for why this is
// deliberately NOT the invites pattern (reusable, read-only).
import { serviceClient } from "./_memberAuth.js";

const BUCKET = "family-media";
const SIGNED_URL_TTL_SECONDS = 1800; // 30 min — a real third-party browsing
// session on ScanJunction's side (picking photos in a grid), not one
// immediate server-side fetch like photobook-family.js's 300s. The code is
// reusable, so a longer session can just redeem it again for fresh URLs.

// Never '*' — this hands out signed URLs to real private photos. A
// wildcard would let any site's script redeem a leaked/guessed code via a
// victim's own browser. Must be the partner's exact origin.
const ALLOWED_ORIGIN = process.env.SCANJUNCTION_ALLOWED_ORIGIN;

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    // So no shared cache ever serves this origin's CORS headers to a
    // different Origin.
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  applyCors(req, res);

  // Preflight must always succeed structurally — the actual POST below is
  // what gets rejected if the origin or config is wrong.
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!ALLOWED_ORIGIN) {
    res.status(500).json({ error: "This isn't configured on this deployment yet." });
    return;
  }
  if (req.headers.origin !== ALLOWED_ORIGIN) {
    // Browsers already block the response body cross-origin without a
    // matching Access-Control-Allow-Origin header, but reject explicitly
    // too — defends non-browser callers (curl, server-to-server) and makes
    // the intent unambiguous rather than relying solely on CORS enforcement.
    res.status(403).json({ error: "Not an authorized origin." });
    return;
  }

  const { code } = req.body || {};
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Missing code." });
    return;
  }

  const supabase = serviceClient();

  const { data: exportCode, error: codeErr } = await supabase
    .from("gallery_export_codes")
    .select("id, family_id")
    .eq("code", code.trim().toUpperCase())
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (codeErr) {
    res.status(500).json({ error: "Something went wrong." });
    return;
  }
  if (!exportCode) {
    // Deliberately generic — never distinguish wrong/expired/revoked to an
    // unauthenticated caller. That distinction only ever shows in the
    // Head/Admin's own Admin UI.
    res.status(404).json({ error: "This code is invalid or has expired." });
    return;
  }

  const { data: photoRows, error: photoErr } = await supabase
    .from("contributions")
    .select("id, content, contributor, date, person_id")
    .eq("family_id", exportCode.family_id)
    .eq("type", "photo")
    .eq("status", "Verified")
    // Runs under the service role (bypasses RLS) — a private photo must
    // never leave the family's own archive via this external-facing export.
    .eq("visibility", "shared");
  if (photoErr) {
    res.status(500).json({ error: "Something went wrong." });
    return;
  }

  // One batched lookup, not N+1.
  const personIds = [...new Set(photoRows.map((r) => r.person_id).filter(Boolean))];
  let namesById = new Map();
  if (personIds.length) {
    const { data: peopleRows } = await supabase
      .from("people").select("id, name").eq("family_id", exportCode.family_id).in("id", personIds);
    namesById = new Map((peopleRows || []).map((p) => [p.id, p.name]));
  }

  const photos = (await Promise.all(photoRows.map(async (row) => {
    if (!row.content) return null;
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(row.content, SIGNED_URL_TTL_SECONDS);
    if (!signed?.signedUrl) return null;
    return {
      photoUrl: signed.signedUrl,
      contributor: row.contributor || null,
      date: row.date || null,
      personName: row.person_id ? (namesById.get(row.person_id) || null) : null,
    };
  }))).filter(Boolean);

  // Non-blocking audit trail — must never fail the actual export response.
  supabase.from("gallery_export_codes").update({ last_used_at: new Date().toISOString() }).eq("id", exportCode.id)
    .then(() => {}, () => {});

  res.status(200).json({ photos });
}
