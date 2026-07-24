import { supabase } from "../lib/supabaseClient";

function requireClient() {
  if (!supabase) throw new Error("Backend isn't configured.");
  return supabase;
}

// ---- Boot hydration -------------------------------------------------------

export async function fetchFamilyData(familyId) {
  const db = requireClient();
  const [people, marriages, contributions, experienceEntries] = await Promise.all([
    db.from("people").select("*").eq("family_id", familyId),
    db.from("marriages").select("*").eq("family_id", familyId),
    db.from("contributions").select("*").eq("family_id", familyId),
    db.from("experience_entries").select("*").eq("family_id", familyId),
  ]);
  if (people.error) throw new Error(people.error.message);
  if (marriages.error) throw new Error(marriages.error.message);
  if (contributions.error) throw new Error(contributions.error.message);
  if (experienceEntries.error) throw new Error(experienceEntries.error.message);
  return { people: people.data, marriages: marriages.data, contributions: contributions.data, experienceEntries: experienceEntries.data };
}

export async function fetchFamilyName(familyId) {
  const db = requireClient();
  const { data, error } = await db.from("families").select("name").eq("id", familyId).maybeSingle();
  if (error || !data) return null;
  return data.name;
}

// ---- Contributions ---------------------------------------------------------

export async function insertContribution(familyId, c) {
  const db = requireClient();
  const row = {
    family_id: familyId,
    person_id: c.personId ?? null,
    new_person_name: c.newPersonName ?? null,
    type: c.type,
    field: c.field ?? null,
    field_label: c.fieldLabel ?? null,
    content: c.content ?? null,
    contributor: c.contributor ?? null,
    status: c.status,
    date: c.date,
    exp_category: c.expCategory ?? null,
    anchor_person_id: c.anchorPersonId ?? null,
    relation: c.relation ?? null,
    name: c.name ?? null,
    birth_year: c.birthYear ?? null,
    geo: c.geo ?? null,
    title: c.title ?? null,
    body_text: c.text ?? null,
  };
  const { data, error } = await db.from("contributions").insert(row).select().single();
  if (error) throw new Error(error.message);
  return mapContributionRow(data);
}

export async function updateContributionStatus(id, status) {
  const db = requireClient();
  const { error } = await db.from("contributions").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export function mapContributionRow(row) {
  return {
    id: row.id,
    personId: row.person_id,
    newPersonName: row.new_person_name,
    type: row.type,
    field: row.field,
    fieldLabel: row.field_label,
    content: row.content,
    contributor: row.contributor,
    status: row.status,
    date: row.date,
    expCategory: row.exp_category,
    anchorPersonId: row.anchor_person_id,
    relation: row.relation,
    name: row.name,
    birthYear: row.birth_year,
    geo: row.geo,
    title: row.title,
    text: row.body_text,
  };
}

// ---- People ----------------------------------------------------------------

export async function insertPerson(familyId, p) {
  const db = requireClient();
  const row = {
    family_id: familyId,
    id: p.id,
    name: p.name,
    gen: p.gen,
    born: p.born ?? null,
    died: p.died ?? null,
    spouse: p.spouse ?? null,
    parents: p.parents ?? [],
    rashi: p.rashi ?? null,
    gotra: p.gotra ?? null,
    trust: p.trust ?? "approx",
    geo: p.geo ?? null,
    geo_origin: p.geoOrigin ?? null,
  };
  const { error } = await db.from("people").insert(row);
  if (error) throw new Error(error.message);
}

export async function updatePersonSpouse(familyId, personId, spouseId) {
  const db = requireClient();
  const { error } = await db.from("people").update({ spouse: spouseId }).eq("family_id", familyId).eq("id", personId);
  if (error) throw new Error(error.message);
}

// Generic partial update — callers pass exact column names (summary, geo,
// places, rashi, gotra, photo_path, ...) since most fields are simple
// wholesale replacements, not merges.
export async function updatePersonFields(familyId, personId, patch) {
  const db = requireClient();
  const { error } = await db.from("people").update(patch).eq("family_id", familyId).eq("id", personId);
  if (error) throw new Error(error.message);
}

// life_lesson is a partial merge (a submitted edit may carry just a new
// quote, leaving values untouched, or vice versa) — small, single-row
// read-modify-write, same trade-off the whole-blob model always had, just
// now scoped to one person instead of the entire family.
export async function mergeLifeLesson(familyId, personId, partial) {
  const db = requireClient();
  const { data: cur } = await db.from("people").select("life_lesson").eq("family_id", familyId).eq("id", personId).maybeSingle();
  const merged = { ...(cur?.life_lesson || {}), ...partial };
  const { error } = await db.from("people").update({ life_lesson: merged }).eq("family_id", familyId).eq("id", personId);
  if (error) throw new Error(error.message);
}

export async function appendChapter(familyId, personId, chapter) {
  const db = requireClient();
  const { data: cur } = await db.from("people").select("chapters").eq("family_id", familyId).eq("id", personId).maybeSingle();
  const chapters = [...(cur?.chapters || []), chapter];
  const { error } = await db.from("people").update({ chapters }).eq("family_id", familyId).eq("id", personId);
  if (error) throw new Error(error.message);
}

export async function setChapterAt(familyId, personId, idx, text) {
  const db = requireClient();
  const { data: cur } = await db.from("people").select("chapters").eq("family_id", familyId).eq("id", personId).maybeSingle();
  const chapters = [...(cur?.chapters || [])];
  if (chapters[idx] !== undefined) chapters[idx] = { ...chapters[idx], text };
  const { error } = await db.from("people").update({ chapters }).eq("family_id", familyId).eq("id", personId);
  if (error) throw new Error(error.message);
}

// "Reset" a chapter now means clearing it so the synthesized fallback (built
// from summary/life lesson/places) kicks back in — there's no longer a
// separate seed-vs-override layer to revert to.
export async function clearChapterAt(familyId, personId, idx) {
  const db = requireClient();
  const { data: cur } = await db.from("people").select("chapters").eq("family_id", familyId).eq("id", personId).maybeSingle();
  const chapters = (cur?.chapters || []).filter((_, i) => i !== idx);
  const { error } = await db.from("people").update({ chapters }).eq("family_id", familyId).eq("id", personId);
  if (error) throw new Error(error.message);
}

// ---- Marriages ---------------------------------------------------------

export async function insertMarriage(familyId, m) {
  const db = requireClient();
  const { error } = await db.from("marriages").insert({ family_id: familyId, a: m.a, b: m.b, date: m.date ?? null });
  if (error) throw new Error(error.message);
}

// ---- Experience entries ---------------------------------------------------

export async function insertExperienceEntry(familyId, entry) {
  const db = requireClient();
  const row = {
    family_id: familyId,
    person_id: entry.personId,
    type: entry.type,
    caption: entry.caption ?? null,
    media_path: entry.mediaPath ?? null,
    source_contribution_id: entry.sourceContributionId ?? null,
  };
  const { data, error } = await db.from("experience_entries").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateExperienceCaption(entryId, caption) {
  const db = requireClient();
  const { error } = await db.from("experience_entries").update({ caption }).eq("id", entryId);
  if (error) throw new Error(error.message);
}

export async function deleteExperienceEntry(entryId) {
  const db = requireClient();
  const { error } = await db.from("experience_entries").delete().eq("id", entryId);
  if (error) throw new Error(error.message);
}

// ---- Bulk family population (repurposed Family Builder wizard) -----------

// Inserts (never replaces) a whole tree built via the wizard or the Excel
// template import into an already-provisioned, currently-empty family. One
// multi-row insert for all people at once (not one insert per person) —
// required so the deferred spouse foreign key can see mutually-referencing
// spouses before the transaction commits.
export async function bulkInsertFamily(familyId, people, marriages) {
  const db = requireClient();
  const peopleRows = people.map((p) => ({
    family_id: familyId,
    id: p.id,
    name: p.name,
    gen: p.gen,
    born: p.born ?? null,
    died: p.died ?? null,
    spouse: p.spouse ?? null,
    parents: p.parents ?? [],
    rashi: p.rashi ?? null,
    gotra: p.gotra ?? null,
    trust: p.trust ?? "approx",
    geo: p.geo ?? null,
    summary: p.summary ?? null,
    places: p.places ?? null,
    life_lesson: p.lifeLesson ?? null,
  }));
  const { error: peopleError } = await db.from("people").insert(peopleRows);
  if (peopleError) throw new Error(peopleError.message);

  if (marriages?.length) {
    const marriageRows = marriages.map((m) => ({ family_id: familyId, a: m.a, b: m.b, date: m.date ?? null }));
    const { error: marriageError } = await db.from("marriages").insert(marriageRows);
    if (marriageError) throw new Error(marriageError.message);
  }
}

// ---- Invites ---------------------------------------------------------------

export async function createInvite(familyId, userId) {
  const db = requireClient();
  const { data, error } = await db.from("invites").insert({ family_id: familyId, created_by: userId }).select().single();
  if (error) throw new Error(error.message);
  return data.code;
}

export async function redeemInvite(code) {
  const db = requireClient();
  const { data, error } = await db.rpc("redeem_invite", { p_code: code });
  if (error) throw new Error(error.message);
  return data;
}
