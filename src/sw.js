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

self.addEventListener("push", (event) => {
  const text = event.data ? event.data.text() : "spike push with no payload";
  event.waitUntil(
    self.registration.showNotification("Samskara (spike)", { body: text })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
