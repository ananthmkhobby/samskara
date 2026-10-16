import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { redeemInvite, recordConsent, registerNewFamily } from "../data/familyDb";
import { ACCOUNT_NEEDS_FAMILY, IS_BLOG_AUTHOR } from "../data/session";
import { POLICY_VERSION } from "../lib/policy";
import { SHOW_GOOGLE_AUTH } from "../lib/featureFlags";
import { callApi } from "../lib/apiFetch";
import PrivacyPolicyView from "./PrivacyPolicyView";
import TermsOfServiceView from "./TermsOfServiceView";

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

  // Checked before ACCOUNT_NEEDS_FAMILY, since a blog author also has zero
  // family_members rows — see the comment in data/people.js's
  // resolveAuthAndFamily() for why these two states must stay distinct.
  if (IS_BLOG_AUTHOR) {
    return (
      <div className="auth-panel card">
        <span className="eyebrow">Samskara team</span>
        <p className="form-hint" style={{ marginTop: 8 }}>
          You're signed in as a blog author — not a family member.
        </p>
        <button type="button" className="btn primary" style={{ marginTop: 10 }} onClick={() => { window.location.href = "/blog/editor"; }}>
          Go to the Blog editor →
        </button>
        <button className="link-btn" style={{ marginTop: 10, display: "block" }} onClick={handleSignOut}>Sign out</button>
      </div>
    );
  }

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
        <SignUpForm email={email} setEmail={setEmail} password={password} setPassword={setPassword} name={name} setName={setName} busy={busy} setBusy={setBusy} error={error} setError={setError} />
      ) : (
        <JoinForm email={email} setEmail={setEmail} password={password} setPassword={setPassword} name={name} setName={setName} code={code} setCode={setCode} busy={busy} setBusy={setBusy} error={error} setError={setError} />
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
  // Interim stopgap until a real email service is configured (see
  // api/password-reset-requests.js) — "Forgot password?" above may not
  // reliably deliver today, and a self-registered Head has no Admin above
  // them to reset them in-app the way a regular member does. This just
  // files a request for the app owner to handle manually via /superadmin.
  const [requestHelpOpen, setRequestHelpOpen] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestError, setRequestError] = useState("");

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

  async function sendHelpRequest() {
    if (!email.trim()) {
      setRequestError("Enter your email above first.");
      return;
    }
    setRequestBusy(true);
    setRequestError("");
    try {
      await callApi("/api/password-reset-requests", { action: "submit", email: email.trim(), note: requestNote.trim() });
      setRequestSent(true);
    } catch (err) {
      setRequestError(err.message);
    } finally {
      setRequestBusy(false);
    }
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
            {/* Shown first and stated plainly, same as the username-login
                branch above — this already works today with no email
                involved at all (Admin > Members > Reset password), so it's
                the fastest real fix for anyone who has a Head or Admin to
                ask. The email link and the superadmin-routed request below
                are both slower, less certain fallbacks for someone who
                doesn't. */}
            If you're a member of a family already here, your Family Head or Admin can reset it for you directly — no email needed (Admin → Members → Reset password).
            <br />
            <button type="button" className="link-btn" disabled={resetBusy} onClick={sendReset}>
              {resetBusy ? "Sending…" : "Or try an email reset link"}
            </button>
            {" · "}
            <button type="button" className="link-btn" onClick={() => { setLoginWithUsername(true); setEmail(""); setError(""); }}>
              No email? Log in with username
            </button>
            {" · "}
            <button type="button" className="link-btn" onClick={() => setRequestHelpOpen((v) => !v)}>
              No admin to ask? Request help
            </button>
          </>
        )}
      </p>
      {!loginWithUsername && requestHelpOpen && (
        requestSent ? (
          <p className="form-hint">Received — you'll be contacted once it's handled.</p>
        ) : (
          <div className="form-row">
            <p className="form-hint" style={{ marginTop: 0 }}>
              For when there's no Family Head or Admin who can reset you directly — e.g. you started your own family here and there's no one above you. This doesn't reset anything itself; someone will follow up to sort it out.
            </p>
            <label>Tell us a bit more (optional)</label>
            <textarea value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder="e.g. which family this is for, or anything else that'll help us find you" />
            {requestError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{requestError}</p>}
            <button type="button" className="btn ghost small" disabled={requestBusy} onClick={sendHelpRequest} style={{ marginTop: 8 }}>
              {requestBusy ? "Sending…" : "Send request"}
            </button>
          </div>
        )
      )}
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      <button type="submit" className="btn primary small" disabled={busy} style={{ marginTop: 10 }}>{busy ? "Signing in…" : "Log in →"}</button>
    </form>
  );
}

// Creates an authenticated identity only — deliberately asks nothing about
// family/role here. What happens next (start a new family vs. join one with
// a code) is decided one screen later, by FamilyIntentGate, the same place a
// first-time Google sign-in lands too — one funnel for both, not two.
function SignUpForm({ email, setEmail, password, setPassword, name, setName, busy, setBusy, error, setError }) {
  const [agreed, setAgreed] = useState(false);
  // Shown inline (not via onShowPrivacy/onShowTerms's full view-switch) so
  // opening either document doesn't wipe the name/email/password already
  // typed into this form — same reasoning as ConsentGate's own "viewed
  // before checkable" requirement, just without losing in-progress state.
  const [reading, setReading] = useState(null); // null | "privacy" | "terms"
  const [viewedPrivacy, setViewedPrivacy] = useState(false);
  const [viewedTerms, setViewedTerms] = useState(false);
  const bothViewed = viewedPrivacy && viewedTerms;
  // Set instead of reloading when this project requires email confirmation
  // and signUp() leaves no session behind yet — same reasoning and pattern
  // as JoinForm's identical state. Without this, a plain reload lands the
  // new account in NEEDS_LOGIN with zero explanation of what just happened.
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(), password, options: {
          data: { display_name: name.trim() || undefined },
          // Without this, Supabase falls back to the project's own Auth
          // "Site URL" setting for the confirmation email's link — which is
          // easy to leave at its local-dev default (a real incident: both
          // this project's Supabase projects had it stuck on
          // http://localhost:3000, silently locking out every real
          // self-registered signup until caught and fixed directly in
          // Supabase's dashboard). Passing it explicitly here means a
          // correct redirect no longer depends on that project setting
          // ever being right.
          emailRedirectTo: window.location.origin,
        },
      });
      if (signUpErr) throw signUpErr;
      // getSession() (not getUser()) is the only reliable way to tell
      // whether the client actually holds a usable JWT right now — see
      // JoinForm's identical check for the full reasoning.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPendingConfirmation(true);
        setBusy(false);
        return;
      }
      await recordConsent(session.user.id, POLICY_VERSION).catch(() => {});
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (pendingConfirmation) {
    return (
      <div className="form-row">
        <p className="form-hint">
          Almost there — we've sent a confirmation link to <strong>{email.trim()}</strong>. Click it, then come back
          here and log in to start your family's archive.
        </p>
      </div>
    );
  }

  if (reading) {
    return (
      <div>
        <button type="button" className="link-btn" onClick={() => setReading(null)}>← Back</button>
        {reading === "privacy" ? <PrivacyPolicyView /> : <TermsOfServiceView />}
      </div>
    );
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
      <label className="consent-check" style={{ marginTop: 14, marginBottom: 4, ...(!bothViewed ? { opacity: 0.5, cursor: "not-allowed" } : {}) }}>
        <input type="checkbox" checked={agreed} disabled={!bothViewed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          I agree to the{" "}
          <button type="button" className="link-btn" onClick={() => { setViewedPrivacy(true); setReading("privacy"); }}>Privacy Policy{viewedPrivacy ? " ✓" : ""}</button>
          {" "}and{" "}
          <button type="button" className="link-btn" onClick={() => { setViewedTerms(true); setReading("terms"); }}>Terms &amp; Conditions{viewedTerms ? " ✓" : ""}</button>
        </span>
      </label>
      {!bothViewed && <p className="form-hint">Open both above at least once to check this box.</p>}
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
  // Only asked of someone creating an account here — a returning account
  // already consented when it was made, and re-asking at every sign-in
  // teaches people to click through without reading.
  const [agreed, setAgreed] = useState(false);
  // Shown inline rather than navigating away, same reasoning as
  // SignUpForm's identical state — opening either document shouldn't wipe
  // the invite code/email/password already typed into this form.
  const [reading, setReading] = useState(null); // null | "privacy" | "terms"
  const [viewedPrivacy, setViewedPrivacy] = useState(false);
  const [viewedTerms, setViewedTerms] = useState(false);
  const bothViewed = viewedPrivacy && viewedTerms;
  // Set instead of reloading when a brand-new signup leaves no session
  // behind (email confirmation required on this project) — redeemInvite()
  // needs a real auth.uid() server-side, so it must never be called before
  // one exists. Shown in place of the form rather than as an error, since
  // nothing actually failed yet.
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!alreadySignedIn) {
        if (isNewAccount) {
          const { error: signUpErr } = await supabase.auth.signUp({
            email: email.trim(), password, options: {
              data: { display_name: name.trim() || undefined },
              // Explicit for the same reason as SignUpForm's identical
              // option (see its comment) — and here, the full current URL
              // rather than just the origin, so confirming the email
              // returns them to this same invite link with ?code= intact
              // instead of just the site's root.
              emailRedirectTo: window.location.href,
            },
          });
          if (signUpErr) throw signUpErr;
          // getSession() (not getUser()) is the only reliable way to tell
          // whether the client actually holds a usable JWT right now — a
          // freshly-resolved signUp() doesn't guarantee one yet (e.g. this
          // project requiring email confirmation, or the SDK not having
          // finished attaching the new session internally). redeemInvite()
          // below depends on auth.uid() being set server-side; calling it
          // without a confirmed session here is exactly what used to
          // produce a raw "null value in column user_id" database error
          // instead of a clear message.
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            setPendingConfirmation(true);
            setBusy(false);
            return;
          }
          // Recorded here so consent is on file from the moment the account
          // exists.
          await recordConsent(session.user.id, POLICY_VERSION).catch(() => {});
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

  if (pendingConfirmation) {
    return (
      <div className="form-row">
        <p className="form-hint">
          Almost there — we've sent a confirmation link to <strong>{email.trim()}</strong>. Click it, then come back to{" "}
          <strong>this same invite link</strong> and log in to finish joining the family.
        </p>
      </div>
    );
  }

  if (reading) {
    return (
      <div>
        <button type="button" className="link-btn" onClick={() => setReading(null)}>← Back</button>
        {reading === "privacy" ? <PrivacyPolicyView /> : <TermsOfServiceView />}
      </div>
    );
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
        <>
          <label className="consent-check" style={{ marginTop: 14, marginBottom: 4, ...(!bothViewed ? { opacity: 0.5, cursor: "not-allowed" } : {}) }}>
            <input type="checkbox" checked={agreed} disabled={!bothViewed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              I agree to the{" "}
              <button type="button" className="link-btn" onClick={() => { setViewedPrivacy(true); setReading("privacy"); }}>Privacy Policy{viewedPrivacy ? " ✓" : ""}</button>
              {" "}and{" "}
              <button type="button" className="link-btn" onClick={() => { setViewedTerms(true); setReading("terms"); }}>Terms &amp; Conditions{viewedTerms ? " ✓" : ""}</button>
            </span>
          </label>
          {!bothViewed && <p className="form-hint">Open both above at least once to check this box.</p>}
        </>
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
