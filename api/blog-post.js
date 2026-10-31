// Vercel serverless function — the ONE place in this app that returns
// server-rendered HTML instead of letting the SPA shell handle a route.
// Everything else is a pure client-rendered app (see vercel.json's catch-all
// rewrite); a blog post is the one page type where that costs real SEO —
// a crawler that doesn't execute JS would otherwise only ever see the
// generic app-wide <title>/description, never the post's own.
//
// Not true SSR/hydration: React mounts via createRoot (src/main.jsx), which
// replaces whatever's in #root rather than hydrating it, so this only needs
// to produce real markup for a crawler (and a brief flash for a human
// visitor before the SPA takes over) — no hydration-mismatch risk either way.
import { createClient } from "@supabase/supabase-js";
import DOMPurify from "isomorphic-dompurify";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Defense-in-depth: blogDb.js already sanitizes body_html before it's ever
// written, but this is the one path that renders it unescaped into raw
// HTML a crawler/browser parses directly — a row written before that fix
// existed (or via a direct SQL edit) shouldn't be able to run script here.
function sanitizeBodyHtml(html) {
  return DOMPurify.sanitize(html || "", {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "s", "u", "code", "pre", "blockquote",
      "h1", "h2", "h3", "ul", "ol", "li", "a", "img", "hr",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel"],
  });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function plainTextExcerpt(html, max = 155) {
  const text = String(html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default async function handler(req, res) {
  const slug = (req.query.slug || "").trim();
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

  let shell;
  try {
    shell = await readFile(path.join(process.cwd(), "dist", "index.html"), "utf8");
  } catch {
    res.status(500).send("Build output not found.");
    return;
  }

  if (!slug || !url || !anonKey) {
    res.status(404).send(shell);
    return;
  }

  const supabase = createClient(url, anonKey);
  // Explicit status filter here too, not just relying on RLS — this
  // function's whole job is deciding what a crawler/signed-out visitor
  // sees, so it states its own access rule rather than trusting a second
  // system to enforce the one thing that matters most to get right here.
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, excerpt, body_html, cover_image_path, author_display_name, published_at, language")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!post) {
    res.status(404).send(shell);
    return;
  }

  const title = `${escapeHtml(post.title)} — Samskara Blog`;
  const description = escapeHtml(post.excerpt || plainTextExcerpt(post.body_html));
  const canonical = `${appUrl}/blog/${encodeURIComponent(slug)}`;
  // Falls back to the branded OG card (see public/og-image.png) instead of
  // omitting og:image entirely — a post with no cover photo previously
  // shared with no image at all on WhatsApp/etc.
  const coverUrl = post.cover_image_path
    ? `${url}/storage/v1/object/public/blog-media/${post.cover_image_path}`
    : `${appUrl}/og-image.png`;
  const publishedDate = post.published_at ? new Date(post.published_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }) : "";

  let html = shell
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${description}">`)
    .replace(
      "</head>",
      [
        `<link rel="canonical" href="${canonical}">`,
        `<meta property="og:type" content="article">`,
        `<meta property="og:title" content="${escapeHtml(post.title)}">`,
        `<meta property="og:description" content="${description}">`,
        `<meta property="og:url" content="${canonical}">`,
        coverUrl ? `<meta property="og:image" content="${coverUrl}">` : "",
        `<meta name="twitter:card" content="${coverUrl ? "summary_large_image" : "summary"}">`,
        `<meta name="twitter:title" content="${escapeHtml(post.title)}">`,
        `<meta name="twitter:description" content="${description}">`,
        post.language ? `<meta property="og:locale" content="${escapeHtml(post.language)}">` : "",
        "</head>",
      ].filter(Boolean).join("\n    ")
    )
    .replace(
      '<div id="root">',
      [
        '<div id="root">',
        '<article style="max-width:720px;margin:0 auto;padding:32px 20px;font-family:Georgia,serif;color:#2a1a0f;">',
        coverUrl ? `<img src="${coverUrl}" alt="" style="width:100%;border-radius:8px;margin-bottom:20px;">` : "",
        `<h1>${escapeHtml(post.title)}</h1>`,
        `<p style="color:#7a5c2e;font-size:14px;">By ${escapeHtml(post.author_display_name)}${publishedDate ? ` · ${publishedDate}` : ""}</p>`,
        sanitizeBodyHtml(post.body_html),
        "</article>",
      ].filter(Boolean).join("\n")
    );

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=600");
  res.status(200).send(html);
}
