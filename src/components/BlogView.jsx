import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { fetchPublishedPosts, fetchPostBySlug, blogMediaUrl } from "../data/blogDb";
import "../styles/blog.css";

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

  return (
    <article className="blog-post">
      <button type="button" className="link-btn" onClick={onBack}>← Back to Blog</button>
      {coverUrl && <img className="blog-post-cover" src={coverUrl} alt="" />}
      <h1>{post.title}</h1>
      <p className="blog-post-meta">By {post.author_display_name} · {formatDate(post.published_at)}</p>
      <ReadAloudBar title={post.title} textRef={bodyRef} />
      {/* Trusted markup — only blog_authors (a small, admin-created team,
          see supabase/migrations/20261015150000_blog_posts_and_authors.sql)
          can ever write body_html, via Tiptap's own serializer, never
          arbitrary visitor input. */}
      <div ref={bodyRef} className="blog-post-body" dangerouslySetInnerHTML={{ __html: post.body_html }} />
    </article>
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
