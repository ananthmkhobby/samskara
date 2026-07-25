import { useState } from "react";

const LABELS = {
  wisdom: { title: "Add a lesson", placeholder: "One lesson this book taught you…" },
  memory: { title: "Add a memory", placeholder: "What moment ties you to this copy?" },
  discussion: { title: "Add to the discussion", placeholder: "Ask a question, or answer one already asked…" },
};

export default function LibraryEntryModal({ bookId, kind, onCancel, onSubmit, canModerate }) {
  const [content, setContent] = useState("");
  const [contributor, setContributor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const labels = LABELS[kind];

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    if (!content.trim()) { setError("This needs some text first."); return; }
    setSubmitting(true);
    setError("");
    await onSubmit({
      type: "library_entry", field: kind, bookId, content: content.trim(), contributor: contributor.trim() || "Anonymous",
    });
    setSubmitting(false);
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-panel" style={{ maxWidth: 460 }}>
        <button className="modal-close on-paper" onClick={onCancel} aria-label="Close">✕</button>
        <div className="modal-body">
          <span className="eyebrow">Family Library</span>
          <h2 style={{ fontSize: 20, marginTop: 6 }}>{labels.title}</h2>
          <form onSubmit={submit}>
            <div className="form-row">
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={labels.placeholder} />
            </div>
            <div className="form-row">
              <label>Your name</label>
              <input type="text" placeholder="e.g. Kavya Reddy" value={contributor} onChange={(e) => setContributor(e.target.value)} />
            </div>
            {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
            <div className="folio-actions">
              <button type="submit" className="btn primary" disabled={submitting}>{submitting ? "Saving…" : canModerate ? "Add now" : "Submit for review"}</button>
              <button type="button" className="btn ghost" onClick={onCancel} disabled={submitting}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
