import { PEOPLE } from "./people";

export const MIN_GEN = Math.min(...PEOPLE.map((p) => p.gen));
export const MAX_GEN = Math.max(...PEOPLE.map((p) => p.gen));

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

// Applies admin-approved edits (summary / life lesson / places / chapter text /
// rashi / gotra / photo) on top of the base seed data without mutating the
// shared PEOPLE array. Also normalizes chapters/timeline so every person has
// a biography, even one synthesized from their existing folio content.
export function applyOverrides(person, overrides) {
  const o = overrides[person.id];
  const merged = { ...person };
  merged.chapters = getBiographyChapters(person);
  merged.timeline = getBiographyTimeline(person);
  if (!o) return merged;
  if (o.summary !== undefined) merged.summary = o.summary;
  if (o.lifeLesson !== undefined) merged.lifeLesson = { ...person.lifeLesson, ...o.lifeLesson };
  if (o.places !== undefined) merged.places = o.places;
  if (o.rashi !== undefined) merged.rashi = o.rashi;
  if (o.gotra !== undefined) merged.gotra = o.gotra;
  if (o.photoUrl !== undefined) merged.photoUrl = o.photoUrl;
  if (o.spouse !== undefined) merged.spouse = o.spouse;
  if (o.geo !== undefined) merged.geo = o.geo;
  if (o.chapters) {
    merged.chapters = merged.chapters.map((c, i) => (o.chapters[i] !== undefined ? { ...c, text: o.chapters[i] } : c));
  }
  // Chapters drafted from an AI-guided interview are appended rather than
  // replacing an existing index, since they're new material, not edits.
  if (o.newChapters?.length) merged.chapters = [...merged.chapters, ...o.newChapters];
  // Real contributed photos/recordings tagged with an experience category
  // append onto whatever the seed data already has; edits/removals are keyed
  // by position in that combined list, so they work the same whether the
  // entry was hand-authored or contributed later.
  merged.experience = [...(person.experience || []), ...(o.experienceAdds || [])];
  if (o.experienceEdits) {
    merged.experience = merged.experience
      .map((e, i) => (o.experienceEdits[i] !== undefined ? { ...e, ...o.experienceEdits[i] } : e))
      .filter((e) => !e.removed);
  }
  return merged;
}
