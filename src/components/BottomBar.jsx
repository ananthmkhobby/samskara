import { HomeIcon, TreeIcon, VaultIcon, GalleryIcon, SearchIcon, MoreIcon, DiyaGlyph } from "./NavIcons";

// Redesign v2 — six items instead of the old eight (Parampara, Library,
// Treasury, Journey, Admin moved into "More"). Fixes the real crowding
// limit the old nav was already at (see the comment that used to live on
// SHOW_BANYAN_TOGGLE-adjacent code: Chitrashale never got its own tab for
// exactly this reason) instead of just working around it again.
// Split across the raised center FAB: three tabs sit either side of it.
const LEFT_TABS = [
  { key: "cover", label: "Home", Icon: HomeIcon },
  { key: "tree", label: "Tree", Icon: TreeIcon },
  { key: "vault", label: "Timeline", Icon: VaultIcon },
];
const RIGHT_TABS = [
  { key: "gallery", label: "Gallery", Icon: GalleryIcon },
  { key: "search", label: "Search", Icon: SearchIcon },
  { key: "more", label: "More", Icon: MoreIcon }
];

// Views that now live behind "More" — used so the More tab itself lights
// up "active" while any of them is open, instead of nothing being highlighted.
const MORE_VIEWS = ["parampara", "library", "treasury", "map", "admin", "help"];

function NavButton({ tab, active, onNav, pendingCount }) {
  const { key, label, Icon } = tab;
  return (
    <button className={active ? "active" : ""} style={key === "more" ? { position: "relative" } : undefined} onClick={() => onNav(key)}>
      <Icon />{label}
      {key === "more" && pendingCount > 0 && <span className="badge-count" style={{ top: -2, right: 14 }}>{pendingCount}</span>}
    </button>
  );
}

// The raised center action replaces the old full-width floating "record a
// memory" pill — same onContribute call, just folded into the bar itself so
// it no longer floats over page content on every view.
export default function BottomBar({ view, onNav, pendingCount, onContribute }) {
  const isMoreActive = MORE_VIEWS.includes(view);
  return (
    <nav className="bottombar">
      {LEFT_TABS.map((tab) => (
        <NavButton key={tab.key} tab={tab} active={view === tab.key} onNav={onNav} pendingCount={pendingCount} />
      ))}
      <button className="bottombar-fab" onClick={() => onContribute({})} aria-label="Record a memory">
        <DiyaGlyph />
      </button>
      {RIGHT_TABS.map((tab) => (
        <NavButton key={tab.key} tab={tab} active={tab.key === "more" ? isMoreActive : view === tab.key} onNav={onNav} pendingCount={pendingCount} />
      ))}
    </nav>
  );
}
