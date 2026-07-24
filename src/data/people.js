import { supabase } from "../lib/supabaseClient";
import { batchResolveMediaUrls } from "../lib/mediaUpload";
import { fetchFamilyData, fetchFamilyName, mapContributionRow, insertPerson as dbInsertPerson, insertMarriage as dbInsertMarriage } from "./familyDb";
import { setSession, DEMO_FAMILY_ID, CURRENT_FAMILY_ID } from "./session";

export const VALUES = ["Courage", "Seva", "Education", "Simplicity", "Devotion", "Discipline", "Hospitality", "Resilience"];

export const CHALLENGES = [
  { month: 0, type: "date", title: "Whose birthday are we missing?", text: "January is thin on the almanac. Add a birthdate for anyone you know isn't listed yet." },
  { month: 1, type: "photo", title: "Dig out an old photograph", text: "February's challenge: find one photo older than you are and add it to a folio." },
  { month: 2, type: "memory", title: "A lesson from an elder", text: "Write down one piece of advice an elder gave you that you still use." },
  { month: 3, type: "audio", title: "Record a voice worth keeping", text: "April's challenge: record thirty seconds of a grandparent or parent telling a story." },
  { month: 4, type: "memory", title: "The story behind a name", text: "Share how someone in the family got their name — a memory hook for May." },
  { month: 5, type: "video", title: "Capture a family recipe in motion", text: "June's challenge: record someone making a dish only they make properly." },
  { month: 6, type: "memory", title: "This month's family challenge", text: "Share what you know about someone whose story isn't in the archive yet." },
  { month: 7, type: "document", title: "A document worth preserving", text: "August's challenge: scan one old letter, certificate, or ledger page." },
  { month: 8, type: "memory", title: "A hard year, remembered honestly", text: "September's challenge: write about a difficult year and what got the family through it." },
  { month: 9, type: "photo", title: "Four generations, one frame", text: "October's challenge: find or take a photo spanning as many generations as possible." },
  { month: 10, type: "date", title: "Remembrance days check", text: "November's challenge: confirm the remembrance dates already in the Vault are correct." },
  { month: 11, type: "memory", title: "What are you grateful for this year", text: "December's challenge: add one memory about the year that's ending." }
];

// Populated once, before the app's first render (see initDataLayer below) —
// every view reads these as plain synchronous module exports, mutated in
// place afterward (addPerson, etc.) rather than replaced, so a stable
// reference is kept throughout.
export const PEOPLE = [];
export const MARRIAGES = [];
export let INITIAL_CONTRIBUTIONS = [];
export let MIN_GEN = 1;
export let MAX_GEN = 1;

function recomputeMinMaxGen() {
  if (!PEOPLE.length) { MIN_GEN = 1; MAX_GEN = 1; return; }
  MIN_GEN = Math.min(...PEOPLE.map((p) => p.gen));
  MAX_GEN = Math.max(...PEOPLE.map((p) => p.gen));
}

function mapPersonRow(row) {
  return {
    id: row.id, name: row.name, gen: row.gen, born: row.born, died: row.died,
    spouse: row.spouse, parents: row.parents || [], rashi: row.rashi, gotra: row.gotra,
    isLegacy: row.is_legacy, trust: row.trust, geoOrigin: row.geo_origin, geo: row.geo,
    summary: row.summary, places: row.places, lifeLesson: row.life_lesson,
    chapters: row.chapters || [], timeline: row.timeline || [],
    photoPath: row.photo_path, photoUrl: null, // photoUrl resolved in initDataLayer
    experience: [],
  };
}

function mapExperienceRow(row) {
  return { id: row.id, personId: row.person_id, type: row.type, caption: row.caption, mediaPath: row.media_path, mediaUrl: null };
}

async function resolveAuthAndFamily() {
  if (!supabase) return { userId: null, familyId: DEMO_FAMILY_ID, role: null, isDemo: true, needsFamily: false };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { userId: null, familyId: DEMO_FAMILY_ID, role: null, isDemo: true, needsFamily: false };

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id, role")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!membership) {
    // A real account with no family yet — a distinct state, not silently
    // treated as an anonymous demo visitor.
    return { userId: session.user.id, familyId: DEMO_FAMILY_ID, role: null, isDemo: true, needsFamily: true };
  }
  return { userId: session.user.id, familyId: membership.family_id, role: membership.role, isDemo: false, needsFamily: false };
}

// Hydrates PEOPLE/MARRIAGES/INITIAL_CONTRIBUTIONS and the auth/tenancy
// bindings in data/session.js from the shared Supabase backend. Must run —
// and be awaited — before the app's first render (see main.jsx), since
// every view reads these as plain synchronous module exports rather than
// reactive state; arriving too late would leave a stale/empty tree on
// screen with nothing to trigger a re-render.
export async function initDataLayer() {
  const resolved = await resolveAuthAndFamily();
  const familyId = resolved.familyId;

  const [{ people, marriages, contributions, experienceEntries }, familyName] = await Promise.all([
    fetchFamilyData(familyId),
    fetchFamilyName(familyId),
  ]);

  const mappedPeople = people.map(mapPersonRow);
  const mappedExperience = experienceEntries.map(mapExperienceRow);
  for (const p of mappedPeople) p.experience = mappedExperience.filter((e) => e.personId === p.id);

  const mappedContributions = contributions.map(mapContributionRow);
  // Audio/video/photo contributions store a Storage path in `content` (once
  // actually uploaded through the app — pre-existing demo/seed contributions
  // with fake filenames simply resolve to nothing, handled gracefully below).
  const contributionMediaPaths = mappedContributions
    .filter((c) => ["audio", "video", "photo"].includes(c.type))
    .map((c) => c.content);

  const allPaths = [...mappedPeople.map((p) => p.photoPath), ...mappedExperience.map((e) => e.mediaPath), ...contributionMediaPaths];
  const urlMap = await batchResolveMediaUrls(allPaths);
  for (const p of mappedPeople) if (p.photoPath) p.photoUrl = urlMap[p.photoPath] || null;
  for (const e of mappedExperience) if (e.mediaPath) e.mediaUrl = urlMap[e.mediaPath] || null;
  for (const c of mappedContributions) {
    if (["audio", "video", "photo"].includes(c.type)) c.mediaUrl = urlMap[c.content] || null;
  }

  PEOPLE.length = 0;
  PEOPLE.push(...mappedPeople);
  MARRIAGES.length = 0;
  MARRIAGES.push(...marriages.map((m) => ({ a: m.a, b: m.b, date: m.date })));
  recomputeMinMaxGen();

  INITIAL_CONTRIBUTIONS = mappedContributions;

  setSession({
    userId: resolved.userId,
    familyId,
    familyName: familyName || null,
    role: resolved.role,
    isDemo: resolved.isDemo,
    needsFamily: resolved.needsFamily,
  });
}

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "person";
}

export function makeUniquePersonId(name) {
  const existing = new Set(PEOPLE.map((p) => p.id));
  const base = slugify(name);
  let id = base, n = 2;
  while (existing.has(id)) id = `${base}-${n++}`;
  return id;
}

// Appends a newly-approved family member directly to the live PEOPLE/
// MARRIAGES arrays (picked up on next render — no reload needed) and
// persists it to Supabase in the background.
export function addPerson(person, marriage) {
  PEOPLE.push({ ...person, parents: person.parents || [], chapters: person.chapters || [], timeline: person.timeline || [], experience: person.experience || [] });
  if (marriage) MARRIAGES.push(marriage);
  recomputeMinMaxGen();

  dbInsertPerson(CURRENT_FAMILY_ID, person).catch((err) => console.error("Failed to persist new person:", err.message));
  if (marriage) dbInsertMarriage(CURRENT_FAMILY_ID, marriage).catch((err) => console.error("Failed to persist marriage:", err.message));
}
