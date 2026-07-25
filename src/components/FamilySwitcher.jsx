import { useEffect, useRef, useState } from "react";
import { CURRENT_FAMILY_ID, CURRENT_FAMILY_NAME, CURRENT_ROLE, MY_FAMILIES } from "../data/session";
import { switchFamily } from "../data/familyDb";
import { supabase } from "../lib/supabaseClient";

const ROLE_LABELS = { head: "Family Head", admin: "Admin", member: "Member" };

async function handleSignOut() {
  await supabase?.auth.signOut();
  window.location.reload();
}

export default function FamilySwitcher({ onJoinAnother }) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function handleSwitch(familyId) {
    if (familyId === CURRENT_FAMILY_ID || switching) return;
    setSwitching(true);
    setError("");
    try {
      await switchFamily(familyId);
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setSwitching(false);
    }
  }

  return (
    <div className="family-switcher" ref={ref}>
      <button type="button" className="family-switcher-trigger" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="role-badge">{ROLE_LABELS[CURRENT_ROLE] || "Member"}</span>
        <span className="family-switcher-name">{CURRENT_FAMILY_NAME || "Family"}</span>
        {MY_FAMILIES.length > 1 && <span className={`collapse-chevron${open ? "" : " collapsed"}`}>▾</span>}
      </button>
      {open && (
        <div className="family-switcher-menu">
          {MY_FAMILIES.map((f) => (
            <button
              type="button"
              key={f.familyId}
              className={`family-switcher-item${f.familyId === CURRENT_FAMILY_ID ? " active" : ""}`}
              onClick={() => handleSwitch(f.familyId)}
              disabled={switching}
            >
              <span className="family-switcher-check">{f.familyId === CURRENT_FAMILY_ID ? "✓" : ""}</span>
              {f.familyName}
            </button>
          ))}
          {error && <p className="form-hint" style={{ color: "var(--maroon-ink)", padding: "0 14px" }}>{error}</p>}
          <div className="family-switcher-divider" />
          <button type="button" className="family-switcher-item" onClick={() => { setOpen(false); onJoinAnother(); }}>+ Join another family</button>
          <div className="family-switcher-divider" />
          <button type="button" className="family-switcher-item" onClick={handleSignOut}>Sign out</button>
        </div>
      )}
    </div>
  );
}
