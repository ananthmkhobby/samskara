// Vercel serverless function — the whole interim password-reset-request
// stopgap in one endpoint (merged from two separate files to stay under
// Vercel's Hobby-plan 12-function limit): action:"submit" is public/
// unauthenticated (filed from the login page's "No admin to ask?" link),
// action:"list"/"resolve" require a signed-in superadmin (see
// api/_superadminAuth.js). Actually changing anyone's password still
// happens manually (a service-role script, same call
// api/reset-member-password.js already uses) — this endpoint only tracks
// the request, it never resets a password itself.
import { createClient } from "@supabase/supabase-js";
import { requireSuperadmin } from "./_superadminAuth.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { action, email, note, id } = req.body || {};

  if (action === "submit") {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.VITE_SUPABASE_URL;
    if (!serviceKey || !url) {
      res.status(500).json({ error: "This isn't configured on this deployment yet." });
      return;
    }
    const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
      res.status(400).json({ error: "Enter a valid email address." });
      return;
    }
    if (note && note.length > 500) {
      res.status(400).json({ error: "That note is too long — keep it under 500 characters." });
      return;
    }
    try {
      const { error } = await supabase.from("password_reset_requests").insert({ email: email.trim(), note: note?.trim() || null });
      if (error) throw new Error(error.message);
      // Generic response regardless of whether this email matches a real
      // account — never confirm/deny account existence to an unauthenticated
      // caller.
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Couldn't submit that request." });
    }
    return;
  }

  // Everything below (list, resolve) requires a signed-in superadmin.
  const supabase = await requireSuperadmin(req, res);
  if (!supabase) return;

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
