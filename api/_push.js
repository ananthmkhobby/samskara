// Shared Web Push sending logic — originally only in
// api/reset-member-password.js, extracted here once a second caller
// (api/provision-family.js's superadmin broadcast) needed the exact same
// setVapid()/sendToUserIds() behavior, including the dead-subscription
// cleanup. Not a new serverless function — an underscore-prefixed file,
// same as _memberAuth.js, doesn't count against Vercel's function cap.
import webpush from "web-push";

export function setVapid() {
  const vapidPublic = process.env.VITE_PUSH_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.PUSH_VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) throw new Error("Push isn't configured on this deployment yet — missing VAPID keys.");
  webpush.setVapidDetails("mailto:support@oursamskara.com", vapidPublic, vapidPrivate);
}

// Sends one payload to every subscription row for the given user ids, and
// cleans up any subscription the push service reports as dead (404/410 —
// permission revoked, browser data cleared, etc.) rather than leaving a
// row that would just fail forever.
export async function sendToUserIds(supabase, userIds, payload) {
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
