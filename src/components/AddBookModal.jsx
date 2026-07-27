import { useState } from "react";
import { LIBRARY_CATEGORIES } from "../lib/library";
import { resizeImage } from "../lib/imageResize";
import { uploadFamilyMedia } from "../lib/mediaUpload";
import { CURRENT_FAMILY_ID } from "../data/session";

export default function AddBookModal({ onCancel, onSubmit, canModerate }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(LIBRARY_CATEGORIES[0].key);
  const [story, setStory] = useState("");
  const [coverDataUrl, setCoverDataUrl] = useState("");
  const [coverBlob, setCoverBlob] = useState(null);
  const [coverError, setCoverError] = useState("");
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [contributor, setContributor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleCoverFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setCoverError("");
    try {
      const { dataUrl, blob } = await resizeImage(file);
      setCoverDataUrl(dataUrl);
      setCoverBlob(blob);
    } catch {
      setCoverError("Couldn't read that image — try a different file.");
    }
  }

  function handleFileInput(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFileError("");
    if (f.size > 25 * 1024 * 1024) { setFileError("That file is larger than 25MB — try a smaller copy."); return; }
    setFile(f);
  }

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (!title.trim()) { setError("This book needs a title."); return; }

    let coverPath = null;
    let filePath = null;
    try {
      if (coverBlob) {
        setSubmitting(true);
        coverPath = await uploadFamilyMedia(CURRENT_FAMILY_ID, "library", coverBlob, "jpg");
      }
      if (file) {
        setSubmitting(true);
        filePath = await uploadFamilyMedia(CURRENT_FAMILY_ID, "library", file, file.name.split(".").pop() || "pdf");
      }
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }

    const categoryDef = LIBRARY_CATEGORIES.find((c) => c.key === category);
    await onSubmit({
      type: "newBook", name: title.trim(), field: category, fieldLabel: categoryDef.label,
      content: JSON.stringify({ story: story.trim(), coverPath, filePath, fileName: file?.name || null }), contributor: contributor.trim() || "Anonymous",
    });
    setSubmitting(false);
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-panel">
        <button className="modal-close on-paper" onClick={onCancel} aria-label="Close">✕</button>
        <div className="modal-body">
          <span className="eyebrow">Family Library</span>
          <h2 style={{ fontSize: 20, marginTop: 6 }}>Add a book to the shelf</h2>
          <form onSubmit={submit}>
            <div className="form-row">
              <label>Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bhagavad Gita" />
            </div>
            <div className="form-row">
              <label>Shelf</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {LIBRARY_CATEGORIES.map((c) => <option value={c.key} key={c.key}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Story (optional)</label>
              <textarea value={story} onChange={(e) => setStory(e.target.value)} placeholder="Why is this book important? Who introduced it? Why should future generations read it?" />
            </div>
            <div className="form-row">
              <label>Cover photo (optional)</label>
              <input type="file" accept="image/*" onChange={handleCoverFile} />
              {coverDataUrl && <img src={coverDataUrl} alt="" style={{ width: 90, height: 118, objectFit: "cover", borderRadius: 8, marginTop: 10, border: "1px solid var(--line-strong)" }} />}
              {coverError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{coverError}</p>}
            </div>
            <div className="form-row">
              <label>Soft copy (optional)</label>
              <input type="file" accept=".pdf,.epub,.doc,.docx,.txt" onChange={handleFileInput} />
              {file && <p className="form-hint">{file.name}</p>}
              {fileError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{fileError}</p>}
              <p className="form-hint">Any family member will be able to download it from the shelf. Up to 25MB.</p>
            </div>
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
