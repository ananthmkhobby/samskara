import { useRef } from "react";
import { byId, yearsLabel, trustLabel, contributionsFor, verifiedMediaFor, personHasContent, roleTag, MIN_GEN, MAX_GEN } from "../data/helpers";
import { MEDIA_ICONS, EXP_LABELS, ExpIcon, AUDIO_EXP_TYPES, EditPencilIcon } from "./Icons";
import PersonAvatar from "./PersonAvatar";
import { fileToResizedDataUrl } from "../lib/imageResize";

export default function FolioModal({ person, contributions, onClose, onEdit, onShare, onOpenBiography, onChangePhoto, onAddFamily, onOpenInterview, onOpenVoiceWizard, playingExp, onToggleExpPlay, canModerate, onRemoveExperience }) {
  const contribs = contributionsFor(contributions, person.id);
  const media = verifiedMediaFor(contributions, person.id);
  const hasContent = personHasContent(contributions, person);
  const role = roleTag(contributions, person);
  const spouse = person.spouse && byId(person.spouse);
  const photoInputRef = useRef(null);

  async function handlePhotoFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      onChangePhoto(person.id, dataUrl);
    } catch {
      // ignore unreadable file; input stays empty
    }
    e.target.value = "";
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel">
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="folio-band">
          <button type="button" className="avatar-edit-btn" onClick={() => photoInputRef.current?.click()} aria-label="Change profile photo">
            <PersonAvatar person={person} size={74} minGen={MIN_GEN} maxGen={MAX_GEN} variant="band" className="avatar" />
            <span className="avatar-edit-overlay"><EditPencilIcon /></span>
          </button>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoFile} />
          <h2>{person.name}</h2>
          <div className="role">{role || (spouse ? `m. ${spouse.name}` : "")} — {yearsLabel(person)}</div>
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
                  <div className="folio-section-head"><h4>Their experience</h4></div>
                  <div className="exp-grid">
                    {person.experience.map((e, i) => {
                      const key = `${person.id}:${i}`;
                      const isAudio = AUDIO_EXP_TYPES.includes(e.type) && !e.mediaUrl;
                      const playing = playingExp === key;
                      return (
                        <div key={i} className={`exp-card${playing ? " playing" : ""}${e.mediaUrl ? " has-media" : ""}`}>
                          {canModerate && (
                            <div className="exp-mod-actions">
                              <button type="button" className="icon-only" aria-label="Propose edit to this experience" onClick={() => onEdit({ field: `experience:${i}`, fieldLabel: "Experience caption", value: e.caption })}><EditPencilIcon /></button>
                              <button type="button" className="icon-only" aria-label="Remove this experience" onClick={() => onRemoveExperience(i)}>✕</button>
                            </div>
                          )}
                          <button
                            type="button"
                            className="exp-card-inner"
                            onClick={() => isAudio && onToggleExpPlay(key)}
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
                  </div>
                  <p className="form-hint">Cards with a photo show the real upload. Audio-type cards without one play a short illustrative sample.</p>
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
                    if (m.type === "photo" && m.content?.startsWith("data:")) {
                      return <div className="gallery-item has-photo" key={i}><img src={m.content} alt="" /></div>;
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
                  const isRealAudio = c.type === "audio" && c.content?.startsWith("blob:");
                  const isRealVideo = c.type === "video" && c.content?.startsWith("blob:");
                  return (
                    <div className="contrib-item" key={c.id} style={{ flexDirection: isRealAudio || isRealVideo ? "column" : "row", alignItems: "stretch" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div className="contrib-text">
                          {c.type === "edit" ? `Proposed change to ${c.fieldLabel}` : isRealAudio ? "Voice recording" : isRealVideo ? "Video recording" : (c.type === "memory" || c.type === "date" ? c.content : `[${c.type}] ${c.content}`)}
                          <span className="who">{c.contributor}</span>
                        </div>
                        <span className={`status-pill ${c.status}`}>{c.status}</span>
                      </div>
                      {isRealAudio && <audio src={c.content} controls style={{ width: "100%", marginTop: 8 }} />}
                      {isRealVideo && <video src={c.content} controls style={{ width: "100%", marginTop: 8, borderRadius: 8, maxHeight: 220 }} />}
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
    </div>
  );
}
