import { useEffect, useState } from "react";
import { PARAMPARA_CATEGORIES, categoryFor, parseParamparaContent, continuedForYears } from "../lib/parampara";
import { batchResolveMediaUrls } from "../lib/mediaUpload";
import { createContentShare } from "../data/familyDb";
import { CURRENT_FAMILY_ID, CURRENT_USER_ID } from "../data/session";
import PhotoLightbox from "./PhotoLightbox";
import HeritageIntro, { DiyaIcon } from "./HeritageIntro";
import { EditPencilIcon, CloseIcon } from "./Icons";
import { useModalA11y } from "../hooks/useModalA11y";

// A share code's whole content — title, story, since-year — travels; the
// photo doesn't, since mediaPath points at this family's own private
// Storage bucket, which the receiving family has no access to.
function ShareCodeModal({ state, onClose }) {
  const [copied, setCopied] = useState(false);
  const modalA11y = useModalA11y(onClose);
  if (!state) return null;
  async function copy() {
    try { await navigator.clipboard.writeText(state.code); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }} {...modalA11y}>
        <button className="modal-close on-paper" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        <div className="modal-body">
          {state.error ? (
            <>
              <h4 style={{ marginTop: 0 }}>Couldn't create that share</h4>
              <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{state.error}</p>
            </>
          ) : (
            <>
              <h4 style={{ marginTop: 0 }}>Share "{state.title}" with another family</h4>
              <p className="form-hint" style={{ marginTop: 0 }}>
                Send them this code. On their own Admin page, under "Import a shared story", they can turn it into a
                copy in their own archive — a photo attached here won't carry over, only the text.
              </p>
              <div className="tag-row" style={{ alignItems: "center", marginTop: 14 }}>
                <input type="text" readOnly value={state.code} style={{ flex: 1, fontSize: 18, letterSpacing: "0.06em", textAlign: "center" }} />
                <button type="button" className="btn small" onClick={copy}>{copied ? "Copied!" : "Copy"}</button>
              </div>
              <p className="form-hint">Works once, and expires in 30 days.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LineageCard({ entry, canModerate, onEdit }) {
  const chain = parseParamparaContent(entry.content);
  const rows = [
    ["Gotra", chain.gotra], ["Pravara", chain.pravara], ["Veda", chain.veda],
    ["Shakha", chain.shakha], ["Family guru / mutt", chain.guru], ["Known generations", chain.generations],
  ].filter(([, v]) => v);
  if (!rows.length) return null;
  return (
    <div className="card parampara-lineage-card">
      <div className="folio-section-head">
        <span className="eyebrow">🕉️ Veda Lineage</span>
        {canModerate && <button className="icon-only" aria-label="Edit lineage" onClick={() => onEdit(entry)}><EditPencilIcon /></button>}
      </div>
      <div className="lineage-chain">
        {rows.map(([label, value], i) => (
          <div className="lineage-row" key={label}>
            <div className="lineage-label">{label}</div>
            <div className="lineage-value">{value}</div>
            {i < rows.length - 1 && <div className="lineage-arrow">↓</div>}
          </div>
        ))}
      </div>
      <p className="form-hint" style={{ marginTop: 12 }}>Fine if parts are still unknown — this can be filled in gradually as the family reconstructs it.</p>
    </div>
  );
}

function ParamparaCard({ entry, mediaUrl, canModerate, onOpenPhoto, onEdit, onShare }) {
  const { description, sinceYear } = parseParamparaContent(entry.content);
  const cat = categoryFor(entry.field);
  const years = continuedForYears(sinceYear);
  return (
    <div className="card parampara-card">
      {mediaUrl && (
        <button type="button" className="parampara-photo-btn" onClick={() => onOpenPhoto(mediaUrl)} aria-label="View photo full screen">
          <img src={mediaUrl} alt={entry.title} className="parampara-photo" />
        </button>
      )}
      <div className="parampara-card-body">
        <div className="folio-section-head">
          <span className="eyebrow">{cat.icon} {cat.label}</span>
          {canModerate && (
            <span style={{ display: "flex", gap: 4 }}>
              <button className="icon-only" aria-label={`Share ${entry.title} with another family`} onClick={() => onShare(entry)}>🔗</button>
              <button className="icon-only" aria-label={`Edit ${entry.title}`} onClick={() => onEdit(entry)}><EditPencilIcon /></button>
            </span>
          )}
        </div>
        <h4>{entry.title}</h4>
        <p className="folio-summary">{description}</p>
        {years && <p className="parampara-continued">This has continued for {years} years.</p>}
        <p className="parampara-contributor">Shared by {entry.contributor}</p>
      </div>
    </div>
  );
}

export default function ParamparaView({ contributions, canModerate, onContribute, onEdit }) {
  const [urlMap, setUrlMap] = useState({});
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [shareModal, setShareModal] = useState(null);

  async function handleShare(entry) {
    try {
      const code = await createContentShare(CURRENT_FAMILY_ID, CURRENT_USER_ID, entry);
      setShareModal({ code, title: entry.title });
    } catch (err) {
      setShareModal({ error: err.message });
    }
  }
  const verified = contributions.filter((c) => c.type === "parampara" && c.status === "Verified");
  const lineageEntry = [...verified].reverse().find((c) => c.field === "lineage");
  const entries = verified.filter((c) => c.field !== "lineage");
  const [filter, setFilter] = useState(null);
  const filtered = filter ? entries.filter((e) => e.field === filter) : entries;

  // Keyed on the actual set of media paths (not entries.length, which
  // editing an entry in place never changes) — so replacing or adding a
  // photo on an existing entry re-resolves its URL instead of leaving the
  // new photo unresolved until something else happens to change the count.
  const mediaPathsKey = entries.map((e) => parseParamparaContent(e.content).mediaPath).filter(Boolean).join(",");
  useEffect(() => {
    if (!mediaPathsKey) return;
    batchResolveMediaUrls(mediaPathsKey.split(",")).then(setUrlMap);
  }, [mediaPathsKey]);

  return (
    <section className="wrap">
      <HeritageIntro icon={<DiyaIcon />} />
      <div className="section-head heritage-wipe">
        <span className="eyebrow parampara-eyebrow">✨ Parampare</span>
        <h2>Your family's living heritage</h2>
        <p>
          Not "what is your surname" — instead, what traditions survived because of your family? Every ritual, prayer,
          principle, and half-forgotten skill kept alive here becomes part of the record, once an Admin verifies it.
        </p>
      </div>

      {lineageEntry && (
        <div className="heritage-fade-up" style={{ "--enter-delay": "0.75s" }}>
          <LineageCard entry={lineageEntry} canModerate={canModerate} onEdit={onEdit} />
        </div>
      )}

      <div className="tag-row parampara-filters heritage-fade-up" style={{ marginTop: lineageEntry ? 18 : 0, "--enter-delay": "0.85s" }}>
        <button className={`chip${filter === null ? " active" : ""}`} onClick={() => setFilter(null)}>All</button>
        {PARAMPARA_CATEGORIES.map((c) => (
          <button key={c.key} className={`chip${filter === c.key ? " active" : ""}`} onClick={() => setFilter(c.key)}>{c.icon} {c.label}</button>
        ))}
      </div>

      <button type="button" className="btn primary parampara-cta heritage-fade-up" style={{ "--enter-delay": "0.92s" }} onClick={onContribute}>+ Share your family's Parampare</button>

      {filtered.length ? (
        <div className="parampara-grid">
          {filtered.map((e, i) => (
            <div key={e.id} className="heritage-fade-up" style={{ "--enter-delay": `${1 + Math.min(i, 6) * 0.08}s` }}>
              <ParamparaCard entry={e} mediaUrl={urlMap[parseParamparaContent(e.content).mediaPath]} canModerate={canModerate} onOpenPhoto={setLightboxSrc} onEdit={onEdit} onShare={handleShare} />
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          {filter ? `Nothing under "${categoryFor(filter).label}" yet — be the first to add one.` : "Nothing recorded yet — be the first to share what's survived in your family."}
        </div>
      )}
      <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      <ShareCodeModal state={shareModal} onClose={() => setShareModal(null)} />
    </section>
  );
}
