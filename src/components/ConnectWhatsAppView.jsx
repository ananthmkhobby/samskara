import { useEffect, useState } from "react";
import { redeemWhatsAppLink, isWhatsAppConnected, fetchNudgePreference, setNudgePreference } from "../data/familyDb";
import { CURRENT_USER_ID, IS_DEMO } from "../data/session";
import { WHATSAPP_DISPLAY_NUMBER } from "../lib/whatsapp";

// Landing page for the link Samskara sends on WhatsApp the first time an
// unrecognized number messages it (see api/whatsapp-webhook.js) — that's
// the `token` path below, "connecting" -> "done"/"error". Reached only once
// the person is already signed in — the app's normal login gate handles
// that before this ever renders — so all that path does is redeem the
// one-time code against whichever family they're already a member of.
//
// Reached WITHOUT a token, it's the "before" explainer instead (MoreMenu's
// "Connect on WhatsApp" entry, or the Home promo card's "How it works") —
// what number to text and what happens next, the one thing that was
// previously only written down in docs/WHATSAPP_GUIDE.md and never shown
// anywhere in the app itself.
export default function ConnectWhatsAppView({ token, onDone }) {
  const [status, setStatus] = useState(token ? "connecting" : "explainer");
  const [error, setError] = useState("");
  const [alreadyConnected, setAlreadyConnected] = useState(false);
  const [nudgesEnabled, setNudgesEnabled] = useState(false);
  const [nudgeBusy, setNudgeBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      if (!IS_DEMO) isWhatsAppConnected().then(setAlreadyConnected).catch(() => {});
      return;
    }
    let cancelled = false;
    redeemWhatsAppLink(token)
      .then(() => { if (!cancelled) setStatus("done"); })
      .catch((err) => { if (!cancelled) { setError(err.message); setStatus("error"); } })
      .finally(() => {
        // App.jsx stashes the token here so it survives the login page's
        // full reload (by then the URL's own ?token= has already been
        // stripped) — cleared once this attempt is done, successful or
        // not, so a later unrelated visit to this page doesn't silently
        // retry a stale or already-used code.
        try { localStorage.removeItem("vamsha.whatsappLinkToken"); } catch { /* storage unavailable */ }
      });
    return () => { cancelled = true; };
  }, [token]);

  // Nudge opt-in is shown (NudgeToggle) on both "done" and "explainer" —
  // load whatever's already saved for either, regardless of whether a
  // phone number happens to be connected yet; the preference itself can be
  // set ahead of connecting, same as it can be revoked after. Originally
  // gated this load on `alreadyConnected` too, which was wrong: it meant a
  // toggle saved correctly (confirmed directly against the DB) never read
  // back on a later visit for anyone who hadn't also linked a number.
  useEffect(() => {
    const relevant = status === "done" || status === "explainer";
    if (!relevant || IS_DEMO || !CURRENT_USER_ID) return;
    let cancelled = false;
    fetchNudgePreference(CURRENT_USER_ID).then((v) => { if (!cancelled) setNudgesEnabled(v); }).catch(() => {});
    return () => { cancelled = true; };
  }, [status, alreadyConnected]);

  async function toggleNudges() {
    const next = !nudgesEnabled;
    setNudgeBusy(true);
    setNudgesEnabled(next); // optimistic — a failed toggle isn't worth a confusing rollback for a low-stakes preference
    try {
      await setNudgePreference(CURRENT_USER_ID, next);
    } catch {
      setNudgesEnabled(!next);
    } finally {
      setNudgeBusy(false);
    }
  }

  function NudgeToggle() {
    if (IS_DEMO) return null;
    return (
      <label className="form-hint" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, cursor: "pointer" }}>
        <input type="checkbox" checked={nudgesEnabled} disabled={nudgeBusy} onChange={toggleNudges} />
        Also let Samskara message me on WhatsApp when something needs my attention (e.g. items waiting for my review). You can turn this off any time from this same page.
      </label>
    );
  }

  return (
    <section className="wrap" style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="section-head">
        <h2>Connect WhatsApp</h2>
      </div>
      <div className="card" style={{ padding: 24 }}>
        {status === "explainer" && (
          <>
            {alreadyConnected ? (
              <p><strong>Your number is already connected.</strong></p>
            ) : (
              <>
                <p>Message <strong>{WHATSAPP_DISPLAY_NUMBER}</strong> from WhatsApp — anything at all, like "hi" — to get a one-time link that connects your number.</p>
                <p className="form-hint">Once connected, you can send photos, voice notes, and stories straight from WhatsApp, and (for a Head/Admin) update folio details or browse the family gallery. See the full list of what you can send in the WhatsApp guide.</p>
              </>
            )}
            <NudgeToggle />
          </>
        )}
        {status === "connecting" && <p>Connecting your WhatsApp number…</p>}
        {status === "done" && (
          <>
            <p><strong>Connected successfully.</strong></p>
            <p className="form-hint">You can now send photos, stories, and voice memories to Samskara on WhatsApp, and they'll be preserved in your family's archive.</p>
            <NudgeToggle />
          </>
        )}
        {status === "error" && (
          <>
            <p style={{ color: "var(--maroon-ink)" }}>{error}</p>
            <p className="form-hint">Send a new message on WhatsApp to get a fresh link, then try again.</p>
          </>
        )}
        <button type="button" className="btn primary" style={{ marginTop: 16 }} onClick={onDone}>Go to Samskara</button>
      </div>
    </section>
  );
}
