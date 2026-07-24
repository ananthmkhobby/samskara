import { supabase } from "./supabaseClient";

const BUCKET = "family-media";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year — re-resolved on every boot anyway

// Uploads to a private, family-scoped path and returns the object PATH (not
// a URL — the bucket is private, so a plain public URL wouldn't resolve).
// Path convention: {familyId}/{personId}/{uuid}.{ext} — the first segment is
// what the storage RLS policies check against family membership.
export async function uploadFamilyMedia(familyId, personId, blob, ext) {
  if (!supabase) throw new Error("Media storage isn't configured.");
  const path = `${familyId}/${personId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type });
  if (error) throw new Error(`Upload failed: ${error.message}`);
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
