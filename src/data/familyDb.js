import { supabase } from "../lib/supabaseClient";

function requireClient() {
  if (!supabase) throw new Error("Backend isn't configured.");
  return supabase;
}

// ---- Boot hydration -------------------------------------------------------

export async function fetchFamilyData(familyId) {
  const db = requireClient();
  const [people, marriages, contributions, experienceEntries] = await Promise.all([
    db.from("people").select("*").eq("family_id", familyId).order("sort_index", { ascending: true, nullsFirst: false }),
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

// ---- Multi-family membership -----------------------------------------------

// Every family a logged-in user belongs to, for the family switcher —
// distinct from fetchFamilyData/fetchFamilyName, which only ever look at
// the single currently-active family.
export async function fetchMyFamilies(userId) {
  const db = requireClient();
  const { data, error } = await db
    .from("family_members")
    .select("family_id, role, families(name)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({ familyId: row.family_id, role: row.role, familyName: row.families?.name || "Family" }));
}

// The server-verified source of truth for "which family is active" —
// resolves the caller's stored preference against their real memberships,
// falling back to their earliest membership. Never returns a family the
// caller isn't actually a member of.
export async function fetchActiveFamilyId() {
  const db = requireClient();
  const { data, error } = await db.rpc("current_family_id");
  if (error) throw new Error(error.message);
  return data;
}

// Switching families is a single verified database write, not a re-login —
// set_active_family() checks real membership before updating the pointer.
export async function switchFamily(familyId) {
  const db = requireClient();
  const { error } = await db.rpc("set_active_family", { p_family_id: familyId });
  if (error) throw new Error(error.message);
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
    book_id: c.bookId ?? null,
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
    bookId: row.book_id,
  };
}

// ---- People ----------------------------------------------------------------

export async function insertPerson(familyId, p, sortIndex) {
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
    sort_index: sortIndex ?? null,
    born_year_only: p.bornYearOnly ?? false,
    died_year_only: p.diedYearOnly ?? false,
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
  // sort_index = the row's position in the uploaded sheet — this path is
  // only ever used to seed a still-empty tree (FamilyBuilderView's
  // alreadyHasPeople gate), so starting the sequence at 0 is safe.
  const peopleRows = people.map((p, i) => ({
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
    sort_index: i,
    born_year_only: p.bornYearOnly ?? false,
    died_year_only: p.diedYearOnly ?? false,
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

export async function createInvite(familyId, userId, personId) {
  const db = requireClient();
  const { data, error } = await db.from("invites").insert({ family_id: familyId, created_by: userId, person_id: personId || null }).select().single();
  if (error) throw new Error(error.message);
  return data.code;
}

// Members page: every invite a moderator has generated for this family, so
// a forgotten/unused link isn't invisible the moment you navigate away.
export async function fetchInvites(familyId) {
  const db = requireClient();
  const { data, error } = await db
    .from("invites")
    .select("id, code, person_id, used_by, used_at, expires_at, created_at")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    id: r.id, code: r.code, personId: r.person_id, usedBy: r.used_by, usedAt: r.used_at,
    expiresAt: r.expires_at, createdAt: r.created_at,
  }));
}

// Only succeeds on an invite that hasn't been redeemed yet — enforced by
// RLS ("moderator can delete own unused invites"), not just this call site.
export async function revokeInvite(inviteId) {
  const db = requireClient();
  const { error } = await db.from("invites").delete().eq("id", inviteId);
  if (error) throw new Error(error.message);
}

// ---- Family Library ---------------------------------------------------------

function mapBookRow(row) {
  return {
    id: row.id, title: row.title, category: row.category, coverPath: row.cover_path, coverUrl: null,
    filePath: row.file_path, fileName: row.file_name, fileUrl: null,
    story: row.story, contributor: row.contributor, status: row.status, createdAt: row.created_at,
  };
}

function mapOwnershipRow(row) {
  return { id: row.id, bookId: row.book_id, personId: row.person_id, personName: row.person_name, action: row.action, year: row.year, sortOrder: row.sort_order, createdAt: row.created_at };
}

function mapReaderRow(row) {
  return { id: row.id, bookId: row.book_id, personId: row.person_id, status: row.status, createdAt: row.created_at };
}

export async function fetchLibraryData(familyId) {
  const db = requireClient();
  const [books, ownership, readers] = await Promise.all([
    db.from("family_books").select("*").eq("family_id", familyId),
    db.from("book_ownership").select("*").eq("family_id", familyId),
    db.from("book_readers").select("*").eq("family_id", familyId),
  ]);
  if (books.error) throw new Error(books.error.message);
  if (ownership.error) throw new Error(ownership.error.message);
  if (readers.error) throw new Error(readers.error.message);
  return {
    books: books.data.map(mapBookRow),
    ownership: ownership.data.map(mapOwnershipRow),
    readers: readers.data.map(mapReaderRow),
  };
}

// Only ever called while the acting session is a moderator (a direct add,
// or approving someone else's "newBook" proposal) — see applyContributionEffects.
export async function insertBook(familyId, b) {
  const db = requireClient();
  const row = {
    family_id: familyId, title: b.title, category: b.category, cover_path: b.coverPath ?? null,
    file_path: b.filePath ?? null, file_name: b.fileName ?? null,
    story: b.story ?? null, contributor: b.contributor ?? null, contributor_user_id: b.contributorUserId ?? null,
    status: "Verified",
  };
  const { data, error } = await db.from("family_books").insert(row).select().single();
  if (error) throw new Error(error.message);
  return mapBookRow(data);
}

export async function updateBookFields(bookId, patch) {
  const db = requireClient();
  const { error } = await db.from("family_books").update(patch).eq("id", bookId);
  if (error) throw new Error(error.message);
}

export async function insertOwnership(familyId, o) {
  const db = requireClient();
  const row = {
    family_id: familyId, book_id: o.bookId, person_id: o.personId ?? null, person_name: o.personName ?? null,
    action: o.action, year: o.year ?? null, sort_order: o.sortOrder ?? 0,
  };
  const { data, error } = await db.from("book_ownership").insert(row).select().single();
  if (error) throw new Error(error.message);
  return mapOwnershipRow(data);
}

export async function deleteOwnership(id) {
  const db = requireClient();
  const { error } = await db.from("book_ownership").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// One row per (book, person) — upsert so re-marking status (reading -> read)
// just updates the existing row instead of erroring on the unique constraint.
export async function setReaderStatus(familyId, bookId, personId, status) {
  const db = requireClient();
  const { data, error } = await db
    .from("book_readers")
    .upsert({ family_id: familyId, book_id: bookId, person_id: personId, status }, { onConflict: "book_id,person_id" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapReaderRow(data);
}

export async function redeemInvite(code, displayName) {
  const db = requireClient();
  const { data, error } = await db.rpc("redeem_invite", { p_code: code, p_display_name: displayName || null });
  if (error) throw new Error(error.message);
  return data;
}

// ---- Family roster / admin promotion ----------------------------------------

export async function fetchFamilyMembers(familyId) {
  const db = requireClient();
  const { data, error } = await db.from("family_members").select("id, user_id, role, display_name, person_id, created_at").eq("family_id", familyId);
  if (error) throw new Error(error.message);
  return data.map((r) => ({ id: r.id, userId: r.user_id, role: r.role, displayName: r.display_name, personId: r.person_id, createdAt: r.created_at }));
}

// Only ever succeeds when the acting session is the Family Head — enforced
// by RLS ("head can update own roster"), not just this call site.
export async function updateMemberRole(memberRowId, role) {
  const db = requireClient();
  const { data, error } = await db.from("family_members").update({ role }).eq("id", memberRowId).select();
  if (error) throw new Error(error.message);
  if (!data.length) throw new Error("Only the Family Head can change roles.");
  return data[0];
}

// family_members has no direct-write RLS for this column on purpose (see
// the "no direct write policy, only validated security-definer RPCs"
// posture already used by redeem_invite()/set_active_family()) — a raw RLS
// policy scoped to "your own row" would also let a member touch their own
// `role` column, which is a real privilege-escalation gap. The RPC only
// ever touches person_id, validates the target row belongs to the caller's
// own family, and lets a member set their own link or a head/admin set
// anyone's.
export async function setMemberPersonLink(memberRowId, personId) {
  const db = requireClient();
  const { error } = await db.rpc("set_member_person_link", { p_member_id: memberRowId, p_person_id: personId });
  if (error) throw new Error(error.message);
}

// Same "no raw RLS" reasoning as setMemberPersonLink above, but for the
// display_name column — a Head/Admin-only RPC that never touches role.
export async function updateMemberDisplayName(memberRowId, displayName) {
  const db = requireClient();
  const { error } = await db.rpc("update_member_display_name", { p_member_id: memberRowId, p_display_name: displayName });
  if (error) throw new Error(error.message);
}

// auth.users isn't client-readable directly — this goes through a
// Head/Admin-only RPC so someone who "forgot their password" (really: which
// email they signed up with) can be reminded, then use the self-service
// reset on the login page.
export async function fetchMemberEmail(memberRowId) {
  const db = requireClient();
  const { data, error } = await db.rpc("get_member_email", { p_member_id: memberRowId });
  if (error) throw new Error(error.message);
  return data;
}

// The caller's own membership row for the active family — used at boot to
// know which tree node (if any) is "me", so the Tree view can highlight it.
export async function fetchMyPersonLink(familyId, userId) {
  const db = requireClient();
  const { data, error } = await db.from("family_members").select("person_id").eq("family_id", familyId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.person_id ?? null;
}

// A shared, family-wide streak (not per-user) — whoever's the first to open
// the app on a given day keeps the whole family's flame lit. The row lock in
// the function body means simultaneous callers can't double-increment.
export async function bumpFamilyFlame(familyId) {
  const db = requireClient();
  const { data, error } = await db.rpc("bump_family_flame", { p_family_id: familyId });
  if (error) throw new Error(error.message);
  return data?.[0]?.streak ?? 0;
}
