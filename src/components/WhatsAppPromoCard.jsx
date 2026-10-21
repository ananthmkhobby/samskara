import { useEffect, useState } from "react";
import { CloseIcon } from "./Icons";
import { IS_DEMO } from "../data/session";
import { isWhatsAppConnected } from "../data/familyDb";
import { WHATSAPP_DISPLAY_NUMBER } from "../lib/whatsapp";

const DISMISS_KEY = "vamsha.dismissedWhatsAppPromoCard";

// Same dismissible-card pattern as BlogPromoCard.jsx — but additionally
// gated on the signed-in account actually having no whatsapp_connections
// row yet (checked via isWhatsAppConnected(), a security-definer RPC, since
// that table has no client-readable policy at all). A dismissal only hides
// it for this browser; someone who later wants to connect can still do so
// from MoreMenu's persistent "Connect on WhatsApp" entry.
export default function WhatsAppPromoCard({ onNav }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });
  const [connected, setConnected] = useState(true); // fail closed — don't flash the card while checking

  useEffect(() => {
    if (IS_DEMO) return;
    let cancelled = false;
    isWhatsAppConnected().then((v) => { if (!cancelled) setConnected(v); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (IS_DEMO || dismissed || connected) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* storage unavailable */ }
    setDismissed(true);
  }

  return (
    <div className="card install-card whatsapp-promo-card">
      <button className="install-dismiss" onClick={dismiss} aria-label="Not now"><CloseIcon /></button>
      <span className="eyebrow">Also on WhatsApp</span>
      <h3>Send photos and stories straight from WhatsApp</h3>
      <p>
        Message <strong>{WHATSAPP_DISPLAY_NUMBER}</strong> to connect your number —
        after that, anything you send becomes part of the family's archive.
      </p>
      <button type="button" className="btn primary small" onClick={() => onNav("connectWhatsapp")}>How it works →</button>
    </div>
  );
}
