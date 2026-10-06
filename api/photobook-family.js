// Vercel serverless function — generates the whole family tree as one PDF
// photobook: a cover, a generation-grouped table of contents, and one
// section per person who actually has content, in generation order.
import { serviceClient, requireMember } from "./_memberAuth.js";
import { Document, FamilyCoverPage, TableOfContentsPage, GenerationDividerPage, PersonSection, Page, h, StyleSheet } from "./_photobook.js";
import { renderToBuffer } from "@react-pdf/renderer";

const MAX_PHOTOS_PER_PERSON = 6;
const MAX_MEMORIES_PER_PERSON = 4;
const MAX_FAMILY_BOOK_PEOPLE = 80; // size guard — see plan: a deliberate, legible failure instead of a silent timeout
const BUCKET = "family-media";
const SIGNED_URL_TTL_SECONDS = 300;

const pageStyle = StyleSheet.create({ page: { padding: 48, fontFamily: "Times-Roman" } }).page;

function personHasContent(contributionsByPerson, person) {
  return !!(person.summary || person.lifeLesson || (contributionsByPerson.get(person.id) || []).length);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { familyId } = req.body || {};
  if (!familyId) {
    res.status(400).json({ error: "Missing familyId." });
    return;
  }

  let supabase;
  try {
    supabase = serviceClient();
    await requireMember(supabase, req, familyId);
  } catch (err) {
    res.status(403).json({ error: err.message });
    return;
  }

  try {
    const { data: familyRow, error: familyErr } = await supabase
      .from("families").select("name, tagline, logo_path").eq("id", familyId).maybeSingle();
    if (familyErr) throw new Error(familyErr.message);
    if (!familyRow) throw new Error("That family couldn't be found.");

    const { data: peopleRows, error: peopleErr } = await supabase
      .from("people").select("*").eq("family_id", familyId);
    if (peopleErr) throw new Error(peopleErr.message);
    if (!peopleRows?.length) throw new Error("This family tree has no one in it yet.");

    const { data: contribRows, error: contribErr } = await supabase
      .from("contributions").select("id, person_id, type, content, contributor, status, date")
      .eq("family_id", familyId).eq("status", "Verified");
    if (contribErr) throw new Error(contribErr.message);

    const contributionsByPerson = new Map();
    for (const c of contribRows || []) {
      if (!c.person_id) continue;
      if (!contributionsByPerson.has(c.person_id)) contributionsByPerson.set(c.person_id, []);
      contributionsByPerson.get(c.person_id).push(c);
    }

    const people = peopleRows.map((row) => ({
      id: row.id, name: row.name, gen: row.gen, born: row.born, died: row.died,
      diedUnknown: row.died_unknown, rashi: row.rashi, gotra: row.gotra,
      summary: row.summary, places: row.places, lifeLesson: row.life_lesson,
      dayInLife: row.day_in_life, chapters: row.chapters || [], photoPath: row.photo_path,
    }));

    const included = people.filter((p) => personHasContent(contributionsByPerson, p));
    if (!included.length) throw new Error("No one in this family tree has any content yet — add a few photos or stories first.");
    if (included.length > MAX_FAMILY_BOOK_PEOPLE) {
      throw new Error(`This family tree is too large for a single-file export right now (${included.length} people, limit ${MAX_FAMILY_BOOK_PEOPLE}) — contact support.`);
    }

    const minGen = Math.min(...included.map((p) => p.gen));
    const maxGen = Math.max(...included.map((p) => p.gen));

    const byGen = new Map();
    for (const p of included) {
      if (!byGen.has(p.gen)) byGen.set(p.gen, []);
      byGen.get(p.gen).push(p);
    }
    const gens = [...byGen.keys()].sort((a, b) => a - b);
    for (const gen of gens) byGen.get(gen).sort((a, b) => a.name.localeCompare(b.name));

    let logoUrl = null;
    if (familyRow.logo_path) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(familyRow.logo_path, SIGNED_URL_TTL_SECONDS);
      logoUrl = signed?.signedUrl || null;
    }

    // Resolve each included person's capped photo/memory lists, in
    // parallel — bounded by the per-person caps, so total signed-URL calls
    // scale with real content, not raw family size.
    const personContent = new Map();
    await Promise.all(included.map(async (p) => {
      const rows = contributionsByPerson.get(p.id) || [];
      const photoRows = rows.filter((c) => c.type === "photo" && c.content)
        .sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, MAX_PHOTOS_PER_PERSON);
      const media = (await Promise.all(photoRows.map(async (c) => {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(c.content, SIGNED_URL_TTL_SECONDS);
        return signed?.signedUrl ? { id: c.id, mediaUrl: signed.signedUrl, date: c.date, contributor: c.contributor } : null;
      }))).filter(Boolean);
      const memories = rows.filter((c) => c.type === "memory" && c.content)
        .sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, MAX_MEMORIES_PER_PERSON)
        .map((c) => ({ id: c.id, content: c.content, contributor: c.contributor }));
      if (p.photoPath) {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(p.photoPath, SIGNED_URL_TTL_SECONDS);
        p.photoUrl = signed?.signedUrl || null;
      }
      personContent.set(p.id, { media, memories });
    }));

    const generationsForToc = gens.map((gen) => ({ gen, people: byGen.get(gen) }));

    const pages = [
      h(FamilyCoverPage, { familyName: familyRow.name, tagline: familyRow.tagline, logoUrl, personCount: included.length, genCount: gens.length }),
      h(TableOfContentsPage, { generations: generationsForToc, minGen, maxGen }),
    ];
    for (const gen of gens) {
      pages.push(h(GenerationDividerPage, { gen, minGen, maxGen }));
      for (const p of byGen.get(gen)) {
        const { media, memories } = personContent.get(p.id);
        pages.push(h(Page, { size: "A4", style: pageStyle }, h(PersonSection, { person: p, media, memories })));
      }
    }

    const buffer = await renderToBuffer(h(Document, null, ...pages));

    const slug = (familyRow.name || "family").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${slug}-photobook.pdf"`);
    res.status(200).send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't generate the family photobook right now." });
  }
}
