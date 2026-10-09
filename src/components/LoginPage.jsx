import AuthPanel from "./AuthPanel";

export default function LoginPage({ onShowHelp, onShowPrivacy, onShowTerms }) {
  return (
    <div className="login-page">
      <button className="login-help-link" onClick={onShowHelp}>Help</button>
      <button
        type="button"
        className="login-help-link login-demo-link"
        onClick={() => { window.location.href = "/?demo=1"; }}
      >
        Try a live demo →
      </button>
      <div className="login-hero">
        <div className="login-keepsake" aria-hidden="true">
          <img src="/images/heritage-letter.jpg" alt="" loading="eager" />
          <span className="login-keepsake-seal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--parchment-paper)" strokeWidth="1.6">
              <path d="M12 21v-9" strokeLinecap="round" />
              <path d="M12 15 7 10" strokeLinecap="round" /><path d="M12 13 17 9" strokeLinecap="round" />
              <path d="M12 11 8 7" strokeLinecap="round" /><path d="M12 10 16 6" strokeLinecap="round" />
            </svg>
          </span>
        </div>
        <span className="brand-mark" />
        <h1 className="login-wordmark">
          संस्कार वंश वृक्ष
          <span className="translit">Samskara Vamsha Vruksha</span>
        </h1>
        <p className="login-headline">Some letters were never meant to fade.</p>
        <p className="login-tagline">
          Your family's living record — every birth, marriage, memory, and hard-won lesson, kept in one place.
        </p>
      </div>
      <AuthPanel onShowPrivacy={onShowPrivacy} onShowTerms={onShowTerms} />
      <p className="form-hint" style={{ textAlign: "center", marginTop: 16 }}>
        By continuing, you agree to our{" "}
        <button type="button" className="link-btn" onClick={onShowTerms}>Terms &amp; Conditions</button>
        {" "}and{" "}
        <button type="button" className="link-btn" onClick={onShowPrivacy}>Privacy Policy</button>.
      </p>
    </div>
  );
}
