import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { redeemInvite } from "../data/familyDb";
import { ACCOUNT_NEEDS_FAMILY } from "../data/session";

// Reads a `?code=` invite link once at module load (mirrors App.jsx's
// FORCE_INTRO pattern) — if present, the join form opens pre-filled instead
// of defaulting to the login form.
const INVITE_CODE_FROM_URL = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("code") : null;

async function handleSignOut() {
  await supabase?.auth.signOut();
  window.location.reload();
}

export default function AuthPanel() {
  const [mode, setMode] = useState(INVITE_CODE_FROM_URL ? "join" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState(INVITE_CODE_FROM_URL || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (ACCOUNT_NEEDS_FAMILY) {
    return (
      <div className="auth-panel card">
        <span className="eyebrow">Account not linked yet</span>
        <p className="form-hint" style={{ marginTop: 8 }}>
          You're signed in, but this account isn't attached to a family yet — whoever set this up needs to add you, or you can redeem an invite code below if you have one.
        </p>
        <JoinForm email={email} setEmail={setEmail} password={password} setPassword={setPassword} name={name} setName={setName} code={code} setCode={setCode} busy={busy} setBusy={setBusy} error={error} setError={setError} alreadySignedIn />
        <button className="link-btn" style={{ marginTop: 10 }} onClick={handleSignOut}>Sign out</button>
      </div>
    );
  }

  return (
    <div className="auth-panel card">
      <div className="auth-tabs">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Log in</button>
        <button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>Have an invite code?</button>
      </div>
      {mode === "login" ? (
        <LoginForm email={email} setEmail={setEmail} password={password} setPassword={setPassword} busy={busy} setBusy={setBusy} error={error} setError={setError} />
      ) : (
        <JoinForm email={email} setEmail={setEmail} password={password} setPassword={setPassword} name={name} setName={setName} code={code} setCode={setCode} busy={busy} setBusy={setBusy} error={error} setError={setError} />
      )}
    </div>
  );
}

function LoginForm({ email, setEmail, password, setPassword, busy, setBusy, error, setError }) {
  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  async function sendReset() {
    if (!email.trim()) {
      setError("Enter your email above first, then tap \"Forgot password?\" again.");
      return;
    }
    setResetBusy(true);
    setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setResetBusy(false);
    if (err) { setError(err.message); return; }
    setResetSent(true);
  }

  return (
    <form onSubmit={submit}>
      <div className="form-row">
        <label>Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="form-row">
        <label>Password</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <p className="form-hint" style={{ marginTop: 6 }}>
        {resetSent ? (
          `Check ${email.trim()} for a reset link.`
        ) : (
          <button type="button" className="link-btn" disabled={resetBusy} onClick={sendReset}>
            {resetBusy ? "Sending…" : "Forgot password?"}
          </button>
        )}
      </p>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      <button type="submit" className="btn primary small" disabled={busy} style={{ marginTop: 10 }}>{busy ? "Signing in…" : "Log in →"}</button>
    </form>
  );
}

function JoinForm({ email, setEmail, password, setPassword, name, setName, code, setCode, busy, setBusy, error, setError, alreadySignedIn }) {
  // Someone opening an invite link isn't necessarily new — they might
  // already have an account (e.g. from joining a different family
  // earlier). Asking explicitly, rather than inferring it from a failed
  // signup, sidesteps Supabase Auth's email-enumeration protection, which
  // deliberately makes "does this email already exist" unreliable to
  // detect from a signUp() error alone.
  const [isNewAccount, setIsNewAccount] = useState(true);
  // The code is already baked into the link and pre-filled here — showing
  // it as an editable field anyway reads as "asking again" even though
  // nothing needs re-typing. Only show the field when there's genuinely no
  // code yet (opened the site directly, no link), with a manual-entry
  // escape hatch in case a pre-filled code is ever wrong (stale link, etc).
  const [showCodeField, setShowCodeField] = useState(!INVITE_CODE_FROM_URL);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!alreadySignedIn) {
        if (isNewAccount) {
          const { error: signUpErr } = await supabase.auth.signUp({
            email: email.trim(), password, options: { data: { display_name: name.trim() || undefined } },
          });
          if (signUpErr) throw signUpErr;
        } else {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          if (signInErr) throw signInErr;
        }
      }
      await redeemInvite(code.trim(), name.trim());
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {!alreadySignedIn && (
        <>
          <div className="auth-tabs" style={{ marginBottom: 12 }}>
            <button type="button" className={isNewAccount ? "active" : ""} onClick={() => setIsNewAccount(true)}>I'm new here</button>
            <button type="button" className={!isNewAccount ? "active" : ""} onClick={() => setIsNewAccount(false)}>I already have an account</button>
          </div>
          {isNewAccount && (
            <div className="form-row">
              <label>Your name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kavya Reddy" />
            </div>
          )}
          <div className="form-row">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="form-row">
            <label>{isNewAccount ? "Choose a password" : "Password"}</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </>
      )}
      {showCodeField ? (
        <div className="form-row">
          <label>Invite code</label>
          <input type="text" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. a1b2c3d4e5" />
        </div>
      ) : (
        <p className="form-hint">
          Invite code applied from your link.{" "}
          <button type="button" className="link-btn" onClick={() => setShowCodeField(true)}>Not the right code?</button>
        </p>
      )}
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      <button type="submit" className="btn primary small" disabled={busy} style={{ marginTop: 10 }}>
        {busy ? "Joining…" : alreadySignedIn || isNewAccount ? "Join your family →" : "Log in & join →"}
      </button>
    </form>
  );
}
