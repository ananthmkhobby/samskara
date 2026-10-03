import { BOOK_OWNERSHIP } from "../data/people";
import { byId } from "../data/helpers";

export const LIBRARY_CATEGORIES = [
  { key: "spiritual", label: "Spiritual", icon: "📖" },
  { key: "philosophy", label: "Philosophy", icon: "🧠" },
  { key: "education", label: "Education", icon: "🎓" },
  { key: "finance", label: "Finance", icon: "💰" },
  { key: "literature", label: "Literature", icon: "🎨" },
  { key: "childrens", label: "Children's Books", icon: "👧" },
  { key: "rare", label: "Rare Books", icon: "📜" },
  { key: "favourites", label: "Family Favourites", icon: "⭐" },
];

export function libraryCategoryFor(key) {
  return LIBRARY_CATEGORIES.find((c) => c.key === key) || { key, label: key, icon: "📚" };
}

const OWNERSHIP_ACTION_LABELS = { owned: "Owned by", gifted: "Gifted to", read: "Read by", recommended: "Recommended to" };
export function ownershipActionLabel(action) {
  return OWNERSHIP_ACTION_LABELS[action] || action;
}

// A book whose current owner (the last link in the ownership chain) has
// passed away becomes a quiet memorial — nobody edits or rearranges it,
// children can only look. Falls out of data that already exists rather
// than needing its own "is this locked" field. Lives here (not in
// LibraryView.jsx, where it used to be) so BookModal.jsx can use it
// without pulling the whole Library view into its own module graph —
// LibraryView is lazy-loaded (see App.jsx) and this file isn't.
export function isGrandfathersShelf(bookId) {
  const chain = BOOK_OWNERSHIP.filter((o) => o.bookId === bookId).sort((a, b) => a.sortOrder - b.sortOrder);
  const last = chain[chain.length - 1];
  const owner = last?.personId ? byId(last.personId) : null;
  return !!owner?.died;
}
