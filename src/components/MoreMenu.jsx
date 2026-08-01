import { ParamparaIcon, LibraryIcon, TreasuryIcon, MapIcon, AdminIcon } from "./NavIcons";
import { IS_DEMO } from "../data/session";

// Redesign v2 — everything that doesn't fit in the six-item bottom nav
// anymore lives here instead. One extra tap instead of permanent crowding.
const ITEMS = [
  { key: "parampara", label: "Parampara", sub: "Family traditions, sayings, and heritage", Icon: ParamparaIcon },
  { key: "library", label: "Family Library", sub: "Books the family has kept and passed down", Icon: LibraryIcon },
  { key: "treasury", label: "Treasury of Wisdom", sub: "One life lesson from each storyteller", Icon: TreasuryIcon },
  { key: "map", label: "Journey", sub: "Where the family has lived, on a map", Icon: MapIcon },
];

export default function MoreMenu({ onNav, canModerate }) {
  return (
    <section className="wrap">
      <div className="section-head">
        <h2>More</h2>
        <p>Everything else the archive holds.</p>
      </div>
      <div className="more-menu-grid">
        {ITEMS.map(({ key, label, sub, Icon }) => (
          <button key={key} type="button" className="card more-menu-item" onClick={() => onNav(key)}>
            <span className="more-menu-icon"><Icon /></span>
            <span className="more-menu-text">
              <b>{label}</b>
              <span>{sub}</span>
            </span>
          </button>
        ))}
        {!IS_DEMO && (
          <button type="button" className="card more-menu-item" onClick={() => onNav("admin")}>
            <span className="more-menu-icon"><AdminIcon /></span>
            <span className="more-menu-text">
              <b>Admin</b>
              <span>{canModerate ? "Manage members and review the queue" : "See what's pending review"}</span>
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
