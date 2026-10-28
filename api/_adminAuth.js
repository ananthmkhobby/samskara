// Shared helper for every superadmin-secret-gated endpoint (provision-
// family.js, manage-plan.js, broadcast.js) — extracted when those split
// out of one file into three (2026-10-28), so the adminSecret check
// itself has exactly one definition instead of three copies.
import { createClient } from "@supabase/supabase-js";

// Returns { secret, supabase } on success, or null after already writing
// a 500 response — callers just `if (!ctx) return;` same as before.
export function serviceClientOrNull(res) {
  const secret = process.env.ADMIN_PROVISION_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  if (!secret || !serviceKey || !url) {
    res.status(500).json({ error: "Not configured on this deployment yet — missing ADMIN_PROVISION_SECRET or SUPABASE_SERVICE_ROLE_KEY." });
    return null;
  }
  return { secret, supabase: createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

// Full gate: config check + secret match, in one call. Returns the
// service-role supabase client on success, or null after already writing
// the right error response (500 for missing config, 401 for a wrong
// secret) — callers just `if (!supabase) return;`.
export function requireAdminSecret(req, res) {
  const ctx = serviceClientOrNull(res);
  if (!ctx) return null;
  if ((req.body || {}).adminSecret !== ctx.secret) {
    res.status(401).json({ error: "Incorrect admin secret." });
    return null;
  }
  return ctx.supabase;
}
