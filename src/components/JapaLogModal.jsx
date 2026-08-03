import { useState } from "react";
import { PEOPLE } from "../data/people";
import { MY_PERSON_ID } from "../data/session";
import { PRACTICES, CUSTOM_PRACTICE_KEY, QUICK_COUNTS } from "../lib/japa";
import { yearsLabel, todayStr } from "../data/helpers";

// Standalone overlay, not anchored to a Folio (unlike EditModal) — this is
// reachable from the Home dashboard card with no person already in
// context, so it needs its own "who is this for" picker. Defaults to the
// logged-in user's own linked person when one exists, since logging your
// own count is the common case; still freely switchable to log on behalf
// of an elder relative who doesn't use the app themselves.
export default function JapaLogModal({ onCancel, onSubmit }) {
  const [personId, setPersonId] = useState(MY_PERSON_ID || "");
  const [practiceKey, setPracticeKey] = useState(PRACTICES[0].key);
  const [customLabel, setCustomLabel] = useState("");
  const [count, setCount] = useState(1);
  const [loggedDate, setLoggedDate] = useState(todayStr());
  const [contributor, setContributor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isCustom = practiceKey === CUSTOM_PRACTICE_KEY;

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!personId) { setError("Choose who this count is for."); return; }
    const n = Number(count);
    if (!Number.isFinite(n) || n <= 0) { setError("Enter a count greater than zero."); return; }
    if (isCustom && !customLabel.trim()) { setError("Name the practice, or pick one from the list."); return; }
    setError("");
    setBusy(true);
    try {
      const practiceLabel = isCustom ? customLabel.trim() : PRACTICES.find((p) => p.key === practiceKey).label;
      await onSubmit({
        personId, practiceKey, practiceLabel, count: n, loggedDate,
        contributor: contributor.trim() || "Anonymous",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-panel">
        <button className="modal-close on-paper" onClick={onCancel} aria-label="Close">✕</button>
        <div className="modal-body">
          <span className="eyebrow">🪔 Japa & Chanting</span>
          <h2 style={{ fontSize: 20, marginTop: 6 }}>Log a count</h2>
          <p className="form-hint" style={{ marginTop: 6 }}>Applies right away — no review needed, same as marking a book as read.</p>
          <form onSubmit={submit}>
            <div className="form-row">
              <label>Who is this for?</label>
              <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
                <option value="">— choose —</option>
                {[...PEOPLE].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{yearsLabel(p) ? ` (${yearsLabel(p)})` : ""}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Practice</label>
              <div className="tag-row">
                {PRACTICES.map((p) => (
                  <button type="button" key={p.key} className={`chip${practiceKey === p.key ? " active" : ""}`} onClick={() => setPracticeKey(p.key)}>{p.label}</button>
                ))}
                <button type="button" className={`chip${isCustom ? " active" : ""}`} onClick={() => setPracticeKey(CUSTOM_PRACTICE_KEY)}>Other…</button>
              </div>
              {isCustom && (
                <input
                  type="text" placeholder="e.g. Lalitha Sahasranama" value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)} style={{ marginTop: 8 }}
                />
              )}
            </div>
            <div className="form-row">
              <label>Count</label>
              <input type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} style={{ maxWidth: 120 }} />
              <div className="tag-row" style={{ marginTop: 8 }}>
                {QUICK_COUNTS.map((n) => (
                  <button type="button" key={n} className="chip" onClick={() => setCount(n)}>{n}</button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <label>Date</label>
              <input type="date" value={loggedDate} max={todayStr()} onChange={(e) => setLoggedDate(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Your name</label>
              <input type="text" placeholder="e.g. Kavya Reddy" value={contributor} onChange={(e) => setContributor(e.target.value)} />
            </div>
            {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
            <div className="folio-actions">
              <button type="submit" className="btn primary" disabled={busy}>{busy ? "Logging…" : "Log it"}</button>
              <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
