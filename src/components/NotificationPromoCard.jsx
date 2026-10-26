import { useEffect, useState } from "react";
import { CloseIcon } from "./Icons";
import { IS_DEMO } from "../data/session";
import { getPushSubscriptionState } from "../lib/push";

const DISMISS_KEY = "vamsha.dismissedNotificationPromoCard";

// Same dismissible-card pattern as WhatsAppPromoCard.jsx, but checks push
// subscription state (a real browser API call — getPushSubscriptionState()
// — not an account-level DB flag, since a push subscription belongs to
// this browser/device, not the account). Only shown for "unsubscribed" —
// genuinely nothing useful this card can offer someone whose browser
// doesn't support push at all, or who already denied the OS permission
// (that needs a browser-settings fix, not a tap on this card).
export default function NotificationPromoCard({ onNav }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });
  const [state, setState] = useState("checking"); // fail closed — don't flash the card while checking

  useEffect(() => {
    if (IS_DEMO) return;
    let cancelled = false;
    getPushSubscriptionState().then((v) => { if (!cancelled) setState(v); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (IS_DEMO || dismissed || state !== "unsubscribed") return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* storage unavailable */ }
    setDismissed(true);
  }

  return (
    <div className="card install-card notification-promo-card">
      <button className="install-dismiss" onClick={dismiss} aria-label="Not now"><CloseIcon /></button>
      <span className="eyebrow">Stay in the loop</span>
      <h3>Get notified when something's added</h3>
      <p>
        Turn on notifications to hear from your family the moment someone shares a photo,
        a story, or an update — right on this device.
      </p>
      <button type="button" className="btn primary small" onClick={() => onNav("notifications")}>Turn on notifications →</button>
    </div>
  );
}
