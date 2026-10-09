// Shared rendering for the two photobook endpoints (photobook-person.js,
// photobook-family.js). Deliberately self-contained — api/*.js can't import
// from src/ (different build/runtime), so a handful of tiny, stable helpers
// are ported here verbatim from src/data/helpers.js rather than shared by
// reference. Each one names its source so the two don't quietly drift.
//
// Uses React.createElement directly rather than JSX — api/*.js files run as
// plain Vercel Node functions, not through Vite's JSX transform, and
// there's no guarantee the Node function builder applies a JSX transform to
// a .js file. createElement sidesteps that question entirely.
import { createElement as h } from "react";
import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { fileURLToPath } from "url";
import path from "path";
import { buildVamshavali } from "../src/lib/vamshavali.js";

// Noto Sans Kannada (SIL Open Font License) — the Standard-14 PDF fonts
// used everywhere else in this file (Times-Roman etc.) have no Kannada
// glyphs at all, so the Vamshavali document needs its own embedded font.
// Bundled into this function's deployment via vercel.json's existing
// includeFiles mechanism (same precedent already used there for pdfkit's
// own standard-font data). Registered once, at module load, for every
// render in this process.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
Font.register({ family: "Noto Sans Kannada", src: path.join(__dirname, "_fonts/NotoSansKannada-Regular.ttf") });

// Ported from src/components/PersonAvatar.jsx:1,7-11 — generation-to-color
// mapping, used here for section dividers in the whole-family book.
export const GEN_COLOR_STOPS = ["#5C1414", "#8A2222", "#7A5714", "#26381F", "#3D5A34"];
export function genColor(gen, minGen, maxGen) {
  if (maxGen === minGen) return GEN_COLOR_STOPS[0];
  const t = (gen - minGen) / (maxGen - minGen);
  return GEN_COLOR_STOPS[Math.round(t * (GEN_COLOR_STOPS.length - 1))];
}

// Ported from src/data/helpers.js:35-37,44-47.
export function isDeceased(p) {
  return !!(p?.died || p?.diedUnknown);
}
export function formatName(p) {
  if (!p?.name) return p?.name ?? "";
  return isDeceased(p) ? `Late ${p.name}` : p.name;
}

// Ported from src/data/helpers.js:49-54.
export function yearsLabel(p) {
  const by = p.born ? p.born.slice(0, 4) : "?";
  if (p.died) return `${by}–${p.died.slice(0, 4)}`;
  if (p.diedUnknown) return `${by}–?`;
  return `b. ${by}`;
}

// Ported from src/data/helpers.js:149-157 — always returns a non-empty
// chapters array, same graceful fallback the in-app "Open full biography"
// relies on.
export function getBiographyChapters(person) {
  if (person.chapters && person.chapters.length) return person.chapters;
  const parts = [];
  if (person.summary) parts.push(person.summary);
  if (person.lifeLesson) parts.push(`A life lesson remembered: “${person.lifeLesson.quote}”`);
  if (person.places && person.places.length) parts.push(`Places: ${person.places.join(", ")}`);
  if (!parts.length) parts.push(`${person.name}'s story hasn't been written yet. Share what you know, and a fuller biography can grow from here.`);
  return [{ title: "Their Story So Far", text: parts.join("\n\n") }];
}

// Brand palette ported from src/styles/tokens.css — the small subset needed
// here, not the whole token system (this is a deliberately print-styled
// document, not a reuse of the app's live CSS).
const COLOR = {
  parchment: "#EFE1BB",
  parchmentPaper: "#F8F0DA",
  ink: "#3B2712",
  inkSoft: "#6B4E30",
  maroon: "#8A2222",
  maroonDeep: "#5C1414",
  gold: "#A9791C",
};

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Times-Roman", fontSize: 11, color: COLOR.ink, backgroundColor: "#FFFFFF" },
  coverPage: { padding: 0, backgroundColor: COLOR.parchment, alignItems: "center", justifyContent: "center" },
  coverLogo: { width: 110, height: 110, borderRadius: 55, marginBottom: 24, objectFit: "cover" },
  coverTitle: { fontFamily: "Times-Bold", fontSize: 30, color: COLOR.maroonDeep, textAlign: "center", marginBottom: 8 },
  coverSubtitle: { fontSize: 13, color: COLOR.inkSoft, textAlign: "center", marginBottom: 4 },
  coverFooter: { position: "absolute", bottom: 40, fontSize: 9, color: COLOR.inkSoft, textAlign: "center", width: "100%" },

  personHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 18, borderBottom: `1pt solid ${COLOR.gold}`, paddingBottom: 14 },
  personPhoto: { width: 72, height: 72, borderRadius: 36, marginRight: 16, objectFit: "cover" },
  personInitials: { width: 72, height: 72, borderRadius: 36, marginRight: 16, alignItems: "center", justifyContent: "center" },
  personInitialsText: { color: "#FFFFFF", fontFamily: "Times-Bold", fontSize: 22 },
  personName: { fontFamily: "Times-Bold", fontSize: 20, color: COLOR.maroonDeep },
  personMeta: { fontSize: 10, color: COLOR.inkSoft, marginTop: 3 },

  sectionHeading: { fontFamily: "Times-Bold", fontSize: 13, color: COLOR.maroon, marginTop: 16, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  bodyText: { fontSize: 11, lineHeight: 1.5, color: COLOR.ink, marginBottom: 6 },
  chapterTitle: { fontFamily: "Times-Bold", fontSize: 12, color: COLOR.ink, marginTop: 8, marginBottom: 4 },

  lifeLessonBox: { backgroundColor: COLOR.parchmentPaper, padding: 14, borderRadius: 4, marginTop: 16 },
  lifeLessonQuote: { fontFamily: "Times-Italic", fontSize: 13, color: COLOR.maroonDeep, lineHeight: 1.5 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, gap: 6 },
  chip: { fontSize: 8, color: COLOR.gold, border: `0.75pt solid ${COLOR.gold}`, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8 },

  galleryGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 16, gap: 8 },
  galleryItem: { width: 150 },
  galleryImage: { width: 150, height: 150, objectFit: "cover", borderRadius: 4 },
  galleryCaption: { fontSize: 8, color: COLOR.inkSoft, marginTop: 3 },

  memoryQuote: { fontSize: 10.5, fontFamily: "Times-Italic", color: COLOR.ink, marginTop: 10, lineHeight: 1.4 },
  memoryAttribution: { fontSize: 9, color: COLOR.inkSoft, marginTop: 2 },

  dividerPage: { padding: 0, alignItems: "center", justifyContent: "center" },
  dividerLabel: { fontFamily: "Times-Bold", fontSize: 26, color: "#FFFFFF", textAlign: "center" },

  tocHeading: { fontFamily: "Times-Bold", fontSize: 20, color: COLOR.maroonDeep, marginBottom: 20 },
  tocGenHeading: { fontFamily: "Times-Bold", fontSize: 12, color: COLOR.maroon, marginTop: 14, marginBottom: 6 },
  tocEntry: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  tocDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  tocName: { fontSize: 11, color: COLOR.ink },

  // Sized up from the original pass — this document is read as often on a
  // phone (fit-to-width, no separate zoom step most people think to take)
  // as printed, so the baseline needs to hold up small, not just on paper.
  vTitleKannada: { fontFamily: "Noto Sans Kannada", fontSize: 24, color: COLOR.maroonDeep, textAlign: "center" },
  vTitleEnglish: { fontSize: 12, color: COLOR.inkSoft, textAlign: "center", marginTop: 4, marginBottom: 4 },
  // Noto Sans Kannada, not Times-Italic — this line mixes English and
  // Kannada mid-sentence, and the Standard-14 fonts have no Kannada
  // glyphs at all, which garbled the Kannada word when this was tried
  // with Times-Italic. Noto Sans Kannada covers Latin too, so one font
  // for the whole mixed-script line is both correct and simpler.
  vSubhead: { fontFamily: "Noto Sans Kannada", fontSize: 10, color: COLOR.inkSoft, textAlign: "center", marginBottom: 18 },
  vSection: { marginBottom: 16, border: `0.75pt solid ${COLOR.gold}`, borderRadius: 4 },
  vSectionHead: { backgroundColor: COLOR.parchment, paddingVertical: 7, paddingHorizontal: 10 },
  vSectionTitleKannada: { fontFamily: "Noto Sans Kannada", fontSize: 14, color: COLOR.maroonDeep },
  vSectionTitleEnglish: { fontSize: 9, color: COLOR.inkSoft, marginTop: 1 },
  // Column proportions: Relationship / Name / Status / Gotra / Rashi —
  // Name gets the most room since it's the one column that's genuinely
  // variable-length and the thing a reader is actually looking for.
  vHeaderRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 10, backgroundColor: COLOR.maroonDeep },
  vHeaderCell: { fontFamily: "Times-Bold", fontSize: 8, color: "#F8ECE4", textTransform: "uppercase", letterSpacing: 0.5 },
  vRow: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 10, borderTop: `0.5pt solid ${COLOR.parchment}` },
  vRowTerm: { width: "26%" },
  vRowTermKannada: { fontFamily: "Noto Sans Kannada", fontSize: 11, color: COLOR.ink },
  vRowTermEnglish: { fontSize: 7.5, color: COLOR.inkSoft, marginTop: 1 },
  vRowName: { width: "30%", fontFamily: "Noto Sans Kannada", fontSize: 11.5, color: COLOR.ink, fontWeight: 600 },
  vRowStatus: { width: "14%", fontSize: 9.5, color: COLOR.inkSoft },
  vRowGotra: { width: "15%", fontSize: 9.5, color: COLOR.inkSoft },
  vRowRashi: { width: "15%", fontSize: 9.5, color: COLOR.inkSoft },
});

const V_HEADER_LABELS = [
  ["26%", "Relationship"], ["30%", "Name"], ["14%", "Status"], ["15%", "Gotra"], ["15%", "Rashi"],
];

function PersonHeader({ person }) {
  const initials = (person.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return h(View, { style: styles.personHeaderRow },
    person.photoUrl
      ? h(Image, { src: person.photoUrl, style: styles.personPhoto })
      : h(View, { style: [styles.personInitials, { backgroundColor: COLOR.maroon }] },
          h(Text, { style: styles.personInitialsText }, initials)),
    h(View, null,
      h(Text, { style: styles.personName }, formatName(person)),
      h(Text, { style: styles.personMeta },
        yearsLabel(person) +
        (person.rashi ? `  ·  Rashi: ${person.rashi}` : "") +
        (person.gotra ? `  ·  Gotra: ${person.gotra}` : "")
      )
    )
  );
}

// One person's full chapter — used standalone (wrapped in its own Page by
// the per-person endpoint) and repeated per included person inside the
// whole-family Document. `media`/`memories` are already filtered+capped by
// the caller (see MAX_PHOTOS/MAX_MEMORIES constants in the two endpoints).
export function PersonSection({ person, media, memories }) {
  const chapters = getBiographyChapters(person);
  return h(View, null,
    h(PersonHeader, { person }),

    person.lifeLesson && h(View, { style: styles.lifeLessonBox },
      h(Text, { style: styles.lifeLessonQuote }, `“${person.lifeLesson.quote}”`),
      !!person.lifeLesson.values?.length && h(View, { style: styles.chipRow },
        person.lifeLesson.values.map((v) => h(Text, { key: v, style: styles.chip }, v))
      )
    ),

    h(Text, { style: styles.sectionHeading }, "Their Story"),
    chapters.map((ch, i) => h(View, { key: i },
      ch.title && h(Text, { style: styles.chapterTitle }, ch.title),
      h(Text, { style: styles.bodyText }, ch.text)
    )),

    person.dayInLife?.items?.length ? h(View, null,
      h(Text, { style: styles.sectionHeading }, `A Day In Their Life${person.dayInLife.year ? ` — ${person.dayInLife.year}` : ""}`),
      person.dayInLife.items.map((item, i) => h(Text, { key: i, style: styles.bodyText }, `• ${item}`))
    ) : null,

    media.length ? h(View, null,
      h(Text, { style: styles.sectionHeading }, "Photographs"),
      h(View, { style: styles.galleryGrid },
        media.map((m) => h(View, { key: m.id, style: styles.galleryItem },
          h(Image, { src: m.mediaUrl, style: styles.galleryImage }),
          (m.date || m.contributor) && h(Text, { style: styles.galleryCaption }, [m.date, m.contributor].filter(Boolean).join(" · "))
        ))
      )
    ) : null,

    memories.length ? h(View, null,
      h(Text, { style: styles.sectionHeading }, "Memories Shared"),
      memories.map((m) => h(View, { key: m.id },
        h(Text, { style: styles.memoryQuote }, `“${m.content}”`),
        m.contributor && h(Text, { style: styles.memoryAttribution }, `— ${m.contributor}`)
      ))
    ) : null
  );
}

export function FamilyCoverPage({ familyName, tagline, logoUrl, personCount, genCount }) {
  return h(Page, { size: "A4", style: [styles.page, styles.coverPage] },
    logoUrl ? h(Image, { src: logoUrl, style: styles.coverLogo }) : null,
    h(Text, { style: styles.coverTitle }, familyName || "Our Family"),
    tagline ? h(Text, { style: styles.coverSubtitle }, tagline) : null,
    h(Text, { style: [styles.coverSubtitle, { marginTop: 16, fontFamily: "Times-Italic" }] }, "A Samskara Family Photobook"),
    h(Text, { style: styles.coverFooter },
      `${personCount} ${personCount === 1 ? "person" : "people"} across ${genCount} generation${genCount === 1 ? "" : "s"}  ·  ` +
      new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
    )
  );
}

export function TableOfContentsPage({ generations, minGen, maxGen }) {
  return h(Page, { size: "A4", style: styles.page },
    h(Text, { style: styles.tocHeading }, "Table of Contents"),
    generations.map(({ gen, people }) => h(View, { key: gen },
      h(Text, { style: styles.tocGenHeading }, `Generation ${gen - minGen + 1}`),
      people.map((p) => h(View, { key: p.id, style: styles.tocEntry },
        h(View, { style: [styles.tocDot, { backgroundColor: genColor(gen, minGen, maxGen) }] }),
        h(Text, { style: styles.tocName }, formatName(p))
      ))
    ))
  );
}

export function GenerationDividerPage({ gen, minGen, maxGen }) {
  const color = genColor(gen, minGen, maxGen);
  return h(Page, { size: "A4", style: [styles.page, styles.dividerPage, { backgroundColor: color }] },
    h(Text, { style: styles.dividerLabel }, `Generation ${gen - minGen + 1}`)
  );
}

export function PersonPage({ person, media, memories }) {
  return h(Page, { size: "A4", style: styles.page },
    h(PersonSection, { person, media, memories })
  );
}

function VamshavaliHeaderRow() {
  return h(View, { style: styles.vHeaderRow },
    V_HEADER_LABELS.map(([width, label]) => h(Text, { key: label, style: [styles.vHeaderCell, { width }] }, label))
  );
}

// One row in a Vamshavali section — "unresolved"/"noneFound" render a
// plain dash rather than guessing, matching buildVamshavali's own refusal
// to guess anywhere the data doesn't support it. Every resolved person's
// real name is shown regardless of alive/departed status — status is its
// own column, so naming someone doesn't imply anything about their gotra
// shown alongside being right for the departed only.
function VamshavaliRow({ row }) {
  const displayName = row.unresolved || row.noneFound ? "—" : row.name;
  const status = row.unresolved ? "Unknown" : row.noneFound ? "" : row.isAlive ? "Alive" : "Departed";
  const blank = row.unresolved || row.noneFound;
  return h(View, { style: styles.vRow },
    h(View, { style: styles.vRowTerm },
      h(Text, { style: styles.vRowTermKannada }, row.kannadaTerm),
      h(Text, { style: styles.vRowTermEnglish }, row.englishTerm)
    ),
    h(Text, { style: styles.vRowName }, displayName),
    h(Text, { style: styles.vRowStatus }, status),
    h(Text, { style: styles.vRowGotra }, row.gotra || (blank ? "" : "—")),
    h(Text, { style: styles.vRowRashi }, row.rashi || (blank ? "" : "—"))
  );
}

function VamshavaliSection({ section }) {
  return h(View, { style: styles.vSection },
    h(View, { style: styles.vSectionHead },
      h(Text, { style: styles.vSectionTitleKannada }, section.title),
      h(Text, { style: styles.vSectionTitleEnglish }, section.titleEnglish)
    ),
    h(VamshavaliHeaderRow, null),
    section.rows.map((row, i) => h(VamshavaliRow, { key: i, row }))
  );
}

// `vamshavali` is this person's buildVamshavali(...) result, computed by
// the caller (so the one relationship engine in src/lib/vamshavali.js is
// also the one source of truth server-side — see the import at the top of
// this file).
export function VamshavaliPage({ vamshavali, familyName }) {
  return h(Page, { size: "A4", style: styles.page },
    h(Text, { style: styles.vTitleKannada }, "ವಂಶಾವಳಿ"),
    h(Text, { style: styles.vTitleEnglish }, `Vamshavali — ${formatName(vamshavali.ego)}${familyName ? `, ${familyName}` : ""}`),
    h(Text, { style: styles.vSubhead }, "Father's and mother's line, by relationship, gotra and rashi — the Status column shows who's still living."),
    vamshavali.sections.map((section) => h(VamshavaliSection, { key: section.key, section }))
  );
}

export { Document, Page, View, Text, Image, StyleSheet, Font, h, buildVamshavali };
