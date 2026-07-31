import { useState } from "react";
import { PEOPLE, VALUES } from "../data/people";
import { yearsLabel, byId, MIN_GEN, MAX_GEN } from "../data/helpers";
import { EXP_LABELS } from "./Icons";
import PersonAvatar from "./PersonAvatar";
import PhotoLightbox from "./PhotoLightbox";

const TABS = ["Wisdom", "Gallery"];
const GALLERY_TYPES = ["photo", "audio", "video", "memory", "document"];

function GalleryCard({ c, onSelectPerson, onOpenPhoto }) {
  const person = c.personId ? byId(c.personId) : null;
  const isRealPhoto = c.type === "photo" && !!c.mediaUrl;
  const isRealAudio = c.type === "audio" && !!c.mediaUrl;
  const isRealVideo = c.type === "video" && !!c.mediaUrl;

  return (
    <div className="card gallery-card">
      {isRealPhoto && (
        <button type="button" className="gallery-photo-btn" onClick={() => onOpenPhoto(c.mediaUrl)} aria-label="View photo full screen">
          <img src={c.mediaUrl} alt="" className="gallery-photo" />
        </button>
      )}
      {isRealAudio && <audio src={c.mediaUrl} controls className="gallery-media-player" />}
      {isRealVideo && <video src={c.mediaUrl} controls className="gallery-media-player gallery-video" />}
      {!isRealPhoto && !isRealAudio && !isRealVideo && (
        <div className="gallery-text-body">
          {c.type === "document" ? `📄 ${c.content}` : c.content}
        </div>
      )}
      <div className="gallery-card-foot">
        {person ? (
          <button type="button" className="gallery-who" onClick={() => onSelectPerson(person.id)}>
            <PersonAvatar person={person} size={28} minGen={MIN_GEN} maxGen={MAX_GEN} className="avatar" />
            <span>{person.name}</span>
          </button>
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

export default function TreasuryView({ contributions, onSelectPerson }) {
  const [tab, setTab] = useState("Wisdom");
  const [filter, setFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const withLessons = PEOPLE.filter((p) => p.lifeLesson && (!filter || p.lifeLesson.values.includes(filter)));

  const galleryItems = contributions
    .filter((c) => c.status === "Verified" && GALLERY_TYPES.includes(c.type) && (!typeFilter || c.type === typeFilter))
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>{tab === "Wisdom" ? "Treasury of Wisdom" : "Family Gallery"}</h2>
        <p>
          {tab === "Wisdom"
            ? "The one lesson each storyteller wanted the family to keep. Filter by value to find what you need today."
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
