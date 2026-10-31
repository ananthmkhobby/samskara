import { useState } from "react";
import { CloseIcon } from "./Icons";

const DISMISS_KEY = "vamsha.dismissedFeatureGuideCard";

// Temporarily off everywhere (this file, MoreMenu.jsx, HelpView.jsx all
// check it) — a user flagged a concern about data being downloaded
// unexpectedly around these entry points. Investigation so far (network
// traffic on the logged-out/demo view, the actual href of the download
// link) found no evidence of anything beyond the static PDF fetch, but
// hiding first and confirming after costs nothing. Flip back to true
// once that's resolved — nothing else about the feature needs to change.
export const FEATURE_GUIDE_ENABLED = false;

// Shown on Home, same dismissible pattern as BlogPromoCard/InstallAppCard —
// the fix for "people get lost in the middle of many features" without a
// clear map of what exists. Two destinations on purpose: the downloadable
// PDF (quick reference, what exists) and the in-app Help page (the deeper
// how-to content) — see docs/FEATURE_LIST.md and HelpView.jsx's own new
// top card for the second half of this.
export default function FeatureGuideCard({ onNav }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  if (dismissed || !FEATURE_GUIDE_ENABLED) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* storage unavailable */ }
    setDismissed(true);
  }

  return (
    <div className="card install-card">
      <button className="install-dismiss" onClick={dismiss} aria-label="Not now"><CloseIcon /></button>
      <span className="eyebrow">New here?</span>
      <h3>See everything Samskara can do</h3>
      <p>A short guide to every feature — the tree, sharing, invites, and more — so you're never guessing what's possible.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href="/samskara-feature-guide.pdf" target="_blank" rel="noreferrer" className="btn primary small">Download the guide (PDF) →</a>
        <button type="button" className="btn ghost small" onClick={() => onNav("help")}>Open Help instead →</button>
      </div>
    </div>
  );
}
