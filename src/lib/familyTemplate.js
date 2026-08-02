import * as XLSX from "xlsx";
import { VALUES } from "../data/people";
import { geocodePlace } from "./geocode";

// One shared column schema used both to generate the downloadable template
// and to parse a filled-in one back — keeps the two from ever drifting out
// of sync with each other.
export const TEMPLATE_COLUMNS = [
  { key: "personId", header: "Person ID*", width: 16 },
  { key: "name", header: "Name*", width: 24 },
  { key: "parent1Id", header: "Parent 1 ID", width: 14 },
  { key: "parent2Id", header: "Parent 2 ID", width: 14 },
  { key: "spouseId", header: "Spouse ID", width: 14 },
  { key: "born", header: "Born (YYYY-MM-DD or YYYY)", width: 24 },
  { key: "died", header: "Died (blank if living, \"deceased\" if date unknown)", width: 30 },
  { key: "rashi", header: "Rashi", width: 14 },
  { key: "gotra", header: "Gotra", width: 16 },
  { key: "city", header: "Current City", width: 18 },
  { key: "places", header: "Places (separate with ;)", width: 40 },
  { key: "lifeLesson", header: "Life Lesson", width: 40 },
  { key: "lifeLessonValues", header: `Life Lesson Values (${VALUES.join(", ")})`, width: 44 },
  { key: "summary", header: "Summary", width: 44 },
];

const EXAMPLE_ROWS = [
  { personId: "example-grandpa", name: "Example Grandfather", spouseId: "example-grandma", born: "1930", died: "2005", rashi: "Simha", gotra: "Bharadwaja", places: "Born in Example Village", lifeLesson: "Hard work never goes to waste.", lifeLessonValues: "Discipline, Resilience", summary: "Delete these 3 example rows before adding your own family." },
  { personId: "example-grandma", name: "Example Grandmother", spouseId: "example-grandpa", born: "1935", city: "Mangalore" },
  { personId: "example-child", name: "Example Child", parent1Id: "example-grandpa", parent2Id: "example-grandma", born: "1960", city: "Bangalore" },
];

const INSTRUCTIONS_ROWS = [
  ["Samskara Vamsha Vruksha — family import template"],
  [""],
  ["How this works"],
  ["1. Go to the \"Family Data\" sheet."],
  ["2. Delete the 3 example rows and add one row per family member."],
  ["3. Give everyone a short, unique Person ID that you invent — e.g. \"narasimha\" or \"grandpa1\". Other rows use this ID to say who someone's parent or spouse is."],
  ["4. Only Person ID and Name are required — leave anything else blank if you don't know it."],
  ["5. Photos, audio, and video are added later inside the app, not in this file."],
  ["6. Save this file and upload it back on the \"Fill in a spreadsheet template\" step."],
  [""],
  ["Column", "What to enter", "Example"],
  ["Person ID*", "A short code you invent, unique within this file.", "narasimha"],
  ["Name*", "Full name.", "Narasimha Rao"],
  ["Parent 1 ID / Parent 2 ID", "The Person ID of one or both parents, if they're also in this file.", "narasimha"],
  ["Spouse ID", "The Person ID of their spouse, if also in this file.", "kamala"],
  ["Born", "A date (YYYY-MM-DD) or just a year.", "1902 or 1902-03-11"],
  ["Died", "Leave blank if living. Know they've passed but not when? Just write \"deceased\" — it'll be recorded that way instead of guessing a date.", "1978-09-02, or \"deceased\""],
  ["Rashi / Gotra", "Optional heritage details.", "Simha / Bharadwaja"],
  ["Current City", "Where they live now — places them on the family's Journey map.", "Mangalore"],
  ["Places", "Separate multiple places with a semicolon (;).", "Born in Kundapura; Settled in Mangalore, 1934"],
  ["Life Lesson", "A quote or piece of advice remembered from them.", "Never let a regular customer leave without credit if they need it."],
  ["Life Lesson Values", `Comma-separated, from: ${VALUES.join(", ")}.`, "Hospitality, Seva"],
  ["Summary", "A couple of sentences about their life.", "Founder of the family household in Mangalore..."],
];

export function generateTemplateWorkbook() {
  const wb = XLSX.utils.book_new();

  const instructionsSheet = XLSX.utils.aoa_to_sheet(INSTRUCTIONS_ROWS);
  instructionsSheet["!cols"] = [{ wch: 26 }, { wch: 60 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, instructionsSheet, "Instructions");

  const headers = TEMPLATE_COLUMNS.map((c) => c.header);
  const dataRows = EXAMPLE_ROWS.map((row) => TEMPLATE_COLUMNS.map((c) => row[c.key] || ""));
  const dataSheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  dataSheet["!cols"] = TEMPLATE_COLUMNS.map((c) => ({ wch: c.width }));
  XLSX.utils.book_append_sheet(wb, dataSheet, "Family Data");

  return wb;
}

export function downloadTemplate() {
  XLSX.writeFile(generateTemplateWorkbook(), "samskara-family-template.xlsx");
}

function slugifyId(raw) {
  return String(raw ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function parseDate(raw) {
  if (raw instanceof Date && !isNaN(raw)) return { value: raw.toISOString().slice(0, 10), yearOnly: false, warning: null };
  const s = String(raw ?? "").trim();
  if (!s) return { value: null, yearOnly: false, warning: null };
  // A bare year has no real day/month — flagged so the Vault doesn't treat
  // the January 1st placeholder below as an actual date.
  if (/^\d{4}$/.test(s)) return { value: `${s}-01-01`, yearOnly: true, warning: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { value: s, yearOnly: false, warning: null };
  return { value: null, yearOnly: false, warning: `couldn't understand the date "${s}" — left blank` };
}

// Parses an uploaded, filled-in template. Returns { people, marriages,
// errors, warnings } in the shape data/familyDb.js's bulkInsertFamily
// expects — blocking errors mean nothing should be imported; warnings are
// informational only.
export async function parseTemplateWorkbook(arrayBuffer) {
  const errors = [];
  const warnings = [];
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets["Family Data"] || wb.Sheets[wb.SheetNames[wb.SheetNames.length - 1]];
  if (!sheet) {
    errors.push('Couldn\'t find a "Family Data" sheet in this file — make sure you\'re uploading the template as downloaded.');
    return { people: [], marriages: [], errors, warnings };
  }

  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!rawRows.length) {
    errors.push("No people found — the Family Data sheet is empty.");
    return { people: [], marriages: [], errors, warnings };
  }

  const headerToKey = Object.fromEntries(TEMPLATE_COLUMNS.map((c) => [c.header, c.key]));
  const rows = rawRows.map((raw, i) => {
    const row = { _rowNum: i + 2 };
    for (const [header, value] of Object.entries(raw)) {
      const key = headerToKey[header];
      if (key) row[key] = value;
    }
    return row;
  });

  const byId = new Map();
  rows.forEach((row) => {
    const id = slugifyId(row.personId);
    row._id = id;
    if (!id) { errors.push(`Row ${row._rowNum}: missing Person ID.`); return; }
    if (!String(row.name ?? "").trim()) { errors.push(`Row ${row._rowNum} ("${id}"): missing Name.`); return; }
    if (byId.has(id)) { errors.push(`Row ${row._rowNum}: Person ID "${id}" is used more than once (also row ${byId.get(id)._rowNum}).`); return; }
    byId.set(id, row);
  });
  if (errors.length) return { people: [], marriages: [], errors, warnings };

  function checkRef(row, field, label) {
    const ref = slugifyId(row[field]);
    if (!ref) return "";
    if (!byId.has(ref)) { errors.push(`Row ${row._rowNum} ("${row._id}"): ${label} "${row[field]}" doesn't match any Person ID in this file.`); return ""; }
    return ref;
  }
  rows.forEach((row) => {
    row._parent1 = checkRef(row, "parent1Id", "Parent 1 ID");
    row._parent2 = checkRef(row, "parent2Id", "Parent 2 ID");
    row._spouse = checkRef(row, "spouseId", "Spouse ID");
    if (row._parent1 && row._parent1 === row._id) errors.push(`Row ${row._rowNum} ("${row._id}"): can't be their own parent.`);
    if (row._parent2 && row._parent2 === row._id) errors.push(`Row ${row._rowNum} ("${row._id}"): can't be their own parent.`);
    if (row._spouse && row._spouse === row._id) errors.push(`Row ${row._rowNum} ("${row._id}"): can't be their own spouse.`);
  });
  if (errors.length) return { people: [], marriages: [], errors, warnings };

  // Mirror one-sided spouse declarations so pairing/labels work from
  // either person's row, same as if both had listed each other.
  rows.forEach((row) => {
    if (!row._spouse) return;
    const other = byId.get(row._spouse);
    if (!other._spouse) other._spouse = row._id;
    else if (other._spouse !== row._id) errors.push(`Row ${row._rowNum} ("${row._id}") and row ${other._rowNum} ("${other._id}") disagree about who their spouse is.`);
  });
  if (errors.length) return { people: [], marriages: [], errors, warnings };

  // Generation is computed from parent chains, not a manual column — but a
  // person with no parents listed isn't necessarily a root: they might have
  // married into the family, in which case they belong at their spouse's
  // generation, not automatically generation 1. Pass 1 resolves everyone
  // reachable via a parent chain; pass 2 lets anyone still unresolved
  // inherit their spouse's generation (iterated, in case that spouse was
  // themselves only just resolved this way); anyone left over — truly
  // isolated, or two married-in people paired with each other and no
  // blood link to anyone — defaults to generation 1.
  const genCache = new Map();
  function fromParents(id, stack) {
    if (genCache.has(id)) return genCache.get(id);
    if (stack.includes(id)) { errors.push(`Circular parent relationship detected involving "${id}".`); genCache.set(id, 1); return 1; }
    const row = byId.get(id);
    const parents = [row._parent1, row._parent2].filter(Boolean);
    if (!parents.length) return null;
    const gen = 1 + Math.max(...parents.map((p) => fromParents(p, [...stack, id]) ?? 1));
    genCache.set(id, gen);
    return gen;
  }
  rows.forEach((row) => {
    const gen = fromParents(row._id, []);
    if (gen !== null) genCache.set(row._id, gen);
  });
  let resolvedMore = true;
  let guard = 0;
  while (resolvedMore && guard < rows.length + 1) {
    resolvedMore = false;
    guard++;
    rows.forEach((row) => {
      if (genCache.has(row._id)) return;
      if (row._spouse && genCache.has(row._spouse)) {
        genCache.set(row._id, genCache.get(row._spouse));
        resolvedMore = true;
      }
    });
  }
  rows.forEach((row) => { row._gen = genCache.has(row._id) ? genCache.get(row._id) : 1; });
  if (errors.length) return { people: [], marriages: [], errors, warnings };

  // A few plain-English synonyms in the Died column mean "definitely
  // deceased, but no one knows exactly when" — distinct from leaving it
  // blank (which means still living). Checked before the date parser so
  // these never fall through to a "couldn't understand this date" warning.
  const DIED_UNKNOWN_WORDS = new Set(["deceased", "dead", "yes", "unknown", "passed away", "passed"]);
  rows.forEach((row) => {
    const born = parseDate(row.born);
    const diedRaw = String(row.died ?? "").trim().toLowerCase();
    row._diedUnknown = DIED_UNKNOWN_WORDS.has(diedRaw);
    const died = row._diedUnknown ? { value: null, yearOnly: false, warning: null } : parseDate(row.died);
    row._born = born.value;
    row._died = died.value;
    row._bornYearOnly = born.yearOnly;
    row._diedYearOnly = died.yearOnly;
    if (born.warning) warnings.push(`Row ${row._rowNum} ("${row._id}"): ${born.warning} for Born.`);
    if (died.warning) warnings.push(`Row ${row._rowNum} ("${row._id}"): ${died.warning} for Died.`);
  });

  const valuesByLower = new Map(VALUES.map((v) => [v.toLowerCase(), v]));
  rows.forEach((row) => {
    const listed = String(row.lifeLessonValues ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    row._values = [];
    listed.forEach((v) => {
      const match = valuesByLower.get(v.toLowerCase());
      if (match) row._values.push(match);
      else warnings.push(`Row ${row._rowNum} ("${row._id}"): "${v}" isn't a recognized value tag — skipped.`);
    });
  });

  rows.forEach((row) => {
    row._places = String(row.places ?? "").split(";").map((s) => s.trim()).filter(Boolean);
  });

  // Geocode distinct cities sequentially, respecting Nominatim's ~1 req/sec
  // usage policy, rather than firing them all in parallel.
  const cityToGeo = new Map();
  const uniqueCities = [...new Set(rows.map((r) => String(r.city ?? "").trim()).filter(Boolean))];
  for (const city of uniqueCities) {
    try {
      cityToGeo.set(city, await geocodePlace(city));
    } catch (err) {
      warnings.push(`Couldn't place "${city}" on the map (${err.message}) — imported without a Journey pin.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }

  const people = rows.map((row) => ({
    id: row._id,
    name: String(row.name).trim(),
    gen: row._gen,
    born: row._born,
    died: row._died,
    bornYearOnly: row._bornYearOnly,
    diedYearOnly: row._diedYearOnly,
    diedUnknown: row._diedUnknown,
    parents: [row._parent1, row._parent2].filter(Boolean),
    spouse: row._spouse || undefined,
    rashi: String(row.rashi ?? "").trim() || undefined,
    gotra: String(row.gotra ?? "").trim() || undefined,
    trust: "approx",
    geo: cityToGeo.get(String(row.city ?? "").trim()) || undefined,
    summary: String(row.summary ?? "").trim() || undefined,
    places: row._places.length ? row._places : undefined,
    lifeLesson: (String(row.lifeLesson ?? "").trim() || row._values.length)
      ? { quote: String(row.lifeLesson ?? "").trim(), values: row._values }
      : undefined,
  }));

  const seenPairs = new Set();
  const marriages = [];
  rows.forEach((row) => {
    if (!row._spouse) return;
    const pairKey = [row._id, row._spouse].sort().join("|");
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);
    marriages.push({ a: row._id, b: row._spouse, date: null });
  });

  return { people, marriages, errors, warnings };
}
