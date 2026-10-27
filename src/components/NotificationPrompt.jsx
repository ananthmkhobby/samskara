import { useState } from "react";

// A real, unmissable one-time ask — not the quiet dismissible card on Home
// (HomePromoCarousel), which plenty of people scroll straight past. Shown
// once per app open (App.jsx's own state, not localStorage — see its
// comment) whenever the signed-in account hasn't enabled push yet, so it
// reappears next time they open the app rather than being silenced
// forever after one glance. Stops reappearing entirely the moment the
// account actually subscribes, or if the OS permission gets denied
// outright (nothing this screen does can fix a denial).
export default function NotificationPrompt({ onEnable, onLater }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function enable() {
    setBusy(true);
    setError("");
    try {
      await onEnable();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="login-page login-page-scroll">
      <div className="login-help-wrap">
        <section className="wrap">
          <div className="section-head">
            <span className="eyebrow">🔔 Stay in the loop</span>
            <h2>Turn on notifications?</h2>
            <p>
              Get pushed a message right on this device the moment someone in your family adds a photo, a story,
              or sends you one to review — without having to keep checking back.
            </p>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <p className="folio-summary" style={{ marginBottom: 10 }}>
              Your browser will ask for permission — that's the only step. You can turn this off any time from
              More → Notifications.
            </p>
            <p className="folio-summary">
              On a phone, you may also need to allow notifications for this app in your phone's own settings if
              they still don't show up after allowing here.
            </p>
          </div>

          {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}

          <button type="button" className="btn primary" disabled={busy} onClick={enable} style={{ marginTop: 4 }}>
            {busy ? "Working…" : "Turn on notifications →"}
          </button>

          <p className="form-hint" style={{ marginTop: 14 }}>
            <button type="button" className="link-btn" onClick={onLater}>Maybe later</button>
            {" "}— we'll ask again next time you open Samskara.
          </p>
        </section>
      </div>
    </div>
  );
}
