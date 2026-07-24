import { PEOPLE, MIN_GEN, MAX_GEN } from "./people";

// Live bindings re-exported from people.js, where they're recomputed once
// hydration finishes (see initDataLayer) — must not be computed here at
// static import time, since that would freeze them at whatever PEOPLE
// happened to contain before a real family's data replaced it.
export { MIN_GEN, MAX_GEN };

export function byId(id) {
  return PEOPLE.find((p) => p.id === id);
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function yearsLabel(p) {
  const by = p.born ? p.born.slice(0, 4) : "?";
  if (p.died) return `${by}–${p.died.slice(0, 4)}`;
  return `b. ${by}`;
}

export function trustLabel(t) {
  return t === "verified" ? "Verified" : t === "elder" ? "Remembered by elder" : "Approximate";
}

export function parentsCaption(p) {
  if (!p.parents || !p.parents.length) return "";
  const names = p.parents.map((id) => byId(id)?.name.split(" ")[0]).join(" & ");
  return `Child of ${names}`;
}

// How this person connects to the family's founding generation — computed
// from parents/spouse links already on record, no extra data needed.
// Terms are kept gender-neutral on purpose: authentic regional kinship
// terms (Kannada "chikkappa" vs "chikkamma", "grandson" vs
// "granddaughter", etc.) are inherently gendered, and this app doesn't
// track gender — guessing it from a name risks getting someone's own
// family record wrong, which is worse than a plainer term.
const DESCENT_TERMS = ["Child", "Grandchild", "Great-grandchild", "Great-great-grandchild"];

function climbToRoot(person) {
  let current = person;
  while (current.gen > MIN_GEN) {
    if (!current.parents || !current.parents.length) break;
    const parentObjs = current.parents.map((id) => byId(id)).filter(Boolean);
    if (!parentObjs.length) break;
    // Prefer whichever parent actually has traceable ancestry — a parent
    // who married in has an empty `parents` array and would dead-end here.
    current = parentObjs.find((p) => p.gen === MIN_GEN || (p.parents && p.parents.length)) || parentObjs[0];
  }
  return current;
}

export function relationshipCaption(p) {
  if (p.gen === MIN_GEN) return "";
  if (!p.parents || !p.parents.length) {
    const spouse = p.spouse && byId(p.spouse);
    return spouse ? `Spouse of ${spouse.name}` : "";
  }
  const root = climbToRoot(p);
  const rootSpouse = root.spouse && byId(root.spouse);
  const rootLabel = rootSpouse ? `${root.name.split(" ")[0]} & ${rootSpouse.name.split(" ")[0]}` : root.name;
  const distance = p.gen - MIN_GEN;
  const term = DESCENT_TERMS[distance - 1] || `${distance}th-generation descendant`;
  return `${term} of ${rootLabel}`;
}

// Only surfaces for someone currently alive whose spouse has passed —
// deceased/alive itself is already conveyed by yearsLabel's born–died
// range, so this only adds the one status that isn't otherwise visible
// at a glance. "Widowed" (adjective) rather than "widow"/"widower" sidesteps
// the same gender-data gap noted above.
export function widowedLabel(p) {
  if (p.died) return "";
  const spouse = p.spouse && byId(p.spouse);
  return spouse?.died ? "Widowed" : "";
}

export function monthName(i) {
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][i];
}

export function contributionsFor(contributions, personId) {
  return contributions.filter((c) => c.personId === personId);
}

export function verifiedMediaFor(contributions, personId) {
  return contributionsFor(contributions, personId).filter(
    (c) => c.status === "Verified" && ["photo", "audio", "video", "document"].includes(c.type)
  );
}

export function personHasContent(contributions, p) {
  return !!(p.summary || p.lifeLesson || contributionsFor(contributions, p.id).length || verifiedMediaFor(contributions, p.id).length);
}

export function roleTag(contributions, p) {
  if (p.isLegacy) return "Legacy figure";
  if (p.gen === MIN_GEN) return "Root ancestor";
  if (!personHasContent(contributions, p)) return "Unwritten leaf";
  return "";
}

export function initials(name) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

// Every person gets a full biography — people with authored chapters use
// those; everyone else gets a graceful single-chapter fallback built from
// whatever is already on their folio, so "Open full biography" always works.
export function getBiographyChapters(person) {
  if (person.chapters && person.chapters.length) return person.chapters;
  const parts = [];
  if (person.summary) parts.push(person.summary);
  if (person.lifeLesson) parts.push(`A life lesson remembered: “${person.lifeLesson.quote}”`);
  if (person.places && person.places.length) parts.push(`Places: ${person.places.join(", ")}`);
  if (!parts.length) parts.push(`${person.name}'s story hasn't been written yet. Share what you know, and a fuller biography can grow from here.`);
  return [{ title: "Their Story So Far", text: parts.join("\n\n") }];
}

export function getBiographyTimeline(person) {
  if (person.timeline && person.timeline.length) return person.timeline;
  const items = [];
  if (person.born) items.push({ year: person.born.slice(0, 4), event: "Born" });
  if (person.died) items.push({ year: person.died.slice(0, 4), event: "Passed away" });
  return items;
}
