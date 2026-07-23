import { useState } from "react";
import { VALUES } from "../data/people";
import { geocodePlace } from "../lib/geocode";

export default function EditModal({ request, onCancel, onSubmit, canModerate }) {
  const isHeritage = request.field === "heritage";
  const isLifeLesson = request.field === "lifeLesson";
  const isGeo = request.field === "geo";
  const [value, setValue] = useState(request.value || "");
  const [rashi, setRashi] = useState(request.rashi || "");
  const [gotra, setGotra] = useState(request.gotra || "");
  const [selectedValues, setSelectedValues] = useState(request.values || []);
  const [contributor, setContributor] = useState("");
  const [busy, setBusy] = useState(false);
  const [geoError, setGeoError] = useState("");

  function toggleValue(v) {
    setSelectedValues((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (isGeo) {
      if (!value.trim()) return;
      setBusy(true);
      setGeoError("");
      let geo;
      try {
        geo = await geocodePlace(value.trim());
      } catch (err) {
        setGeoError(err.message);
        setBusy(false);
        return;
      }
      setBusy(false);
      onSubmit({ field: request.field, fieldLabel: request.fieldLabel, content: JSON.stringify(geo), contributor: contributor.trim() || "Anonymous" });
      return;
    }
    const content = isHeritage
      ? JSON.stringify({ rashi: rashi.trim(), gotra: gotra.trim() })
      : isLifeLesson
        ? JSON.stringify({ quote: value.trim(), values: selectedValues })
        : value.trim();
    onSubmit({ field: request.field, fieldLabel: request.fieldLabel, content, contributor: contributor.trim() || "Anonymous" });
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-panel">
        <button className="modal-close on-paper" onClick={onCancel} aria-label="Close">✕</button>
        <div className="modal-body">
          <span className="eyebrow">Propose a change</span>
          <h2 style={{ fontSize: 20, marginTop: 6 }}>Edit: {request.fieldLabel}</h2>
          <p className="form-hint" style={{ marginTop: 6 }}>{canModerate ? "You're viewing as Admin/Family Head — this applies immediately, no review needed." : "Your change goes to an admin for verification. It won't appear on the folio until approved."}</p>
          <form onSubmit={submit}>
            {isHeritage ? (
              <>
                <div className="form-row">
                  <label>Rashi (optional)</label>
                  <input type="text" placeholder="e.g. Simha" value={rashi} onChange={(e) => setRashi(e.target.value)} />
                </div>
                <div className="form-row">
                  <label>Gotra (optional)</label>
                  <input type="text" placeholder="e.g. Bharadwaja" value={gotra} onChange={(e) => setGotra(e.target.value)} />
                </div>
              </>
            ) : isLifeLesson ? (
              <>
                <div className="form-row">
                  <label>Proposed life lesson quote</label>
                  <textarea style={{ minHeight: 100 }} value={value} onChange={(e) => setValue(e.target.value)} />
                </div>
                <div className="form-row">
                  <label>Which values does this reflect? (optional)</label>
                  <div className="tag-row">
                    {VALUES.map((v) => (
                      <button type="button" key={v} className={`chip${selectedValues.includes(v) ? " active" : ""}`} onClick={() => toggleValue(v)}>{v}</button>
                    ))}
                  </div>
                </div>
              </>
            ) : isGeo ? (
              <div className="form-row">
                <label>City</label>
                <input type="text" placeholder="e.g. Mangalore" value={value} onChange={(e) => setValue(e.target.value)} />
                <p className="form-hint">This shows them as a pin on the family's Journey map.</p>
                {geoError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{geoError}</p>}
              </div>
            ) : (
              <div className="form-row">
                <label>Proposed {request.fieldLabel.toLowerCase()}</label>
                <textarea style={{ minHeight: 140 }} value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
            )}
            <div className="form-row">
              <label>Your name</label>
              <input type="text" placeholder="e.g. Kavya Reddy" value={contributor} onChange={(e) => setContributor(e.target.value)} />
            </div>
            <div className="folio-actions">
              <button type="submit" className="btn primary" disabled={busy}>{busy ? "Looking up city…" : canModerate ? "Apply now" : "Submit for review"}</button>
              <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
