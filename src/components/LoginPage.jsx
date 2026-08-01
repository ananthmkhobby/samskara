import AuthPanel from "./AuthPanel";

export default function LoginPage({ onShowHelp, onShowPrivacy, onShowTerms }) {
  return (
    <div className="login-page">
      <button className="login-help-link" onClick={onShowHelp}>Help</button>
      <div className="login-hero">
        <span className="brand-mark" />
        <h1 className="login-wordmark">
          संस्कार वंश वृक्ष
          <span className="translit">Samskara Vamsha Vruksha</span>
        </h1>
        <p className="login-tagline">
          Your family's living record — every birth, marriage, memory, and hard-won lesson, kept in one place.
        </p>
      </div>
      <AuthPanel />
      <p className="form-hint" style={{ textAlign: "center", marginTop: 16 }}>
        By continuing, you agree to our{" "}
        <button type="button" className="link-btn" onClick={onShowTerms}>Terms &amp; Conditions</button>
        {" "}and{" "}
        <button type="button" className="link-btn" onClick={onShowPrivacy}>Privacy Policy</button>.
      </p>
    </div>
  );
}
