// Hand-written service worker (injectManifest mode — see vite.config.js)
// so push notifications and share-target can both register their own
// custom event listeners, which generateSW mode doesn't support. The two
// pieces below reproduce what generateSW used to do automatically
// (precache + network-only /api); everything past that is custom.
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";

precacheAndRoute(self.__WB_MANIFEST);

// generateSW's navigateFallbackDenylist doesn't exist in injectManifest
// mode — this is the hand-written equivalent: every navigation except
// /api/* falls back to the precached index.html (SPA routing while
// offline), same as before. /s/ is excluded too — a share link
// (api/share.js) must always hit the network, even for a browser that
// already has this app installed, or it serves a stale cached shell with
// the wrong (or no) per-share og: tags instead of the real ones. Doesn't
// affect WhatsApp's own crawler at all (it never has a Samskara service
// worker in the first place), but does affect this app's own installed
// users opening a share link, so it's worth excluding anyway.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), {
  denylist: [/^\/api\//, /^\/s\//],
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
      // Only set when the sender has a real photo to show (the
      // "tell us more about this photo" prompt) — a large image in the
      // notification itself, not just the small icon. Chrome/Android
      // supports this; browsers that don't just ignore the option.
      ...(payload.image ? { image: payload.image } : {}),
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

// The OS share sheet's "Samskara" entry (see vite.config.js's share_target
// manifest key) POSTs multipart/form-data straight to this URL — only a
// service worker's fetch listener can intercept that directly, a plain
// page can't. We can't hand the File object itself across the redirect
// below, so it's stashed in a scratch Cache Storage entry keyed by a
// generated id, and the redirect target (ShareTargetLanding) reads it back
// out by that id once the SPA is actually running.
const SHARE_CACHE = "share-target-inbox";

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const title = formData.get("title") || "";
        const text = formData.get("text") || "";
        const sharedUrl = formData.get("url") || "";
        const file = formData.get("media");

        const cache = await caches.open(SHARE_CACHE);
        await cache.put(
          `/share-target-data/${id}`,
          new Response(JSON.stringify({ title, text, url: sharedUrl, hasFile: !!(file && file.size) }))
        );
        if (file && file.size) {
          await cache.put(`/share-target-file/${id}`, new Response(file, { headers: { "Content-Type": file.type || "application/octet-stream" } }));
        }

        return Response.redirect(`/share-target?id=${id}`, 303);
      })()
    );
  }
});
