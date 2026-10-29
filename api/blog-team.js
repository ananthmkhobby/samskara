// Vercel serverless function — the Samskara blog team: either create a
// username+password login and add it to blog_authors in one step
// (action: "create"), or add an EXISTING account, found by email
// (action: "grant", no new login needed). Split out of
// api/create-member-login.js (2026-10-28), where it lived as `kind:
// "blog"` purely to stay under Vercel's Hobby-plan 12-function cap — a
// blog author was never actually a kind of family-member login (it isn't
// scoped to a family at all), just two unrelated features sharing one
// account-creation code path.
import { usernameToEmail } from "./_memberAuth.js";
import { requireSuperadmin } from "./_superadminAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { mode } = req.body || {};
  if (mode === "grant") return grantBlogAccess(req, res);
  return createBlogAuthor(req, res);
}

// Paginates auth.users looking for an exact email match — supabase-js's
// admin.listUsers() has no reliable cross-version "get by email" filter,
// and at this project's real account count (dozens, not thousands) a full
// scan is simpler and more robust than depending on an API shape that's
// shifted between gotrue versions.
async function findUserByEmail(supabase, email) {
  const target = email.trim().toLowerCase();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
}

// Superadmin-secret gated (same gate as api/provision-family.js) instead
// of requireModerator — a blog author isn't scoped to any family, so
// there's no Head/Admin to delegate this to.
async function createBlogAuthor(req, res) {
  const supabase = await requireSuperadmin(req, res);
  if (!supabase) return;

  const { username, password, displayName } = req.body || {};
  if (!username?.trim() || !password) {
    res.status(400).json({ error: "Username and password are required." });
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
  if (!displayName?.trim()) {
    res.status(400).json({ error: "Display name is required." });
    return;
  }

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

// Adds an EXISTING account to the blog team — no new login, no password.
// Covers both a family member you also want writing posts, and someone
// who self-signed-up with their own email/password and just needs the
// flag flipped on.
async function grantBlogAccess(req, res) {
  const supabase = await requireSuperadmin(req, res);
  if (!supabase) return;

  const { email, displayName } = req.body || {};
  if (!email?.trim()) {
    res.status(400).json({ error: "Email is required." });
    return;
  }

  try {
    const user = await findUserByEmail(supabase, email);
    if (!user) {
      throw new Error("No account found with that email — they need to sign up first (or use \"Create a login without email\" if they have none).");
    }

    const { data: existing } = await supabase.from("blog_authors").select("user_id").eq("user_id", user.id).maybeSingle();
    if (existing) {
      res.status(200).json({ email: user.email, alreadyOnTeam: true });
      return;
    }

    const { error: insertErr } = await supabase.from("blog_authors").insert({
      user_id: user.id, display_name: displayName?.trim() || user.email,
    });
    if (insertErr) throw new Error(insertErr.message);

    res.status(200).json({ email: user.email, alreadyOnTeam: false });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't grant blog access." });
  }
}
