// Vercel serverless function — the actual account-creation logic behind
// /superadmin. Runs server-side only: holds the Supabase service-role key,
// which must never reach the browser bundle (it bypasses all RLS).
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

function generatePassword() {
  return crypto.randomBytes(9).toString("base64").replace(/[/+=]/g, "").slice(0, 12);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = process.env.ADMIN_PROVISION_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  if (!secret || !serviceKey || !url) {
    res.status(500).json({ error: "Provisioning isn't configured on this deployment yet — missing ADMIN_PROVISION_SECRET or SUPABASE_SERVICE_ROLE_KEY." });
    return;
  }

  const { adminSecret, familyName, headEmail, headName } = req.body || {};
  if (adminSecret !== secret) {
    res.status(401).json({ error: "Incorrect admin secret." });
    return;
  }
  if (!familyName?.trim() || !headEmail?.trim()) {
    res.status(400).json({ error: "Family name and head email are required." });
    return;
  }

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const password = generatePassword();

  try {
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: headEmail.trim(),
      password,
      email_confirm: true, // no email-sending is configured — skip confirmation entirely
    });
    if (userError) throw new Error(`Creating account failed: ${userError.message}`);

    const { data: family, error: familyError } = await supabase
      .from("families")
      .insert({ name: familyName.trim() })
      .select()
      .single();
    if (familyError) throw new Error(`Creating family failed: ${familyError.message}`);

    const { error: memberError } = await supabase
      .from("family_members")
      .insert({ family_id: family.id, user_id: userData.user.id, role: "head", display_name: headName?.trim() || null });
    if (memberError) throw new Error(`Linking head to family failed: ${memberError.message}`);

    res.status(200).json({ familyId: family.id, familyName: familyName.trim(), headEmail: headEmail.trim(), password });
  } catch (err) {
    res.status(500).json({ error: err.message || "Provisioning failed." });
  }
}
