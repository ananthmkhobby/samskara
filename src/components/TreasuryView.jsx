import { useEffect, useState } from "react";
import { PEOPLE, VALUES } from "../data/people";
import { yearsLabel, byId, MIN_GEN, MAX_GEN } from "../data/helpers";
import { EXP_LABELS } from "./Icons";
import PersonAvatar from "./PersonAvatar";
import PhotoLightbox from "./PhotoLightbox";
import { fetchMyPrivateContributions } from "../data/familyDb";
import { batchResolveMediaUrls } from "../lib/mediaUpload";
import { CURRENT_FAMILY_ID, CURRENT_USER_ID } from "../data/session";

const GALLERY_TYPES = ["photo", "audio", "video", "memory", "document"];

function GalleryCard({ c, onSelectPerson, onOpenPhoto, isPrivate }) {
  const person = c.personId ? byId(c.personId) : null;
  const isRealPhoto = c.type === "photo" && !!c.mediaUrl;
  const isRealAudio = c.type === "audio" && !!c.mediaUrl;
  const isRealVideo = c.type === "video" && !!c.mediaUrl;
  const isRealDocument = c.type === "document" && !!c.mediaUrl;

  return (
    <div className="card gallery-card">
      {isRealPhoto && (
        <button type="button" className="gallery-photo-btn" onClick={() => onOpenPhoto(c.mediaUrl)} aria-label="View photo full screen">
          <img src={c.mediaUrl} alt="" className="gallery-photo" />
        </button>
      )}
      {isRealAudio && <audio src={c.mediaUrl} controls className="gallery-media-player" />}
      {isRealVideo && <video src={c.mediaUrl} controls className="gallery-media-player gallery-video" />}
      {isRealDocument && (
        <div className="gallery-text-body">
          <a href={c.mediaUrl} target="_blank" rel="noreferrer">📄 {c.title || "Document"}</a>
        </div>
      )}
      {!isRealPhoto && !isRealAudio && !isRealVideo && !isRealDocument && (
        <div className="gallery-text-body">
          {c.type === "document" ? `📄 ${c.title || "Document"} — wasn't saved; ask them to upload it again` : c.content}
        </div>
      )}
      <div className="gallery-card-foot">
        {person ? (
          <button type="button" className="gallery-who" onClick={() => onSelectPerson(person.id)}>
            <PersonAvatar person={person} size={28} minGen={MIN_GEN} maxGen={MAX_GEN} className="avatar" />
            <span>{person.name}</span>
          </button>
        ) : isPrivate ? (
          <span className="gallery-who gallery-who-family">🔒 Private to you</span>
        ) : (
          <span className="gallery-who gallery-who-family">🪔 Shared with the whole family</span>
        )}
        <span className="gallery-meta">
          {c.expCategory ? `${EXP_LABELS[c.expCategory] || c.expCategory} · ` : ""}
          {c.contributor} · {c.date}
        </span>
      </div>
    </div>
  );
}

export default function TreasuryView({ contributions, onSelectPerson, initialTab = "Wisdom" }) {
  const [tab, setTab] = useState(initialTab);
  const [filter, setFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [privateItems, setPrivateItems] = useState(null);
  const [privateLoading, setPrivateLoading] = useState(false);
  const [privateError, setPrivateError] = useState("");
  const withLessons = PEOPLE.filter((p) => p.lifeLesson && (!filter || p.lifeLesson.values.includes(filter)));

  // Only a real signed-in member has private uploads to find — not shown
  // for an anonymous demo visitor, who has no account for anything to be
  // scoped to.
  const showPrivateTab = !!CURRENT_USER_ID;
  const TABS = ["Wisdom", "Gallery", ...(showPrivateTab ? ["Private to me"] : [])];

  const galleryItems = contributions
    .filter((c) => c.status === "Verified" && GALLERY_TYPES.includes(c.type) && (!typeFilter || c.type === typeFilter))
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // Private contributions never arrive in the `contributions` prop at all
  // (fetchFamilyData excludes them) — this tab is the one place they're
  // meant to surface, fetched and resolved on its own, only when opened.
  useEffect(() => {
    if (tab !== "Private to me" || !showPrivateTab) return;
    let cancelled = false;
    setPrivateLoading(true);
    setPrivateError("");
    (async () => {
      try {
        const rows = await fetchMyPrivateContributions(CURRENT_FAMILY_ID, CURRENT_USER_ID);
        const paths = rows.filter((c) => GALLERY_TYPES.includes(c.type) && c.type !== "memory").map((c) => c.content);
        const urlMap = await batchResolveMediaUrls(paths);
        if (cancelled) return;
        setPrivateItems(rows.map((c) => ({ ...c, mediaUrl: urlMap[c.content] || null })));
      } catch (err) {
        if (!cancelled) setPrivateError(err.message);
      } finally {
        if (!cancelled) setPrivateLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, showPrivateTab]);

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>{tab === "Wisdom" ? "Treasury of Wisdom" : tab === "Private to me" ? "Private to me" : "Family Gallery"}</h2>
        <p>
          {tab === "Wisdom"
            ? "The one lesson each storyteller wanted the family to keep. Filter by value to find what you need today."
            : tab === "Private to me"
            ? "Only visible to you — not the family, not an Admin. Nothing here shows up anywhere else in the app."
            : "Every photo, recording, and memory the family has shared, verified and kept — whether it belongs to one person's Folio or the whole family."}
        </p>
      </div>

      <div className="admin-tabs" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t} className={`chip${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "Wisdom" ? (
        <>
          <div className="value-filters">
            {VALUES.map((v) => (
              <button key={v} className={`chip${filter === v ? " active" : ""}`} onClick={() => setFilter(v)}>{v}</button>
            ))}
            <button className={`chip${filter === null ? " active" : ""}`} onClick={() => setFilter(null)}>All</button>
          </div>
          {withLessons.length ? (
            <div className="treasury-grid">
              {withLessons.map((p) => (
                <button key={p.id} className="card lesson-card" onClick={() => onSelectPerson(p.id)} aria-label={`Open ${p.name}'s folio`}>
                  <p className="quote">{p.lifeLesson.quote}</p>
                  <div className="lesson-who">
                    <PersonAvatar person={p} size={36} minGen={MIN_GEN} maxGen={MAX_GEN} className="avatar" />
                    <div><b>{p.name}</b><span>{yearsLabel(p)}</span></div>
                  </div>
                  <div className="tag-row">{p.lifeLesson.values.map((v) => <span className="tag" key={v}>{v}</span>)}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">No life lessons recorded for “{filter}” yet.</div>
          )}
        </>
      ) : tab === "Private to me" ? (
        <>
          {privateError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{privateError}</p>}
          {privateLoading ? (
            <div className="empty-state">Loading…</div>
          ) : privateItems?.length ? (
            <div className="gallery-grid">
              {privateItems.map((c) => (
                <GalleryCard key={c.id} c={c} onSelectPerson={onSelectPerson} onOpenPhoto={setLightboxSrc} isPrivate />
              ))}
            </div>
          ) : (
            <div className="empty-state">Nothing here yet — mark something "private" when you add it, and it'll show up here, only for you.</div>
          )}
        </>
      ) : (
        <>
          <div className="value-filters">
            {[["photo", "Photos"], ["video", "Videos"], ["audio", "Recordings"], ["memory", "Memories"], ["document", "Documents"]].map(([key, label]) => (
              <button key={key} className={`chip${typeFilter === key ? " active" : ""}`} onClick={() => setTypeFilter((t) => (t === key ? null : key))}>{label}</button>
            ))}
          </div>
          {galleryItems.length ? (
            <div className="gallery-grid">
              {galleryItems.map((c) => (
                <GalleryCard key={c.id} c={c} onSelectPerson={onSelectPerson} onOpenPhoto={setLightboxSrc} />
              ))}
            </div>
          ) : (
            <div className="empty-state">Nothing here yet — verified photos, recordings, and memories will show up as the family adds them.</div>
          )}
        </>
      )}
      <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </section>
  );
}
