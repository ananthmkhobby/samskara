import { useState } from "react";
import { PEOPLE, BOOK_OWNERSHIP, BOOK_READERS } from "../data/people";
import { byId } from "../data/helpers";
import { libraryCategoryFor, ownershipActionLabel } from "../lib/library";
import { EditPencilIcon } from "./Icons";
import { isGrandfathersShelf } from "./LibraryView";
import PhotoLightbox from "./PhotoLightbox";

const TABS = ["Story", "Readers", "Wisdom", "Memories", "Discussions"];
const FIELD_FOR_TAB = { Wisdom: "wisdom", Memories: "memory", Discussions: "discussion" };

function OwnershipChain({ bookId }) {
  const chain = BOOK_OWNERSHIP.filter((o) => o.bookId === bookId).sort((a, b) => a.sortOrder - b.sortOrder);
  if (!chain.length) return <p className="form-hint" style={{ marginTop: 0 }}>No journey recorded yet — add who's owned, gifted, or read this book.</p>;
  return (
    <div className="ownership-chain">
      {chain.map((o, i) => {
        const person = o.personId ? byId(o.personId) : null;
        const name = person?.name || o.personName || "Someone in the family";
        return (
          <div className="ownership-row" key={o.id}>
            <div className="ownership-label">{ownershipActionLabel(o.action)}</div>
            <div className="ownership-value">{name}{o.year && <span className="ownership-year">({o.year})</span>}</div>
            {i < chain.length - 1 && <div className="ownership-arrow">↓</div>}
          </div>
        );
      })}
    </div>
  );
}

function AddOwnershipForm({ bookId, onAdd, onDone }) {
  const [personId, setPersonId] = useState(PEOPLE[0]?.id || "");
  const [action, setAction] = useState("owned");
  const [year, setYear] = useState("");
  const sorted = [...PEOPLE].sort((a, b) => a.name.localeCompare(b.name));

  async function submit(e) {
    e.preventDefault();
    const chain = BOOK_OWNERSHIP.filter((o) => o.bookId === bookId);
    const nextOrder = chain.length ? Math.max(...chain.map((o) => o.sortOrder)) + 1 : 0;
    await onAdd({ bookId, personId, action, year: year ? Number(year) : null, sortOrder: nextOrder });
    onDone();
  }

  return (
    <form onSubmit={submit} className="card" style={{ padding: 14, marginTop: 10 }}>
      <div className="form-row">
        <label>Person</label>
        <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
          {sorted.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="form-row">
        <label>Action</label>
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="owned">Owned</option>
          <option value="gifted">Gifted to</option>
          <option value="read">Read by</option>
          <option value="recommended">Recommended to</option>
        </select>
      </div>
      <div className="form-row">
        <label>Year (optional)</label>
        <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ maxWidth: 140 }} />
      </div>
      <div className="folio-actions">
        <button type="submit" className="btn primary small">Add to journey</button>
        <button type="button" className="btn ghost small" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function ReadersTab({ book, onSetReaderStatus }) {
  const sorted = [...PEOPLE].sort((a, b) => a.name.localeCompare(b.name));
  const statusFor = (personId) => BOOK_READERS.find((r) => r.bookId === book.id && r.personId === personId)?.status || null;

  return (
    <div>
      <p className="form-hint" style={{ marginTop: 0 }}>A reading map, not a review — mark anyone in the family as reading or finished.</p>
      <div className="reader-list">
        {sorted.map((p) => {
          const status = statusFor(p.id);
          return (
            <div className={`reader-row${status ? ` ${status}` : ""}`} key={p.id}>
              {status && <span className="status-dot" />}
              <span style={{ flex: 1 }}>{p.name}</span>
              <button type="button" className={`chip${status === "reading" ? " active" : ""}`} onClick={() => onSetReaderStatus(book.id, p.id, "reading")}>Reading</button>
              <button type="button" className={`chip${status === "read" ? " active" : ""}`} onClick={() => onSetReaderStatus(book.id, p.id, "read")}>Read</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB — generous for a scanned PDF, conservative enough to fail fast rather than hang on a bad upload

function SoftCopySection({ book, canModerate, locked, onUploadFile }) {
  const [replacing, setReplacing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    if (file.size > MAX_FILE_BYTES) { setError("That file is larger than 25MB — try a smaller copy."); return; }
    setUploading(true);
    try {
      await onUploadFile(book.id, file);
      setReplacing(false);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="folio-section-head" style={{ marginTop: 18 }}><h4>Soft copy</h4></div>
      {book.fileUrl && !replacing ? (
        <div>
          <a className="btn small" href={book.fileUrl} download={book.fileName || true} target="_blank" rel="noreferrer">⬇ Download {book.fileName || "file"}</a>
          {canModerate && !locked && (
            <button type="button" className="btn ghost small" style={{ marginLeft: 8 }} onClick={() => setReplacing(true)}>Replace</button>
          )}
        </div>
      ) : canModerate && !locked ? (
        <div className="form-row">
          <input type="file" accept=".pdf,.epub,.doc,.docx,.txt" onChange={handleFile} disabled={uploading} />
          <p className="form-hint">Upload a PDF or ebook copy — any family member will be able to download it. Up to 25MB.</p>
          {uploading && <p className="form-hint">Uploading…</p>}
          {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
          {replacing && <button type="button" className="btn ghost small" onClick={() => setReplacing(false)}>Cancel</button>}
        </div>
      ) : (
        <p className="form-hint" style={{ marginTop: 0 }}>No soft copy uploaded yet.</p>
      )}
    </div>
  );
}

function EntryTab({ entries, kind, onAdd, locked }) {
  const prompts = {
    wisdom: "What's the one lesson this book taught you?",
    memory: "What moment ties you to this copy of the book?",
    discussion: "Ask a question, or answer one already asked.",
  };
  return (
    <div>
      <p className="form-hint" style={{ marginTop: 0 }}>{prompts[kind]}</p>
      {entries.length ? entries.map((e) => (
        <div className="library-entry-card" key={e.id}>
          <p className="folio-summary">{e.content}</p>
          <p className="who">— {e.contributor}</p>
        </div>
      )) : <p className="form-hint">Nothing here yet.</p>}
      {!locked && <button type="button" className="btn small" onClick={onAdd}>+ Add</button>}
    </div>
  );
}

export default function BookModal({ book, contributions, onClose, canModerate, onSaveStory, onAddOwnership, onSetReaderStatus, onAddEntry, onUploadFile }) {
  const [tab, setTab] = useState("Story");
  const [addingOwnership, setAddingOwnership] = useState(false);
  const [editingStory, setEditingStory] = useState(false);
  const [storyDraft, setStoryDraft] = useState(book.story || "");
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const cat = libraryCategoryFor(book.category);
  const locked = isGrandfathersShelf(book.id);
  const entriesFor = (field) => contributions.filter((c) => c.type === "library_entry" && c.bookId === book.id && c.field === field && c.status === "Verified");

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel">
        <button className="modal-close on-paper" onClick={onClose} aria-label="Close">✕</button>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <button
              type="button"
              className="library-book-cover"
              style={{ width: 84, height: 110, borderRadius: 8, flex: "none", border: 0, cursor: book.coverUrl ? "pointer" : "default" }}
              onClick={() => book.coverUrl && setLightboxSrc(book.coverUrl)}
              aria-label={book.coverUrl ? "View cover full screen" : undefined}
            >
              {book.coverUrl ? <img src={book.coverUrl} alt={book.title} /> : <span className="library-book-placeholder">{cat.icon}</span>}
            </button>
            <div>
              <span className="eyebrow">{cat.icon} {cat.label}</span>
              <h2 style={{ fontSize: 21, marginTop: 4 }}>{book.title}</h2>
            </div>
          </div>

          {locked && (
            <div className="library-locked-banner">
              🔒 <span><b>Grandfather's Shelf</b> — this book's owner has passed. Nobody edits or rearranges it; it stays exactly as they left it.</span>
            </div>
          )}

          <div className="library-tabs">
            {TABS.map((t) => <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}
          </div>

          {tab === "Story" && (
            <div>
              <div className="folio-section-head">
                <h4>Story</h4>
                {canModerate && !locked && !editingStory && (
                  <button className="icon-only" aria-label="Edit story" onClick={() => { setStoryDraft(book.story || ""); setEditingStory(true); }}><EditPencilIcon /></button>
                )}
              </div>
              {editingStory ? (
                <div className="form-row">
                  <textarea value={storyDraft} onChange={(e) => setStoryDraft(e.target.value)} placeholder="Why is this book important? Who introduced it? Why should future generations read it?" />
                  <div className="folio-actions" style={{ marginTop: 10 }}>
                    <button type="button" className="btn primary small" onClick={() => { onSaveStory(book.id, storyDraft.trim()); setEditingStory(false); }}>Save</button>
                    <button type="button" className="btn ghost small" onClick={() => setEditingStory(false)}>Cancel</button>
                  </div>
                </div>
              ) : book.story ? <p className="folio-summary">{book.story}</p> : <p className="form-hint" style={{ marginTop: 0 }}>Why this book matters, who introduced it, why future generations should read it — not recorded yet.</p>}
              <SoftCopySection book={book} canModerate={canModerate} locked={locked} onUploadFile={onUploadFile} />
              <div className="folio-section-head" style={{ marginTop: 18 }}><h4>The book's journey</h4></div>
              <OwnershipChain bookId={book.id} />
              {!locked && (addingOwnership ? (
                <AddOwnershipForm bookId={book.id} onAdd={onAddOwnership} onDone={() => setAddingOwnership(false)} />
              ) : (
                <button type="button" className="btn small" style={{ marginTop: 10 }} onClick={() => setAddingOwnership(true)}>+ Add to the journey</button>
              ))}
            </div>
          )}
          {tab === "Readers" && <ReadersTab book={book} onSetReaderStatus={onSetReaderStatus} />}
          {tab === "Wisdom" && <EntryTab entries={entriesFor("wisdom")} kind="wisdom" locked={locked} onAdd={() => onAddEntry(book.id, "wisdom")} />}
          {tab === "Memories" && <EntryTab entries={entriesFor("memory")} kind="memory" locked={locked} onAdd={() => onAddEntry(book.id, "memory")} />}
          {tab === "Discussions" && <EntryTab entries={entriesFor("discussion")} kind="discussion" locked={locked} onAdd={() => onAddEntry(book.id, "discussion")} />}
        </div>
      </div>
      <PhotoLightbox src={lightboxSrc} alt={book.title} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
