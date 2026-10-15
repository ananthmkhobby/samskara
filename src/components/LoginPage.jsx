import AuthPanel from "./AuthPanel";

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
  return (
    <div className="login-page login-page--hero">
      <div className="login-hero-pane">
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
        </div>
      </div>
    </div>
  );
}
