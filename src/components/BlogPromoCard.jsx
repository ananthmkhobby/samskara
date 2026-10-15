import { useState } from "react";
import { CloseIcon } from "./Icons";

const DISMISS_KEY = "vamsha.dismissedBlogPromoCard";

// Shown on Home (the very first screen every visitor sees, every time they
// open the app) — dismissible once, same pattern as InstallAppCard, so it
// doesn't nag someone who's already found the blog. Separate from the
// footer link in MoreMenu and LoginPage's hero CTA — this is the
// "logged-in visibility" leg of the same goal: let people discover the
// blog exists at all, ahead of a planned subscribe feature.
export default function BlogPromoCard({ onNav }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  if (dismissed) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* storage unavailable */ }
    setDismissed(true);
  }

  return (
    <div className="card install-card blog-promo-card">
      <button className="install-dismiss" onClick={dismiss} aria-label="Not now"><CloseIcon /></button>
      <span className="eyebrow">New from Samskara</span>
      <h3>Read the Blog</h3>
      <p>Stories about keeping a family's record — and the ordinary things worth keeping too.</p>
      <button type="button" className="btn primary small" onClick={() => onNav("blog")}>Visit the Blog →</button>
    </div>
  );
}
