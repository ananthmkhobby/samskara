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
