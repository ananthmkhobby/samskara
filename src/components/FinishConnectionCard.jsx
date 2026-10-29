import { useState } from "react";
import { CloseIcon } from "./Icons";

const DISMISS_KEY = "vamsha.dismissedFinishConnectionCard";

// Fast Family Onboarding Phase 1's standing re-entry point — shown on Home
// only when the signed-in user's current membership isn't PLACED_CONFIRMED
// (checked by the caller, see HomeDashboard.jsx). Same dismissible pattern
// as BlogPromoCard, but the gate itself (not just dismissal) is what makes
// this disappear once actually connected — dismissing just hides it for
// now, it doesn't change placement_status.
//
// Copy adapts to placementStatus specifically because showing "Let us
// know who you are" to someone who already submitted that exact claim
// reads as if nothing happened — the single most direct way this feature
// could make someone feel lost/ignored instead of "safely waiting on an
// admin." ANCHORED_UNRESOLVED gets a distinct, reassuring message instead
// of the same first-ask copy.
export default function FinishConnectionCard({ placementStatus, onOpen }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  if (dismissed) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* storage unavailable */ }
    setDismissed(true);
  }

  const alreadySubmitted = placementStatus === "ANCHORED_UNRESOLVED";

  return (
    <div className="card install-card">
      <button className="install-dismiss" onClick={dismiss} aria-label="Not now"><CloseIcon /></button>
      <span className="eyebrow">{alreadySubmitted ? "Still working on it" : "One more thing"}</span>
      <h3>{alreadySubmitted ? "We've got what you told us" : "Finish connecting yourself to the tree"}</h3>
      <p>
        {alreadySubmitted
          ? "A Head or Admin is working on linking you to the right spot in the tree — nothing's stuck, you don't need to do anything else. Want to add more detail or correct something?"
          : "Let us know who you are relative to someone already here — even if you're not sure of every link in between."}
      </p>
      <button type="button" className="btn primary small" onClick={onOpen}>{alreadySubmitted ? "Add more detail →" : "Continue →"}</button>
    </div>
  );
}
