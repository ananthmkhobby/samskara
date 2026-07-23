import { useState } from "react";
import { geocodePlace } from "../lib/geocode";

export default function AddFamilyMemberModal({ request, onCancel, onSubmit, canModerate }) {
  const isSpouse = request.relation === "spouse";
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [city, setCity] = useState("");
  const [contributor, setContributor] = useState("");
  const [busy, setBusy] = useState(false);
  const [geoError, setGeoError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    let geo;
    if (city.trim()) {
      setBusy(true);
      setGeoError("");
      try {
        geo = await geocodePlace(city.trim());
      } catch (err) {
        setGeoError(err.message);
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    onSubmit({ name: name.trim(), birthYear: birthYear.trim(), geo, contributor: contributor.trim() || "Anonymous" });
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-panel">
        <button className="modal-close on-paper" onClick={onCancel} aria-label="Close">✕</button>
        <div className="modal-body">
          <span className="eyebrow">Add to the tree</span>
          <h2 style={{ fontSize: 20, marginTop: 6 }}>
            {isSpouse ? `Add a spouse for ${request.anchorName}` : `Add a son or daughter for ${request.anchorName}`}
          </h2>
          <p className="form-hint" style={{ marginTop: 6 }}>{canModerate ? "You're viewing as Admin/Family Head — they'll be added to the tree immediately." : "This goes to an admin for review. Once approved, they'll appear in the tree right away."}</p>
          <form onSubmit={submit}>
            <div className="form-row">
              <label>{isSpouse ? "Spouse's name" : "Their name"}</label>
              <input type="text" placeholder="e.g. Lakshmamma" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Birth year (optional)</label>
              <input type="text" inputMode="numeric" placeholder="e.g. 1958" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
            </div>
            <div className="form-row">
              <label>City where they live now (optional)</label>
              <input type="text" placeholder="e.g. Mangalore" value={city} onChange={(e) => setCity(e.target.value)} />
              <p className="form-hint">Adding a city shows them as a pin on the family's Journey map.</p>
              {geoError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{geoError}</p>}
            </div>
            <div className="form-row">
              <label>Your name</label>
              <input type="text" placeholder="e.g. Kavya Reddy" value={contributor} onChange={(e) => setContributor(e.target.value)} />
            </div>
            <div className="folio-actions">
              <button type="submit" className="btn primary" disabled={!name.trim() || busy}>{busy ? "Looking up city…" : canModerate ? "Add now" : "Submit for review"}</button>
              <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
