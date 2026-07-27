import AuthPanel from "./AuthPanel";

export default function LoginPage({ onShowHelp }) {
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
    </div>
  );
}
