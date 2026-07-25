import { useEffect, useState } from "react";
import { onInstallPromptChange, hasNativePrompt, triggerInstall, isStandalone, detectPlatform } from "../lib/installPrompt";

const DISMISS_KEY = "vamsha.dismissedInstallCard";

// Shown on the Cover page (dismissible, so it doesn't nag) and again,
// always, on the Help page — so someone who dismissed it, or a family
// member helping an elder relative later, can still find the steps.
export default function InstallAppCard({ dismissible = false }) {
  const [, forceUpdate] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    if (!dismissible) return false;
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => onInstallPromptChange(() => forceUpdate((x) => x + 1)), []);

  if (dismissed || isStandalone()) return null;

  const platform = detectPlatform();
  if (platform === "other" && !hasNativePrompt()) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* storage unavailable */ }
    setDismissed(true);
  }

  async function install() {
    setBusy(true);
    const outcome = await triggerInstall();
    setBusy(false);
    if (outcome === "accepted") setStatus("added");
  }

  return (
    <div className="card install-card">
      {dismissible && <button className="install-dismiss" onClick={dismiss} aria-label="Not now">✕</button>}
      <span className="eyebrow">Put this on your phone</span>
      <h3>No more typing the address</h3>

      {status === "added" ? (
        <p>Added — look for the icon on your home screen next time.</p>
      ) : platform === "ios" ? (
        <>
          <p>Add an icon to your home screen — tap it any time and you're straight in, like any other app:</p>
          <ol className="install-steps">
            <li>Tap the <b>Share</b> button at the bottom of the screen (the square with an arrow pointing up)</li>
            <li>Scroll down and tap <b>"Add to Home Screen"</b></li>
            <li>Tap <b>"Add"</b> in the top corner</li>
          </ol>
        </>
      ) : hasNativePrompt() ? (
        <>
          <p>Add an icon to your home screen — tap it any time and you're straight in, no browser needed.</p>
          <button className="btn primary" disabled={busy} onClick={install}>
            {busy ? "Adding…" : "Add to Home Screen"}
          </button>
        </>
      ) : (
        <>
          <p>Add an icon to your home screen — tap it any time and you're straight in, no browser needed:</p>
          <ol className="install-steps">
            <li>Tap the <b>⋮ menu</b> in the top corner of your browser</li>
            <li>Choose <b>"Add to Home screen"</b> or <b>"Install app"</b></li>
          </ol>
        </>
      )}
    </div>
  );
}
