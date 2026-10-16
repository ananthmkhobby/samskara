import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import {
  fetchMyAuthorProfile, fetchMyPosts, fetchPostById, createPost, updatePost, deletePost,
  uploadBlogMedia, makeUniqueSlug,
} from "../data/blogDb";
import "../styles/blog.css";

const LANGUAGES = [
  { code: "", label: "Not specified" },
  { code: "en", label: "English" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
];

function Toolbar({ editor, onInsertAudio, onInsertVideo, busyMedia }) {
  if (!editor) return null;
  const btn = (active, onClick, label, title) => (
    <button type="button" className={active ? "active" : ""} onClick={onClick} title={title}>{label}</button>
  );
  return (
    <div className="blog-editor-toolbar">
      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "B", "Bold")}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "I", "Italic")}
      {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "H2", "Heading")}
      {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "• List", "Bullet list")}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "1. List", "Numbered list")}
      {btn(editor.isActive("link"), () => {
        const url = window.prompt("Link URL");
        if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      }, "Link", "Insert link")}
      <label className="btn-file" style={{ display: "inline-block" }}>
        {busyMedia === "image" ? "Uploading…" : "Image"}
        <input type="file" accept="image/*" hidden disabled={!!busyMedia} onChange={async (e) => {
          const file = e.target.files[0]; e.target.value = "";
          if (file) await onInsertAudio(file, "image");
        }} />
      </label>
      {/* Audio upload hidden for now (hard disabled, not removed) — the
          underlying insertImageOrAudio "audio" branch and the
          .blog-post-body audio CSS stay in place, so re-enabling this is
          just re-adding this label block. */}
      <label className="btn-file" style={{ display: "inline-block" }}>
        {busyMedia === "video" ? "Uploading…" : "Video"}
        <input type="file" accept="video/*" hidden disabled={!!busyMedia} onChange={async (e) => {
          const file = e.target.files[0]; e.target.value = "";
          if (file) await onInsertVideo(file);
        }} />
      </label>
    </div>
  );
}

export default function BlogEditorView() {
  const [profile, setProfile] = useState(undefined); // undefined = loading, null = not a team member
  const [posts, setPosts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [language, setLanguage] = useState("");
  const [coverImagePath, setCoverImagePath] = useState(null);
  const [wasPublished, setWasPublished] = useState(false);
  const [busyMedia, setBusyMedia] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const coverInputRef = useRef(null);

  const editor = useEditor({
    extensions: [StarterKit, Image, Link.configure({ openOnClick: false })],
    content: "<p></p>",
  });

  useEffect(() => {
    fetchMyAuthorProfile().then((p) => {
      setProfile(p);
      if (p) refreshPosts();
    }).catch(() => setProfile(null));
  }, []);

  async function refreshPosts() {
    try { setPosts(await fetchMyPosts()); } catch (err) { setError(err.message); }
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setExcerpt("");
    setLanguage("");
    setCoverImagePath(null);
    setWasPublished(false);
    editor?.commands.setContent("<p></p>");
  }

  async function openForEdit(id) {
    setError("");
    try {
      const post = await fetchPostById(id);
      setEditingId(post.id);
      setTitle(post.title);
      setExcerpt(post.excerpt || "");
      setLanguage(post.language || "");
      setCoverImagePath(post.cover_image_path);
      setWasPublished(post.status === "published");
      editor?.commands.setContent(post.body_json || "<p></p>");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCoverUpload(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusyMedia("cover");
    try {
      const { path } = await uploadBlogMedia(file);
      setCoverImagePath(path);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyMedia(null);
    }
  }

  async function insertImageOrAudio(file, kind) {
    setBusyMedia(kind);
    setError("");
    try {
      const { url } = await uploadBlogMedia(file);
      if (kind === "image") editor.chain().focus().setImage({ src: url }).run();
      else editor.chain().focus().insertContent(`<audio controls src="${url}"></audio><p></p>`).run();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyMedia(null);
    }
  }

  async function insertVideo(file) {
    setBusyMedia("video");
    setError("");
    try {
      const { url } = await uploadBlogMedia(file);
      editor.chain().focus().insertContent(`<video controls src="${url}"></video><p></p>`).run();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyMedia(null);
    }
  }

  async function save(status) {
    if (!title.trim()) { setError("Give the post a title first."); return; }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const bodyJson = editor.getJSON();
      const bodyHtml = editor.getHTML();
      if (editingId) {
        await updatePost(editingId, { title: title.trim(), excerpt, coverImagePath, bodyJson, bodyHtml, language, status, wasPublished });
      } else {
        const slug = await makeUniqueSlug(title.trim());
        await createPost({
          slug, title: title.trim(), excerpt, coverImagePath, bodyJson, bodyHtml, language, status,
          authorUserId: profile.user_id, authorDisplayName: profile.display_name,
        });
      }
      setNotice(status === "published" ? "Published." : "Saved as draft.");
      resetForm();
      refreshPosts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    try {
      await deletePost(id);
      refreshPosts();
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err.message);
    }
  }

  if (profile === undefined) return <p className="form-hint">Loading…</p>;
  if (profile === null) {
    return (
      <div className="card" style={{ maxWidth: 460, padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Not a Samskara team member</h3>
        <p className="form-hint">This account isn't on the blog team — ask a superadmin to create a login for you (SuperAdmin → Blog team).</p>
      </div>
    );
  }

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>Blog editor</h2>
        <p>Signed in as {profile.display_name} — Samskara team.</p>
      </div>

      <div className="card" style={{ padding: 20, maxWidth: 820 }}>
        <div className="form-row">
          <label>Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Why the scooter deserved a photo too" />
        </div>
        <div className="form-row">
          <label>Excerpt (optional — shown on the blog list and as the search-engine description)</label>
          <textarea rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Language of this post (optional)</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Cover image (optional)</label>
          {coverImagePath && <p className="form-hint">Cover set.</p>}
          <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} disabled={busyMedia === "cover"} />
        </div>

        <div className="form-row">
          <label>Body</label>
          <Toolbar editor={editor} onInsertAudio={insertImageOrAudio} onInsertVideo={insertVideo} busyMedia={busyMedia} />
          <div className="blog-editor-body"><EditorContent editor={editor} /></div>
        </div>

        {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
        {notice && <p className="form-hint" style={{ color: "#2d5f2d" }}>{notice}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button type="button" className="btn ghost" disabled={saving} onClick={() => save("draft")}>Save draft</button>
          <button type="button" className="btn primary" disabled={saving} onClick={() => save("published")}>{wasPublished ? "Save" : "Publish"}</button>
          {editingId && <button type="button" className="btn ghost small" onClick={resetForm}>New post</button>}
        </div>
      </div>

      <div className="card" style={{ padding: 20, maxWidth: 820, marginTop: 20 }}>
        <h4 style={{ marginTop: 0 }}>Your team's posts</h4>
        {posts.length === 0 && <p className="form-hint">Nothing yet.</p>}
        {posts.map((p) => (
          <div key={p.id} className="blog-post-list-row">
            <div>
              <strong>{p.title}</strong>{" "}
              <span className={`status-pill ${p.status}`}>{p.status}</span>
              <p className="form-hint" style={{ margin: "2px 0 0" }}>{p.author_display_name}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn small ghost" onClick={() => openForEdit(p.id)}>Edit</button>
              <button type="button" className="btn small ghost" onClick={() => remove(p.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
