// Vercel serverless function — lets a Head/Admin create a username+password
// login for someone with no email (most elders, per the request this came
// from), instead of the invite-link flow which requires one. Server-side
// only: holds the service-role key needed for auth.admin.createUser.
//
// Also handles the Samskara blog team (`kind: "blog"`) — originally its own
// api/create-blog-author.js, folded in here to stay under Vercel Hobby's
// 12-serverless-function-per-deployment cap (hit 2026-10-15 adding the blog
// feature; see docs/CHANGELOG.md). Two blog modes:
//   - "create" (default): same synthetic-email + auth.admin.createUser()
//     mechanics as a family login, for someone with no account at all.
//   - "grant": no new account — just adds an EXISTING account (looked up by
//     email) to blog_authors. For anyone who already has a login (a family
//     member, or someone who just self-signed-up), this is strictly less
//     overhead: no password to generate or hand over, they keep using the
//     one they already have.
import { serviceClient, requireModerator, usernameToEmail } from "./_memberAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { kind, mode, adminSecret, familyId, username, password, displayName, personId, email } = req.body || {};

  if (kind === "blog" && mode === "grant") {
    await grantBlogAccess(res, { adminSecret, email, displayName });
    return;
  }

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

  if (kind === "blog") {
    await createBlogAuthor(res, { adminSecret, username, password, displayName });
    return;
  }

  if (!familyId) {
    res.status(400).json({ error: "Family is required." });
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

  const loginEmail = usernameToEmail(username);
  try {
    if (personId) {
      const { data: person, error: personErr } = await supabase
        .from("people").select("id").eq("family_id", familyId).eq("id", personId).maybeSingle();
      if (personErr) throw new Error(personErr.message);
      if (!person) throw new Error("That person isn't in this family.");
    }

    const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
      email: loginEmail, password, email_confirm: true,
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

function checkAdminSecret(res) {
  const secret = process.env.ADMIN_PROVISION_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Not configured on this deployment — missing ADMIN_PROVISION_SECRET." });
    return null;
  }
  return secret;
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

// Superadmin-secret gated (same gate as api/provision-family.js) instead of
// requireModerator — a blog author isn't scoped to any family, so there's
// no Head/Admin to delegate this to.
async function createBlogAuthor(res, { adminSecret, username, password, displayName }) {
  const secret = checkAdminSecret(res);
  if (!secret) return;
  if (adminSecret !== secret) {
    res.status(401).json({ error: "Incorrect admin secret." });
    return;
  }
  if (!displayName?.trim()) {
    res.status(400).json({ error: "Display name is required." });
    return;
  }

  const supabase = serviceClient();
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
async function grantBlogAccess(res, { adminSecret, email, displayName }) {
  const secret = checkAdminSecret(res);
  if (!secret) return;
  if (adminSecret !== secret) {
    res.status(401).json({ error: "Incorrect admin secret." });
    return;
  }
  if (!email?.trim()) {
    res.status(400).json({ error: "Email is required." });
    return;
  }

  const supabase = serviceClient();
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
