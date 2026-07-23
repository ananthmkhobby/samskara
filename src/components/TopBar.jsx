import { TreeIcon, TreasuryIcon, VaultIcon, MapIcon, AdminIcon } from "./NavIcons";

const TABS = [
  { key: "tree", label: "Tree", Icon: TreeIcon },
  { key: "treasury", label: "Treasury", Icon: TreasuryIcon },
  { key: "vault", label: "Vault", Icon: VaultIcon },
  { key: "map", label: "Journey", Icon: MapIcon }
];

const ROLE_LABELS = { member: "Member", admin: "Admin", head: "Family Head" };

export default function TopBar({ view, onNav, pendingCount, myRole, onRoleChange }) {
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
        <select
          className="role-select" value={myRole} onChange={(e) => onRoleChange(e.target.value)}
          aria-label="Viewing as" title="Which hat are you wearing? This isn't a login — just adjusts what you can do on this device."
        >
          {Object.entries(ROLE_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
        </select>
        <button className="icon-btn" onClick={() => onNav("admin")}>
          <AdminIcon />Admin
          {pendingCount > 0 && <span className="badge-count">{pendingCount}</span>}
        </button>
      </div>
    </header>
  );
}
