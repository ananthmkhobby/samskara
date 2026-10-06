// Vercel serverless function — generates a single person's Folio as a real
// PDF booklet. Replaces the old fake "Download PDF" button (window.print(),
// no real PDF) in src/components/FolioModal.jsx.
import { serviceClient, requireMember } from "./_memberAuth.js";
import { Document, PersonPage, h } from "./_photobook.js";
import { renderToBuffer } from "@react-pdf/renderer";

const MAX_PHOTOS = 12;
const MAX_MEMORIES = 4;
const BUCKET = "family-media";
const SIGNED_URL_TTL_SECONDS = 300; // fetched once by react-pdf's own image loader during render

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { familyId, personId } = req.body || {};
  if (!familyId || !personId) {
    res.status(400).json({ error: "Missing familyId or personId." });
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
    const { data: row, error: personErr } = await supabase
      .from("people").select("*").eq("family_id", familyId).eq("id", personId).maybeSingle();
    if (personErr) throw new Error(personErr.message);
    if (!row) throw new Error("That person couldn't be found.");

    const person = {
      id: row.id, name: row.name, gen: row.gen, born: row.born, died: row.died,
      diedUnknown: row.died_unknown, rashi: row.rashi, gotra: row.gotra,
      summary: row.summary, places: row.places, lifeLesson: row.life_lesson,
      dayInLife: row.day_in_life, chapters: row.chapters || [], photoPath: row.photo_path,
    };

    if (person.photoPath) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(person.photoPath, SIGNED_URL_TTL_SECONDS);
      person.photoUrl = signed?.signedUrl || null;
    }

    const { data: contribRows, error: contribErr } = await supabase
      .from("contributions").select("id, type, content, contributor, status, date")
      .eq("family_id", familyId).eq("person_id", personId).eq("status", "Verified");
    if (contribErr) throw new Error(contribErr.message);

    const photoRows = (contribRows || [])
      .filter((c) => c.type === "photo" && c.content)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, MAX_PHOTOS);

    const media = (await Promise.all(photoRows.map(async (c) => {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(c.content, SIGNED_URL_TTL_SECONDS);
      return signed?.signedUrl ? { id: c.id, mediaUrl: signed.signedUrl, date: c.date, contributor: c.contributor } : null;
    }))).filter(Boolean);

    const memories = (contribRows || [])
      .filter((c) => c.type === "memory" && c.content)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, MAX_MEMORIES)
      .map((c) => ({ id: c.id, content: c.content, contributor: c.contributor }));

    const buffer = await renderToBuffer(
      h(Document, null, h(PersonPage, { person, media, memories }))
    );

    const slug = (person.name || "folio").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${slug}-folio.pdf"`);
    res.status(200).send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't generate that PDF right now." });
  }
}
