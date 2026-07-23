export const VALUES = ["Courage", "Seva", "Education", "Simplicity", "Devotion", "Discipline", "Hospitality", "Resilience"];

const SAMPLE_PEOPLE = [
  {
    id: "narasimha", name: "Narasimha Rao", gen: 1, born: "1902-03-11", died: "1978-09-02",
    spouse: "kamala", parents: [], rashi: "Simha", gotra: "Bharadwaja",
    isLegacy: true, trust: "verified",
    geoOrigin: { lat: 13.63, lng: 74.69, place: "Kundapura", year: 1902, label: "Born in Kundapura" },
    geo: { lat: 12.91, lng: 74.86, place: "Mangalore" },
    summary: "Founder of the family household in Mangalore. Left his native village at nineteen with a trunk of clothes and a head for numbers, and built the provisions business that carried three generations.",
    places: ["Born in Kundapura", "Settled in Mangalore, 1934", "Built the family house on Car Street, 1955"],
    lifeLesson: { quote: "A family that shares its table never goes hungry alone.", values: ["Hospitality", "Seva"] },
    chapters: [
      { title: "Village Beginnings", text: "Narasimha was born in 1902 in a small house near the Kundapura river, the third of five children. His father kept a modest areca farm, and money was tight enough that school was a privilege shared between brothers on alternating years. What Narasimha lacked in formal schooling he made up for with an unusual memory for numbers — by twelve he was keeping the farm's accounts in his head, correcting his father's ledger from memory alone.\n\nAt nineteen, with the farm unable to support five grown sons, he packed a single trunk and left for the coast, telling his mother he would either send for the family within five years or return with nothing to show for it." },
      { title: "The Move to Mangalore", text: "He arrived in Mangalore in 1922 with eleven rupees and a letter of introduction to a distant cousin who ran a small trading counter near the port. For the first two years he slept in the back room of that shop, doing the accounts by night and learning the trade by day.\n\nIt was here, through a marriage arranged by that same cousin, that he met Kamala. They were married in June 1922 in her family's village, and she returned with him to Mangalore within the year — by every family account, the more decisive and quicker-witted of the two." },
      { title: "Building the Family Business", text: "In 1941, with savings from nearly two decades of careful bookkeeping, Narasimha opened his own provisions store on what is now Car Street. He ran it on a simple principle, repeated so often it became a kind of family motto: never let a regular customer leave without credit if they need it, and never let a stranger leave without a fair price.\n\nThe store grew steadily through the 1940s and 50s, eventually employing two of his own sons and, at its peak, six people outside the family. It stayed in family hands until 1988." },
      { title: "Later Years and Legacy", text: "By the 1960s Narasimha had largely handed the day-to-day running of the store to his son Krishnamurthy, though he continued to walk down each morning to check the accounts until his eyesight made the ledgers difficult to read. He and Kamala spent their later years in the Car Street house, which for decades functioned as the unofficial gathering point for the wider family on festival days.\n\nHe passed away in September 1978. The store's regulars, by family legend, closed their own shops for an hour on the day of his funeral." }
    ],
    timeline: [{ year: "1902", event: "Born in Kundapura" }, { year: "1921", event: "Leaves for Mangalore" }, { year: "1922", event: "Marries Kamala" }, { year: "1934", event: "Settles permanently in Mangalore" }, { year: "1941", event: "Opens the family provisions store" }, { year: "1955", event: "Builds the Car Street house" }, { year: "1978", event: "Passes away" }],
    experience: [
      { type: "voice", caption: "Recounting his first week in Mangalore, recorded in 1976" },
      { type: "laugh", caption: "A short laugh caught on tape mid-story about his first customer" },
      { type: "song", caption: "Humming “Vaishnava Jana To” while closing the shop for the night" },
      { type: "prayer", caption: "The evening shloka he recited at the shop's threshold before locking up" },
      { type: "story", caption: "How he decided never to refuse credit to a regular customer" },
      { type: "advice", caption: "Keep your ledger honest even when no one is checking it." },
      { type: "recipe", caption: "His mother's rava kesari, made every Sankranti without fail" },
      { type: "handwriting", caption: "A page from his 1941 account ledger, in his own hand" },
      { type: "signature", caption: "His signature on the store's original 1941 lease" },
      { type: "achievement", caption: "Built a two-generation family business from eleven rupees" },
      { type: "lesson", caption: "Trusted a partner once without a written agreement and lost six months' profit — never skipped paperwork again" }
    ]
  },
  {
    id: "kamala", name: "Kamala Rao", gen: 1, born: "1908-06-02", died: "1990-03-19",
    spouse: "narasimha", parents: [], trust: "elder", rashi: "Kataka", gotra: "Kaundinya",
    geoOrigin: { lat: 13.75, lng: 74.70, place: "Kota", year: 1908, label: "Born near Kota" },
    geo: { lat: 12.91, lng: 74.86, place: "Mangalore" },
    summary: "Narasimha's wife and, by every account, the sharper negotiator of the two. Ran the household finances and was known across the neighbourhood for an open kitchen.",
    places: ["Born near Kota", "Married into the Rao household, 1922"],
    lifeLesson: { quote: "Fear is just a guest who overstays if you let him sit.", values: ["Courage"] },
    experience: [
      { type: "voice", caption: "Describing the day she met Narasimha, recorded in 1988" },
      { type: "laugh", caption: "Laughing at her own memory of over-salting her first meal for him" },
      { type: "advice", caption: "Fear is just a guest who overstays if you let him sit — don't offer it a chair." },
      { type: "recipe", caption: "Her filter coffee recipe, still the family standard" },
      { type: "prayer", caption: "The morning prayer she taught every daughter-in-law in the house" },
      { type: "achievement", caption: "Ran the household finances so carefully the store never once missed a supplier payment" },
      { type: "lesson", caption: "Assumed a new bride would 'just know' the house's routines — learned to write things down after that" }
    ]
  },
  {
    id: "krishnamurthy", name: "Krishnamurthy Rao", gen: 2, born: "1928-01-15", died: "2005-07-30",
    spouse: "saraswathi", parents: ["narasimha", "kamala"], trust: "verified", rashi: "Simha", gotra: "Bharadwaja",
    geo: { lat: 12.91, lng: 74.86, place: "Mangalore" },
    summary: "Took over the family store in the 1960s and expanded it to a second location. Insisted every child in the family, girls included, finish school before joining the business.",
    places: ["Born in Mangalore"],
    lifeLesson: { quote: "Teach the child to read before you teach him to earn.", values: ["Education"] },
    experience: [
      { type: "voice", caption: "Explaining why he insisted every child finish school before joining the business" },
      { type: "advice", caption: "Teach the child to read before you teach him to earn." },
      { type: "achievement", caption: "Expanded the family store to a second location" }
    ]
  },
  {
    id: "saraswathi", name: "Saraswathi Rao", gen: 2, born: "1932-09-08", died: "2010-04-11",
    spouse: "krishnamurthy", parents: [], trust: "elder",
    geo: { lat: 12.91, lng: 74.86, place: "Mangalore" },
    summary: "Ran a tight household on a strict schedule that her grandchildren still joke about. Taught herself tailoring and stitched most of the family's festival clothes into her seventies.",
    lifeLesson: { quote: "Discipline is love with a schedule.", values: ["Discipline"] }
  },
  {
    id: "padmavathi", name: "Padmavathi Sharma", gen: 2, born: "1931-04-27", died: "2015-08-05",
    spouse: "venkat", parents: ["narasimha", "kamala"], trust: "approx",
    geoOrigin: { lat: 12.91, lng: 74.86, place: "Mangalore", year: 1931, label: "Born in Mangalore" },
    geo: { lat: 13.34, lng: 74.74, place: "Udupi" },
    summary: "Married into the Sharma family in 1953. Known for keeping an unusually simple home by choice, even after the family could afford otherwise.",
    lifeLesson: { quote: "Keep the house simple; keep the heart generous.", values: ["Simplicity", "Hospitality"] }
  },
  {
    id: "venkat", name: "Venkat Sharma", gen: 2, born: "1927-12-03", died: "1998-10-22",
    spouse: "padmavathi", parents: [], trust: "approx",
    geo: { lat: 13.34, lng: 74.74, place: "Udupi" },
    summary: "A schoolteacher for thirty-one years in Udupi. Exact postings and dates are remembered approximately by the family."
  },
  {
    id: "gopalakrishna", name: "Gopalakrishna Rao", gen: 2, born: "1935-02-18", died: "2020-12-01",
    parents: ["narasimha", "kamala"], trust: "approx",
    geo: { lat: 12.91, lng: 74.86, place: "Mangalore" },
    summary: ""
  },
  {
    id: "ravindra", name: "Ravindra Rao", gen: 3, born: "1955-05-30",
    spouse: "sunanda", parents: ["krishnamurthy", "saraswathi"], trust: "verified",
    geo: { lat: 12.91, lng: 74.86, place: "Mangalore" },
    summary: "Expanded the family store into two more locations before selling the business in 2001 to focus on the family's small trust for education grants.",
    lifeLesson: { quote: "Every setback is a lesson wearing a disguise.", values: ["Resilience"] },
    experience: [
      { type: "advice", caption: "Every setback is a lesson wearing a disguise." },
      { type: "achievement", caption: "Grew the family store into three locations before stepping back to fund education grants" }
    ]
  },
  {
    id: "sunanda", name: "Sunanda Rao", gen: 3, born: "1958-11-14",
    spouse: "ravindra", parents: [], trust: "elder",
    geo: { lat: 12.91, lng: 74.86, place: "Mangalore" },
    summary: "Trained as a schoolteacher and taught at the same school as her father-in-law's old friend for eighteen years."
  },
  {
    id: "lakshmi", name: "Lakshmi Kumar", gen: 3, born: "1958-08-21",
    spouse: "suresh", parents: ["krishnamurthy", "saraswathi"], trust: "verified",
    geoOrigin: { lat: 12.91, lng: 74.86, place: "Mangalore", year: 1958, label: "Born in Mangalore" },
    geo: { lat: 12.97, lng: 77.59, place: "Bangalore", year: 1985, label: "Moved to Bangalore" },
    summary: "Moved to Bangalore in 1985 and started the family's tradition of a shared lamp-lighting call every Friday evening, wherever everyone happens to be.",
    lifeLesson: { quote: "Light the lamp before you ask why it's dark.", values: ["Devotion"] },
    experience: [
      { type: "song", caption: "The Friday evening bhajan she still leads on the family video call" },
      { type: "advice", caption: "Light the lamp before you ask why it's dark." },
      { type: "story", caption: "Why she started the Friday lamp-lighting call after moving to Bangalore" }
    ]
  },
  {
    id: "suresh", name: "Suresh Kumar", gen: 3, born: "1955-03-09", spouse: "lakshmi", parents: [], trust: "approx",
    summary: "Worked in the state electricity board for over three decades.",
    geoOrigin: { lat: 12.91, lng: 74.86, place: "Mangalore", year: 1955, label: "Born in Mangalore" },
    geo: { lat: 12.97, lng: 77.59, place: "Bangalore", year: 1985, label: "Moved to Bangalore with Lakshmi" }
  },
  {
    id: "anand", name: "Anand Sharma", gen: 3, born: "1960-07-19",
    spouse: "meera", parents: ["padmavathi", "venkat"], trust: "verified",
    geo: { lat: 13.34, lng: 74.74, place: "Udupi" },
    summary: "Kept his father's old teaching notebooks and, decades later, donated a set of them to a village school archive near Udupi."
  },
  {
    id: "meera", name: "Meera Sharma", gen: 3, born: "1963-02-02", spouse: "anand", parents: [], trust: "elder",
    summary: "Ran a small tailoring business from home for over twenty years.",
    geo: { lat: 13.34, lng: 74.74, place: "Udupi" }
  },
  {
    id: "deepa", name: "Deepa Sharma", gen: 3, born: "1963-10-11", parents: ["padmavathi", "venkat"], trust: "approx", summary: "",
    geo: { lat: 13.34, lng: 74.74, place: "Udupi" }
  },
  {
    id: "arjun", name: "Arjun Rao", gen: 4, born: "1985-09-23", parents: ["ravindra", "sunanda"], trust: "verified",
    summary: "Software engineer in Bangalore. Started this archive project after realising he couldn't remember his great-grandmother Kamala's voice.",
    geoOrigin: { lat: 12.91, lng: 74.86, place: "Mangalore", year: 1985, label: "Born in Mangalore" },
    geo: { lat: 12.97, lng: 77.59, place: "Bangalore", year: 2008, label: "Moved to Bangalore for work" }
  },
  {
    id: "kavya", name: "Kavya Reddy", gen: 4, born: "1988-12-05", spouse: "rohan", parents: ["ravindra", "sunanda"], trust: "verified",
    summary: "Paediatrician. Keeps the most complete written record of family birthdays of anyone alive.",
    geoOrigin: { lat: 12.91, lng: 74.86, place: "Mangalore", year: 1988, label: "Born in Mangalore" },
    geo: { lat: 19.08, lng: 72.88, place: "Mumbai", year: 2013, label: "Married Rohan, moved to Mumbai" }
  },
  {
    id: "rohan", name: "Rohan Reddy", gen: 4, born: "1986-06-17", spouse: "kavya", parents: [], trust: "approx",
    summary: "Joined the family in 2013. Still learning everyone's names at gatherings.",
    geo: { lat: 19.08, lng: 72.88, place: "Mumbai" }
  },
  {
    id: "nikhil", name: "Nikhil Kumar", gen: 4, born: "1990-04-08", parents: ["lakshmi", "suresh"], trust: "verified",
    summary: "Started the Friday lamp-lighting video call his mother now leads every week.",
    geo: { lat: 12.97, lng: 77.59, place: "Bangalore" }
  },
  {
    id: "ananya", name: "Ananya Sharma", gen: 4, born: "1992-01-30", parents: ["anand", "meera"], trust: "approx", summary: "",
    geo: { lat: 13.34, lng: 74.74, place: "Udupi" }
  },
  {
    id: "ishaan", name: "Ishaan Reddy", gen: 5, born: "2015-08-14", parents: ["kavya", "rohan"], trust: "approx", summary: "",
    geo: { lat: 19.08, lng: 72.88, place: "Mumbai" }
  },
  {
    id: "meher", name: "Meher Reddy", gen: 5, born: "2018-03-27", parents: ["kavya", "rohan"], trust: "approx", summary: "",
    geo: { lat: 19.08, lng: 72.88, place: "Mumbai" }
  }
];

const SAMPLE_MARRIAGES = [
  { a: "narasimha", b: "kamala", date: "1922-06-14" },
  { a: "krishnamurthy", b: "saraswathi", date: "1954-02-10" },
  { a: "padmavathi", b: "venkat", date: "1953-11-25" },
  { a: "ravindra", b: "sunanda", date: "1982-05-03" },
  { a: "lakshmi", b: "suresh", date: "1985-12-09" },
  { a: "anand", b: "meera", date: "1988-01-20" },
  { a: "kavya", b: "rohan", date: "2013-11-16" }
];

const SAMPLE_CONTRIBUTIONS = [
  { id: 1, personId: "narasimha", type: "audio", contributor: "Ravindra Rao", content: "A recording of Narasimha telling the story of his first week in Mangalore, taped on a cassette in 1976.", status: "Verified", date: "2026-04-02" },
  { id: 2, personId: "krishnamurthy", type: "document", contributor: "Anand Sharma", content: "land-deed-1941-scan.pdf", status: "Verified", date: "2026-05-11" },
  { id: 3, personId: "lakshmi", type: "memory", contributor: "Nikhil Kumar", content: "Amma never missed a Friday lamp-lighting call even when she was in the hospital in 2019 — she asked the nurse to prop up her phone.", status: "Verified", date: "2026-06-01" },
  { id: 4, personId: "arjun", type: "memory", contributor: "Kavya Reddy", content: "Arjun taught me to ride a bicycle on the terrace because he refused to let me be scared of the road below.", status: "Pending", date: "2026-07-10" },
  { id: 5, personId: "ishaan", type: "photo", contributor: "Rohan Reddy", content: "ishaan-first-steps.jpg", status: "Pending", date: "2026-07-14" },
  { id: 6, personId: "nikhil", type: "date", contributor: "Lakshmi Kumar", content: "2026-08-20 — Nikhil's convocation", status: "Pending", date: "2026-07-15" },
  { id: 7, personId: null, newPersonName: "Saroja (Narasimha's youngest sister)", type: "memory", contributor: "Meera Sharma", content: "Saroja walked twelve kilometres to attend Narasimha's wedding because there was no room left in the family cart.", status: "Pending", date: "2026-07-16" },
  { id: 8, personId: "deepa", type: "video", contributor: "Ananya Sharma", content: "Duplicate upload of Deepa's 60th birthday clip — already added under a different date.", status: "Rejected", date: "2026-06-20" },
  { id: 9, personId: "ananya", type: "memory", contributor: "Anand Sharma", content: "Ananya organised the whole family's vaccination records into one spreadsheet during the 2021 outbreak without anyone asking her to.", status: "Pending", date: "2026-07-17" },
  { id: 10, personId: "venkat", type: "edit", field: "summary", fieldLabel: "Summary", contributor: "Anand Sharma", content: "A schoolteacher for thirty-one years in Udupi, known for walking the last mile to school barefoot so his one pair of shoes would last the monsoon.", status: "Pending", date: "2026-07-18" }
];

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

// Anyone can replace the sample Rao family with their own, built via the
// Family Builder wizard. This now lives in the shared Supabase `app_state`
// table rather than one browser's localStorage, so every device sees the
// same family — swapping still reloads the app so every view picks up the
// new data (they all import PEOPLE/MARRIAGES from this one module).
//
// Because this is now shared, replacing or resetting the family affects
// everyone using this deployment, not just the browser that clicked the
// button — worth knowing before treating it as a casual "start over" action.
import { fetchKV, saveKV, deleteKV } from "../lib/kvStore";

const CUSTOM_FAMILY_KEY = "vamsha.customFamily";
const ADDITIONS_KEY = "vamsha.additions";

export async function saveCustomFamily(people, marriages) {
  await saveKV(CUSTOM_FAMILY_KEY, { people, marriages: marriages || [] });
  await Promise.all([deleteKV("vamsha.contributions"), deleteKV("vamsha.overrides"), deleteKV(ADDITIONS_KEY)]);
}

export async function clearCustomFamily() {
  await deleteKV(CUSTOM_FAMILY_KEY);
  await Promise.all([deleteKV("vamsha.contributions"), deleteKV("vamsha.overrides"), deleteKV(ADDITIONS_KEY)]);
}

// Synchronous — reflects whatever was hydrated at boot by initDataLayer().
// A swap/reset always reloads the page right after, so this can never go
// stale within a single session.
export function hasCustomFamily() {
  return IS_CUSTOM_FAMILY;
}

let additions = { people: [], marriages: [] };

export const PEOPLE = [...SAMPLE_PEOPLE];
export const MARRIAGES = [...SAMPLE_MARRIAGES];
export let INITIAL_CONTRIBUTIONS = SAMPLE_CONTRIBUTIONS;
export let INITIAL_OVERRIDES = {};
export let IS_CUSTOM_FAMILY = false;

// Populates PEOPLE/MARRIAGES/INITIAL_CONTRIBUTIONS/INITIAL_OVERRIDES/
// IS_CUSTOM_FAMILY from the shared Supabase backend. Must run — and be
// awaited — before the app's first render (see main.jsx), since every view
// reads these as plain synchronous module exports rather than reactive
// state; arriving too late would leave a stale/empty tree on screen with
// nothing to trigger a re-render.
export async function initDataLayer() {
  const [custom, additionsRaw, contributions, overrides] = await Promise.all([
    fetchKV(CUSTOM_FAMILY_KEY, null),
    fetchKV(ADDITIONS_KEY, { people: [], marriages: [] }),
    fetchKV("vamsha.contributions", undefined),
    fetchKV("vamsha.overrides", {}),
  ]);
  additions = { people: additionsRaw?.people || [], marriages: additionsRaw?.marriages || [] };
  IS_CUSTOM_FAMILY = !!custom;

  PEOPLE.length = 0;
  PEOPLE.push(...(custom?.people?.length ? custom.people : SAMPLE_PEOPLE), ...additions.people);
  MARRIAGES.length = 0;
  MARRIAGES.push(...(custom ? (custom.marriages || []) : SAMPLE_MARRIAGES), ...additions.marriages);
  // A `vamsha.contributions` row only exists once someone has actually
  // submitted or approved something — until then, fall back to the sample
  // set (or none, for a from-scratch custom family), same as before.
  INITIAL_CONTRIBUTIONS = contributions !== undefined ? contributions : (custom ? [] : SAMPLE_CONTRIBUTIONS);
  INITIAL_OVERRIDES = overrides || {};
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
// MARRIAGES arrays (picked up by every view on next render, no reload) and
// persists it so it survives a refresh.
export function addPerson(person, marriage) {
  additions.people.push(person);
  PEOPLE.push(person);
  if (marriage) {
    additions.marriages.push(marriage);
    MARRIAGES.push(marriage);
  }
  // Fire-and-forget — the in-memory arrays above are already updated for
  // instant UI feedback; this just makes the addition visible to other
  // devices on their next load.
  saveKV(ADDITIONS_KEY, additions);
}
