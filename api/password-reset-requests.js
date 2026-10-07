// Vercel serverless function — the admin-facing half of the interim
// password-reset-request stopgap (see request-password-reset.js and the
// password_reset_requests migration). Same shared-secret trust model as
// provision-family.js. POST-only (matches callApi's shape, src/lib/
// apiFetch.js, which never sends GET): action:"list" returns open requests,
// action:"resolve" marks one resolved. Actually changing anyone's password
// still happens manually (a service-role script, same call
// api/reset-member-password.js already uses) — this endpoint only tracks
// the request, it never resets a password itself.
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = process.env.ADMIN_PROVISION_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  if (!secret || !serviceKey || !url) {
    res.status(500).json({ error: "This isn't configured on this deployment yet." });
    return;
  }

  const { adminSecret, action, id } = req.body || {};
  if (adminSecret !== secret) {
    res.status(401).json({ error: "Incorrect admin secret." });
    return;
  }

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  if (action === "resolve") {
    if (!id) {
      res.status(400).json({ error: "Nothing to do." });
      return;
    }
    try {
      const { error } = await supabase
        .from("password_reset_requests").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Couldn't update that request." });
    }
    return;
  }

  try {
    const { data, error } = await supabase
      .from("password_reset_requests").select("id, email, note, status, created_at, resolved_at")
      .eq("status", "open").order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    res.status(200).json({ requests: data });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't load requests." });
  }
}
