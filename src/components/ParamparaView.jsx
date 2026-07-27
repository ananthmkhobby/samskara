import { useEffect, useState } from "react";
import { PARAMPARA_CATEGORIES, categoryFor, parseParamparaContent, continuedForYears } from "../lib/parampara";
import { batchResolveMediaUrls } from "../lib/mediaUpload";
import PhotoLightbox from "./PhotoLightbox";
import HeritageIntro, { DiyaIcon } from "./HeritageIntro";

function LineageCard({ entry }) {
  const chain = parseParamparaContent(entry.content);
  const rows = [
    ["Gotra", chain.gotra], ["Pravara", chain.pravara], ["Veda", chain.veda],
    ["Shakha", chain.shakha], ["Family guru / mutt", chain.guru], ["Known generations", chain.generations],
  ].filter(([, v]) => v);
  if (!rows.length) return null;
  return (
    <div className="card parampara-lineage-card">
      <span className="eyebrow">🕉️ Veda Lineage</span>
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

function ParamparaCard({ entry, mediaUrl, onOpenPhoto }) {
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
        <span className="eyebrow">{cat.icon} {cat.label}</span>
        <h4>{entry.title}</h4>
        <p className="folio-summary">{description}</p>
        {years && <p className="parampara-continued">This has continued for {years} years.</p>}
        <p className="parampara-contributor">Shared by {entry.contributor}</p>
      </div>
    </div>
  );
}

export default function ParamparaView({ contributions, onContribute }) {
  const [urlMap, setUrlMap] = useState({});
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const verified = contributions.filter((c) => c.type === "parampara" && c.status === "Verified");
  const lineageEntry = [...verified].reverse().find((c) => c.field === "lineage");
  const entries = verified.filter((c) => c.field !== "lineage");
  const [filter, setFilter] = useState(null);
  const filtered = filter ? entries.filter((e) => e.field === filter) : entries;

  useEffect(() => {
    const paths = entries.map((e) => parseParamparaContent(e.content).mediaPath).filter(Boolean);
    if (!paths.length) return;
    batchResolveMediaUrls(paths).then(setUrlMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length]);

  return (
    <section className="wrap">
      <HeritageIntro icon={<DiyaIcon />} />
      <div className="section-head heritage-wipe">
        <span className="eyebrow parampara-eyebrow">✨ Parampara</span>
        <h2>Your family's living heritage</h2>
        <p>
          Not "what is your surname" — instead, what traditions survived because of your family? Every ritual, prayer,
          principle, and half-forgotten skill kept alive here becomes part of the record, once an Admin verifies it.
        </p>
      </div>

      {lineageEntry && (
        <div className="heritage-fade-up" style={{ "--enter-delay": "0.75s" }}>
          <LineageCard entry={lineageEntry} />
        </div>
      )}

      <div className="tag-row parampara-filters heritage-fade-up" style={{ marginTop: lineageEntry ? 18 : 0, "--enter-delay": "0.85s" }}>
        <button className={`chip${filter === null ? " active" : ""}`} onClick={() => setFilter(null)}>All</button>
        {PARAMPARA_CATEGORIES.map((c) => (
          <button key={c.key} className={`chip${filter === c.key ? " active" : ""}`} onClick={() => setFilter(c.key)}>{c.icon} {c.label}</button>
        ))}
      </div>

      <button type="button" className="btn primary parampara-cta heritage-fade-up" style={{ "--enter-delay": "0.92s" }} onClick={onContribute}>+ Share your family's Parampara</button>

      {filtered.length ? (
        <div className="parampara-grid">
          {filtered.map((e, i) => (
            <div key={e.id} className="heritage-fade-up" style={{ "--enter-delay": `${1 + Math.min(i, 6) * 0.08}s` }}>
              <ParamparaCard entry={e} mediaUrl={urlMap[parseParamparaContent(e.content).mediaPath]} onOpenPhoto={setLightboxSrc} />
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          {filter ? `Nothing under "${categoryFor(filter).label}" yet — be the first to add one.` : "Nothing recorded yet — be the first to share what's survived in your family."}
        </div>
      )}
      <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </section>
  );
}
