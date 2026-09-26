import { useEffect, useRef, useState } from "react";
import PhotoLightbox from "./PhotoLightbox";

const AUTO_DISMISS_MS = 2200;

// Shown once per app open (not gated by localStorage the way WelcomeIntro
// is) right after a family's own data is ready — a brief, generously-spaced
// moment for the family's own logo and tagline, rather than the small boxed
// treatment they get on Home itself. Skipped entirely by the caller when a
// family has set neither, so nobody sees an empty screen.
export default function FamilySplash({ logoUrl, tagline, familyName, onDone }) {
  const [exiting, setExiting] = useState(false);
  const [logoMaximized, setLogoMaximized] = useState(false);
  const timerRef = useRef(null);

  function finish() {
    if (exiting) return;
    setExiting(true);
    window.setTimeout(onDone, 380);
  }

  function armTimer() {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(finish, AUTO_DISMISS_MS);
  }

  useEffect(() => {
    armTimer();
    return () => window.clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tapping the logo shouldn't dismiss the splash itself — it opens the
  // logo full screen instead, so the auto-dismiss is paused while that's
  // open and given a fresh window once they come back to look a moment
  // longer, rather than continuing straight into Home underneath them.
  function openLogo(e) {
    e.stopPropagation();
    window.clearTimeout(timerRef.current);
    setLogoMaximized(true);
  }
  function closeLogo(e) {
    // PhotoLightbox calls this directly as its own onClick handler (backdrop
    // and the ✕ button both wire onClose straight through), so the event
    // is what's passed in here — without stopping it, the click keeps
    // bubbling up into this component's own onClick and dismisses the
    // whole splash to Home underneath the lightbox that was just closing.
    e?.stopPropagation();
    setLogoMaximized(false);
    armTimer();
  }

  return (
    <div className={`family-splash${exiting ? " family-splash-exit" : ""}`} onClick={finish}>
      {logoUrl && (
        <button type="button" className="family-splash-logo-btn" onClick={openLogo} aria-label="View family logo full screen">
          <img src={logoUrl} alt="" className="family-splash-logo" />
        </button>
      )}
      {familyName && <p className="family-splash-name">{familyName}</p>}
      {tagline && <p className="family-splash-tagline">{tagline}</p>}
      {logoMaximized && <PhotoLightbox src={logoUrl} alt={familyName ? `${familyName}'s logo` : ""} onClose={closeLogo} />}
    </div>
  );
}
