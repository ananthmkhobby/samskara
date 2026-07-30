import { useState } from "react";
import { redeemInvite } from "../data/familyDb";

// The "already signed in, just redeem another invite" flow — used both
// from the family switcher's "+ Join another family" action and when
// someone opens a second family's invite link while already logged in.
// Deliberately just a code box: the account already exists, so there's
// nothing else to fill in.
export default function JoinFamilyModal({ initialCode = "", onClose }) {
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // A code arriving pre-filled came from a real invite link — showing it as
  // an editable field anyway reads as asking the user to re-enter something
  // they already supplied by clicking the link. Only ask when there's
  // genuinely no code yet (opened via "+ Join another family" with nothing
  // pre-filled), with a manual-entry escape hatch in case a pre-filled code
  // is ever wrong.
  const [showCodeField, setShowCodeField] = useState(!initialCode);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await redeemInvite(code.trim());
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel" style={{ maxWidth: 420 }}>
        <button className="modal-close on-paper" onClick={onClose} aria-label="Close">✕</button>
        <div className="modal-body">
          <span className="eyebrow">Join another family</span>
          <h2 style={{ fontSize: 20, marginTop: 6 }}>Redeem an invite code</h2>
          <p className="form-hint" style={{ marginTop: 6 }}>
            You'll stay signed in as yourself — this just adds another family tree you can switch to, without needing a second account.
          </p>
          <form onSubmit={submit}>
            {showCodeField ? (
              <div className="form-row">
                <label>Invite code</label>
                <input type="text" required autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. a1b2c3d4e5" />
              </div>
            ) : (
              <p className="form-hint">
                Invite code applied from your link.{" "}
                <button type="button" className="link-btn" onClick={() => setShowCodeField(true)}>Not the right code?</button>
              </p>
            )}
            {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
            <div className="folio-actions">
              <button type="submit" className="btn primary" disabled={busy}>{busy ? "Joining…" : "Join this family →"}</button>
              <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
