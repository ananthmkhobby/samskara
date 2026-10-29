import { useState } from "react";
import { CloseIcon } from "./Icons";

const DISMISS_KEY = "vamsha.dismissedFinishConnectionCard";

// Fast Family Onboarding Phase 1's standing re-entry point — shown on Home
// only when the signed-in user's current membership isn't PLACED_CONFIRMED
// (checked by the caller, see HomeDashboard.jsx). Same dismissible pattern
// as BlogPromoCard, but the gate itself (not just dismissal) is what makes
// this disappear once actually connected — dismissing just hides it for
// now, it doesn't change placement_status.
export default function FinishConnectionCard({ onOpen }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  if (dismissed) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* storage unavailable */ }
    setDismissed(true);
  }

  return (
    <div className="card install-card">
      <button className="install-dismiss" onClick={dismiss} aria-label="Not now"><CloseIcon /></button>
      <span className="eyebrow">One more thing</span>
      <h3>Finish connecting yourself to the tree</h3>
      <p>Let us know who you are relative to someone already here — even if you're not sure of every link in between.</p>
      <button type="button" className="btn primary small" onClick={onOpen}>Continue →</button>
    </div>
  );
}
