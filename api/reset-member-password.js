// Vercel serverless function. Two unrelated actions share this one file
// purely to stay under Vercel's Hobby-plan 12-function cap (same reason
// api/ai-tools.js merges two otherwise-unrelated things) — this is a
// temporary home for send_test_push specifically, not a real pairing;
// give it its own file once either a Pro upgrade or a genuine push-send
// endpoint (with real family/role/plan targeting) makes this file's
// shared name actively misleading.
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
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { serviceClient, requireModerator } from "./_memberAuth.js";

async function sendTestPush(req, res) {
  const vapidPublic = process.env.VITE_PUSH_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.PUSH_VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    res.status(500).json({ error: "Push isn't configured on this deployment yet — missing VAPID keys." });
    return;
  }
  webpush.setVapidDetails("mailto:support@oursamskara.com", vapidPublic, vapidPrivate);

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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

  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", user.id);
  if (subsErr) {
    res.status(500).json({ error: subsErr.message });
    return;
  }
  if (!subs?.length) {
    res.status(400).json({ error: "No push subscription found for this account — enable notifications first." });
    return;
  }

  const payload = JSON.stringify({
    title: "Samskara",
    body: "This is a test notification — if you can see this, push is working end to end.",
    url: "/tree",
  });

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
    )
  );

  // A 404/410 from the push service means the subscription is dead (user
  // revoked permission, browser data cleared, etc.) — clean it up rather
  // than leaving a row that will fail forever.
  const deadIds = results
    .map((r, i) => (r.status === "rejected" && [404, 410].includes(r.reason?.statusCode) ? subs[i].id : null))
    .filter(Boolean);
  if (deadIds.length) await supabase.from("push_subscriptions").delete().in("id", deadIds);

  const sent = results.filter((r) => r.status === "fulfilled").length;
  res.status(200).json({ sent, total: subs.length, removedDead: deadIds.length });
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
