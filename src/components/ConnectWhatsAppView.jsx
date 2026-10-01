import { useEffect, useState } from "react";
import { redeemWhatsAppLink } from "../data/familyDb";

// Landing page for the link Samskara sends on WhatsApp the first time an
// unrecognized number messages it (see api/whatsapp-webhook.js). Reached
// only once the person is already signed in — the app's normal login gate
// handles that before this ever renders — so all this does is redeem the
// one-time code against whichever family they're already a member of.
export default function ConnectWhatsAppView({ token, onDone }) {
  const [status, setStatus] = useState(token ? "connecting" : "missing");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
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

  return (
    <section className="wrap" style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="section-head">
        <h2>Connect WhatsApp</h2>
      </div>
      <div className="card" style={{ padding: 24 }}>
        {status === "missing" && (
          <p>This page needs a connection link from a WhatsApp message Samskara sent you — open that link instead of this page directly.</p>
        )}
        {status === "connecting" && <p>Connecting your WhatsApp number…</p>}
        {status === "done" && (
          <>
            <p><strong>Connected successfully.</strong></p>
            <p className="form-hint">You can now send photos, stories, and voice memories to Samskara on WhatsApp, and they'll be preserved in your family's archive.</p>
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
