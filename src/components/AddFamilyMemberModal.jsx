import { useState } from "react";
import { geocodePlace } from "../lib/geocode";
import { CloseIcon } from "./Icons";
import { useModalA11y } from "../hooks/useModalA11y";

export default function AddFamilyMemberModal({ request, onCancel, onSubmit, canModerate }) {
  const modalA11y = useModalA11y(onCancel);
  const isSpouse = request.relation === "spouse";
  const isParent = request.relation === "parent";
  const isSibling = request.relation === "sibling";
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [city, setCity] = useState("");
  const [contributor, setContributor] = useState("");
  // Optional, same "never guessed, never required" posture as the
  // existing bulk Admin -> Genders tool (people.gender's own column
  // comment) -- this just asks it at the one moment it's most naturally
  // already known, instead of only ever being a separate admin trip
  // afterward. Labels adapt to the relation being added so "Father" reads
  // as an actual question, not a raw "Male/Female" picker.
  const [gender, setGender] = useState("");
  const [busy, setBusy] = useState(false);
  const [geoError, setGeoError] = useState("");
  const genderLabels = isParent
    ? [["male", "Father"], ["female", "Mother"]]
    : isSpouse
    ? [["male", "Husband"], ["female", "Wife"]]
    : isSibling
    ? [["male", "Brother"], ["female", "Sister"]]
    : [["male", "Son"], ["female", "Daughter"]];

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
    onSubmit({ name: name.trim(), birthYear: birthYear.trim(), geo, contributor: contributor.trim() || "Anonymous", gender: gender || null });
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-panel" {...modalA11y}>
        <button className="modal-close on-paper" onClick={onCancel} aria-label="Close"><CloseIcon /></button>
        <div className="modal-body">
          <span className="eyebrow">Add to the tree</span>
          <h2 style={{ fontSize: 20, marginTop: 6 }}>
            {isSpouse ? `Add a spouse for ${request.anchorName}` : isParent ? `Add a parent for ${request.anchorName}` : isSibling ? `Add a brother or sister for ${request.anchorName}` : `Add a son or daughter for ${request.anchorName}`}
          </h2>
          <p className="form-hint" style={{ marginTop: 6 }}>
            {isParent
              ? "This grows the tree one generation further back — the new person becomes the root of this branch. Add one parent now, then open their folio to add their spouse (the other parent) the same way you'd add any spouse."
              : isSibling
              ? `They'll share the same parent${request.anchorName ? "s already on record for " + request.anchorName : "s"} — useful for documents like the Vamshavali, which looks for siblings by shared parents.`
              : canModerate ? "As an Admin/Family Head, they'll be added to the tree immediately." : "This goes to an admin for review. Once approved, they'll appear in the tree right away."}
          </p>
          <form onSubmit={submit}>
            <div className="form-row">
              <label>{isSpouse ? "Spouse's name" : "Their name"}</label>
              <input type="text" placeholder="e.g. Lakshmamma" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-row">
              <label>{genderLabels[0][1]} or {genderLabels[1][1]}? (optional)</label>
              <div className="tag-row">
                {genderLabels.map(([value, label]) => (
                  <button
                    key={value} type="button" className={`chip${gender === value ? " active" : ""}`}
                    onClick={() => setGender((g) => (g === value ? "" : value))}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="form-hint">Used to say things like "Father" or "Mother" elsewhere in the record — never required, never guessed.</p>
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
