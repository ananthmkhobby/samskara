// Replaces _adminAuth.js's requireAdminSecret() for every human-operator
// superadmin endpoint — see supabase/migrations/20261029180000_superadmins.sql
// for why. Authorization is now "you are signed in AND your account is in
// the superadmins table," proven by the caller's own bearer token, same
// posture as every other member-facing endpoint (api/push.js, api/account.js)
// rather than a shared string.
import { createClient } from "@supabase/supabase-js";

function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Not configured on this deployment — missing SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Returns the service-role supabase client on success, or null after
// already writing the right error response (500 for missing config, 401
// for not signed in, 403 for signed in but not a superadmin) — callers
// just `const supabase = await requireSuperadmin(req, res); if (!supabase) return;`,
// same shape requireAdminSecret used to have.
export async function requireSuperadmin(req, res) {
  let supabase;
  try {
    supabase = serviceClient();
  } catch (err) {
    res.status(500).json({ error: err.message });
    return null;
  }

  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) {
    res.status(401).json({ error: "Not signed in." });
    return null;
  }
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    res.status(401).json({ error: "Your session has expired — please reload and sign in again." });
    return null;
  }

  const { data: row, error: rowErr } = await supabase
    .from("superadmins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (rowErr) {
    res.status(500).json({ error: rowErr.message });
    return null;
  }
  if (!row) {
    res.status(403).json({ error: "Your account isn't a superadmin." });
    return null;
  }

  return supabase;
}
