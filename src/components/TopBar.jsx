import { TreeIcon, TreasuryIcon, VaultIcon, MapIcon, AdminIcon } from "./NavIcons";
import { IS_DEMO, CURRENT_ROLE } from "../data/session";
import { supabase } from "../lib/supabaseClient";

const TABS = [
  { key: "tree", label: "Tree", Icon: TreeIcon },
  { key: "treasury", label: "Treasury", Icon: TreasuryIcon },
  { key: "vault", label: "Vault", Icon: VaultIcon },
  { key: "map", label: "Journey", Icon: MapIcon }
];

const ROLE_LABELS = { head: "Family Head", admin: "Admin", member: "Member" };

// Reloads on sign-out so the boot sequence (data/people.js's initDataLayer)
// re-resolves the session fresh and falls back to the logged-out/demo view —
// the same "reload to pick up new state" pattern the rest of the app uses
// for anything auth- or family-affecting.
async function handleSignOut() {
  await supabase?.auth.signOut();
  window.location.reload();
}

export default function TopBar({ view, onNav, pendingCount }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={() => onNav("cover")} aria-label="Return to cover">
        <span className="brand-mark" />
        <span className="brand-text"><b>संस्कार वंश वृक्ष</b><span>Samskara Vamsha Vruksha</span></span>
      </button>
      <nav className="nav-tabs">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} className={view === key ? "active" : ""} onClick={() => onNav(key)}><Icon />{label}</button>
        ))}
      </nav>
      <div className="topbar-actions">
        <button className="icon-only" style={{ width: 34, height: 34 }} onClick={() => onNav("help")} aria-label="Help">?</button>
        {IS_DEMO ? (
          <button className="btn small ghost" onClick={() => onNav("cover")}>Log in</button>
        ) : (
          <div className="account-menu">
            <span className="role-badge">{ROLE_LABELS[CURRENT_ROLE] || "Member"}</span>
            <button className="btn small ghost" onClick={handleSignOut}>Sign out</button>
          </div>
        )}
        <button className="icon-btn" onClick={() => onNav("admin")}>
          <AdminIcon />Admin
          {pendingCount > 0 && <span className="badge-count">{pendingCount}</span>}
        </button>
      </div>
    </header>
  );
}
