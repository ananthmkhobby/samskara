// Vercel serverless function — superadmin-only. Built to fulfill account
// export/deletion requests now that self-service is off (see
// AccountSettingsView.jsx's SELF_SERVICE_ENABLED and the Privacy Policy's
// "email support" clause) — everything export_my_data() already returns
// (memberships, contributions metadata, blog posts, consents), PLUS a
// time-limited signed URL for every real media file the person
// contributed, so a support-fulfilled export is a genuine export, not a
// JSON file of paths with no way to actually get the photos and videos.
//
// Not called as the user themselves (there's no session to call it with —
// this runs from the SuperAdmin panel, triggered by a human reading a
// support email) — so this can't just call export_my_data() (security
// definer, keyed off auth.uid()). Instead it replicates that function's
// exact same queries directly, scoped to p_userId instead of auth.uid(),
// under the service-role client. Same privacy boundary as the original:
// only what THIS person contributed, not everything in their family.
import { serviceClient } from "./_memberAuth.js";
import { requireSuperadmin } from "./_superadminAuth.js";

const BUCKET = "family-media";
const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour — long enough for a human
// operator to download everything and relay it, short enough that a link
// copy-pasted into an email thread doesn't stay live indefinitely.
const MEDIA_TYPES = ["photo", "audio", "video", "document"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabase = await requireSuperadmin(req, res);
  if (!supabase) return;

  const { email } = req.body || {};
  if (!email?.trim()) {
    res.status(400).json({ error: "Enter the account's email address." });
    return;
  }

  try {
    // auth.admin API, not a table query — auth.users isn't exposed via
    // postgrest, same reasoning api/reset-member-password.js and others
    // already follow for looking someone up by login email.
    const { data: userList, error: userErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (userErr) throw new Error(userErr.message);
    const user = userList.users.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      res.status(404).json({ error: "No account found with that email." });
      return;
    }

    const [{ data: memberships }, { data: contributions }, { data: blogPosts }, { data: consents }] = await Promise.all([
      supabase.from("family_members").select("role, created_at, families(name)").eq("user_id", user.id),
      supabase.from("contributions").select("id, type, title, content, body_text, status, date, created_at").eq("contributor_user_id", user.id),
      supabase.from("blog_posts").select("title, status, published_at").eq("author_user_id", user.id),
      supabase.from("user_consents").select("*").eq("user_id", user.id),
    ]);

    const mediaContribs = (contributions || []).filter((c) => MEDIA_TYPES.includes(c.type) && c.content);
    const media = [];
    for (const c of mediaContribs) {
      const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(c.content, SIGNED_URL_TTL_SECONDS);
      if (signErr || !signed?.signedUrl) continue; // a missing/moved file shouldn't fail the whole export
      media.push({ contributionId: c.id, type: c.type, title: c.title || null, url: signed.signedUrl });
    }

    res.status(200).json({
      exported_at: new Date().toISOString(),
      email: user.email,
      memberships: (memberships || []).map((m) => ({ family_name: m.families?.name, role: m.role, joined_at: m.created_at })),
      contributions: (contributions || []).map((c) => ({
        type: c.type, title: c.title, content: MEDIA_TYPES.includes(c.type) ? undefined : c.content,
        body_text: c.body_text, status: c.status, date: c.date, created_at: c.created_at,
      })),
      blog_posts: blogPosts || [],
      consents: consents || [],
      media,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't build that export." });
  }
}
