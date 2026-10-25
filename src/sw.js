// SPIKE (2026-10-24): proving vite-plugin-pwa's injectManifest strategy
// works cleanly with this app's existing behavior before committing to it
// for push notifications / share-target, both of which need a custom
// service-worker event handler that generateSW mode (the current strategy)
// doesn't support. This file replaces the auto-generated SW — the two
// pieces below reproduce exactly what generateSW was already doing
// (precache + network-only /api), plus one new push handler to prove the
// custom-event path actually works.
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";

precacheAndRoute(self.__WB_MANIFEST);

// generateSW's navigateFallbackDenylist doesn't exist in injectManifest
// mode — this is the hand-written equivalent: every navigation except
// /api/* falls back to the precached index.html (SPA routing while
// offline), same as before.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), {
  denylist: [/^\/api\//],
}));

registerRoute(({ url }) => url.pathname.startsWith("/api/"), new NetworkOnly());

// Payload is always JSON — { title, body, url } — sent by
// api/reset-member-password.js's send_test_push action (and, eventually,
// whatever real send path replaces it). `url` is where a click on the
// notification should land; defaults to the app's root if the sender
// didn't specify one, which matters once this moves past the test-only
// case to real per-event notifications (a review-queue nudge should open
// the review queue, not just the home screen).
self.addEventListener("push", (event) => {
  let payload = { title: "Samskara", body: "You have a new notification." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Non-JSON payload (shouldn't happen from our own send path) — fall
    // back to showing the raw text rather than dropping the push silently.
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url || "/" },
    })
  );
});

// Clicking a notification should focus an already-open Samskara tab and
// navigate it, rather than always opening a fresh one — most people will
// already have the PWA open or in a background tab.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
