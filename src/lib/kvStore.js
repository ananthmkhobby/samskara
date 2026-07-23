import { supabase } from "./supabaseClient";

// Whole-blob key/value persistence against the `app_state` table — this is
// a deliberately thin swap-in for what used to be localStorage.getItem/
// setItem, so the rest of the app (contributions/overrides/additions/
// customFamily, all already JSON-blob shaped) needed no redesign to become
// shared across devices instead of trapped in one browser.
//
// Trade-off worth knowing: writes overwrite the whole blob (last-write-wins),
// not per-field merges. Fine for a family-scale, low-concurrency app; would
// need real per-row tables if two people start editing the same blob at the
// same moment regularly.
export async function fetchKV(key, fallback) {
  if (!supabase) return fallback;
  const { data, error } = await supabase.from("app_state").select("value").eq("key", key).maybeSingle();
  if (error || !data) return fallback;
  return data.value;
}

export async function saveKV(key, value) {
  if (!supabase) return;
  const { error } = await supabase.from("app_state").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) console.error(`Failed to save "${key}" to Supabase:`, error.message);
}

export async function deleteKV(key) {
  if (!supabase) return;
  const { error } = await supabase.from("app_state").delete().eq("key", key);
  if (error) console.error(`Failed to delete "${key}" from Supabase:`, error.message);
}
