import { useState } from "react";
import { CloseIcon } from "./Icons";

const DISMISS_KEY = "vamsha.dismissedFeatureGuideCard";

// Gates this card, MoreMenu.jsx's grid item, and HelpView.jsx's top card.
// Was briefly off after a report of the PDF download landing on the login
// page instead of the file — root cause found and fixed in sw.js: opening
// a PDF via target="_blank" is a top-level navigation, which the service
// worker's NavigationRoute was catching and serving the cached app shell
// for instead of the real file. Not a data-exposure issue (confirmed: the
// link is a plain static fetch, nothing dynamic, nothing account-related).
export const FEATURE_GUIDE_ENABLED = true;

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
