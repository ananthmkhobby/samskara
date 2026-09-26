import { useEffect, useState } from "react";

const AUTO_DISMISS_MS = 2200;

// Shown once per app open (not gated by localStorage the way WelcomeIntro
// is) right after a family's own data is ready — a brief, generously-spaced
// moment for the family's own logo and tagline, rather than the small boxed
// treatment they get on Home itself. Skipped entirely by the caller when a
// family has set neither, so nobody sees an empty screen.
export default function FamilySplash({ logoUrl, tagline, familyName, onDone }) {
  const [exiting, setExiting] = useState(false);

  function finish() {
    if (exiting) return;
    setExiting(true);
    window.setTimeout(onDone, 380);
  }

  useEffect(() => {
    const t = window.setTimeout(finish, AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`family-splash${exiting ? " family-splash-exit" : ""}`} onClick={finish}>
      {logoUrl && <img src={logoUrl} alt="" className="family-splash-logo" />}
      {familyName && <p className="family-splash-name">{familyName}</p>}
      {tagline && <p className="family-splash-tagline">{tagline}</p>}
    </div>
  );
}
