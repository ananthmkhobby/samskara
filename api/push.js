// Vercel serverless function — per-family Web Push sends. Split out of
// api/reset-member-password.js (2026-10-28), where these three actions
// lived purely to stay under Vercel's Hobby-plan 12-function cap; now
// that the project is on Pro, this gets its own file, since "push
// notifications" and "reset a member's password" were never actually
// related. The app-wide superadmin broadcast (a different, unrelated
// thing — not scoped to one family) lives in api/broadcast.js instead.
//
// action: "send_test_push" — sends one Web Push notification to the
// caller's own subscriptions, to prove the whole pipeline (subscribe ->
// save -> encrypt -> push service -> OS notification) end to end. Any
// signed-in user, not moderator-gated — it can only ever push to the
// caller's own devices.
//
// action: "send_family_notification" — a Head/Admin composes a title +
// body and sends it to a chosen set of their own family's members
// (everyone, admins/head only, or specific people). Moderator-gated,
// unlike send_test_push, because this reaches other people's devices.
//
// action: "send_photo_prompt_test" — manual trigger for the "tell us more
// about this photo" automated-notification design (see
// 20261025120000_push_notification_automation.sql): picks a real Verified
// photo with no story yet and pushes it to the caller's own devices,
// respecting their photo_prompt_enabled opt-in. Proves the pick-a-photo
// logic before it's wrapped in an actual cron job.
import { createClient } from "@supabase/supabase-js";
import { serviceClient, requireModerator, requireMember } from "./_memberAuth.js";
import { setVapid, sendToUserIds } from "./_push.js";

async function sendTestPush(req, res) {
  let supabase;
  try {
    setVapid();
    supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
    return;
  }

  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    res.status(401).json({ error: "Your session has expired — please reload and sign in again." });
    return;
  }

  try {
    const result = await sendToUserIds(supabase, [user.id], {
      title: "Samskara",
      body: "This is a test notification — if you can see this, push is working end to end.",
      url: "/tree",
    });
    if (!result.total) {
      res.status(400).json({ error: "No push subscription found for this account — enable notifications first." });
      return;
    }
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// target: "all" | "admins" | { memberIds: [...] } — memberIds are
// family_members.id values (what the roster UI already has on hand), not
// raw user ids, so this re-derives user ids from the caller's own family
// roster rather than trusting any id the client sends directly.
async function sendFamilyNotification(req, res) {
  const { familyId, target, title, body, url } = req.body || {};
  if (!familyId || !target || !title?.trim() || !body?.trim()) {
    res.status(400).json({ error: "Family, target, title, and body are all required." });
    return;
  }
  if (title.length > 65 || body.length > 240) {
    res.status(400).json({ error: "Keep the title under 65 characters and the message under 240 — most of it won't show in a notification otherwise." });
    return;
  }

  let supabase;
  try {
    setVapid();
    supabase = serviceClient();
    await requireModerator(supabase, req, familyId);
  } catch (err) {
    res.status(403).json({ error: err.message });
    return;
  }

  try {
    const { data: roster, error: rosterErr } = await supabase
      .from("family_members").select("id, user_id, role").eq("family_id", familyId);
    if (rosterErr) throw new Error(rosterErr.message);

    let userIds;
    if (target === "all") userIds = roster.map((m) => m.user_id);
    else if (target === "admins") userIds = roster.filter((m) => m.role === "head" || m.role === "admin").map((m) => m.user_id);
    else if (Array.isArray(target?.memberIds)) {
      const ids = new Set(target.memberIds);
      userIds = roster.filter((m) => ids.has(m.id)).map((m) => m.user_id);
    } else {
      res.status(400).json({ error: "Unrecognized target." });
      return;
    }
    if (!userIds.length) {
      res.status(400).json({ error: "No matching family members to notify." });
      return;
    }

    const result = await sendToUserIds(supabase, userIds, { title: title.trim(), body: body.trim(), url: url || "/" });
    res.status(200).json({ ...result, targeted: userIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't send that notification." });
  }
}

// Manual trigger for the "tell us more about this photo" design — proves
// the real pick-a-photo-and-prompt logic works before it's wrapped in an
// actual cron job. Any signed-in member of the family, not moderator-only
// (this only ever pushes to the caller's own devices, about content they
// can already see), but still respects photo_prompt_enabled — a test
// button shouldn't bypass the opt-in it exists to test.
async function sendPhotoPromptTest(req, res) {
  const { familyId } = req.body || {};
  if (!familyId) {
    res.status(400).json({ error: "Missing familyId." });
    return;
  }

  let supabase;
  try {
    setVapid();
    supabase = serviceClient();
    await requireMember(supabase, req, familyId);
  } catch (err) {
    res.status(403).json({ error: err.message });
    return;
  }

  try {
    // requireMember's own return value doesn't carry user_id back out —
    // re-resolve it from the bearer token the same way requireMember
    // itself just did, rather than threading a second value through.
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    const { data: { user } } = await supabase.auth.getUser(token);

    const { data: prefRow, error: prefRowErr } = await supabase
      .from("push_notification_prefs").select("photo_prompt_enabled").eq("user_id", user.id).maybeSingle();
    if (prefRowErr) throw new Error(prefRowErr.message);
    if (!prefRow?.photo_prompt_enabled) {
      res.status(400).json({ error: "Turn on \"add a story to a photo\" notifications first, then try again." });
      return;
    }

    // Verified photos for this family with no sibling Verified memory for
    // the same person — the exact "thin on detail" signal from the design.
    // Excludes anything already prompted (any user, any time) via
    // notification_log, so the same photo isn't asked about repeatedly.
    const { data: photos, error: photosErr } = await supabase
      .from("contributions")
      .select("id, person_id, content")
      .eq("family_id", familyId).eq("type", "photo").eq("status", "Verified")
      .not("person_id", "is", null);
    if (photosErr) throw new Error(photosErr.message);
    if (!photos?.length) {
      res.status(400).json({ error: "No verified photos in this family yet to prompt about." });
      return;
    }

    const { data: memories, error: memErr } = await supabase
      .from("contributions").select("person_id")
      .eq("family_id", familyId).eq("type", "memory").eq("status", "Verified");
    if (memErr) throw new Error(memErr.message);
    const peopleWithStories = new Set((memories || []).map((m) => m.person_id));

    const { data: alreadyPrompted, error: logErr } = await supabase
      .from("notification_log").select("reference_id").eq("type", "photo_prompt");
    if (logErr) throw new Error(logErr.message);
    const promptedIds = new Set((alreadyPrompted || []).map((r) => r.reference_id));

    const candidates = photos.filter((p) => !peopleWithStories.has(p.person_id) && !promptedIds.has(String(p.id)));
    if (!candidates.length) {
      res.status(400).json({ error: "Every photo either already has a story, or has already been prompted about." });
      return;
    }

    const photo = candidates[Math.floor(Math.random() * candidates.length)];
    const { data: person } = await supabase.from("people").select("name").eq("family_id", familyId).eq("id", photo.person_id).maybeSingle();
    const { data: signed, error: signErr } = await supabase.storage.from("family-media").createSignedUrl(photo.content, 3600);
    if (signErr) throw new Error(signErr.message);

    const result = await sendToUserIds(supabase, [user.id], {
      title: "Add to the archive",
      body: `Know more about this photo of ${person?.name || "someone in your family"}? Tap to add a memory.`,
      url: `/tree?person=${encodeURIComponent(photo.person_id)}`,
      image: signed.signedUrl,
    });

    await supabase.from("notification_log").insert({ user_id: user.id, type: "photo_prompt", reference_id: String(photo.id) });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't send that prompt." });
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { action } = req.body || {};
  if (action === "send_test_push") return sendTestPush(req, res);
  if (action === "send_family_notification") return sendFamilyNotification(req, res);
  if (action === "send_photo_prompt_test") return sendPhotoPromptTest(req, res);
  res.status(400).json({ error: "Unknown action." });
}
