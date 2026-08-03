// A handful of commonly-recognized practices, plus a custom option — a
// closed list would inevitably miss a family's own ishta devata stotra or a
// guru's specific practice, so "custom" always stays available alongside
// the presets, same reasoning as Chitrashale's icon picker.
export const PRACTICES = [
  { key: "japa_mala", label: "Japa (mala count)" },
  { key: "hanuman_chalisa", label: "Hanuman Chalisa" },
  { key: "vishnu_sahasranama", label: "Vishnu Sahasranama" },
  { key: "gayatri_mantra", label: "Gayatri Mantra" },
];
export const CUSTOM_PRACTICE_KEY = "custom";

// Generic across every practice rather than mala-specific (108/27) — a
// Chalisa recitation count and a mala round count aren't the same unit,
// so one quick-add set that works reasonably for either is simpler than
// guessing the right multiples per practice.
export const QUICK_COUNTS = [1, 5, 11, 108];

export function familyTotal(logs) {
  return logs.reduce((sum, l) => sum + l.count, 0);
}

export function todayTotal(logs) {
  const today = new Date().toISOString().slice(0, 10);
  return logs.filter((l) => l.loggedDate === today).reduce((sum, l) => sum + l.count, 0);
}

// Sorted highest-first — the natural shape for a small in-family leaderboard.
export function totalsByPerson(logs) {
  const map = new Map();
  for (const l of logs) map.set(l.personId, (map.get(l.personId) || 0) + l.count);
  return [...map.entries()].map(([personId, total]) => ({ personId, total })).sort((a, b) => b.total - a.total);
}

export function totalsByPractice(logs) {
  const map = new Map();
  for (const l of logs) {
    const key = l.practiceLabel;
    map.set(key, (map.get(key) || 0) + l.count);
  }
  return [...map.entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
}
