import { supabase } from "./supabaseClient";
import { getEffectiveLimits } from "./planTiers";

const BUCKET = "family-media";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year — re-resolved on every boot anyway

function classifyMime(mime) {
  if (mime?.startsWith("image/")) return "photos";
  if (mime?.startsWith("audio/")) return "recordings";
  if (mime?.startsWith("video/")) return "videos";
  return null;
}

// enforce_media_limit (supabase/migrations/20261017120000_plan_enforcement.sql)
// blocks an over-limit upload with a clear RAISE EXCEPTION message, but the
// Storage API — unlike PostgREST for a plain table insert — wraps any
// trigger error into a generic "database error, code: 23514", discarding
// the actual text. Re-derive the same message client-side from the one
// place the numbers actually live (planTiers.js), rather than leave
// whoever hit the cap looking at "database error."
async function friendlyLimitMessage(familyId, mimeType) {
  const kind = classifyMime(mimeType);
  if (!kind) return null;
  const { data: family } = await supabase.from("families").select("plan_tier, plan_limit_overrides").eq("id", familyId).maybeSingle();
  if (!family) return null;
  const limit = getEffectiveLimits(family)[kind];
  if (limit === null || limit === undefined) return null; // unlimited — a 23514 here means something else blocked it
  return `This family's plan allows up to ${limit} ${kind}. Ask a Head/Admin to request an upgrade from the Plans page.`;
}

async function uploadToFamilyMedia(familyId, path, blob) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type });
  if (error) {
    if (/23514/.test(error.message || "")) {
      const friendly = await friendlyLimitMessage(familyId, blob.type);
      if (friendly) throw new Error(friendly);
    }
    throw new Error(`Upload failed: ${error.message}`);
  }
}

// Uploads to a private, family-scoped path and returns the object PATH (not
// a URL — the bucket is private, so a plain public URL wouldn't resolve).
// Path convention: {familyId}/{personId}/{uuid}.{ext} — the first segment is
// what the storage RLS policies check against family membership.
export async function uploadFamilyMedia(familyId, personId, blob, ext) {
  if (!supabase) throw new Error("Media storage isn't configured.");
  const path = `${familyId}/${personId}/${crypto.randomUUID()}.${ext}`;
  await uploadToFamilyMedia(familyId, path, blob);
  return path;
}

// Same idea as uploadFamilyMedia, but under a reserved path shape the
// Storage RLS policy specifically recognizes: {familyId}/__private__/{userId}/
// {uuid}.{ext}. "__private__" can never collide with a real person id —
// makeUniquePersonId's slugify only ever produces [a-z0-9-], never
// underscores — and the third segment being the uploader's own id is what
// the policy checks to keep this readable by nobody else, at the Storage
// level, not just the app's own display logic.
export async function uploadPrivateFamilyMedia(familyId, userId, blob, ext) {
  if (!supabase) throw new Error("Media storage isn't configured.");
  const path = `${familyId}/__private__/${userId}/${crypto.randomUUID()}.${ext}`;
  await uploadToFamilyMedia(familyId, path, blob);
  return path;
}

export async function resolveMediaUrl(path) {
  if (!supabase || !path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}

// Resolves many paths in one round trip (Supabase Storage's batch signed-url
// endpoint) — used during boot hydration so every photo/experience-media
// path becomes a directly-renderable URL before the app ever renders.
export async function batchResolveMediaUrls(paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!supabase || !unique.length) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error) return {};
  const map = {};
  for (const row of data) {
    if (row.signedUrl) map[row.path] = row.signedUrl;
  }
  return map;
}

// { photos, recordings, videos } current counts for a family — powers a
// proactive "47/100 photos used" indicator ahead of an upload attempt,
// via the family_media_usage() RPC (supabase/migrations/
// 20261017180000_family_media_usage.sql), since storage.objects isn't
// queryable from the client the way a public-schema table is. Returns
// null on any failure — callers should treat that as "don't know yet,"
// not "zero used."
export async function fetchMediaUsage(familyId) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("family_media_usage", { p_family_id: familyId });
  if (error) return null;
  return data;
}
