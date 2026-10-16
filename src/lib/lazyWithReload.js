import { lazy } from "react";

// A code-split chunk's filename is content-hashed, and the PWA service
// worker (registerType: 'autoUpdate', vite.config.js) swaps to the new
// deploy's precache manifest in the background as soon as it's available —
// not when the open tab's own JS actually reloads. So a tab left open
// across a deploy can still be running the OLD index bundle (which
// references the OLD chunk hashes) after the SW has already moved on to
// precaching the NEW ones; tapping into a view that wasn't loaded yet in
// this session (Blog, Admin, …) then fails to fetch its chunk — reported
// live as "Blog/Admin won't load, but it comes back after a refresh,"
// which is exactly this: a refresh re-fetches index.html fresh, pulling
// the current bundle with correct references.
//
// Wraps React.lazy() so that specific failure (not just any import error)
// self-heals with a single automatic reload instead of leaving a dead
// view on screen — sessionStorage guards against a reload loop if the
// chunk is ever genuinely missing for some other reason.
export function lazyWithReload(importFn) {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (err) {
      const reloadedKey = "vamsha.chunkReloadedOnce";
      const message = String(err?.message || "");
      const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
      if (isChunkError && !sessionStorage.getItem(reloadedKey)) {
        sessionStorage.setItem(reloadedKey, "1");
        window.location.reload();
        // Never resolves — the reload is already underway, and React.lazy
        // just needs this promise to not settle with the stale error.
        return new Promise(() => {});
      }
      throw err;
    }
  });
}
