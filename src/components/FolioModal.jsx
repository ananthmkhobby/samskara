import { useRef, useState } from "react";
import { byId, yearsLabel, trustLabel, contributionsFor, verifiedMediaFor, personHasContent, roleTag, relationshipCaption, widowedLabel, mutualSpouse, formatName, MIN_GEN, MAX_GEN } from "../data/helpers";
import { MEDIA_ICONS, EXP_LABELS, ExpIcon, AUDIO_EXP_TYPES, EditPencilIcon, CloseIcon } from "./Icons";
import PersonAvatar from "./PersonAvatar";
import PhotoLightbox from "./PhotoLightbox";
import { resizeImage } from "../lib/imageResize";
import { uploadFamilyMedia, resolveMediaUrl } from "../lib/mediaUpload";
import { CURRENT_FAMILY_ID } from "../data/session";
import { useModalA11y } from "../hooks/useModalA11y";
import { supabase } from "../lib/supabaseClient";
import { SHOW_AI_FEATURES, SHOW_DATE_OF_DEATH } from "../lib/featureFlags";

// Anubhava Chitrashale ("their room") is built and working, but held back
// from release for now — flip this back on when it's ready to ship. Kept
// mounted-but-unused rather than deleted, same as SHOW_BANYAN_TOGGLE in
// TreeView.jsx.
export const SHOW_CHITRASHALE = false;

export default function FolioModal({ person, contributions, onClose, onEdit, onShare, onOpenBiography, onChangePhoto, onAddFamily, onOpenInterview, onOpenVoiceWizard, onOpenRoom, hasRoomObjects, playingExp, onToggleExpPlay, canModerate, onRemoveExperience, onDeleteContribution, onSelectPerson }) {
  const modalA11y = useModalA11y(onClose);
  const contribs = contributionsFor(contributions, person.id);
  const media = verifiedMediaFor(contributions, person.id);
  const hasContent = personHasContent(contributions, person);
  const role = roleTag(contributions, person);
  const spouse = mutualSpouse(person);
  const relationship = relationshipCaption(person);
  const widowed = widowedLabel(person);
  const photoInputRef = useRef(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [expCollapsed, setExpCollapsed] = useState(false);
  // Starts collapsed once the list is long enough to be worth collapsing —
  // short lists (a handful of entries) just stay open, nothing to hide.
  // Opposite default from "Their experience" above, which starts open:
  // that section is the point of the Folio, this one is a log.
  const [contribsCollapsed, setContribsCollapsed] = useState(contribs.length > 4);
  const hasPhoto = !!person.photoUrl;
  const [pdfDownloading, setPdfDownloading] = useState(false);

  async function handleDownloadPdf() {
    setPdfDownloading(true);
    try {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const res = await fetch("/api/photobook-person", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ familyId: CURRENT_FAMILY_ID, personId: person.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Couldn't generate the PDF.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${person.name.replace(/\s+/g, "-").toLowerCase()}-folio.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || "Couldn't generate the PDF.");
    } finally {
      setPdfDownloading(false);
    }
  }

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
      <div className="modal-panel" {...modalA11y}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        <div className="folio-band">
          <div className="avatar-wrap">
            <button
              type="button"
              className="avatar-view-btn"
              onClick={() => (hasPhoto ? setLightboxSrc(person.photoUrl) : photoInputRef.current?.click())}
              aria-label={hasPhoto ? `View ${person.name}'s photo` : "Add profile photo"}
            >
              <PersonAvatar person={person} size={96} minGen={MIN_GEN} maxGen={MAX_GEN} variant="band" className="avatar" />
            </button>
            <button type="button" className="avatar-edit-fab" onClick={() => photoInputRef.current?.click()} aria-label="Change profile photo">
              <EditPencilIcon />
            </button>
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoFile} />
          <h2 className="folio-name-line">
            {formatName(person)}
            <button
              type="button" className="folio-name-edit"
              aria-label={`Edit ${person.name}'s name`}
              onClick={() => onEdit({ field: "name", fieldLabel: "Name", value: person.name })}
            >
              <EditPencilIcon />
            </button>
          </h2>
          <div className="role">{role || (spouse ? `m. ${formatName(spouse)}` : "")} — {yearsLabel(person)}</div>
          {(relationship || widowed) && (
            <div className="relationship">{[relationship, widowed].filter(Boolean).join(" · ")}</div>
          )}
          <div className="folio-badges">
            <button
              type="button" className={`trust ${person.trust}`}
              aria-label={`Change how certain ${person.name}'s record is — currently ${trustLabel(person.trust)}`}
              onClick={() => onEdit({ field: "trust", fieldLabel: "How certain is this record?", value: person.trust || "approx" })}
            >
              {trustLabel(person.trust)}
            </button>
          </div>
        </div>
        <div className="modal-body">
          <button type="button" className="interview-cta wizard-cta" onClick={onOpenVoiceWizard}>
            <span className="interview-cta-icon">🗣️</span>
            <span>
              <b>Fill in {person.name.split(" ")[0]}'s profile by voice</b>
              <span className="interview-cta-sub">A few quick spoken questions — heritage, life lesson, summary, places. Skip anything, pick up later.</span>
            </span>
          </button>
          {SHOW_AI_FEATURES && (
            <button type="button" className="interview-cta" onClick={onOpenInterview}>
              <span className="interview-cta-icon">🎙️</span>
              <span>
                <b>Record {person.name.split(" ")[0]}'s story, AI-guided</b>
                <span className="interview-cta-sub">A few spoken questions — the AI drafts a biography chapter from the conversation</span>
              </span>
            </button>
          )}
          {SHOW_CHITRASHALE && (
            <button type="button" className="interview-cta room-cta" onClick={onOpenRoom}>
              <span className="interview-cta-icon">🪔</span>
              <span>
                <b>{hasRoomObjects ? `Step into ${person.name.split(" ")[0]}'s room` : `Enter ${person.name.split(" ")[0]}'s room`}</b>
                <span className="interview-cta-sub">{hasRoomObjects ? "A small room furnished with objects that carry a memory." : "Be the first to begin their room."}</span>
              </span>
            </button>
          )}
          <div className="folio-section">
            <div className="folio-section-head">
              <h4>Date of birth</h4>
              <button className="icon-only" aria-label="Edit date of birth" onClick={() => onEdit({ field: "born", fieldLabel: "Date of birth", value: person.born || "" })}><EditPencilIcon /></button>
            </div>
            {person.born ? (
              <p className="folio-summary">
                {person.bornYearOnly
                  ? `Known only as ${person.born.slice(0, 4)}`
                  : new Date(`${person.born}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            ) : <p className="form-hint" style={{ marginTop: 0 }}>Not on record yet — add it if you know it, even just the year.</p>}
          </div>
          {/* Always rendered, same as Date of birth above — it used to only
              show once died/diedUnknown was already true, which meant the
              edit button (the only way to set either) was never reachable
              for someone who didn't already have death info on record. The
              edit button itself stays admin/head-only, unlike every other
              field here: marking someone deceased (and so showing "Late"
              everywhere) is weightier than most edits, so it's deliberately
              not left to a Pending-review proposal from any member. */}
          {SHOW_DATE_OF_DEATH && (
            <div className="folio-section">
              <div className="folio-section-head">
                <h4>Date of death</h4>
                {canModerate && (
                  <button className="icon-only" aria-label="Edit date of death" onClick={() => onEdit({ field: "died", fieldLabel: "Date of death", value: person.died || "", diedUnknown: person.diedUnknown || false })}><EditPencilIcon /></button>
                )}
              </div>
              {person.diedUnknown ? (
                <p className="folio-summary">Passed away — exact date not known</p>
              ) : person.died ? (
                <p className="folio-summary">
                  {person.diedYearOnly
                    ? `Known only as ${person.died.slice(0, 4)}`
                    : new Date(`${person.died}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              ) : <p className="form-hint" style={{ marginTop: 0 }}>Not on record yet.</p>}
            </div>
          )}
          <div className="folio-section">
            <div className="folio-section-head">
              <h4>Heritage details</h4>
              <button className="icon-only" aria-label="Edit heritage details" onClick={() => onEdit({ field: "heritage", fieldLabel: "Rashi & gotra", rashi: person.rashi || "", gotra: person.gotra || "", birthGotra: person.birthGotra || "" })}><EditPencilIcon /></button>
            </div>
            {person.rashi || person.gotra || person.birthGotra ? (
              <div className="tag-row">
                {person.rashi && <span className="tag">Rashi: {person.rashi}</span>}
                {person.gotra && <span className="tag">Gotra: {person.gotra}</span>}
                {person.birthGotra && <span className="tag">Birth gotra: {person.birthGotra}</span>}
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
            <div className="folio-section-head"><h4>Migration path</h4></div>
            {person.geoStops?.length ? (
              <div className="tag-row" style={{ marginBottom: 10 }}>
                {person.geoStops.map((s, i) => (
                  <span key={i} className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {s.place}
                    <button
                      type="button" className="tag-remove-btn" aria-label={`Remove ${s.place} from their migration path`}
                      style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "inherit", display: "inline-flex" }}
                      onClick={() => onEdit({ field: "geoStops", fieldLabel: `Remove ${s.place} from their migration path`, stops: person.geoStops, removeIndex: i })}
                    >
                      <CloseIcon />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="form-hint" style={{ marginTop: 0 }}>
                No earlier stops on record — add each place they lived before their current city, oldest first, to
                draw their migration route on the family's Journey map.
              </p>
            )}
            <button
              type="button" className="btn small ghost"
              onClick={() => onEdit({ field: "geoStops", fieldLabel: "Add a stop to their migration path", stops: person.geoStops || [] })}
            >
              + Add a stop
            </button>
          </div>
          <div className="folio-section">
            <div className="folio-section-head"><h4>Family</h4></div>
            {/* Shows who's already linked before offering to add more — without
                this, there was no way to tell from a person's own Folio which
                recorded parent belongs to which side of the family (the app
                deliberately doesn't track gender, so "Father"/"Mother" labels
                aren't guessed — the name itself is what disambiguates). */}
            {(person.parents?.length > 0 || spouse) && (
              <div className="tag-row" style={{ marginBottom: 10 }}>
                {person.parents?.map((pid) => {
                  const parent = byId(pid);
                  if (!parent) return null;
                  return (
                    <button key={pid} type="button" className="tag" style={{ font: "inherit", cursor: "pointer" }} onClick={() => onSelectPerson?.(pid)}>
                      Parent: {formatName(parent)}
                    </button>
                  );
                })}
                {spouse && (
                  <button type="button" className="tag" style={{ font: "inherit", cursor: "pointer" }} onClick={() => onSelectPerson?.(spouse.id)}>
                    Spouse: {formatName(spouse)}
                  </button>
                )}
              </div>
            )}
            <div className="tag-row">
              <button type="button" className="btn small ghost" onClick={() => onAddFamily("child")}>+ Add son or daughter</button>
              {!person.spouse && <button type="button" className="btn small ghost" onClick={() => onAddFamily("spouse")}>+ Add spouse</button>}
              {!person.parents?.length && <button type="button" className="btn small ghost" onClick={() => onAddFamily("parent")}>+ Add parent</button>}
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
                              <button type="button" className="icon-only" aria-label="Remove this experience" onClick={() => onRemoveExperience(e.id)}><CloseIcon /></button>
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
                <button
                  type="button"
                  className="folio-section-head collapsible"
                  onClick={() => setContribsCollapsed((c) => !c)}
                  aria-expanded={!contribsCollapsed}
                >
                  <h4>Contributions ({contribs.length})</h4>
                  <span className={`collapse-chevron${contribsCollapsed ? " collapsed" : ""}`}>▾</span>
                </button>
                {!contribsCollapsed && (contribs.length ? contribs.map((c) => {
                  const isRealAudio = c.type === "audio" && !!c.mediaUrl;
                  const isRealVideo = c.type === "video" && !!c.mediaUrl;
                  const isRealDocument = c.type === "document" && !!c.mediaUrl;
                  const isRealPhoto = c.type === "photo" && !!c.mediaUrl;
                  const isFromWhatsApp = c.source === "whatsapp";
                  return (
                    <div className="contrib-item" key={c.id} style={{ flexDirection: isRealAudio || isRealVideo ? "column" : "row", alignItems: "stretch" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div className="contrib-text">
                          {c.type === "edit" ? `Proposed change to ${c.fieldLabel}`
                            : isRealAudio ? "Voice recording"
                            : isRealVideo ? "Video recording"
                            : isRealPhoto
                              ? <button type="button" className="link-btn" style={{ font: "inherit" }} onClick={() => setLightboxSrc(c.mediaUrl)}>📷 Photo</button>
                              : isRealDocument
                              ? <a href={c.mediaUrl} target="_blank" rel="noreferrer">📄 {c.title || "Document"}</a>
                              : (c.type === "memory" || c.type === "date" ? c.content
                                : c.type === "document" ? `📄 ${c.title || "Document"} — wasn't saved; ask them to upload it again`
                                : c.type === "photo" ? "📷 Photo — wasn't saved; ask them to send it again"
                                : `[${c.type}] ${c.content}`)}
                          <span className="who">{c.contributor}{isFromWhatsApp ? " · via WhatsApp" : ""}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
                          <span className={`status-pill ${c.status}`}>{c.status}</span>
                          {/* WhatsApp content specifically — not every contribution — since
                              that's the source that mixes casual sends in among formal edits
                              and is the one an admin needs a quick way to clean up, even
                              after it's already verified and showing on the folio. */}
                          {canModerate && isFromWhatsApp && (
                            <button
                              type="button" className="icon-only" aria-label="Delete this WhatsApp contribution"
                              onClick={() => onDeleteContribution(c)}
                            >
                              <CloseIcon />
                            </button>
                          )}
                        </div>
                      </div>
                      {isRealAudio && <audio src={c.mediaUrl} controls style={{ width: "100%", marginTop: 8 }} />}
                      {isRealVideo && <video src={c.mediaUrl} controls style={{ width: "100%", marginTop: 8, borderRadius: 8, maxHeight: 220 }} />}
                    </div>
                  );
                }) : <div className="empty-state">No contributions yet.</div>)}
              </div>
            </>
          ) : (
            <div className="folio-section unwritten">
              <span className="eyebrow">Unwritten leaf</span>
              <p style={{ marginTop: 10 }}>{formatName(person)}'s story hasn't been told yet. Be the first to add a memory, photo, or date.</p>
              <button className="btn primary small" onClick={() => onShare(person.id)}>Share what you know</button>
            </div>
          )}
          <div className="folio-actions">
            <button className="btn" onClick={() => onShare(person.id)}>Share what you know</button>
            <button className="btn primary" onClick={onOpenBiography}>Open full biography</button>
            <button className="btn ghost" onClick={handleDownloadPdf} disabled={pdfDownloading}>{pdfDownloading ? "Preparing PDF…" : "Download PDF"}</button>
          </div>
        </div>
      </div>
      <PhotoLightbox src={lightboxSrc} alt={person.name} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
