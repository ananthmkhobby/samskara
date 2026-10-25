// Vercel serverless function. Three unrelated actions share this one file
// purely to stay under Vercel's Hobby-plan 12-function cap (same reason
// api/ai-tools.js merges two otherwise-unrelated things) — this is a
// temporary home for the two push actions specifically, not a real
// pairing with password reset; give them their own file once either a
// Pro upgrade or a genuine push-send endpoint (with its own real
// family/role/plan targeting) makes this file's shared name actively
// misleading.
//
// Default / no action: lets a Head/Admin directly set a new password for
// any member of their own family, regardless of whether that member
// signed up with a real email or a no-email username login. Covers
// "forgot password" for anyone who can't do the self-service email reset
// (no inbox to receive it) — the Head/Admin sets it and tells them
// directly.
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
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { serviceClient, requireModerator } from "./_memberAuth.js";

function setVapid() {
  const vapidPublic = process.env.VITE_PUSH_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.PUSH_VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) throw new Error("Push isn't configured on this deployment yet — missing VAPID keys.");
  webpush.setVapidDetails("mailto:support@oursamskara.com", vapidPublic, vapidPrivate);
}

// Shared by both push actions: sends one payload to every subscription row
// for the given user ids, and cleans up any subscription the push service
// reports as dead (404/410 — permission revoked, browser data cleared,
// etc.) rather than leaving a row that would just fail forever.
async function sendToUserIds(supabase, userIds, payload) {
  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", userIds);
  if (subsErr) throw new Error(subsErr.message);
  if (!subs?.length) return { sent: 0, total: 0, removedDead: 0, recipients: 0 };

  const json = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, json))
  );

  const deadIds = results
    .map((r, i) => (r.status === "rejected" && [404, 410].includes(r.reason?.statusCode) ? subs[i].id : null))
    .filter(Boolean);
  if (deadIds.length) await supabase.from("push_subscriptions").delete().in("id", deadIds);

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return { sent, total: subs.length, removedDead: deadIds.length, recipients: new Set(subs.map((s) => s.user_id)).size };
}

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (req.body?.action === "send_test_push") {
    await sendTestPush(req, res);
    return;
  }
  if (req.body?.action === "send_family_notification") {
    await sendFamilyNotification(req, res);
    return;
  }

  const { familyId, memberId, password } = req.body || {};
  if (!familyId || !memberId || !password) {
    res.status(400).json({ error: "Family, member, and new password are required." });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters." });
    return;
  }

  let supabase;
  try {
    supabase = serviceClient();
    await requireModerator(supabase, req, familyId);
  } catch (err) {
    res.status(403).json({ error: err.message });
    return;
  }

  try {
    const { data: member, error: memberErr } = await supabase
      .from("family_members").select("user_id, family_id").eq("id", memberId).maybeSingle();
    if (memberErr) throw new Error(memberErr.message);
    if (!member || member.family_id !== familyId) throw new Error("That member isn't in your family.");

    const { error: updateErr } = await supabase.auth.admin.updateUserById(member.user_id, { password });
    if (updateErr) throw new Error(updateErr.message);

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't reset that password." });
  }
}
