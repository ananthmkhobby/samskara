import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "./Icons";
import { useModalA11y } from "../hooks/useModalA11y";
import { PEOPLE } from "../data/people";
import { CURRENT_FAMILY_ID, CURRENT_USER_ID, IS_DEMO } from "../data/session";
import { fetchPhotoTags, addPhotoTag, deletePhotoTag } from "../data/familyDb";

// Shared full-screen viewer for any already-uploaded photo — the Folio
// profile photo, "Their Experience" cards, the Media gallery, the family
// logo, and Parampara entries all open the same lightbox rather than each
// building their own overlay. Tapping the backdrop or the close button
// minimises it back to whatever grid/thumbnail it was opened from; tapping
// the image itself toggles between "fit to screen" and its true resolution
// (scrollable) so a photo with fine detail can actually be zoomed into.
//
// `contributionId`, if passed, additionally turns on photo tagging — point
// at a spot in the photo and label who's there, either an existing family
// member or free text for someone not identified yet (see
// supabase/migrations/20261028150000_photo_tags.sql). Every other caller
// (Folio, Experience cards, the family logo, Parampara) just omits it and
// gets the exact same lightbox as before — tagging only makes sense for an
// actual family photo, not a logo or a document scan.
export default function PhotoLightbox({ src, alt, onClose, contributionId }) {
  const [zoomed, setZoomed] = useState(false);
  const [tags, setTags] = useState([]);
  const [tagging, setTagging] = useState(false);
  const [draftTag, setDraftTag] = useState(null); // { x, y } while the picker is open
  const [openTagId, setOpenTagId] = useState(null); // which existing tag's bubble is showing
  const [picked, setPicked] = useState("");
  const [freeLabel, setFreeLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const imgRef = useRef(null);

  // A fresh photo should always open fitted, not still zoomed from
  // whichever photo was open before it.
  useEffect(() => {
    setZoomed(false);
    setTagging(false);
    setDraftTag(null);
    setOpenTagId(null);
  }, [src]);

  useEffect(() => {
    if (!contributionId) { setTags([]); return; }
    let cancelled = false;
    fetchPhotoTags(contributionId).then((rows) => { if (!cancelled) setTags(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, [contributionId]);

  const modalA11y = useModalA11y(onClose);
  const sortedPeople = [...PEOPLE].sort((a, b) => a.name.localeCompare(b.name));
  const canTag = !!contributionId && !IS_DEMO && !!CURRENT_USER_ID;

  if (!src) return null;

  function handleImageClick(e) {
    e.stopPropagation();
    if (zoomed) { setZoomed(false); return; }
    if (!tagging) { setZoomed(true); return; }
    // Tagging mode: a click drops a new marker instead of zooming — exact
    // percentage position within the image's own rendered bounds, which
    // (in unzoomed/"fit" mode, the only mode tagging is offered in) is
    // exactly the visible photo with no letterboxing to account for.
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOpenTagId(null);
    setDraftTag({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    setPicked("");
    setFreeLabel("");
    setError("");
  }

  async function saveDraftTag() {
    if (!picked && !freeLabel.trim()) { setError("Pick someone, or type a name."); return; }
    setSaving(true);
    setError("");
    try {
      const saved = await addPhotoTag(CURRENT_FAMILY_ID, CURRENT_USER_ID, {
        contributionId, personId: picked || null, label: picked ? null : freeLabel, x: draftTag.x, y: draftTag.y,
      });
      setTags((t) => [...t, saved]);
      setDraftTag(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeTag(id) {
    try {
      await deletePhotoTag(id);
      setTags((t) => t.filter((tg) => tg.id !== id));
      setOpenTagId(null);
    } catch { /* leave the marker up — RLS already prevents anyone but the owner/a moderator from actually deleting it */ }
  }

  function tagName(tag) {
    if (tag.person_id) return sortedPeople.find((p) => p.id === tag.person_id)?.name || "Someone";
    return tag.label;
  }

  return (
    <div className={`photo-lightbox${zoomed ? " is-zoomed" : ""}`} onClick={onClose} {...modalA11y}>
      <button className="modal-close" onClick={onClose} aria-label="Minimise"><CloseIcon /></button>
      <div className="photo-lightbox-frame" onClick={(e) => e.stopPropagation()}>
        <img
          ref={imgRef}
          src={src}
          alt={alt || ""}
          className={zoomed ? "is-zoomed" : ""}
          onClick={handleImageClick}
        />
        {!zoomed && tags.map((tag) => (
          <button
            type="button" key={tag.id} className="photo-tag-marker"
            style={{ left: `${tag.x}%`, top: `${tag.y}%` }}
            onClick={(e) => { e.stopPropagation(); setOpenTagId((id) => (id === tag.id ? null : tag.id)); }}
            aria-label={tagName(tag)}
          >
            <span className="photo-tag-dot" />
            {openTagId === tag.id && (
              <span className="photo-tag-bubble" onClick={(e) => e.stopPropagation()}>
                {tagName(tag)}
                {tag.created_by === CURRENT_USER_ID && (
                  <button type="button" className="photo-tag-remove" onClick={() => removeTag(tag.id)} aria-label="Remove tag">×</button>
                )}
              </span>
            )}
          </button>
        ))}
        {draftTag && (
          <div
            className="photo-tag-bubble photo-tag-draft"
            style={{ left: `${draftTag.x}%`, top: `${draftTag.y}%` }}
            onClick={(e) => e.stopPropagation()}
          >
            <select value={picked} onChange={(e) => { setPicked(e.target.value); setFreeLabel(""); }}>
              <option value="">Who is this?</option>
              {sortedPeople.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}
            </select>
            <input
              type="text" placeholder="Not listed? Type a name"
              value={freeLabel} disabled={!!picked}
              onChange={(e) => setFreeLabel(e.target.value)}
            />
            {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
            <div className="tag-row">
              <button type="button" className="btn small primary" disabled={saving} onClick={saveDraftTag}>{saving ? "Saving…" : "Save"}</button>
              <button type="button" className="btn small ghost" disabled={saving} onClick={() => setDraftTag(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      {canTag && !zoomed && (
        <button
          type="button" className={`photo-tag-toggle${tagging ? " active" : ""}`}
          onClick={(e) => { e.stopPropagation(); setTagging((t) => !t); setDraftTag(null); }}
        >
          {tagging ? "Done tagging" : "+ Tag someone"}
        </button>
      )}
    </div>
  );
}
