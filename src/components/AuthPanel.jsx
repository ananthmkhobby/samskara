import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { redeemInvite, recordConsent, registerNewFamily } from "../data/familyDb";
import { ACCOUNT_NEEDS_FAMILY } from "../data/session";
import { POLICY_VERSION } from "../lib/policy";
import { SHOW_GOOGLE_AUTH } from "../lib/featureFlags";

// Reads a `?code=` invite link once at module load (mirrors App.jsx's
// FORCE_INTRO pattern) — if present, the join form opens pre-filled instead
// of defaulting to the login form.
const INVITE_CODE_FROM_URL = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("code") : null;

// Must match usernameToEmail() in api/_memberAuth.js exactly — a no-email
// login (built by a Head/Admin on the Members page for someone with no
// inbox, most often an elder) is really just an auth account whose email
// is synthesized from the username, so signing in with either one works
// the same way through supabase-js's normal signInWithPassword.
function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@members.samskara.app`;
}

async function handleSignOut() {
  await supabase?.auth.signOut();
  window.location.reload();
}

// Supabase handles the whole OAuth round-trip itself (token exchange, then
// redirecting back here with a session already established) — nothing else
// to wire up client-side. A first-time Google identity lands exactly where a
// first-time email/password one does: ConsentGate, then (once there's no
// family_members row yet) the ACCOUNT_NEEDS_FAMILY branch below.
async function signInWithGoogle() {
  await supabase?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
}

export default function AuthPanel({ onShowPrivacy, onShowTerms }) {
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
          You're signed in, but this account isn't attached to a family yet.
        </p>
        <FamilyIntentGate email={email} setEmail={setEmail} password={password} setPassword={setPassword} name={name} setName={setName} code={code} setCode={setCode} busy={busy} setBusy={setBusy} error={error} setError={setError} onShowPrivacy={onShowPrivacy} onShowTerms={onShowTerms} />
        <button className="link-btn" style={{ marginTop: 10 }} onClick={handleSignOut}>Sign out</button>
      </div>
    );
  }

  return (
    <div className="auth-panel card">
      {SHOW_GOOGLE_AUTH && (
        <button type="button" className="btn ghost" style={{ width: "100%", marginBottom: 14 }} onClick={signInWithGoogle}>
          Continue with Google
        </button>
      )}
      <div className="auth-tabs">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Log in</button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>New here? Create an account</button>
        <button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>Have an invite code?</button>
      </div>
      {mode === "login" ? (
        <LoginForm email={email} setEmail={setEmail} password={password} setPassword={setPassword} busy={busy} setBusy={setBusy} error={error} setError={setError} />
      ) : mode === "signup" ? (
        <SignUpForm email={email} setEmail={setEmail} password={password} setPassword={setPassword} name={name} setName={setName} busy={busy} setBusy={setBusy} error={error} setError={setError} onShowPrivacy={onShowPrivacy} onShowTerms={onShowTerms} />
      ) : (
        <JoinForm email={email} setEmail={setEmail} password={password} setPassword={setPassword} name={name} setName={setName} code={code} setCode={setCode} busy={busy} setBusy={setBusy} error={error} setError={setError} onShowPrivacy={onShowPrivacy} onShowTerms={onShowTerms} />
      )}
    </div>
  );
}

function LoginForm({ email, setEmail, password, setPassword, busy, setBusy, error, setError }) {
  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  // Most elders have no email at all — a Head/Admin can build them a
  // username+password login instead (Admin > Members). This toggle is the
  // other half of that: signing back in with just the username, no inbox
  // ever required.
  const [loginWithUsername, setLoginWithUsername] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const loginEmail = loginWithUsername ? usernameToEmail(email) : email.trim();
    const { error: err } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
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
        <label>{loginWithUsername ? "Username" : "Email"}</label>
        <input
          type={loginWithUsername ? "text" : "email"} required value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={loginWithUsername ? "e.g. amma1950" : "you@example.com"}
        />
      </div>
      <div className="form-row">
        <label>Password</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <p className="form-hint" style={{ marginTop: 6 }}>
        {loginWithUsername ? (
          <>
            Forgot it? Ask your Family Head or Admin to reset it for you.{" "}
            <button type="button" className="link-btn" onClick={() => { setLoginWithUsername(false); setEmail(""); setError(""); }}>
              Log in with email instead
            </button>
          </>
        ) : resetSent ? (
          `Check ${email.trim()} for a reset link.`
        ) : (
          <>
            <button type="button" className="link-btn" disabled={resetBusy} onClick={sendReset}>
              {resetBusy ? "Sending…" : "Forgot password?"}
            </button>
            {" · "}
            <button type="button" className="link-btn" onClick={() => { setLoginWithUsername(true); setEmail(""); setError(""); }}>
              No email? Log in with username
            </button>
          </>
        )}
      </p>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      <button type="submit" className="btn primary small" disabled={busy} style={{ marginTop: 10 }}>{busy ? "Signing in…" : "Log in →"}</button>
    </form>
  );
}

// Creates an authenticated identity only — deliberately asks nothing about
// family/role here. What happens next (start a new family vs. join one with
// a code) is decided one screen later, by FamilyIntentGate, the same place a
// first-time Google sign-in lands too — one funnel for both, not two.
function SignUpForm({ email, setEmail, password, setPassword, name, setName, busy, setBusy, error, setError, onShowPrivacy, onShowTerms }) {
  const [agreed, setAgreed] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(), password, options: { data: { display_name: name.trim() || undefined } },
      });
      if (signUpErr) throw signUpErr;
      // Best-effort, same reasoning as JoinForm's identical call: if this
      // fails (or email confirmation is ever turned on, leaving no session
      // yet), the boot-time ConsentGate catches it instead.
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await recordConsent(user.id, POLICY_VERSION).catch(() => {});
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="form-row">
        <label>Your name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kavya Reddy" />
      </div>
      <div className="form-row">
        <label>Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="form-row">
        <label>Choose a password</label>
        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <label className="consent-check" style={{ marginTop: 14, marginBottom: 4 }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          I agree to the{" "}
          <button type="button" className="link-btn" onClick={onShowPrivacy}>Privacy Policy</button>
          {" "}and{" "}
          <button type="button" className="link-btn" onClick={onShowTerms}>Terms &amp; Conditions</button>
        </span>
      </label>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      <button type="submit" className="btn primary small" disabled={busy || !agreed} style={{ marginTop: 10 }}>
        {busy ? "Creating account…" : "Create account →"}
      </button>
      <p className="form-hint" style={{ marginTop: 10 }}>
        Next you'll choose whether to start a new family archive or join one with an invite code.
      </p>
    </form>
  );
}

function JoinForm({ email, setEmail, password, setPassword, name, setName, code, setCode, busy, setBusy, error, setError, alreadySignedIn, onShowPrivacy, onShowTerms }) {
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
  // Only asked of someone creating an account here — a returning account
  // already consented when it was made, and re-asking at every sign-in
  // teaches people to click through without reading.
  const [agreed, setAgreed] = useState(false);

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
          // Recorded here so consent is on file from the moment the account
          // exists. If this write fails (or the project ever turns email
          // confirmation back on, leaving no session yet), the boot-time
          // consent gate catches them instead — hence the swallowed error
          // rather than blocking the join over it.
          const { data: { user } } = await supabase.auth.getUser();
          if (user) await recordConsent(user.id, POLICY_VERSION).catch(() => {});
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
      {!alreadySignedIn && isNewAccount && (
        <label className="consent-check" style={{ marginTop: 14, marginBottom: 4 }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I agree to the{" "}
            <button type="button" className="link-btn" onClick={onShowPrivacy}>Privacy Policy</button>
            {" "}and{" "}
            <button type="button" className="link-btn" onClick={onShowTerms}>Terms &amp; Conditions</button>
          </span>
        </label>
      )}
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      <button
        type="submit" className="btn primary small" style={{ marginTop: 10 }}
        disabled={busy || (!alreadySignedIn && isNewAccount && !agreed)}
      >
        {busy ? "Joining…" : alreadySignedIn || isNewAccount ? "Join your family →" : "Log in & join →"}
      </button>
    </form>
  );
}

// Shown to any signed-in account with no family_members row yet — reached
// from a fresh email/password sign-up, a first-time Google sign-in, or any
// other way an account ends up here. Asks one sequential question instead
// of showing "join" and "create" as two equal-looking buttons, specifically
// so someone who actually has (or should ask for) an invite doesn't end up
// creating an orphan family by accident. Skipped entirely when a real invite
// link (?code=) is already in hand — INVITE_CODE_FROM_URL — matching how
// JoinForm itself already defaults straight in from a link.
function FamilyIntentGate(props) {
  const [intent, setIntent] = useState(INVITE_CODE_FROM_URL ? "join" : null); // null | "join" | "create-confirm" | "create"

  if (intent === null) {
    return (
      <div>
        <p className="form-hint" style={{ marginTop: 0 }}>Were you invited by a family member who's already using Samskara?</p>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" className="btn primary small" onClick={() => setIntent("join")}>Yes, I have an invite</button>
          <button type="button" className="btn ghost small" onClick={() => setIntent("create-confirm")}>No, start a new family</button>
        </div>
      </div>
    );
  }

  if (intent === "create-confirm") {
    return (
      <div>
        <p className="form-hint" style={{ marginTop: 0 }}>
          This starts a brand-new, empty family archive with you as its Head. If a relative already set one up, ask them for an invite instead of creating a second one.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" className="link-btn" onClick={() => setIntent(null)}>← Back</button>
          <button type="button" className="btn primary small" onClick={() => setIntent("create")}>Continue — start a new family</button>
        </div>
      </div>
    );
  }

  if (intent === "create") {
    return <CreateFamilyForm onBack={() => setIntent("create-confirm")} />;
  }

  return <JoinForm {...props} alreadySignedIn />;
}

// Family name + role are the only things collected here — the account
// itself (and its consent) already exist by the time this renders, whether
// it came from SignUpForm, LoginForm's "I already have an account" (Google
// or password), or Google OAuth. 'head' is decided entirely server-side by
// register_new_family() — this form has no role field at all.
function CreateFamilyForm({ onBack }) {
  const [familyName, setFamilyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!familyName.trim()) return;
    setBusy(true);
    setError("");
    try {
      await registerNewFamily(familyName.trim(), displayName.trim());
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="form-row">
        <label>What should we call your family archive?</label>
        <input type="text" required value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="e.g. The Rao Family" />
      </div>
      <div className="form-row">
        <label>Your name</label>
        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Ramesh Rao" />
      </div>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="button" className="link-btn" onClick={onBack} disabled={busy}>← Back</button>
        <button type="submit" className="btn primary small" disabled={busy || !familyName.trim()}>
          {busy ? "Creating…" : "Create my family →"}
        </button>
      </div>
    </form>
  );
}
