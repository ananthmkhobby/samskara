import { supabase } from "../lib/supabaseClient";
import { batchResolveMediaUrls, resolveMediaUrl } from "../lib/mediaUpload";
import { fetchFamilyData, fetchFamilyName, fetchMyFamilies, fetchActiveFamilyId, fetchLibraryData, mapContributionRow, insertPerson as dbInsertPerson, insertMarriage as dbInsertMarriage, insertBook as dbInsertBook, bumpFamilyFlame } from "./familyDb";
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
export const BOOKS = [];
export const BOOK_OWNERSHIP = [];
export const BOOK_READERS = [];
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
    dayInLife: row.day_in_life,
    chapters: row.chapters || [], timeline: row.timeline || [],
    photoPath: row.photo_path, photoUrl: null, // photoUrl resolved in initDataLayer
    experience: [],
  };
}

function mapExperienceRow(row) {
  return { id: row.id, personId: row.person_id, type: row.type, caption: row.caption, mediaPath: row.media_path, mediaUrl: null };
}

// Read once, at module load — before React mounts and before the app's own
// history.replaceState() rebuilds the URL as just the view path, dropping
// any query string (same reasoning as FORCE_INTRO/INVITE_CODE_FROM_URL in
// App.jsx). Lets Help's "Try a live demo" link (?demo=1, full reload) opt an
// anonymous visitor into the public demo instead of the login page.
const DEMO_REQUESTED = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";

async function resolveAuthAndFamily() {
  if (!supabase) return { userId: null, familyId: DEMO_FAMILY_ID, role: null, isDemo: true, needsFamily: false, myFamilies: [] };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    if (DEMO_REQUESTED) return { userId: null, familyId: DEMO_FAMILY_ID, role: null, isDemo: true, needsFamily: false, myFamilies: [] };
    // Fully anonymous, demo not explicitly requested — the login page,
    // not the public demo family, is what a first-time visitor should see.
    return { userId: null, familyId: null, role: null, isDemo: false, needsFamily: false, needsLogin: true, myFamilies: [] };
  }

  // Fetched as a list, not .maybeSingle() — an account can belong to more
  // than one family (e.g. both a dad's and a mom's tree) since the
  // multi-family membership migration.
  const myFamilies = await fetchMyFamilies(session.user.id);

  if (!myFamilies.length) {
    // A real account with no family yet — a distinct state, not silently
    // treated as an anonymous demo visitor.
    return { userId: session.user.id, familyId: DEMO_FAMILY_ID, role: null, isDemo: true, needsFamily: true, myFamilies: [] };
  }

  // current_family_id() is the server-verified source of truth for which
  // one is active (stored preference, falling back to earliest
  // membership) — reused here rather than re-deriving that fallback logic
  // client-side, so there's exactly one place it can drift.
  const activeFamilyId = myFamilies.length === 1 ? myFamilies[0].familyId : await fetchActiveFamilyId();
  const active = myFamilies.find((f) => f.familyId === activeFamilyId) || myFamilies[0];

  return { userId: session.user.id, familyId: active.familyId, role: active.role, isDemo: false, needsFamily: false, myFamilies };
}

// Hydrates PEOPLE/MARRIAGES/INITIAL_CONTRIBUTIONS and the auth/tenancy
// bindings in data/session.js from the shared Supabase backend. Must run —
// and be awaited — before the app's first render (see main.jsx), since
// every view reads these as plain synchronous module exports rather than
// reactive state; arriving too late would leave a stale/empty tree on
// screen with nothing to trigger a re-render.
export async function initDataLayer() {
  const resolved = await resolveAuthAndFamily();

  // No family to fetch — the login page renders with none of this data.
  if (resolved.needsLogin) {
    setSession({ userId: null, familyName: null, role: null, isDemo: false, needsFamily: false, needsLogin: true, myFamilies: [] });
    return;
  }

  const familyId = resolved.familyId;

  const [{ people, marriages, contributions, experienceEntries }, familyName, libraryData, flameStreak] = await Promise.all([
    fetchFamilyData(familyId),
    fetchFamilyName(familyId),
    fetchLibraryData(familyId),
    // Non-critical — a failed flame bump should never block the whole app
    // from loading, it just leaves the streak widget hidden this visit.
    bumpFamilyFlame(familyId).catch(() => 0),
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

  const allPaths = [
    ...mappedPeople.map((p) => p.photoPath), ...mappedExperience.map((e) => e.mediaPath), ...contributionMediaPaths,
    ...libraryData.books.map((b) => b.coverPath), ...libraryData.books.map((b) => b.filePath),
  ];
  const urlMap = await batchResolveMediaUrls(allPaths);
  for (const p of mappedPeople) if (p.photoPath) p.photoUrl = urlMap[p.photoPath] || null;
  for (const e of mappedExperience) if (e.mediaPath) e.mediaUrl = urlMap[e.mediaPath] || null;
  for (const c of mappedContributions) {
    if (["audio", "video", "photo"].includes(c.type)) c.mediaUrl = urlMap[c.content] || null;
  }
  for (const b of libraryData.books) {
    if (b.coverPath) b.coverUrl = urlMap[b.coverPath] || null;
    if (b.filePath) b.fileUrl = urlMap[b.filePath] || null;
  }

  PEOPLE.length = 0;
  PEOPLE.push(...mappedPeople);
  MARRIAGES.length = 0;
  MARRIAGES.push(...marriages.map((m) => ({ a: m.a, b: m.b, date: m.date })));
  recomputeMinMaxGen();

  BOOKS.length = 0;
  BOOKS.push(...libraryData.books);
  BOOK_OWNERSHIP.length = 0;
  BOOK_OWNERSHIP.push(...libraryData.ownership);
  BOOK_READERS.length = 0;
  BOOK_READERS.push(...libraryData.readers);

  INITIAL_CONTRIBUTIONS = mappedContributions;

  setSession({
    userId: resolved.userId,
    familyId,
    familyName: familyName || null,
    role: resolved.role,
    isDemo: resolved.isDemo,
    needsFamily: resolved.needsFamily,
    myFamilies: resolved.myFamilies,
    flameStreak,
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
// persists it to Supabase in the background. Returns the persistence
// promise (rejecting if the insert fails) rather than swallowing it here,
// so a caller that needs to sequence a follow-up write against the same
// row — e.g. linking an existing person's `spouse` column to this new
// person's id, which the database can only accept once this row actually
// exists — can await it first instead of racing it.
export function addPerson(person, marriage) {
  PEOPLE.push({ ...person, parents: person.parents || [], chapters: person.chapters || [], timeline: person.timeline || [], experience: person.experience || [] });
  if (marriage) MARRIAGES.push(marriage);
  recomputeMinMaxGen();

  const personInsert = dbInsertPerson(CURRENT_FAMILY_ID, person);
  const marriageInsert = marriage ? dbInsertMarriage(CURRENT_FAMILY_ID, marriage) : Promise.resolve();
  return Promise.all([personInsert, marriageInsert]);
}

// Unlike addPerson, this can't optimistically push a placeholder first —
// family_books.id is a database-generated identity, not a client-chosen
// slug, so nothing else (ownership rows, readers) can reference the book
// until the insert actually returns. Awaited by callers instead of
// fire-and-forget.
export async function addBook(b) {
  const book = await dbInsertBook(CURRENT_FAMILY_ID, b);
  // mapBookRow always comes back with coverUrl/fileUrl null — boot hydration
  // batch-resolves those from cover_path/file_path, but a book added live
  // mid-session never goes through that batch, so without this it would
  // sit on the shelf with a blank cover / no working download link until
  // the next full reload.
  if (book.coverPath) book.coverUrl = await resolveMediaUrl(book.coverPath);
  if (book.filePath) book.fileUrl = await resolveMediaUrl(book.filePath);
  BOOKS.push(book);
  return book;
}
