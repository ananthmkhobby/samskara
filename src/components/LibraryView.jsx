import { useState } from "react";
import { BOOKS, BOOK_OWNERSHIP, BOOK_READERS } from "../data/people";
import { byId } from "../data/helpers";
import { LIBRARY_CATEGORIES, libraryCategoryFor } from "../lib/library";

function isMonth(dateStr, now) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// A book whose current owner (the last link in the ownership chain) has
// passed away becomes a quiet memorial — nobody edits or rearranges it,
// children can only look. Falls out of data that already exists rather
// than needing its own "is this locked" field.
export function isGrandfathersShelf(bookId) {
  const chain = BOOK_OWNERSHIP.filter((o) => o.bookId === bookId).sort((a, b) => a.sortOrder - b.sortOrder);
  const last = chain[chain.length - 1];
  const owner = last?.personId ? byId(last.personId) : null;
  return !!owner?.died;
}

function BookCard({ book, onOpen }) {
  const cat = libraryCategoryFor(book.category);
  const locked = isGrandfathersShelf(book.id);
  return (
    <button type="button" className="card library-book-card" onClick={() => onOpen(book.id)}>
      <div className="library-book-cover">
        {book.coverUrl ? <img src={book.coverUrl} alt={book.title} /> : <span className="library-book-placeholder">{cat.icon}</span>}
        {locked && <span className="library-locked-badge" title="Grandfather's Shelf — a quiet memorial">🔒</span>}
      </div>
      <div className="library-book-body">
        <span className="eyebrow">{cat.icon} {cat.label}</span>
        <h4>{book.title}</h4>
      </div>
    </button>
  );
}

export default function LibraryView({ onOpenBook, onAddBook }) {
  const [filter, setFilter] = useState(null);
  const verifiedBooks = BOOKS.filter((b) => b.status === "Verified");
  const filtered = filter ? verifiedBooks.filter((b) => b.category === filter) : verifiedBooks;

  const now = new Date();
  const readingNow = new Set(BOOK_READERS.filter((r) => r.status === "reading").map((r) => r.personId)).size;
  const completedThisMonth = BOOK_READERS.filter((r) => r.status === "read" && isMonth(r.createdAt, now)).length;
  const giftedThisMonth = BOOK_OWNERSHIP.filter((o) => o.action === "gifted" && isMonth(o.createdAt, now)).length;

  return (
    <section className="wrap">
      <div className="section-head">
        <span className="eyebrow parampara-eyebrow">📚 Family Library</span>
        <h2>Walk into the family's bookshelf</h2>
        <p>
          Every book here has its own journey — who owned it, who read it, what it taught them. Add a book and its
          story becomes part of the record, once an Admin verifies it.
        </p>
      </div>

      <div className="library-stats">
        <div className="library-stat"><b className="tnum">{readingNow}</b><span>reading right now</span></div>
        <div className="library-stat"><b className="tnum">{completedThisMonth}</b><span>completed this month</span></div>
        <div className="library-stat"><b className="tnum">{giftedThisMonth}</b><span>gifted this month</span></div>
        <div className="library-stat"><b className="tnum">{verifiedBooks.length}</b><span>books on the shelf</span></div>
      </div>

      <div className="tag-row parampara-filters">
        <button className={`chip${filter === null ? " active" : ""}`} onClick={() => setFilter(null)}>All</button>
        {LIBRARY_CATEGORIES.map((c) => (
          <button key={c.key} className={`chip${filter === c.key ? " active" : ""}`} onClick={() => setFilter(c.key)}>{c.icon} {c.label}</button>
        ))}
      </div>

      <button type="button" className="btn primary parampara-cta" onClick={onAddBook}>+ Add a book to the shelf</button>

      {filtered.length ? (
        <div className="library-grid">
          {filtered.map((b) => <BookCard key={b.id} book={b} onOpen={onOpenBook} />)}
        </div>
      ) : (
        <div className="empty-state">
          {filter ? `Nothing under "${libraryCategoryFor(filter).label}" yet — be the first to add one.` : "The shelf is empty — be the first to add a book."}
        </div>
      )}
    </section>
  );
}
