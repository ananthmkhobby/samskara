// Vercel serverless function — lets a Head/Admin create a username+password
// login for someone with no email (most elders, per the request this came
// from), instead of the invite-link flow which requires one. Server-side
// only: holds the service-role key needed for auth.admin.createUser.
import { serviceClient, requireModerator, usernameToEmail } from "./_memberAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { familyId, username, password, displayName, personId } = req.body || {};
  if (!familyId || !username?.trim() || !password) {
    res.status(400).json({ error: "Family, username, and password are required." });
    return;
  }
  if (!/^[a-z0-9._-]{3,32}$/i.test(username.trim())) {
    res.status(400).json({ error: "Username can only use letters, numbers, dots, underscores, or hyphens (3-32 characters)." });
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

  const email = usernameToEmail(username);
  try {
    if (personId) {
      const { data: person, error: personErr } = await supabase
        .from("people").select("id").eq("family_id", familyId).eq("id", personId).maybeSingle();
      if (personErr) throw new Error(personErr.message);
      if (!person) throw new Error("That person isn't in this family.");
    }

    const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (userErr) {
      throw new Error(userErr.message.includes("already been registered")
        ? `The username "${username.trim()}" is already taken — try another.`
        : userErr.message);
    }

    const { error: memberErr } = await supabase.from("family_members").insert({
      family_id: familyId, user_id: userData.user.id, role: "member",
      display_name: displayName?.trim() || null, person_id: personId || null,
    });
    if (memberErr) {
      await supabase.auth.admin.deleteUser(userData.user.id);
      throw new Error(memberErr.message);
    }

    await supabase.from("user_preferences").upsert({ user_id: userData.user.id, active_family_id: familyId });

    res.status(200).json({ username: username.trim(), password });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't create that login." });
  }
}
