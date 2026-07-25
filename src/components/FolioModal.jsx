import { useRef, useState } from "react";
import { byId, yearsLabel, trustLabel, contributionsFor, verifiedMediaFor, personHasContent, roleTag, relationshipCaption, widowedLabel, MIN_GEN, MAX_GEN } from "../data/helpers";
import { MEDIA_ICONS, EXP_LABELS, ExpIcon, AUDIO_EXP_TYPES, EditPencilIcon } from "./Icons";
import PersonAvatar from "./PersonAvatar";
import PhotoLightbox from "./PhotoLightbox";
import { resizeImage } from "../lib/imageResize";
import { uploadFamilyMedia, resolveMediaUrl } from "../lib/mediaUpload";
import { CURRENT_FAMILY_ID } from "../data/session";

export default function FolioModal({ person, contributions, onClose, onEdit, onShare, onOpenBiography, onChangePhoto, onAddFamily, onOpenInterview, onOpenVoiceWizard, playingExp, onToggleExpPlay, canModerate, onRemoveExperience }) {
  const contribs = contributionsFor(contributions, person.id);
  const media = verifiedMediaFor(contributions, person.id);
  const hasContent = personHasContent(contributions, person);
  const role = roleTag(contributions, person);
  const spouse = person.spouse && byId(person.spouse);
  const relationship = relationshipCaption(person);
  const widowed = widowedLabel(person);
  const photoInputRef = useRef(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [expCollapsed, setExpCollapsed] = useState(false);
  const hasPhoto = !!person.photoUrl;

  async function handlePhotoFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { blob } = await resizeImage(file);
      const path = await uploadFamilyMedia(CURRENT_FAMILY_ID, person.id, blob, "jpg");
      const url = await resolveMediaUrl(path);
      onChangePhoto(person.id, path, url);
    } catch {
      // ignore unreadable file / failed upload; input stays empty
    }
    e.target.value = "";
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel">
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="folio-band">
          <div className="avatar-wrap">
            <button
              type="button"
              className="avatar-view-btn"
              onClick={() => (hasPhoto ? setLightboxSrc(person.photoUrl) : photoInputRef.current?.click())}
              aria-label={hasPhoto ? `View ${person.name}'s photo` : "Add profile photo"}
            >
              <PersonAvatar person={person} size={74} minGen={MIN_GEN} maxGen={MAX_GEN} variant="band" className="avatar" />
            </button>
            <button type="button" className="avatar-edit-fab" onClick={() => photoInputRef.current?.click()} aria-label="Change profile photo">
              <EditPencilIcon />
            </button>
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoFile} />
          <h2>{person.name}</h2>
          <div className="role">{role || (spouse ? `m. ${spouse.name}` : "")} — {yearsLabel(person)}</div>
          {(relationship || widowed) && (
            <div className="relationship">{[relationship, widowed].filter(Boolean).join(" · ")}</div>
          )}
          <div className="folio-badges"><span className={`trust ${person.trust}`}>{trustLabel(person.trust)}</span></div>
        </div>
        <div className="modal-body">
          <button type="button" className="interview-cta wizard-cta" onClick={onOpenVoiceWizard}>
            <span className="interview-cta-icon">🗣️</span>
            <span>
              <b>Fill in {person.name.split(" ")[0]}'s profile by voice</b>
              <span className="interview-cta-sub">A few quick spoken questions — heritage, life lesson, summary, places. Skip anything, pick up later.</span>
            </span>
          </button>
          <button type="button" className="interview-cta" onClick={onOpenInterview}>
            <span className="interview-cta-icon">🎙️</span>
            <span>
              <b>Record {person.name.split(" ")[0]}'s story, AI-guided</b>
              <span className="interview-cta-sub">A few spoken questions — the AI drafts a biography chapter from the conversation</span>
            </span>
          </button>
          <div className="folio-section">
            <div className="folio-section-head">
              <h4>Heritage details</h4>
              <button className="icon-only" aria-label="Edit heritage details" onClick={() => onEdit({ field: "heritage", fieldLabel: "Rashi & gotra", rashi: person.rashi || "", gotra: person.gotra || "" })}><EditPencilIcon /></button>
            </div>
            {person.rashi || person.gotra ? (
              <div className="tag-row">
                {person.rashi && <span className="tag">Rashi: {person.rashi}</span>}
                {person.gotra && <span className="tag">Gotra: {person.gotra}</span>}
              </div>
            ) : <p className="form-hint" style={{ marginTop: 0 }}>Rashi and gotra haven't been added yet — optional, but nice to have on record.</p>}
          </div>
          <div className="folio-section">
            <div className="folio-section-head">
              <h4>Location</h4>
              <button className="icon-only" aria-label="Edit location" onClick={() => onEdit({ field: "geo", fieldLabel: "Location", value: person.geo?.place || "" })}><EditPencilIcon /></button>
            </div>
            {person.geo ? <p className="folio-summary">{person.geo.place}</p> : <p className="form-hint" style={{ marginTop: 0 }}>No city on record yet — add one to show them on the family's Journey map.</p>}
          </div>
          <div className="folio-section">
            <div className="folio-section-head"><h4>Family</h4></div>
            <div className="tag-row">
              <button type="button" className="btn small ghost" onClick={() => onAddFamily("child")}>+ Add son or daughter</button>
              {!person.spouse && <button type="button" className="btn small ghost" onClick={() => onAddFamily("spouse")}>+ Add spouse</button>}
            </div>
          </div>
          <div className="folio-section">
            <div className="folio-section-head">
              <h4>Life lesson</h4>
              <button className="icon-only" aria-label="Propose edit to Life lesson" onClick={() => onEdit({ field: "lifeLesson", fieldLabel: "Life lesson", value: person.lifeLesson?.quote || "", values: person.lifeLesson?.values || [] })}><EditPencilIcon /></button>
            </div>
            {person.lifeLesson ? (
              <>
                <p className="lesson-quote">“{person.lifeLesson.quote}”</p>
                {person.lifeLesson.values?.length > 0 && (
                  <div className="tag-row" style={{ marginTop: 10 }}>
                    {person.lifeLesson.values.map((v) => <span className="tag" key={v}>{v}</span>)}
                  </div>
                )}
              </>
            ) : <p className="form-hint" style={{ marginTop: 0 }}>No life lesson recorded yet — optional, but a nice thing to capture, along with which values it reflects.</p>}
          </div>
          <div className="folio-section">
            <div className="folio-section-head">
              <h4>A day in their life</h4>
              <button
                className="icon-only"
                aria-label="Propose edit to A day in their life"
                onClick={() => onEdit({
                  field: "dayInLife", fieldLabel: "A day in their life",
                  dayYear: person.dayInLife?.year || "", dayItems: (person.dayInLife?.items || []).join("\n"),
                })}
              ><EditPencilIcon /></button>
            </div>
            {person.dayInLife?.items?.length ? (
              <div className="day-in-life">
                {person.dayInLife.year && <span className="eyebrow tnum">Year: {person.dayInLife.year}</span>}
                <ul className="day-in-life-list">
                  {person.dayInLife.items.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
                <p className="day-in-life-contrast">None of this exists the same way today — that contrast is the point.</p>
              </div>
            ) : <p className="form-hint" style={{ marginTop: 0 }}>Not recorded yet — a few concrete details of an ordinary day (what they wore, ate, walked, owned) says more than a list of achievements.</p>}
          </div>
          {hasContent ? (
            <>
              {person.summary && (
                <div className="folio-section">
                  <div className="folio-section-head">
                    <h4>Summary</h4>
                    <button className="icon-only" aria-label="Propose edit to Summary" onClick={() => onEdit({ field: "summary", fieldLabel: "Summary", value: person.summary })}><EditPencilIcon /></button>
                  </div>
                  <p className="folio-summary">{person.summary}</p>
                </div>
              )}
              {person.experience && person.experience.length > 0 && (
                <div className="folio-section">
                  <button
                    type="button"
                    className="folio-section-head collapsible"
                    onClick={() => setExpCollapsed((c) => !c)}
                    aria-expanded={!expCollapsed}
                  >
                    <h4>Their experience ({person.experience.length})</h4>
                    <span className={`collapse-chevron${expCollapsed ? " collapsed" : ""}`}>▾</span>
                  </button>
                  {!expCollapsed && <div className="exp-grid">
                    {person.experience.map((e, i) => {
                      const key = `${person.id}:${i}`;
                      const isAudio = AUDIO_EXP_TYPES.includes(e.type) && !e.mediaUrl;
                      const playing = playingExp === key;
                      return (
                        <div key={i} className={`exp-card${playing ? " playing" : ""}${e.mediaUrl ? " has-media" : ""}`}>
                          {canModerate && e.id != null && (
                            <div className="exp-mod-actions">
                              <button type="button" className="icon-only" aria-label="Propose edit to this experience" onClick={() => onEdit({ field: `experience:${e.id}`, fieldLabel: "Experience caption", value: e.caption })}><EditPencilIcon /></button>
                              <button type="button" className="icon-only" aria-label="Remove this experience" onClick={() => onRemoveExperience(e.id)}>✕</button>
                            </div>
                          )}
                          <button
                            type="button"
                            className="exp-card-inner"
                            onClick={() => (e.mediaUrl ? setLightboxSrc(e.mediaUrl) : isAudio && onToggleExpPlay(key))}
                          >
                            {e.mediaUrl ? (
                              <img className="exp-photo" src={e.mediaUrl} alt={e.caption || EXP_LABELS[e.type]} />
                            ) : (
                              <span className="exp-icon"><ExpIcon type={e.type} /></span>
                            )}
                            <span className="exp-body">
                              <span className="exp-label">{EXP_LABELS[e.type]}</span>
                              {e.caption && <span className="exp-caption">{e.caption}</span>}
                              {isAudio && (
                                <>
                                  <span className="exp-eq"><span></span><span></span><span></span></span>
                                  <span className="exp-playstate">Playing — sample audio</span>
                                </>
                              )}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>}
                  {!expCollapsed && <p className="form-hint">Cards with a photo show the real upload. Audio-type cards without one play a short illustrative sample.</p>}
                </div>
              )}
              {person.places && (
                <div className="folio-section">
                  <div className="folio-section-head">
                    <h4>Places</h4>
                    <button className="icon-only" aria-label="Propose edit to Places" onClick={() => onEdit({ field: "places", fieldLabel: "Places", value: person.places.join(", ") })}><EditPencilIcon /></button>
                  </div>
                  <p className="folio-summary">{person.places.join(" · ")}</p>
                </div>
              )}
              <div className="folio-section">
                <div className="folio-section-head"><h4>Media</h4></div>
                <div className="gallery">
                  {media.map((m, i) => {
                    if (m.type === "photo" && m.mediaUrl) {
                      return (
                        <button type="button" className="gallery-item has-photo" key={i} onClick={() => setLightboxSrc(m.mediaUrl)} aria-label="View photo full screen">
                          <img src={m.mediaUrl} alt="" />
                        </button>
                      );
                    }
                    const Icon = MEDIA_ICONS[m.type] || MEDIA_ICONS.document;
                    return <div className="gallery-item" key={i}><Icon /><span>{m.type}</span></div>;
                  })}
                  <button className="gallery-item" style={{ border: "1px dashed var(--line-strong)", background: "none", cursor: "pointer" }} onClick={() => onShare(person.id, "photo")}>+ Add</button>
                </div>
              </div>
              <div className="folio-section">
                <div className="folio-section-head"><h4>Contributions ({contribs.length})</h4></div>
                {contribs.length ? contribs.map((c) => {
                  const isRealAudio = c.type === "audio" && !!c.mediaUrl;
                  const isRealVideo = c.type === "video" && !!c.mediaUrl;
                  return (
                    <div className="contrib-item" key={c.id} style={{ flexDirection: isRealAudio || isRealVideo ? "column" : "row", alignItems: "stretch" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div className="contrib-text">
                          {c.type === "edit" ? `Proposed change to ${c.fieldLabel}` : isRealAudio ? "Voice recording" : isRealVideo ? "Video recording" : (c.type === "memory" || c.type === "date" ? c.content : `[${c.type}] ${c.content}`)}
                          <span className="who">{c.contributor}</span>
                        </div>
                        <span className={`status-pill ${c.status}`}>{c.status}</span>
                      </div>
                      {isRealAudio && <audio src={c.mediaUrl} controls style={{ width: "100%", marginTop: 8 }} />}
                      {isRealVideo && <video src={c.mediaUrl} controls style={{ width: "100%", marginTop: 8, borderRadius: 8, maxHeight: 220 }} />}
                    </div>
                  );
                }) : <p style={{ color: "var(--ink-faint)", fontSize: 13 }}>No contributions yet.</p>}
              </div>
            </>
          ) : (
            <div className="folio-section unwritten">
              <span className="eyebrow">Unwritten leaf</span>
              <p style={{ marginTop: 10 }}>{person.name}'s story hasn't been told yet. Be the first to add a memory, photo, or date.</p>
              <button className="btn primary small" onClick={() => onShare(person.id)}>Share what you know</button>
            </div>
          )}
          <div className="folio-actions">
            <button className="btn" onClick={() => onShare(person.id)}>Share what you know</button>
            <button className="btn primary" onClick={onOpenBiography}>Open full biography</button>
            <button className="btn ghost" onClick={() => window.print()}>Download PDF</button>
          </div>
        </div>
      </div>
      <PhotoLightbox src={lightboxSrc} alt={person.name} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
