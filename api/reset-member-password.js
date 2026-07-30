// Vercel serverless function — lets a Head/Admin directly set a new
// password for any member of their own family, regardless of whether that
// member signed up with a real email or a no-email username login. Covers
// "forgot password" for anyone who can't do the self-service email reset
// (no inbox to receive it) — the Head/Admin sets it and tells them directly.
import { serviceClient, requireModerator } from "./_memberAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { familyId, memberId, password } = req.body || {};
  if (!familyId || !memberId || !password) {
    res.status(400).json({ error: "Family, member, and new password are required." });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters." });
    return;
  }

  let supabase;
  try {
    supabase = serviceClient();
    await requireModerator(supabase, req, familyId);
  } catch (err) {
    res.status(403).json({ error: err.message });
    return;
  }

  try {
    const { data: member, error: memberErr } = await supabase
      .from("family_members").select("user_id, family_id").eq("id", memberId).maybeSingle();
    if (memberErr) throw new Error(memberErr.message);
    if (!member || member.family_id !== familyId) throw new Error("That member isn't in your family.");

    const { error: updateErr } = await supabase.auth.admin.updateUserById(member.user_id, { password });
    if (updateErr) throw new Error(updateErr.message);

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't reset that password." });
  }
}
