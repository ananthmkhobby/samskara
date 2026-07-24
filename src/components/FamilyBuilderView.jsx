import { useRef, useState } from "react";
import { makeNode, flattenFamily, countPeople, hydrateNode } from "../lib/familyBuilder";
import { updateNode, addChild, removeChild } from "../lib/familyTreeOps";
import { PEOPLE } from "../data/people";
import { bulkInsertFamily } from "../data/familyDb";
import { CURRENT_FAMILY_ID } from "../data/session";
import { callApi } from "../lib/apiFetch";
import FamilyNodeEditor from "./FamilyNodeEditor";

export default function FamilyBuilderView({ onNav }) {
  const [root, setRoot] = useState(null);
  const [starterName, setStarterName] = useState("");
  const [starterSpouse, setStarterSpouse] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const fileRef = useRef(null);

  // A one-time tool for populating a freshly-provisioned, currently-empty
  // family — once people already exist, ids are added one at a time (via
  // "+ Add son/daughter" from a Folio) instead, since this wizard's id
  // generation only avoids collisions within the tree it's building, not
  // against whatever's already saved.
  const alreadyHasPeople = PEOPLE.length > 0;

  function beginManually(e) {
    e.preventDefault();
    if (!starterName.trim()) return;
    const node = makeNode(starterName.trim(), starterSpouse.trim());
    setRoot(node);
  }

  async function handleScan(e) {
    const file = e.target.files[0];
    if (!file) return;
    setScanning(true);
    setScanError("");
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read that file."));
        reader.readAsDataURL(file);
      });
      const data = await callApi("/api/scan-family-tree", { image: dataUrl });
      setRoot(hydrateNode(data.tree));
    } catch (err) {
      setScanError(err.message || "Something went wrong reading that photo.");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleUpdate(key, patch) { setRoot((r) => updateNode(r, key, patch)); }
  function handleAddChild(key, child) { setRoot((r) => addChild(r, key, child)); }
  function handleRemove(key) { setRoot((r) => removeChild(r, key)); }

  async function handleSave() {
    const { people, marriages } = flattenFamily(root);
    if (!people.length) return;
    setSaving(true);
    setSaveError("");
    try {
      await bulkInsertFamily(CURRENT_FAMILY_ID, people, marriages);
      window.location.reload();
    } catch (err) {
      setSaveError(err.message);
      setSaving(false);
    }
  }

  if (alreadyHasPeople) {
    return (
      <section className="wrap fam-builder-intro">
        <div className="section-head">
          <h2>Your family tree already has people in it</h2>
          <p>This wizard is only for populating a brand-new, empty tree. To add more people, open anyone's folio and use "+ Add son or daughter" or "+ Add spouse" instead.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => onNav("tree")}>Go to the family tree →</button>
      </section>
    );
  }

  if (!root) {
    return (
      <section className="wrap fam-builder-intro">
        <div className="section-head">
          <h2>Start your family tree</h2>
          <p>Build your Vamsha Vruksha from scratch — no technical terms, just names. You'll start with a couple, then add their children one at a time, and each child's own children after that.</p>
        </div>
        <div className="fam-builder-paths">
          <form className="card fam-builder-path" onSubmit={beginManually}>
            <h3>Start by typing names</h3>
            <div className="form-row">
              <label>Who's the first person in this tree? (e.g. your grandparent)</label>
              <input type="text" placeholder="e.g. Ramaiah Gowda" value={starterName} onChange={(e) => setStarterName(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Their spouse's name (optional)</label>
              <input type="text" placeholder="e.g. Lakshmamma" value={starterSpouse} onChange={(e) => setStarterSpouse(e.target.value)} />
            </div>
            <button type="submit" className="btn primary" disabled={!starterName.trim()}>Begin building</button>
          </form>
          <div className="card fam-builder-path">
            <h3>Or scan a photo of an existing chart</h3>
            <p className="form-hint" style={{ marginTop: 0 }}>Already have a family tree drawn on paper or a photo of one? Upload it and AI will read the names and relationships to get you started — you'll still be able to fix anything it gets wrong before saving.</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleScan} disabled={scanning} />
            {scanning && <p className="form-hint">Reading the photo… this can take a moment.</p>}
            {scanError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{scanError}</p>}
          </div>
        </div>
      </section>
    );
  }

  const total = countPeople(root);

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>Build your family tree</h2>
        <p>Add a son or daughter under anyone, and their own children after that. Nothing is saved until you're ready — click "Save & view my family tree" whenever you want.</p>
      </div>
      <div className="fam-builder-toolbar">
        <span className="eyebrow tnum">{total} {total === 1 ? "person" : "people"} so far</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn ghost" onClick={() => setRoot(null)}>Start over</button>
          <button type="button" className="btn primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save & view my family tree"}</button>
        </div>
      </div>
      {saveError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{saveError}</p>}
      <FamilyNodeEditor node={root} depth={0} onUpdate={handleUpdate} onAddChild={handleAddChild} onRemove={handleRemove} />
    </section>
  );
}
