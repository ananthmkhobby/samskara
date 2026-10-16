import { useEffect, useRef, useState, Suspense } from "react";
import { lazyWithReload as lazy } from "../lib/lazyWithReload";
import { fetchPublishedPosts, fetchPostBySlug, blogMediaUrl, likePost } from "../data/blogDb";
import "../styles/blog.css";
import { SHOW_BLOG_READ_ALOUD } from "../lib/featureFlags";

// Only the Samskara team ever needs Tiptap's weight (editor, starter-kit,
// image/link extensions) — lazy so every ordinary reader's bundle skips it
// entirely, same reasoning App.jsx already applies to its own heavy views.
const BlogEditorView = lazy(() => import("./BlogEditorView"));

// Standalone section of the app, reachable identically whether signed in or
// not (see App.jsx's NEEDS_LOGIN bypass + its always-rendered line in the
// main view switch) — so it manages its own list↔post navigation directly
// against window.location rather than going through App.jsx's view/commit
// state machine, which only ever models one path per view key. A real
// browser visiting /blog/:slug gets this same component after the SPA
// bundle boots — api/blog-post.js only pre-renders the HTML a crawler or
// the very first paint sees; this is what takes over immediately after.
function slugFromPath(pathname) {
  const m = pathname.match(/^\/blog\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function goHome() {
  window.location.href = "/";
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

const RATES = [0.75, 1, 1.25, 1.5];

// Browser-native text-to-speech — no API cost, no server dependency. Reads
// the post's own rendered text (stripped of markup) rather than body_html
// directly, so headings/alt text/etc. don't get read as literal tags.
function ReadAloudBar({ title, textRef }) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function speak() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const text = [title, textRef.current?.textContent || ""].filter(Boolean).join(". ");
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = rate;
    utter.onend = () => { setSpeaking(false); setPaused(false); };
    utter.onerror = () => { setSpeaking(false); setPaused(false); };
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
    setPaused(false);
  }

  function togglePause() {
    if (!speaking) return;
    if (paused) { window.speechSynthesis.resume(); setPaused(false); }
    else { window.speechSynthesis.pause(); setPaused(true); }
  }

  function stop() {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  }

  if (!supported) return null;

  return (
    <div className="blog-readaloud">
      <span className="blog-readaloud-icon" aria-hidden="true">🔊</span>
      {!speaking ? (
        <button type="button" className="btn small primary" onClick={speak}>Listen to this post</button>
      ) : (
        <>
          <button type="button" className="btn small ghost" onClick={togglePause}>{paused ? "Resume" : "Pause"}</button>
          <button type="button" className="btn small ghost" onClick={stop}>Stop</button>
        </>
      )}
      <div className="blog-readaloud-rates">
        {RATES.map((r) => (
          <button
            key={r} type="button" className={`blog-rate-btn${rate === r ? " active" : ""}`}
            onClick={() => { setRate(r); if (speaking) speak(); }}
          >
            {r}×
          </button>
        ))}
      </div>
    </div>
  );
}

const LIKED_KEY = "vamsha.likedBlogPosts";

function getLikedIds() {
  try { return new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || "[]")); } catch { return new Set(); }
}
function rememberLiked(id) {
  try {
    const ids = getLikedIds();
    ids.add(id);
    localStorage.setItem(LIKED_KEY, JSON.stringify([...ids]));
  } catch { /* storage unavailable */ }
}

// No accounts for ordinary readers (the blog has no login wall at all), so
// there's no real identity to dedupe a like against server-side — see the
// migration's own comment for the honor-system reasoning. This just stops
// an accidental double-click/tap from counting twice in the SAME browser,
// nothing stronger.
function LikeButton({ postId, initialCount }) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(() => getLikedIds().has(postId));
  const [busy, setBusy] = useState(false);

  async function handleLike() {
    if (liked || busy) return;
    setBusy(true);
    setLiked(true);
    setCount((c) => c + 1);
    rememberLiked(postId);
    try {
      const serverCount = await likePost(postId);
      if (typeof serverCount === "number") setCount(serverCount);
    } catch {
      // Keep the optimistic bump — losing a like over a flaky request
      // isn't worth confusing the reader with a rollback.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={`blog-like-btn${liked ? " liked" : ""}`} onClick={handleLike} disabled={liked} aria-pressed={liked}>
      <span className="blog-like-icon" aria-hidden="true">{liked ? "❤️" : "🤍"}</span>
      <span>{count > 0 ? count : ""} {liked ? "Liked" : "Like this"}</span>
    </button>
  );
}

// Native share sheet where it exists (most mobile browsers); every
// browser — mobile or not — still gets Copy link and the quick social
// links, so "share outside Samskara" always has a real path.
function ShareRow({ title, url }) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function nativeShare() {
    try { await navigator.share({ title, url }); } catch { /* cancelled — nothing to do */ }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }

  const enc = encodeURIComponent;
  const links = [
    { key: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${enc(`${title} — ${url}`)}` },
    { key: "x", label: "X", href: `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}` },
    { key: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { key: "linkedin", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
  ];

  return (
    <div className="blog-share-row">
      <span className="blog-share-label">Share</span>
      {canNativeShare && <button type="button" className="blog-share-btn" onClick={nativeShare}>Share →</button>}
      {links.map((l) => (
        <a key={l.key} className="blog-share-btn" href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>
      ))}
      <button type="button" className="blog-share-btn" onClick={copyLink}>{copied ? "Copied!" : "Copy link"}</button>
    </div>
  );
}

// A thin progress bar across the top of the viewport, filling as the
// reader scrolls through the article body — the one "reading experience"
// touch that actually needs JS rather than just typography/CSS.
function ReadingProgress({ targetRef }) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    function onScroll() {
      const el = targetRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = -rect.top;
      const ratio = total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;
      setPct(Math.round(ratio * 100));
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [targetRef]);

  return (
    <div className="blog-reading-progress" aria-hidden="true">
      <div className="blog-reading-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

const SORTS = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
];

function BlogList({ onOpen }) {
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("all");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    fetchPublishedPosts().then(setPosts).catch((err) => setError(err.message));
  }, []);

  const authors = posts ? [...new Set(posts.map((p) => p.author_display_name))].sort() : [];

  const q = query.trim().toLowerCase();
  let visible = posts || [];
  if (author !== "all") visible = visible.filter((p) => p.author_display_name === author);
  if (q) visible = visible.filter((p) => p.title.toLowerCase().includes(q) || (p.excerpt || "").toLowerCase().includes(q));
  visible = [...visible].sort((a, b) => {
    const diff = new Date(a.published_at) - new Date(b.published_at);
    return sort === "newest" ? -diff : diff;
  });

  return (
    <div className="blog-list">
      <div className="blog-hero">
        <span className="eyebrow">Samskara</span>
        <h1>The Blog</h1>
        <p>Stories about keeping a family's record — and the ordinary things worth keeping too.</p>
        {/* Visible to every reader (harmless either way — the editor itself
            checks real blog-team membership via RLS), this is just the
            discoverability path: a team member browsing the public blog
            shouldn't need a bookmarked URL to find their own editor. */}
        <button type="button" className="blog-team-link" onClick={() => { window.location.href = "/blog/editor"; }}>
          Samskara team? Write a post →
        </button>
      </div>

      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      {!posts && !error && <p className="form-hint">Loading…</p>}

      {posts && posts.length > 0 && (
        <div className="blog-filters">
          <input
            type="search" className="blog-search" placeholder="Search posts…"
            value={query} onChange={(e) => setQuery(e.target.value)}
          />
          <div className="blog-filter-row">
            <select value={author} onChange={(e) => setAuthor(e.target.value)} aria-label="Filter by author">
              <option value="all">All authors</option>
              {authors.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by date">
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {posts && posts.length === 0 && <p className="form-hint">Nothing published yet — check back soon.</p>}
      {posts && posts.length > 0 && visible.length === 0 && <p className="form-hint">No posts match that search.</p>}

      <div className="blog-grid">
        {visible.map((p) => (
          <button key={p.id} type="button" className="blog-card" onClick={() => onOpen(p.slug)}>
            <div className="blog-card-cover-wrap">
              {p.cover_image_path ? (
                <img className="blog-card-cover" src={blogMediaUrl(p.cover_image_path)} alt="" />
              ) : (
                <div className="blog-card-cover blog-card-cover-placeholder" aria-hidden="true">संस्कार</div>
              )}
              {p.language && <span className="blog-card-lang">{p.language.toUpperCase()}</span>}
            </div>
            <div className="blog-card-body">
              <h3>{p.title}</h3>
              {p.excerpt && <p className="blog-card-excerpt">{p.excerpt}</p>}
              <p className="blog-card-meta">{p.author_display_name} · {formatDate(p.published_at)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function BlogPost({ slug, onBack }) {
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");
  const bodyRef = useRef(null);
  const articleRef = useRef(null);

  useEffect(() => {
    setPost(null);
    setError("");
    fetchPostBySlug(slug).then((p) => {
      if (!p) { setError("That post couldn't be found — it may have been unpublished."); return; }
      setPost(p);
    }).catch((err) => setError(err.message));
  }, [slug]);

  if (error) {
    return (
      <div className="blog-post">
        <button type="button" className="link-btn" onClick={onBack}>← Back to Blog</button>
        <p className="form-hint" style={{ color: "var(--maroon-ink)", marginTop: 16 }}>{error}</p>
      </div>
    );
  }
  if (!post) return <p className="form-hint">Loading…</p>;

  const coverUrl = post.cover_image_path ? blogMediaUrl(post.cover_image_path) : null;
  const shareUrl = `${window.location.origin}/blog/${encodeURIComponent(post.slug)}`;

  return (
    <>
      <ReadingProgress targetRef={articleRef} />
      <article className="blog-post blog-post--book" ref={articleRef}>
        <button type="button" className="link-btn" onClick={onBack}>← Back to Blog</button>
        {coverUrl && <img className="blog-post-cover" src={coverUrl} alt="" />}
        <h1>{post.title}</h1>
        <p className="blog-post-meta">By {post.author_display_name} · {formatDate(post.published_at)}</p>
        {SHOW_BLOG_READ_ALOUD && <ReadAloudBar title={post.title} textRef={bodyRef} />}
        <div className="blog-post-divider" aria-hidden="true"><span>॥</span></div>
        {/* Trusted markup — only blog_authors (a small, admin-created team,
            see supabase/migrations/20261015150000_blog_posts_and_authors.sql)
            can ever write body_html, via Tiptap's own serializer, never
            arbitrary visitor input. */}
        <div ref={bodyRef} className="blog-post-body blog-post-body--dropcap" dangerouslySetInnerHTML={{ __html: post.body_html }} />
        <div className="blog-post-footer">
          <LikeButton postId={post.id} initialCount={post.like_count || 0} />
          <ShareRow title={post.title} url={shareUrl} />
        </div>
      </article>
    </>
  );
}

export default function BlogView() {
  const [slug, setSlug] = useState(() => slugFromPath(window.location.pathname));

  useEffect(() => {
    function onPopState() { setSlug(slugFromPath(window.location.pathname)); }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function openPost(s) {
    window.history.pushState(null, "", `/blog/${encodeURIComponent(s)}`);
    setSlug(s);
    window.scrollTo({ top: 0 });
  }

  function backToList() {
    window.history.pushState(null, "", "/blog");
    setSlug(null);
    window.scrollTo({ top: 0 });
  }

  // /blog/editor — the Samskara team's authoring tool. Not linked from
  // anywhere in the public nav (same "internal tool, reached directly by
  // URL" precedent as /superadmin), since a public blog has no reason to
  // advertise its own login screen; the team gets this URL directly when
  // their login is created (SuperAdmin → Blog team).
  if (slug === "editor") {
    return (
      <div className="login-page login-page-scroll blog-shell">
        <button className="login-help-link login-back-link" onClick={goHome}>← Samskara</button>
        <div className="login-help-wrap blog-wrap">
          <Suspense fallback={<p className="form-hint">Loading…</p>}>
            <BlogEditorView />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page login-page-scroll blog-shell">
      <button className="login-help-link login-back-link" onClick={goHome}>← Samskara</button>
      <div className="login-help-wrap blog-wrap">
        {slug ? <BlogPost slug={slug} onBack={backToList} /> : <BlogList onOpen={openPost} />}
      </div>
    </div>
  );
}
