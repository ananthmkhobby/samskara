import { useEffect, useRef } from "react";
import AuthPanel from "./AuthPanel";
import PromoCarousel from "./PromoCarousel";
import { WHATSAPP_DISPLAY_NUMBER } from "../lib/whatsapp";

// Pure awareness, no `cta`/`onClick` — neither WhatsApp linking nor
// enabling push can actually happen before signing in (both need a real
// account to attach to), so there's nothing for a button here to do.
// The real, actionable version of each lives on Home post-login.
const LOGGED_OUT_SLIDES = [
  {
    key: "whatsapp",
    icon: "📱",
    eyebrow: "Also on WhatsApp",
    title: <>Sign in, then message <strong>{WHATSAPP_DISPLAY_NUMBER}</strong> to send photos and stories straight from your phone.</>,
  },
  {
    key: "notifications",
    icon: "🔔",
    eyebrow: "Stay in the loop",
    title: "Sign in, then turn on notifications to hear the moment someone adds something.",
  },
];

// Each rotates through the hero panel on a slow crossfade (see .login-hero-slide
// in login.css) — a mix of the kind of ordinary family objects that almost never
// got photographed on their own: a letter, a scooter, a sewing machine, a phone.
const HERO_IMAGES = [
  "/images/heritage-letter.jpg",
  "/images/login/scooter.jpg",
  "/images/login/car.jpg",
  "/images/login/kitchen.jpg",
  "/images/login/sewing-machine.jpg",
  "/images/login/telephone.jpg",
  "/images/login/enfield.jpg",
  "/images/login/gramophone.jpg",
  "/images/login/brass-lamp.jpg",
  "/images/login/radio.jpg",
];

export default function LoginPage({ onShowHelp, onShowPrivacy, onShowTerms }) {
  const heroRef = useRef(null);

  // A small cursor-reactive depth effect, desktop only (no pointer to
  // react to on mobile, so this simply never fires there — nothing to
  // guard separately). Writes CSS custom properties rather than React
  // state, so a fast mouse doesn't cause a re-render on every move; the
  // actual motion is pure CSS (see .login-hero-brand/.login-hero-copy's
  // transform in login.css), just driven by these two variables.
  useEffect(() => {
    const el = heroRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    function onMove(e) {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5..0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty("--parallax-x", x.toFixed(3));
      el.style.setProperty("--parallax-y", y.toFixed(3));
    }
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div className="login-page login-page--hero">
      <div className="login-hero-pane" ref={heroRef}>
        <div className="login-hero-slides" aria-hidden="true">
          {HERO_IMAGES.map((src, i) => (
            <img
              key={src}
              className="login-hero-slide"
              src={src}
              alt=""
              style={{ animationDelay: `${i * -4}s` }}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
            />
          ))}
        </div>
        <div className="login-hero-scrim" />
        <div className="login-hero-brand">
          <div className="login-hero-devanagari">संस्कार वंश वृक्ष</div>
          <div className="login-hero-translit">Samskara · Vamsha Vruksha</div>
        </div>
        <div className="login-hero-copy">
          <p className="login-hero-caption">The ordinary things deserved to be kept too.</p>
          <h1 className="login-hero-hook">Did your family have something like this? Almost no one thought to photograph it.</h1>
          <p className="login-hero-sub">
            Samskara is where you finally do — the scooter, the kitchen, the everyday things that made up a life, kept for good this time.
          </p>
          {/* No account needed to try this — pick a photo and preview it
              right here; signing in only happens once they choose to save
              it. See FirstMemoryWizard.jsx. */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <button type="button" className="login-hero-primary-cta" onClick={() => { window.location.href = "/first-memory"; }}>
              <span aria-hidden="true">🪔</span>
              Preserve your first memory →
            </button>
            <button type="button" className="login-hero-blog-cta" style={{ marginTop: 10 }} onClick={() => { window.location.href = "/blog"; }}>
              <span className="login-hero-blog-cta-icon" aria-hidden="true">📖</span>
              Read our stories on the Blog →
            </button>
          </div>
        </div>
      </div>

      <div className="login-form-pane">
        <div className="login-form-topbar">
          <button
            type="button"
            className="login-help-link login-demo-link"
            onClick={() => { window.location.href = "/?demo=1"; }}
          >
            Try a live demo →
          </button>
          <button className="login-help-link" onClick={() => { window.location.href = "/blog"; }}>Blog</button>
          <button className="login-help-link" onClick={onShowHelp}>Help</button>
        </div>
        <div className="login-form-inner">
          <AuthPanel onShowPrivacy={onShowPrivacy} onShowTerms={onShowTerms} />
          <p className="form-hint" style={{ textAlign: "center", marginTop: 16 }}>
            By continuing, you agree to our{" "}
            <button type="button" className="link-btn" onClick={onShowTerms}>Terms &amp; Conditions</button>
            {" "}and{" "}
            <button type="button" className="link-btn" onClick={onShowPrivacy}>Privacy Policy</button>.
          </p>
          <div style={{ marginTop: 14 }}>
            <PromoCarousel slides={LOGGED_OUT_SLIDES} />
          </div>
        </div>
      </div>
    </div>
  );
}
