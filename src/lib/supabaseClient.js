import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Null when env vars are absent (e.g. a fork running without a configured
// backend yet) so callers can fall back to seed/local-only behavior instead
// of throwing at import time.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
