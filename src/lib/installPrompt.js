// Captured at module load (before React mounts) — Chrome can fire
// beforeinstallprompt before any component has a chance to add a listener,
// and it only fires once per page load, so missing it means no native
// install button for the rest of the visit.
let deferredPrompt = null;
let listeners = [];

function notify() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export function onInstallPromptChange(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

export function hasNativePrompt() {
  return !!deferredPrompt;
}

// Resolves to "accepted", "dismissed", or "unavailable" (no captured prompt
// — the caller should fall back to manual menu instructions).
export async function triggerInstall() {
  if (!deferredPrompt) return "unavailable";
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return choice.outcome;
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function detectPlatform() {
  if (typeof window === "undefined") return "other";
  const ua = window.navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}
