// Vercel serverless function — public, unauthenticated. Captures a "I'm
// locked out" request for a human to triage via /superadmin while there's
// no real email service to automate recovery with (see the migration
// comment on password_reset_requests). Deliberately does nothing else —
// no password is reset here, no email is sent.
import { createClient } from "@supabase/supabase-js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  if (!serviceKey || !url) {
    res.status(500).json({ error: "This isn't configured on this deployment yet." });
    return;
  }

  const { email, note } = req.body || {};
  if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  if (note && note.length > 500) {
    res.status(400).json({ error: "That note is too long — keep it under 500 characters." });
    return;
  }

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { error } = await supabase.from("password_reset_requests").insert({
      email: email.trim(), note: note?.trim() || null,
    });
    if (error) throw new Error(error.message);
    // Generic response regardless of whether this email matches a real
    // account — never confirm/deny account existence to an unauthenticated
    // caller.
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't submit that request." });
  }
}
