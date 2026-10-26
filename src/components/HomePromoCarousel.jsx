import { useEffect, useState } from "react";
import PromoCarousel from "./PromoCarousel";
import { IS_DEMO } from "../data/session";
import { isWhatsAppConnected } from "../data/familyDb";
import { getPushSubscriptionState } from "../lib/push";
import { WHATSAPP_DISPLAY_NUMBER } from "../lib/whatsapp";

const DISMISS_KEY = "vamsha.dismissedHomePromoCarousel";

// Replaces the old WhatsAppPromoCard + NotificationPromoCard (two separate,
// always-full-width cards) with one small rotating slot — each slide is
// only included once its own state check comes back "not yet done," same
// gating those two components used individually. Nothing to show (and no
// network calls worth making) in the public demo.
export default function HomePromoCarousel({ onNav }) {
  const [whatsappConnected, setWhatsappConnected] = useState(true); // fail closed
  const [pushState, setPushState] = useState("checking");

  useEffect(() => {
    if (IS_DEMO) return;
    let cancelled = false;
    isWhatsAppConnected().then((v) => { if (!cancelled) setWhatsappConnected(v); }).catch(() => {});
    getPushSubscriptionState().then((v) => { if (!cancelled) setPushState(v); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (IS_DEMO) return null;

  const slides = [];
  if (!whatsappConnected) {
    slides.push({
      key: "whatsapp",
      icon: "📱",
      eyebrow: "Also on WhatsApp",
      title: <>Message <strong>{WHATSAPP_DISPLAY_NUMBER}</strong> to connect your number and send photos and stories straight from your phone.</>,
      cta: "How it works →",
      onClick: () => onNav("connectWhatsapp"),
    });
  }
  // Only for "unsubscribed" — an unsupported browser or an already-denied
  // OS permission need a settings fix this slide can't offer, same
  // reasoning NotificationPromoCard.jsx used before being folded in here.
  // The copy itself covers "at the phone level too," since granting
  // browser permission isn't always enough on its own (OS-level
  // notification settings can still be muted independently).
  if (pushState === "unsubscribed") {
    slides.push({
      key: "notifications",
      icon: "🔔",
      eyebrow: "Stay in the loop",
      title: "Turn on notifications to hear the moment someone adds a photo or story — check your phone's own notification settings too if they don't show up.",
      cta: "Turn on →",
      onClick: () => onNav("notifications"),
    });
  }

  return <PromoCarousel slides={slides} dismissKey={DISMISS_KEY} />;
}
