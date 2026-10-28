// Vercel serverless function — Share Preview Service (MVP: Gallery photo
// only). See docs/SHARE_PREVIEW_SERVICE.md for the full requirements doc
// and the engineering decisions behind this file's shape.
//
// Two very different jobs share this one file, same hybrid pattern
// api/broadcast.js already uses for its own cron branch:
//
//   GET  /api/share?type=g&token=...  — public, unauthenticated. Routed
//        from /s/g/:token (vercel.json). Reads the built dist/index.html
//        shell (same trick api/blog-post.js uses) and injects the
//        share's APPROVED preview fields as OG meta tags. Never renders
//        the real photo — a bare GET here has no way to know who's
//        asking (this app's auth is bearer-token/localStorage-based, not
//        cookies), so the real photo is resolved client-side after the
//        SPA boots, under the same Postgres RLS that already gates every
//        other read in this app. See SharedPhotoLanding.jsx.
//
//   POST /api/share  — action-discriminated, same shape as every other
//        multi-action endpoint in this project: create / revoke / status
//        (authenticated, bearer token) / resolve / log-event (both
//        public — the client needs resolve to turn a token into a
//        content_id before it can query the real photo under its own
//        RLS, since share_links has no client-readable policy at all;
//        log-event is a best-effort analytics beacon, same posture as
//        track-click.js).
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { serviceClient, requireMember } from "./_memberAuth.js";

const PREVIEW_BUCKET = "share-previews";

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function appUrl(req) {
  return process.env.APP_URL || `https://${req.headers.host}`;
}

// ---------------------------------------------------------------------
// GET — public landing page (crawler + a human's very first HTML load).
async function handleLanding(req, res) {
  const type = (req.query.type || "").trim();
  const token = (req.query.token || "").trim();

  let shell;
  try {
    shell = await readFile(path.join(process.cwd(), "dist", "index.html"), "utf8");
  } catch {
    res.status(500).send("Build output not found.");
    return;
  }

  const base = appUrl(req);
  const fallbackImage = `${base}/icon-512.png`;
  const canonical = `${base}/s/${encodeURIComponent(type)}/${encodeURIComponent(token)}`;

  // Only "g" (gallery photo) exists for MVP — any other type, or a
  // missing/unknown/revoked/expired token, gets the same safe generic
  // card. Never distinguish "wrong token" from "revoked" from "expired"
  // to a public, unauthenticated request — same posture gallery-export.js
  // already uses for its own code lookups.
  let title = "A memory on Samskara";
  let description = "Someone shared a memory with you on Samskara — your family's living record.";
  let image = fallbackImage;

  if (type === "g" && token) {
    const supabase = serviceClient();
    const { data: share } = await supabase
      .from("share_links")
      .select("id, status, expires_at, share_previews(approved_title, approved_description, preview_image_mode, preview_image_path)")
      .eq("token", token)
      .eq("content_type", "gallery_photo")
      .maybeSingle();

    const preview = share?.share_previews;
    const stillActive = share && share.status === "active" && (!share.expires_at || new Date(share.expires_at) > new Date());
    if (stillActive && preview) {
      title = preview.approved_title || title;
      description = preview.approved_description || description;
      if (preview.preview_image_mode === "photo" && preview.preview_image_path) {
        image = `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/${PREVIEW_BUCKET}/${preview.preview_image_path}`;
      }
    }
  }

  const html = shell
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(
      "</head>",
      [
        `<link rel="canonical" href="${canonical}">`,
        `<meta name="robots" content="noindex">`,
        `<meta property="og:type" content="website">`,
        `<meta property="og:title" content="${escapeHtml(title)}">`,
        `<meta property="og:description" content="${escapeHtml(description)}">`,
        `<meta property="og:url" content="${canonical}">`,
        `<meta property="og:image" content="${image}">`,
        `<meta name="twitter:card" content="summary_large_image">`,
        `<meta name="twitter:title" content="${escapeHtml(title)}">`,
        `<meta name="twitter:description" content="${escapeHtml(description)}">`,
        "</head>",
      ].join("\n    ")
    );

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Short cache — a revoke should stop showing the old preview reasonably
  // soon, same TTL reasoning as blog-post.js's own cache header.
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=600");
  res.status(200).send(html);
}

// ---------------------------------------------------------------------
// POST action: create
async function handleCreate(req, res) {
  const { contentType, contentId, previewTitle, previewDescription, previewImageMode, previewImagePath } = req.body || {};
  if (contentType !== "gallery_photo" || !contentId) {
    res.status(400).json({ error: "Unsupported content type." });
    return;
  }
  if (!previewTitle?.trim() || !previewDescription?.trim()) {
    res.status(400).json({ error: "Title and description are required." });
    return;
  }
  if (!["brand", "photo"].includes(previewImageMode)) {
    res.status(400).json({ error: "Unrecognized preview image mode." });
    return;
  }
  if (previewImageMode === "photo" && !previewImagePath) {
    res.status(400).json({ error: "Missing the approved preview image." });
    return;
  }

  const supabase = serviceClient();

  // Resolve family_id, ownership and sharability straight from the
  // contribution row itself — never trust a family id the client sends,
  // and never let a private-to-me or not-yet-Verified photo be shared.
  const { data: contribution, error: contribErr } = await supabase
    .from("contributions")
    .select("id, family_id, type, status, visibility")
    .eq("id", contentId)
    .maybeSingle();
  if (contribErr) { res.status(500).json({ error: contribErr.message }); return; }
  if (!contribution || contribution.type !== "photo") {
    res.status(404).json({ error: "That photo doesn't exist." });
    return;
  }
  if (contribution.status !== "Verified" || contribution.visibility !== "shared") {
    res.status(400).json({ error: "Only a Verified photo that's shared with the family can be shared externally." });
    return;
  }

  try {
    await requireMember(supabase, req, contribution.family_id);
  } catch (err) {
    res.status(403).json({ error: err.message });
    return;
  }
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  const { data: { user } } = await supabase.auth.getUser(token);

  const shareToken = crypto.randomBytes(16).toString("base64url");

  try {
    const { data: share, error: shareErr } = await supabase
      .from("share_links")
      .insert({
        token: shareToken, content_type: "gallery_photo", content_id: contentId,
        family_id: contribution.family_id, owner_id: user.id,
      })
      .select("id")
      .single();
    if (shareErr) throw new Error(shareErr.message);

    const { error: previewErr } = await supabase.from("share_previews").insert({
      share_id: share.id,
      approved_title: previewTitle.trim().slice(0, 100),
      approved_description: previewDescription.trim().slice(0, 300),
      preview_image_mode: previewImageMode,
      preview_image_path: previewImageMode === "photo" ? previewImagePath : null,
      approved_by: user.id,
    });
    if (previewErr) throw new Error(previewErr.message);

    await supabase.from("share_events").insert({ share_id: share.id, event_type: "share_created" });

    res.status(201).json({ shareId: share.id, token: shareToken, shareUrl: `${appUrl(req)}/s/g/${shareToken}`, status: "active" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't create that share link." });
  }
}

// ---------------------------------------------------------------------
// POST action: revoke
async function handleRevoke(req, res) {
  const { shareId } = req.body || {};
  if (!shareId) { res.status(400).json({ error: "Missing shareId." }); return; }

  const supabase = serviceClient();
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) { res.status(401).json({ error: "Not signed in." }); return; }
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) { res.status(401).json({ error: "Your session has expired — please reload and sign in again." }); return; }

  const { data: share, error: findErr } = await supabase
    .from("share_links").select("id, owner_id").eq("id", shareId).maybeSingle();
  if (findErr) { res.status(500).json({ error: findErr.message }); return; }
  if (!share || share.owner_id !== user.id) { res.status(403).json({ error: "You can only revoke your own share links." }); return; }

  try {
    await supabase.from("share_links").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", shareId);
    await supabase.from("share_events").insert({ share_id: shareId, event_type: "share_revoked" });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't revoke that link." });
  }
}

// ---------------------------------------------------------------------
// POST action: status — "does an active share already exist for this
// photo, owned by me" — lets the Gallery UI show the existing link
// instead of the creation form.
async function handleStatus(req, res) {
  const { contentType, contentId } = req.body || {};
  if (contentType !== "gallery_photo" || !contentId) { res.status(400).json({ error: "Missing content." }); return; }

  const supabase = serviceClient();
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) { res.status(401).json({ error: "Not signed in." }); return; }
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) { res.status(401).json({ error: "Your session has expired — please reload and sign in again." }); return; }

  const { data: share, error } = await supabase
    .from("share_links")
    .select("id, token, status")
    .eq("content_type", contentType).eq("content_id", contentId).eq("owner_id", user.id).eq("status", "active")
    .maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(200).json({ share: share ? { shareId: share.id, shareUrl: `${appUrl(req)}/s/g/${share.token}` } : null });
}

// ---------------------------------------------------------------------
// POST action: resolve — public, unauthenticated. Turns a token into the
// bare content_type/content_id SharedPhotoLanding.jsx needs to then query
// the real photo itself, under the visitor's own session and RLS. Never
// returns anything else about the share or the photo — an id alone is
// meaningless without a database session that RLS actually lets read it,
// so handing it to an unauthenticated visitor discloses nothing real.
async function handleResolve(req, res) {
  const { token } = req.body || {};
  if (!token) { res.status(400).json({ active: false }); return; }

  const supabase = serviceClient();
  const { data: share } = await supabase
    .from("share_links")
    .select("status, expires_at, content_type, content_id")
    .eq("token", token)
    .maybeSingle();

  const stillActive = share && share.status === "active" && (!share.expires_at || new Date(share.expires_at) > new Date());
  if (!stillActive) { res.status(200).json({ active: false }); return; }

  res.status(200).json({ active: true, contentType: share.content_type, contentId: share.content_id });
}

// ---------------------------------------------------------------------
// POST action: log-event — public, best-effort, fire-and-forget, same
// posture as track-click.js. Called from SharedPhotoLanding.jsx and the
// Gallery share modal's own WhatsApp/copy buttons.
async function handleLogEvent(req, res) {
  const { token, eventType } = req.body || {};
  const VALID = ["share_opened", "access_granted", "access_denied", "share_wa_clicked", "share_copied"];
  if (!token || !VALID.includes(eventType)) { res.status(200).json({ ok: true }); return; }

  try {
    const supabase = serviceClient();
    const { data: share } = await supabase.from("share_links").select("id").eq("token", token).maybeSingle();
    if (share) await supabase.from("share_events").insert({ share_id: share.id, event_type: eventType });
  } catch (err) {
    console.error("share_events insert failed:", err.message);
  }
  res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    await handleLanding(req, res);
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { action } = req.body || {};
  if (action === "create") return handleCreate(req, res);
  if (action === "revoke") return handleRevoke(req, res);
  if (action === "status") return handleStatus(req, res);
  if (action === "resolve") return handleResolve(req, res);
  if (action === "log-event") return handleLogEvent(req, res);
  res.status(400).json({ error: "Unknown action." });
}
