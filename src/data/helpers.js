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
