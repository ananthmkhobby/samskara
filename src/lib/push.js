// Web Push subscribe/unsubscribe — the browser-side half of the spike's
// push_subscriptions table. Mirrors the shape of isWhatsAppConnected() /
// setNudgePreference() in familyDb.js: a small, direct client, not routed
// through a serverless function, since pushManager.subscribe() must run
// in the browser (it's the thing that talks to the push service and mints
// the endpoint/keys) and the resulting row is owned entirely by the
// signed-in user's own RLS policy.
import { supabase } from "./supabaseClient";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_PUSH_VAPID_PUBLIC_KEY;

// Push services want the VAPID key as a raw Uint8Array, not the
// base64url string the env var holds — same conversion every web-push
// tutorial does, extracted here once rather than inlined at the call site.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
}

export async function getPushSubscriptionState() {
  if (!(await isPushSupported())) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? "subscribed" : "unsubscribed";
}

// Asks for OS permission (must be called from a real user gesture — a
// click handler, not on page load) and, if granted, both subscribes with
// the push service and saves the resulting endpoint/keys for the signed-in
// user. Each browser/device gets its own row (push_subscriptions.endpoint
// is unique per subscription, not per user) — see the migration for why.
export async function enablePush(userId) {
  if (!(await isPushSupported())) throw new Error("Push notifications aren't supported in this browser.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  });
  // A re-subscribe on a browser that already has a row hits the unique
  // constraint on endpoint — harmless, the row's already exactly right.
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function disablePush(userId) {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
}
