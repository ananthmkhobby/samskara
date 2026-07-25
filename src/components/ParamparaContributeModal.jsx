import { useState } from "react";
import { PARAMPARA_CATEGORIES, LINEAGE_CATEGORY } from "../lib/parampara";
import { resizeImage } from "../lib/imageResize";
import { uploadFamilyMedia } from "../lib/mediaUpload";
import { CURRENT_FAMILY_ID } from "../data/session";

const CATEGORY_CHOICES = [...PARAMPARA_CATEGORIES, LINEAGE_CATEGORY];

export default function ParamparaContributeModal({ onCancel, onSubmit, canModerate }) {
  const [category, setCategory] = useState(PARAMPARA_CATEGORIES[0].key);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sinceYear, setSinceYear] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoError, setPhotoError] = useState("");
  // Lineage is a structured chain, not a title+story — its own set of fields.
  const [gotra, setGotra] = useState("");
  const [pravara, setPravara] = useState("");
  const [veda, setVeda] = useState("");
  const [shakha, setShakha] = useState("");
  const [guru, setGuru] = useState("");
  const [generations, setGenerations] = useState("");
  const [contributor, setContributor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isLineage = category === "lineage";
  const categoryDef = CATEGORY_CHOICES.find((c) => c.key === category);

  async function handlePhotoFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoError("");
    try {
      const { dataUrl, blob } = await resizeImage(file);
      setPhotoDataUrl(dataUrl);
      setPhotoBlob(blob);
    } catch {
      setPhotoError("Couldn't read that image — try a different file.");
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");

    if (isLineage) {
      const payload = { gotra: gotra.trim(), pravara: pravara.trim(), veda: veda.trim(), shakha: shakha.trim(), guru: guru.trim(), generations: generations.trim() };
      if (!Object.values(payload).some(Boolean)) { setError("Fill in at least one field."); return; }
      await onSubmit({
        type: "parampara", field: "lineage", fieldLabel: LINEAGE_CATEGORY.label,
        title: "Family lineage", content: JSON.stringify(payload), contributor: contributor.trim() || "Anonymous",
      });
      return;
    }

    if (!title.trim() || !description.trim()) { setError("Title and story are both needed."); return; }
    let mediaPath = null;
    try {
      if (photoBlob) {
        setSubmitting(true);
        mediaPath = await uploadFamilyMedia(CURRENT_FAMILY_ID, "parampara", photoBlob, "jpg");
      }
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }
    const payload = { description: description.trim(), sinceYear: sinceYear ? Number(sinceYear) : null, mediaPath };
    await onSubmit({
      type: "parampara", field: category, fieldLabel: categoryDef.label,
      title: title.trim(), content: JSON.stringify(payload), contributor: contributor.trim() || "Anonymous",
    });
    setSubmitting(false);
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-panel">
        <button className="modal-close on-paper" onClick={onCancel} aria-label="Close">✕</button>
        <div className="modal-body">
          <span className="eyebrow">Parampara</span>
          <h2 style={{ fontSize: 20, marginTop: 6 }}>Add to your family's heritage</h2>
          <form onSubmit={submit}>
            <div className="form-row">
              <label>What kind of Parampara is this?</label>
              <div className="type-grid">
                {CATEGORY_CHOICES.map((c) => (
                  <button type="button" key={c.key} className={category === c.key ? "active" : ""} onClick={() => setCategory(c.key)}>
                    <span style={{ fontSize: 18 }}>{c.icon}</span><span>{c.label}</span>
                  </button>
                ))}
              </div>
              {categoryDef.prompt && <p className="form-hint">{categoryDef.prompt}</p>}
            </div>

            {isLineage ? (
              <>
                <div className="form-row"><label>Gotra</label><input type="text" value={gotra} onChange={(e) => setGotra(e.target.value)} placeholder="e.g. Bharadwaja" /></div>
                <div className="form-row"><label>Pravara</label><input type="text" value={pravara} onChange={(e) => setPravara(e.target.value)} placeholder="e.g. Bharadwaja, Angirasa, Barhaspatya" /></div>
                <div className="form-row"><label>Veda</label><input type="text" value={veda} onChange={(e) => setVeda(e.target.value)} placeholder="e.g. Yajurveda" /></div>
                <div className="form-row"><label>Shakha</label><input type="text" value={shakha} onChange={(e) => setShakha(e.target.value)} placeholder="e.g. Taittiriya" /></div>
                <div className="form-row"><label>Family guru / mutt (optional)</label><input type="text" value={guru} onChange={(e) => setGuru(e.target.value)} /></div>
                <div className="form-row"><label>Known generations (optional)</label><input type="text" value={generations} onChange={(e) => setGenerations(e.target.value)} placeholder="e.g. 5 generations traced back to..." /></div>
                <p className="form-hint">Fine to fill in only what's known today — this can be added to gradually.</p>
              </>
            ) : (
              <>
                <div className="form-row">
                  <label>Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Friday Lakshmi Pooja" />
                </div>
                <div className="form-row">
                  <label>The story</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is it, who keeps it going, how did it start?" />
                </div>
                <div className="form-row">
                  <label>Since which year? (optional)</label>
                  <input type="number" value={sinceYear} onChange={(e) => setSinceYear(e.target.value)} placeholder="e.g. 1882" style={{ maxWidth: 160 }} />
                  <p className="form-hint">If known, this shows as "continued for N years" — skip it if not.</p>
                </div>
                <div className="form-row">
                  <label>Photo (optional)</label>
                  <input type="file" accept="image/*" onChange={handlePhotoFile} />
                  {photoDataUrl && <img src={photoDataUrl} alt="" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, marginTop: 10, border: "1px solid var(--line-strong)" }} />}
                  {photoError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{photoError}</p>}
                </div>
              </>
            )}

            <div className="form-row">
              <label>Your name</label>
              <input type="text" placeholder="e.g. Kavya Reddy" value={contributor} onChange={(e) => setContributor(e.target.value)} />
            </div>
            {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
            <div className="folio-actions">
              <button type="submit" className="btn primary" disabled={submitting}>{submitting ? "Uploading…" : canModerate ? "Add now" : "Submit for review"}</button>
              <button type="button" className="btn ghost" onClick={onCancel} disabled={submitting}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
