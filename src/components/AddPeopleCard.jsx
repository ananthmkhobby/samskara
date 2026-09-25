import { useRef, useState } from "react";
import { PEOPLE } from "../data/people";
import { CURRENT_FAMILY_ID } from "../data/session";
import { bulkInsertFamily, linkExistingSpouses } from "../data/familyDb";
import { downloadTemplate, parseTemplateWorkbook } from "../lib/familyTemplate";

// The bulk-upload path in FamilyBuilderView only ever worked once, on a
// completely empty tree (PEOPLE.length > 0 replaced the whole wizard with a
// dead end) — so a family that imported 40 people from one branch had no way
// to bring in another 30 from a second spreadsheet later. This card is that
// second path: same downloadable template (unchanged — it's already been
// shared with families, so the columns, sheet name and instructions here are
// deliberately identical to FamilyBuilderView's), but the parser and insert
// both know how to attach new rows onto people who already exist.
export default function AddPeopleCard() {
  const [showIds, setShowIds] = useState(false);
  const [preview, setPreview] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const fileRef = useRef(null);

  const existingPeople = PEOPLE.map((p) => ({ id: p.id, name: p.name, gen: p.gen, spouse: p.spouse }));

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPreview(null);
    setImportError("");
    setParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = await parseTemplateWorkbook(buffer, existingPeople);
      setPreview(result);
    } catch (err) {
      setPreview({ people: [], marriages: [], spouseLinks: [], errors: [err.message || "Couldn't read that file — make sure it's the downloaded template."], warnings: [] });
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!preview?.people.length || preview.errors.length) return;
    setImporting(true);
    setImportError("");
    try {
      await bulkInsertFamily(CURRENT_FAMILY_ID, preview.people, preview.marriages, PEOPLE.length);
      await linkExistingSpouses(CURRENT_FAMILY_ID, preview.spouseLinks);
      window.location.reload();
    } catch (err) {
      // People rows land first and marriages/spouse-links after — a failure
      // here means the new people are already saved, so the message says so
      // rather than implying the whole import can just be retried from zero.
      setImportError(`${err.message} — some or all of the new people may already be saved; check the tree before re-uploading.`);
      setImporting(false);
    }
  }

  const newCount = preview?.people.length ?? 0;
  const genCount = preview ? new Set(preview.people.map((p) => p.gen)).size : 0;
  const linkCount = preview?.spouseLinks.length ?? 0;

  return (
    <div className="card" style={{ padding: 18, marginBottom: 18 }}>
      <h4 style={{ fontSize: 15, marginBottom: 4 }}>Add more people from a spreadsheet</h4>
      <p className="form-hint" style={{ marginTop: 0, marginBottom: 10 }}>
        For bringing in another branch — your mother's side, a cousin's family — after the tree already has people in
        it. New rows can name someone already in your tree as a parent or spouse to attach onto them.
      </p>

      <button type="button" className="link-btn" onClick={() => setShowIds((s) => !s)} style={{ marginBottom: 10 }}>
        {showIds ? "Hide" : "See"} your current family's Person IDs →
      </button>
      {showIds && (
        <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, background: "var(--parchment)" }}>
          {existingPeople.length ? existingPeople.map((p) => (
            <div key={p.id} style={{ fontSize: 13, padding: "3px 0", display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span>{p.name}</span>
              <code style={{ color: "var(--ink-faint)" }}>{p.id}</code>
            </div>
          )) : <span className="form-hint">Nobody in the tree yet.</span>}
        </div>
      )}

      <button type="button" className="btn small" onClick={downloadTemplate} style={{ marginBottom: 12 }}>
        Download template (.xlsx)
      </button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} disabled={parsing || importing} />
      {parsing && <p className="form-hint">Reading the file… looking up any cities, this can take a few seconds.</p>}

      {preview && (
        <div style={{ marginTop: 12 }}>
          {preview.errors.length > 0 ? (
            <>
              <p className="form-hint" style={{ color: "var(--maroon-ink)", fontWeight: 700 }}>Fix these in the file and re-upload:</p>
              <ul className="form-hint" style={{ color: "var(--maroon-ink)", marginTop: 4, paddingLeft: 18 }}>
                {preview.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </>
          ) : (
            <>
              <p className="form-hint">
                Found <strong>{newCount}</strong> new {newCount === 1 ? "person" : "people"} across <strong>{genCount}</strong> generation{genCount === 1 ? "" : "s"}
                {linkCount > 0 && <>, <strong>{linkCount}</strong> {linkCount === 1 ? "of them marrying" : "of them marrying"} someone already in your tree</>}.
              </p>
              {preview.warnings.length > 0 && (
                <ul className="form-hint" style={{ marginTop: 4, paddingLeft: 18 }}>
                  {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
              <button type="button" className="btn primary small" onClick={handleImport} disabled={importing} style={{ marginTop: 8 }}>
                {importing ? "Importing…" : `Add ${newCount} ${newCount === 1 ? "person" : "people"}`}
              </button>
            </>
          )}
        </div>
      )}
      {importError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{importError}</p>}
    </div>
  );
}
