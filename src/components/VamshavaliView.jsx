import { useMemo, useState } from "react";
import { PEOPLE, MIN_GEN } from "../data/people";
import { CURRENT_FAMILY_ID, MY_PERSON_ID } from "../data/session";
import { buildVamshavali } from "../lib/vamshavali";
import { supabase } from "../lib/supabaseClient";
import { useModalA11y } from "../hooks/useModalA11y";
import { CloseIcon } from "./Icons";

const ROW_LABELS = { alive: "Alive", departed: "Departed", unknown: "Unknown" };

function VamshavaliRow({ row }) {
  if (row.unresolved) {
    return (
      <div className="vamshavali-row vamshavali-row-unresolved">
        <div className="vamshavali-row-term">
          <span className="vamshavali-term-kn">{row.kannadaTerm}</span>
          <span className="vamshavali-term-en">{row.englishTerm}</span>
        </div>
        <span className="vamshavali-row-unknown">Not yet recorded</span>
      </div>
    );
  }
  if (row.noneFound) {
    return (
      <div className="vamshavali-row vamshavali-row-unresolved">
        <div className="vamshavali-row-term">
          <span className="vamshavali-term-kn">{row.kannadaTerm}</span>
          <span className="vamshavali-term-en">{row.englishTerm}</span>
        </div>
        <span className="vamshavali-row-unknown">None recorded</span>
      </div>
    );
  }
  const status = row.isAlive ? ROW_LABELS.alive : ROW_LABELS.departed;
  return (
    <div className="vamshavali-row">
      <div className="vamshavali-row-term">
        <span className="vamshavali-term-kn">{row.kannadaTerm}</span>
        <span className="vamshavali-term-en">{row.englishTerm}</span>
      </div>
      <span className="vamshavali-row-name">{row.name === null ? "ಇದ್ದಾರೆ (alive)" : row.name}</span>
      <span className={`vamshavali-row-status status-${status.toLowerCase()}`}>{status}</span>
      <span className="vamshavali-row-gotra">{row.gotra || "—"}</span>
      <span className="vamshavali-row-rashi">{row.rashi || "—"}</span>
    </div>
  );
}

export default function VamshavaliView({ onClose }) {
  const modalA11y = useModalA11y(onClose);
  const [egoId, setEgoId] = useState(MY_PERSON_ID || PEOPLE[0]?.id || null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const vamshavali = useMemo(() => (egoId ? buildVamshavali(egoId, PEOPLE, "pitru") : { ego: null, sections: [] }), [egoId]);

  // Grouped oldest generation first — a big family's person list is
  // otherwise one long flat alphabetical list with no sense of who's an
  // elder vs. a grandchild, which made picking an older relative as the
  // subject slower than it should be.
  const peopleByGen = useMemo(() => {
    const byGen = new Map();
    for (const p of PEOPLE) {
      if (!byGen.has(p.gen)) byGen.set(p.gen, []);
      byGen.get(p.gen).push(p);
    }
    return [...byGen.keys()].sort((a, b) => a - b).map((gen) => ({
      gen, people: byGen.get(gen).slice().sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, []);

  async function handleDownload() {
    setDownloading(true);
    setDownloadError("");
    try {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const res = await fetch("/api/photobook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ action: "vamshavali", familyId: CURRENT_FAMILY_ID, personId: egoId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Couldn't generate the Vamshavali.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(vamshavali.ego?.name || "vamshavali").replace(/\s+/g, "-").toLowerCase()}-vamshavali.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel vamshavali-modal" onClick={(e) => e.stopPropagation()} {...modalA11y}>
        <button className="modal-close on-paper" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        <div className="modal-body">
          <span className="eyebrow">ವಂಶಾವಳಿ — Vamshavali</span>
          <h4 style={{ marginTop: 4 }}>Pitru form</h4>
          <p className="form-hint" style={{ marginTop: 0 }}>
            The ritual convention: only those who have passed are named, by relationship and gotra. Anyone still living
            is simply marked ಇದ್ದಾರೆ (alive), the same way this document has traditionally been kept.
          </p>

          <div className="form-row">
            <label>For whom</label>
            <select value={egoId || ""} onChange={(e) => setEgoId(e.target.value)}>
              {peopleByGen.map(({ gen, people }) => (
                <optgroup key={gen} label={`Generation ${gen - MIN_GEN + 1}`}>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {vamshavali.sections.map((section) => (
            <div key={section.key} className="vamshavali-section">
              <div className="vamshavali-section-head">
                <span className="vamshavali-section-title-kn">{section.title}</span>
                <span className="vamshavali-section-title-en">{section.titleEnglish}</span>
              </div>
              {section.rows.map((row, i) => <VamshavaliRow key={i} row={row} />)}
            </div>
          ))}

          <p className="form-hint" style={{ marginTop: 4 }}>
            Rows marked "Not yet recorded" are missing a link somewhere in the chain — most often because no one's
            gender is on record for that parent pair yet. A way to ask the family for this is coming soon; for now,
            an Admin can set it quickly for everyone at once under Admin → Genders, or one person at a time from
            their own Folio.
          </p>

          {downloadError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{downloadError}</p>}
          <button type="button" className="btn primary" disabled={downloading || !egoId} onClick={handleDownload} style={{ marginTop: 10 }}>
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
