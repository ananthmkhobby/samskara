// Pure, framework-free relationship engine for the Pitru/Matru Vamshavali
// document (Parampara > Vamshavali). Shared verbatim between the browser
// preview (VamshavaliView.jsx) and the server-side PDF renderer
// (api/_photobook.js) — api/*.js can't import from src/ (different
// build/runtime, see _photobook.js's own header comment), so this file is
// ported there the same way a handful of src/data/helpers.js functions
// already are: copy, don't import, and name the source so the two can't
// quietly drift.
//
// The Kannada relationship terms below are not generated from a grammar —
// Kannada's genitive suffix varies by noun class (ತಾಯಿ → ತಾಯಿಯ, ತಮ್ಮ →
// ತಮ್ಮನ — different suffixes for different word endings), so a generic
// compositor risks producing wrong Kannada for any path not already
// verified. Every term here is instead the exact phrase from the user's
// own attached reference document, or (for the two sibling sections, which
// that document attests the building blocks for but not every
// combination) composed from that same small, attested vocabulary. Nothing
// here is invented beyond what the source document and its visible pattern
// support.

export function isDeceased(p) {
  return !!(p?.died || p?.diedUnknown);
}

// Resolves which of a person's up-to-2 `parents` is the father/mother,
// using the optional `gender` field (see the people.gender migration) —
// never guessed from array position or birth order. Returns null for
// either side when it can't be determined confidently (missing gender,
// both parents the same recorded gender, etc.) — the caller must treat
// null as "unknown," never as "absent."
export function resolveParentRole(person, byId) {
  const parentObjs = (person?.parents || []).map((id) => byId(id)).filter(Boolean);
  const male = parentObjs.filter((p) => p.gender === "male");
  const female = parentObjs.filter((p) => p.gender === "female");
  return {
    father: male.length === 1 ? male[0] : null,
    mother: female.length === 1 ? female[0] : null,
  };
}

// Walks a path of "father"/"mother" steps from `person`. Returns the
// resolved person at the end, or { brokenAt: index } the moment a link
// can't be resolved — the index is what later tells a "request this info"
// flow exactly which link in the chain is missing, rather than just
// failing the whole row.
export function walkPath(person, byId, steps) {
  let current = person;
  for (let i = 0; i < steps.length; i++) {
    if (!current) return { brokenAt: i };
    const { father, mother } = resolveParentRole(current, byId);
    current = steps[i] === "father" ? father : mother;
    if (!current) return { brokenAt: i };
  }
  return current || { brokenAt: steps.length - 1 };
}

function isResolved(walked) {
  return walked && walked.brokenAt === undefined;
}

// People who share at least one resolved parent with `person` — used for
// the two sibling-based sections (father's brothers, mother's brothers).
// `genderFilter` narrows to brothers ("male"); omit for either.
export function findSiblings(person, allPeople, genderFilter) {
  if (!person) return [];
  const parentIds = new Set(person.parents || []);
  if (!parentIds.size) return [];
  return allPeople.filter((p) => {
    if (p.id === person.id) return false;
    if (!p.parents?.some((id) => parentIds.has(id))) return false;
    if (genderFilter && p.gender !== genderFilter) return false;
    return true;
  });
}

// Mutual-only, mirrors src/data/helpers.js's mutualSpouse — a one-directional
// `.spouse` pointer means stale data, not a real link.
export function findSpouse(person, byId) {
  if (!person?.spouse) return null;
  const spouse = byId(person.spouse);
  return spouse && spouse.spouse === person.id ? spouse : null;
}

// Best-effort elder/younger, only when both birth years are on record —
// `born` is an ISO date or a bare year, both of which sort correctly as
// plain strings. Returns null (not a guess) when it can't be told.
function elderOrYounger(reference, candidate) {
  if (!reference?.born || !candidate?.born) return null;
  return candidate.born < reference.born ? "elder" : "younger";
}

// The five sections from the attached reference document, in order.
// "path" sections are a fixed single-ancestor chain; "siblings" sections
// (the two uncle sections) instead resolve a pivot ancestor and then list
// however many matching siblings — and each sibling's spouse — are found,
// since a person can have any number of uncles.
export const ANCESTOR_SECTIONS = [
  {
    key: "pitru_trayi", title: "ಪಿತೃತ್ರಯೀ", titleEnglish: "Pitru-trayi — Father's Direct Line", kind: "path",
    rows: [
      { path: ["father"], kannadaTerm: "ಪಿತೃ", englishTerm: "Father" },
      { path: ["father", "father"], kannadaTerm: "ಪಿತಾಮಹ", englishTerm: "Father's Father" },
      { path: ["father", "father", "father"], kannadaTerm: "ಪ್ರಪಿತಾಮಹ", englishTerm: "Father's Father's Father" },
    ],
  },
  {
    key: "matru_trayi", title: "ಮಾತೃತ್ರಯೀ", titleEnglish: "Matru-trayi — Wives of the Direct Line", kind: "path",
    rows: [
      { path: ["mother"], kannadaTerm: "ತಾಯಿ", englishTerm: "Mother" },
      { path: ["father", "mother"], kannadaTerm: "ತಂದೆಯ ತಾಯಿ", englishTerm: "Father's Mother" },
      { path: ["father", "father", "mother"], kannadaTerm: "ತಂದೆಯ ಅಜ್ಜಿ", englishTerm: "Father's Father's Mother" },
    ],
  },
  {
    key: "matru_gana", title: "ಮಾತೃಗಣ", titleEnglish: "Matru-gana — Mother's Line", kind: "path",
    rows: [
      { path: ["mother", "father"], kannadaTerm: "ತಾಯಿಯ ತಂದೆ", englishTerm: "Mother's Father" },
      { path: ["mother", "mother"], kannadaTerm: "ತಾಯಿಯ ತಾಯಿ", englishTerm: "Mother's Mother" },
      { path: ["mother", "father", "father"], kannadaTerm: "ತಾಯಿಯ ಅಜ್ಜ", englishTerm: "Mother's Father's Father" },
      { path: ["mother", "father", "mother"], kannadaTerm: "ತಾಯಿಯ ಅಜ್ಜಿ", englishTerm: "Mother's Father's Mother" },
      { path: ["mother", "father", "father", "father"], kannadaTerm: "ತಾಯಿಯ ಮುತ್ತಜ್ಜ", englishTerm: "Mother's Father's Father's Father" },
      { path: ["mother", "father", "father", "mother"], kannadaTerm: "ತಾಯಿಯ ಮುತ್ತಜ್ಜಿ", englishTerm: "Mother's Father's Father's Mother" },
    ],
  },
  {
    key: "pitru_bhratru", title: "ಪಿತೃ ಭ್ರಾತೃ", titleEnglish: "Pitru-Bhratru — Father's Brothers", kind: "siblings",
    pivotPath: ["father"], relationPrefixKannada: "ತಂದೆಯ", relationPrefixEnglish: "Father's",
  },
  {
    key: "sodara_mavandiru", title: "ಸೋದರ ಮಾವಂದಿರು", titleEnglish: "Sodara-Mavandiru — Mother's Brothers", kind: "siblings",
    pivotPath: ["mother"], relationPrefixKannada: "ತಾಯಿಯ", relationPrefixEnglish: "Mother's",
  },
];

// Vocabulary attested directly in the reference document: ಅಣ್ಣ (elder
// brother), ತಮ್ಮ (younger brother), both take -ನ for "X's" (ತಮ್ಮನ
// ಹೆಂಡತಿ = younger brother's wife, exactly as shown). ಸಹೋದರ (brother,
// unspecified order) is the honest fallback when birth years aren't on
// record to tell elder from younger — it takes the same -ನ suffix pattern.
const SIBLING_TERM = { elder: "ಅಣ್ಣ", younger: "ತಮ್ಮ", unknown: "ಸಹೋದರ" };
const SIBLING_TERM_ENGLISH = { elder: "Elder Brother", younger: "Younger Brother", unknown: "Brother" };

function personRow(person, kannadaTerm, englishTerm, mode) {
  const alive = !isDeceased(person);
  const nameHidden = mode === "pitru" && alive;
  return {
    kannadaTerm, englishTerm,
    personId: person.id,
    name: nameHidden ? null : person.name,
    isAlive: alive,
    gotra: person.gotra || null,
    rashi: person.rashi || null,
  };
}

function unresolvedRow(kannadaTerm, englishTerm, brokenAt) {
  return { kannadaTerm, englishTerm, personId: null, name: null, isAlive: null, gotra: null, rashi: null, unresolved: true, brokenAt };
}

// Builds the full document for `personId` as the ego. `mode`:
// - "pitru" (Phase 1's only mode): a living resolved relative is shown
//   with the alive-placeholder instead of their name, matching the
//   ritual convention in the reference document — this document names
//   the departed, not the living.
// Returns { ego, sections: [{ key, title, titleEnglish, rows }] }, or
// { ego: null, sections: [] } if personId isn't found.
export function buildVamshavali(personId, allPeople, mode = "pitru") {
  const byId = (id) => allPeople.find((p) => p.id === id);
  const ego = byId(personId);
  if (!ego) return { ego: null, sections: [] };

  const sections = ANCESTOR_SECTIONS.map((section) => {
    if (section.kind === "path") {
      const rows = section.rows.map((rowDef) => {
        const walked = walkPath(ego, byId, rowDef.path);
        return isResolved(walked)
          ? personRow(walked, rowDef.kannadaTerm, rowDef.englishTerm, mode)
          : unresolvedRow(rowDef.kannadaTerm, rowDef.englishTerm, walked.brokenAt);
      });
      return { key: section.key, title: section.title, titleEnglish: section.titleEnglish, rows };
    }

    // kind === "siblings"
    const pivot = walkPath(ego, byId, section.pivotPath);
    if (!isResolved(pivot)) {
      return {
        key: section.key, title: section.title, titleEnglish: section.titleEnglish,
        rows: [unresolvedRow(section.relationPrefixKannada, section.relationPrefixEnglish, pivot.brokenAt)],
      };
    }
    const brothers = findSiblings(pivot, allPeople, "male");
    const rows = [];
    for (const brother of brothers) {
      const order = elderOrYounger(pivot, brother) || "unknown";
      rows.push(personRow(
        brother,
        `${section.relationPrefixKannada} ${SIBLING_TERM[order]}`,
        `${section.relationPrefixEnglish} ${SIBLING_TERM_ENGLISH[order]}`,
        mode
      ));
      const spouse = findSpouse(brother, byId);
      if (spouse) {
        rows.push(personRow(
          spouse,
          `${section.relationPrefixKannada} ${SIBLING_TERM[order]}ನ ಹೆಂಡತಿ`,
          `${section.relationPrefixEnglish} ${SIBLING_TERM_ENGLISH[order]}'s Wife`,
          mode
        ));
      }
    }
    if (!rows.length) rows.push({ kannadaTerm: section.relationPrefixKannada, englishTerm: section.relationPrefixEnglish, personId: null, name: null, isAlive: null, gotra: null, rashi: null, noneFound: true });
    return { key: section.key, title: section.title, titleEnglish: section.titleEnglish, rows };
  });

  return { ego, sections };
}
