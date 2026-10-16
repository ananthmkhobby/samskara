import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { recordConsent } from "../data/familyDb";
import { markConsentGiven } from "../data/session";
import { POLICY_VERSION, POLICY_VERSION_LABEL } from "../lib/policy";
import PrivacyPolicyView from "./PrivacyPolicyView";
import TermsOfServiceView from "./TermsOfServiceView";

// Shown once to a signed-in account that hasn't accepted the current policy
// version. Deliberately blocking: it renders instead of the app, not over it,
// so there's no way to browse past it and no ambiguity later about whether
// someone actually saw it.
//
// The box starts unticked and Continue stays disabled until it's ticked — a
// pre-ticked box, or a "by continuing you agree" line with no affirmative
// action, is not valid consent under the DPDP Act and would make the whole
// exercise pointless. The box itself also stays disabled until both
// documents have actually been opened at least once — "I agree" to
// something you were never made to even look at is the same hollow consent
// problem, just moved one step earlier.
export default function ConsentGate({ userId, onAccepted }) {
  const [agreed, setAgreed] = useState(false);
  const [reading, setReading] = useState(null); // null | "privacy" | "terms"
  const [viewedPrivacy, setViewedPrivacy] = useState(false);
  const [viewedTerms, setViewedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bothViewed = viewedPrivacy && viewedTerms;

  async function accept() {
    setBusy(true);
    setError("");
    try {
      await recordConsent(userId, POLICY_VERSION);
      markConsentGiven();
      onAccepted();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (reading) {
    return (
      <div className="login-page login-page-scroll">
        <button className="login-help-link login-back-link" onClick={() => setReading(null)}>← Back</button>
        <div className="login-help-wrap">
          {reading === "privacy" ? <PrivacyPolicyView /> : <TermsOfServiceView />}
        </div>
      </div>
    );
  }

  return (
    <div className="login-page login-page-scroll">
      <div className="login-help-wrap">
        <section className="wrap">
          <div className="section-head">
            <h2>Before you go in</h2>
            <p>A family archive holds real details about real people, so we'd rather you agreed to this knowingly than clicked past it.</p>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <p className="folio-summary" style={{ marginBottom: 10 }}>
              In short: your family's archive is visible only to people your family has invited, it is never sold or
              shared with anyone else, and you can ask for your own data — or the whole family's — to be deleted at
              any time.
            </p>
            <p className="folio-summary">
              That short version isn't the agreement, though. The two documents below are, and they're worth the
              five minutes.
            </p>
          </div>

          <div className="consent-doc-links">
            <button type="button" className="card more-menu-item" onClick={() => { setViewedPrivacy(true); setReading("privacy"); }}>
              <span className="more-menu-text">
                <b>Privacy Policy{viewedPrivacy ? " ✓" : ""}</b>
                <span>What's collected, who can see it, and how to get it deleted</span>
              </span>
            </button>
            <button type="button" className="card more-menu-item" onClick={() => { setViewedTerms(true); setReading("terms"); }}>
              <span className="more-menu-text">
                <b>Terms &amp; Conditions{viewedTerms ? " ✓" : ""}</b>
                <span>What you can expect from us, and what we ask of you</span>
              </span>
            </button>
          </div>

          <label className="consent-check" style={!bothViewed ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
            <input type="checkbox" checked={agreed} disabled={!bothViewed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              I have read and agree to the Privacy Policy and Terms &amp; Conditions
              <em> (version of {POLICY_VERSION_LABEL})</em>
            </span>
          </label>
          {!bothViewed && (
            <p className="form-hint" style={{ marginTop: 6 }}>Open both documents above at least once to check this box.</p>
          )}

          {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}

          <button type="button" className="btn primary" disabled={!agreed || busy} onClick={accept} style={{ marginTop: 4 }}>
            {busy ? "Saving…" : "Agree and continue →"}
          </button>

          <p className="form-hint" style={{ marginTop: 14 }}>
            Not comfortable with it?{" "}
            <button type="button" className="link-btn" onClick={() => supabase.auth.signOut().then(() => window.location.reload())}>
              Sign out
            </button>
            {" "}— nothing is added to the archive on your behalf either way.
          </p>
        </section>
      </div>
    </div>
  );
}
