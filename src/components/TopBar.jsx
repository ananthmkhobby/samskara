import { TreeIcon, VaultIcon, GalleryIcon, SearchIcon, MoreIcon, MenuIcon, BellIcon, DiyaGlyph } from "./NavIcons";
import { IS_DEMO } from "../data/session";
import FamilySwitcher from "./FamilySwitcher";

const TABS = [
  { key: "tree", label: "Tree", Icon: TreeIcon },
  { key: "vault", label: "Timeline", Icon: VaultIcon },
  { key: "gallery", label: "Gallery", Icon: GalleryIcon },
  { key: "search", label: "Search", Icon: SearchIcon }
];
const MORE_VIEWS = ["parampara", "library", "treasury", "map", "admin", "help"];

export default function TopBar({ view, onNav, pendingCount, onJoinAnother, onContribute }) {
  const isMoreActive = MORE_VIEWS.includes(view);
  return (
    <header className="topbar">
      {/* The hamburger is a second entry point into the same More overflow
          page — not a separate drawer — so there's exactly one "everything
          else" surface to keep in sync, not two. */}
      <button className="icon-only topbar-menu-btn" onClick={() => onNav("more")} aria-label="Menu"><MenuIcon /></button>
      <button className="brand" onClick={() => onNav("cover")} aria-label="Return to cover">
        <span className="brand-mark" />
        <span className="brand-text"><b>संस्कार वंश वृक्ष</b><span>Samskara Vamsha Vruksha</span></span>
      </button>
      <nav className="nav-tabs">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} className={view === key ? "active" : ""} onClick={() => onNav(key)}><Icon />{label}</button>
        ))}
        <button className={isMoreActive ? "active" : ""} onClick={() => onNav("more")} style={{ position: "relative" }}>
          <MoreIcon />More
          {pendingCount > 0 && <span className="badge-count">{pendingCount}</span>}
        </button>
      </nav>
      <div className="topbar-actions">
        <button className="icon-only" style={{ width: 34, height: 34 }} onClick={() => onContribute({})} aria-label="Record a memory"><DiyaGlyph /></button>
        {/* Reuses the same pendingCount signal already shown on the More
            tab's badge — a second, more visible surface for it, not a
            separate notification feed that doesn't exist yet. */}
        <button className="icon-only topbar-bell-btn" style={{ width: 34, height: 34, position: "relative" }} onClick={() => onNav("more")} aria-label="Pending review items">
          <BellIcon />
          {pendingCount > 0 && <span className="badge-count" style={{ top: -3, right: -3 }}>{pendingCount}</span>}
        </button>
        <button className="icon-only" style={{ width: 34, height: 34 }} onClick={() => onNav("help")} aria-label="Help">?</button>
        {IS_DEMO ? (
          <button className="btn small ghost" onClick={() => {
            onNav("cover");
            // Log in lives inline on the Cover page, further down — jump
            // straight to it instead of leaving the visitor to scroll and find it.
            requestAnimationFrame(() => requestAnimationFrame(() => {
              document.querySelector(".auth-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }));
          }}>Log in</button>
        ) : (
          <FamilySwitcher onJoinAnother={onJoinAnother} />
        )}
      </div>
    </header>
  );
}
