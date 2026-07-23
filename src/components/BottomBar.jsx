import { CoverIcon, TreeIcon, TreasuryIcon, VaultIcon, MapIcon, AdminIcon } from "./NavIcons";

const TABS = [
  { key: "cover", label: "Cover", Icon: CoverIcon },
  { key: "tree", label: "Tree", Icon: TreeIcon },
  { key: "treasury", label: "Treasury", Icon: TreasuryIcon },
  { key: "vault", label: "Vault", Icon: VaultIcon },
  { key: "map", label: "Journey", Icon: MapIcon },
  { key: "admin", label: "Admin", Icon: AdminIcon }
];

export default function BottomBar({ view, onNav, pendingCount }) {
  return (
    <nav className="bottombar">
      {TABS.map(({ key, label, Icon }) => (
        <button key={key} className={view === key ? "active" : ""} style={key === "admin" ? { position: "relative" } : undefined} onClick={() => onNav(key)}>
          <Icon />{label}
          {key === "admin" && pendingCount > 0 && <span className="badge-count" style={{ top: -2, right: 14 }}>{pendingCount}</span>}
        </button>
      ))}
    </nav>
  );
}
