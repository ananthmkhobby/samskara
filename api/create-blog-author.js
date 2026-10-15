// Vercel serverless function — superadmin-only. Creates a username+password
// login for a Samskara team blog author, same synthetic-email pattern as
// api/create-member-login.js, but inserts into blog_authors instead of
// family_members — a blog author isn't scoped to any family, so there's no
// Head/Admin to delegate this to, only the superadmin secret (same gate as
// api/provision-family.js).
import { createClient } from "@supabase/supabase-js";

// Must match usernameToEmail() in src/components/AuthPanel.jsx and
// api/_memberAuth.js exactly — the login page's existing "No email? Log in
// with username" toggle only ever appends this one domain, so a blog
// author's account has to use it too, not a separate domain, or that
// login screen simply couldn't find them. (Means a username has to be
// unique across family no-email logins AND blog authors together — both
// share the same auth.users email index either way.)
function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@members.samskara.app`;
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
    res.status(500).json({ error: "Not configured on this deployment — missing ADMIN_PROVISION_SECRET or SUPABASE_SERVICE_ROLE_KEY." });
    return;
  }

  const { adminSecret, username, password, displayName } = req.body || {};
  if (adminSecret !== secret) {
    res.status(401).json({ error: "Incorrect admin secret." });
    return;
  }
  if (!username?.trim() || !password || !displayName?.trim()) {
    res.status(400).json({ error: "Username, password, and display name are required." });
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

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = usernameToEmail(username);

  try {
    const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (userErr) {
      throw new Error(userErr.message.includes("already been registered")
        ? `The username "${username.trim()}" is already taken — try another.`
        : userErr.message);
    }

    const { error: authorErr } = await supabase.from("blog_authors").insert({
      user_id: userData.user.id, display_name: displayName.trim(),
    });
    if (authorErr) {
      await supabase.auth.admin.deleteUser(userData.user.id);
      throw new Error(authorErr.message);
    }

    res.status(200).json({ username: username.trim(), password });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't create that login." });
  }
}
