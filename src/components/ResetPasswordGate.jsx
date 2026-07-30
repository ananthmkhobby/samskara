import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Shown instead of the whole app the moment Supabase tells us this visit is
// a password-recovery link being followed (see the PASSWORD_RECOVERY
// listener in App.jsx) — clicking the emailed link already signs the
// browser in with a temporary recovery session, so the only thing left to
// do is collect a new password and save it, then hand off to a normal reload.
export default function ResetPasswordGate({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Those two passwords don't match."); return; }
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    setDone(true);
  }

  return (
    <div className="login-page">
      <div className="login-hero">
        <span className="brand-mark" />
        <h1 className="login-wordmark">
          संस्कार वंश वृक्ष
          <span className="translit">Samskara Vamsha Vruksha</span>
        </h1>
      </div>
      <div className="auth-panel card">
        {done ? (
          <>
            <p className="form-hint">Password updated — you're all set.</p>
            <button type="button" className="btn primary small" style={{ marginTop: 10 }} onClick={onDone}>Continue →</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="form-row">
              <label>New password</label>
              <input type="password" required minLength={6} autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Confirm new password</label>
              <input type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
            <button type="submit" className="btn primary small" disabled={busy} style={{ marginTop: 10 }}>{busy ? "Saving…" : "Save new password →"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
