// Vercel serverless function — the actual account-creation logic behind
// /superadmin. Runs server-side only: holds the Supabase service-role key,
// which must never reach the browser bundle (it bypasses all RLS).
//
// Used to also hold "manage a family's subscription plan" and the
// superadmin push broadcast — both unrelated features folded in here
// purely to stay under Vercel's Hobby-plan 12-function cap. Split out to
// api/manage-plan.js and api/broadcast.js (2026-10-28) once the project
// moved to Pro.
import crypto from "node:crypto";
import { requireAdminSecret } from "./_adminAuth.js";

function generatePassword() {
  return crypto.randomBytes(9).toString("base64").replace(/[/+=]/g, "").slice(0, 12);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabase = requireAdminSecret(req, res);
  if (!supabase) return;

  const { familyName, headEmail, headName, moduleFlags } = req.body || {};
  if (!familyName?.trim() || !headEmail?.trim()) {
    res.status(400).json({ error: "Family name and head email are required." });
    return;
  }

  const password = generatePassword();

  try {
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: headEmail.trim(),
      password,
      email_confirm: true, // no email-sending is configured — skip confirmation entirely
    });
    if (userError) throw new Error(`Creating account failed: ${userError.message}`);

    // moduleFlags is only ever a set of explicit `false`s (disabled) —
    // omitting a key, or the whole object, means that module stays
    // enabled. See src/data/session.js's isModuleEnabled(). plan_tier
    // isn't set here — it defaults to 'starter' via the column default,
    // same as any self-registered family.
    const { data: family, error: familyError } = await supabase
      .from("families")
      .insert({ name: familyName.trim(), module_flags: moduleFlags || {} })
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
