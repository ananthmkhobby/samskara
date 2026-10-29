// Data layer for the public Samskara blog — deliberately separate from
// familyDb.js, since none of this is family-scoped. Talks to Supabase
// directly through RLS (blog_posts/blog_authors policies, see
// supabase/migrations/20261015150000_blog_posts_and_authors.sql), same
// convention as the rest of the app's data modules: no bespoke CRUD API
// routes, the database is the actual authority either way.
import DOMPurify from "isomorphic-dompurify";
import { supabase } from "../lib/supabaseClient";
import { resizeImage } from "../lib/imageResize";

const BUCKET = "blog-media";

// RLS (`is_blog_team()`) gates WHO can write a post, never WHAT the HTML
// contains — a direct REST call with a hand-crafted body_html bypasses the
// Tiptap editor entirely. This is the one place both write paths funnel
// through, so it's the one place sanitization has to happen for it to be
// real. Mirrors the actual Tiptap extension set in use (starter-kit +
// extension-image + extension-link) — nothing broader is ever needed.
function sanitizeBodyHtml(html) {
  return DOMPurify.sanitize(html || "", {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "s", "u", "code", "pre", "blockquote",
      "h1", "h2", "h3", "ul", "ol", "li", "a", "img", "hr",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
  });
}

function requireClient() {
  if (!supabase) throw new Error("Backend isn't configured.");
  return supabase;
}

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "post";
}

// Appends a short random suffix only if the plain slug is already taken —
// keeps URLs clean for the common case instead of always suffixing.
export async function makeUniqueSlug(title) {
  const db = requireClient();
  const base = slugify(title);
  const { data } = await db.from("blog_posts").select("slug").like("slug", `${base}%`);
  const taken = new Set((data || []).map((r) => r.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export async function fetchPublishedPosts() {
  const db = requireClient();
  const { data, error } = await db
    .from("blog_posts")
    .select("id, slug, title, excerpt, cover_image_path, author_display_name, language, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

// Atomic, anonymous-safe (see the migration for the actual trust model) —
// increment_blog_post_likes() is a security-definer RPC grantable to
// `anon`, so this works identically whether the reader is signed in or
// not, matching the rest of the blog's "no login wall" design. Returns
// the new total so the UI can update without a second fetch.
export async function likePost(postId) {
  const db = requireClient();
  const { data, error } = await db.rpc("increment_blog_post_likes", { p_post_id: postId });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchPostBySlug(slug) {
  const db = requireClient();
  const { data, error } = await db
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Team-only (RLS: is_blog_team()) — every post regardless of status, for
// the editor's "my team's posts" list.
export async function fetchMyPosts() {
  const db = requireClient();
  const { data, error } = await db
    .from("blog_posts")
    .select("id, slug, title, status, cover_image_path, author_display_name, published_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchPostById(id) {
  const db = requireClient();
  const { data, error } = await db.from("blog_posts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Cheap existence check the editor UI uses to decide what to show before
// any write is attempted — RLS is still the real enforcement either way,
// this just avoids a confusing silent-failure UX for someone who isn't
// actually on the team. Returns the author's own row (for display_name)
// or null if they're not on the team.
export async function fetchMyAuthorProfile() {
  const db = requireClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db.from("blog_authors").select("user_id, display_name").eq("user_id", user.id).maybeSingle();
  return data || null;
}

export async function createPost({ slug, title, excerpt, coverImagePath, bodyJson, bodyHtml, language, status, authorUserId, authorDisplayName }) {
  const db = requireClient();
  const { data, error } = await db.from("blog_posts").insert({
    slug, title, excerpt: excerpt || null, cover_image_path: coverImagePath || null,
    body_json: bodyJson, body_html: sanitizeBodyHtml(bodyHtml), language: language || null, status,
    author_user_id: authorUserId, author_display_name: authorDisplayName,
    published_at: status === "published" ? new Date().toISOString() : null,
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePost(id, { title, excerpt, coverImagePath, bodyJson, bodyHtml, language, status, wasPublished }) {
  const db = requireClient();
  const patch = {
    title, excerpt: excerpt || null, cover_image_path: coverImagePath || null,
    body_json: bodyJson, body_html: sanitizeBodyHtml(bodyHtml), language: language || null, status,
    updated_at: new Date().toISOString(),
  };
  // Only stamp published_at the first time a post goes live — re-saving an
  // already-published post (a typo fix, say) shouldn't bump its date.
  if (status === "published" && !wasPublished) patch.published_at = new Date().toISOString();
  const { data, error } = await db.from("blog_posts").update(patch).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deletePost(id) {
  const db = requireClient();
  const { error } = await db.from("blog_posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Images resize through the same pipeline every other upload in this app
// uses (src/lib/imageResize.js); audio/video upload as-is. Returns the
// bucket's plain public URL — blog-media is a public bucket, no signed
// URL needed, unlike family-media.
export async function uploadBlogMedia(file) {
  const db = requireClient();
  const isImage = file.type.startsWith("image/");
  let blob = file, ext = (file.name.split(".").pop() || "bin").toLowerCase();
  if (isImage) {
    const resized = await resizeImage(file);
    blob = resized.blob;
    ext = "jpg";
  }
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || file.type });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export function blogMediaUrl(path) {
  if (!path || !supabase) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
