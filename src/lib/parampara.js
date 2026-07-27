// Parampara categories — everything except "lineage" is a growing
// collection of entries (title + story, optionally "since a year" and a
// photo). "lineage" is different: one structured chain the family
// gradually fills in and refines, so only the most recent Verified one
// is shown, rendered as a chain rather than a card grid.
export const PARAMPARA_CATEGORIES = [
  { key: "tradition", label: "Family Tradition", icon: "🪔", prompt: "What tradition has survived because of your family?" },
  { key: "kula_devata", label: "Kula Devata Journey", icon: "🛕", prompt: "Which deity does your family turn to, and how did that begin?" },
  { key: "sloka", label: "Family Sloka", icon: "📿", prompt: "Which prayer has been passed down in your family, and who recites it?" },
  { key: "festival", label: "Festival Through Generations", icon: "🎇", prompt: "How has a festival been celebrated differently across generations?" },
  { key: "dharma", label: "Family Dharma", icon: "⚖️", prompt: "What unwritten rule has your family always lived by?" },
  { key: "wisdom", label: "Ancestor Wisdom", icon: "💬", prompt: "What's a piece of advice an ancestor was known for?" },
  { key: "lost_skill", label: "Lost Skill", icon: "🧵", prompt: "What skill did someone in the family have that's since disappeared?" },
  { key: "memory", label: "Living Memory", icon: "🎥", prompt: "What should this family never forget?" },
  { key: "recipe", label: "Family Recipe", icon: "🍲", prompt: "What dish has been made in your family for generations — who makes it best, and what's the secret in it?" },
  { key: "rangoli_art", label: "Rangoli / Kolam Art", icon: "🎨", prompt: "What pattern, rangoli, or handmade art has been passed down — who taught it, and when is it drawn or made?" },
];

export const LINEAGE_CATEGORY = { key: "lineage", label: "Veda Lineage", icon: "🕉️" };

export const ALL_PARAMPARA_CATEGORIES = [...PARAMPARA_CATEGORIES, LINEAGE_CATEGORY];

export function categoryFor(key) {
  return ALL_PARAMPARA_CATEGORIES.find((c) => c.key === key) || { key, label: key, icon: "✦" };
}

export function parseParamparaContent(content) {
  try {
    return JSON.parse(content) || {};
  } catch {
    return { description: content || "" };
  }
}

// "This tradition has continued for 143 years" — the emotional core of
// the Parampara Map idea. Only shown when a since-year was actually given.
export function continuedForYears(sinceYear) {
  if (!sinceYear) return null;
  const years = new Date().getFullYear() - Number(sinceYear);
  return years > 0 ? years : null;
}
