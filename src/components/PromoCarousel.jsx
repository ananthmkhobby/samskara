import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "./Icons";

// Generic "ad slot" — a small banner that rotates through a list of short
// promotional slides on a slow crossfade, one visible at a time. Built
// after the old WhatsApp/notification promo cards turned out too big and
// too static for Home (two separate full-width cards, both always-on
// walls of text) and the login page (one dense paragraph). This is the
// shared "ad manager": callers hand it a `slides` array and it handles
// rotation, dismissal, and layout — callers never touch timing or
// transition logic themselves.
//
// `slides`: [{ key, icon?, eyebrow, title, cta?, onClick? }]. A slide with
// no `cta`/`onClick` renders as plain awareness text (e.g. the logged-out
// login page, where no action is actually reachable pre-auth). Single-slide
// lists render statically, no rotation, no wasted interval timer.
export default function PromoCarousel({ slides, dismissKey, intervalMs = 6000 }) {
  const [dismissed, setDismissed] = useState(() => {
    if (!dismissKey) return false;
    try { return localStorage.getItem(dismissKey) === "1"; } catch { return false; }
  });
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    setIndex(0);
    if (slides.length < 2) return;
    timerRef.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(timerRef.current);
  }, [slides.length, intervalMs]);

  if (!slides.length || dismissed) return null;

  function dismiss() {
    if (dismissKey) {
      try { localStorage.setItem(dismissKey, "1"); } catch { /* storage unavailable */ }
    }
    setDismissed(true);
  }

  const slide = slides[Math.min(index, slides.length - 1)];

  return (
    <div className="promo-carousel">
      {dismissKey && (
        <button className="promo-carousel-dismiss" onClick={dismiss} aria-label="Not now"><CloseIcon /></button>
      )}
      <div className="promo-carousel-slide" key={slide.key}>
        {slide.icon && <span className="promo-carousel-icon" aria-hidden="true">{slide.icon}</span>}
        <div className="promo-carousel-text">
          <span className="promo-carousel-eyebrow">{slide.eyebrow}</span>
          <p>{slide.title}</p>
        </div>
        {slide.cta && (
          <button type="button" className="promo-carousel-cta" onClick={slide.onClick}>{slide.cta}</button>
        )}
      </div>
      {slides.length > 1 && (
        <div className="promo-carousel-dots" aria-hidden="true">
          {slides.map((s, i) => <span key={s.key} className={i === index ? "active" : ""} />)}
        </div>
      )}
    </div>
  );
}
