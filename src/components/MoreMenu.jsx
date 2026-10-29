import { ParamparaIcon, LibraryIcon, TreasuryIcon, MapIcon, JapaIcon, AdminIcon, ChatIcon, BellIcon } from "./NavIcons";
import { IS_DEMO, isModuleEnabled } from "../data/session";
import { minimumTierForFlag, PLAN_TIERS } from "../lib/planTiers";

// Redesign v2 — everything that doesn't fit in the six-item bottom nav
// anymore lives here instead. One extra tap instead of permanent crowding.
// `gateKey` ties an item to its families.module_flags entry — omitted for
// anything that should never be gated.
const ITEMS = [
  { key: "parampara", gateKey: "parampara", label: "Parampare", sub: "Family traditions, sayings, and heritage", Icon: ParamparaIcon },
  { key: "library", gateKey: "library", label: "Family Library", sub: "Books the family has kept and passed down", Icon: LibraryIcon },
  { key: "treasury", gateKey: "treasury", label: "Treasury of Wisdom", sub: "One life lesson from each storyteller", Icon: TreasuryIcon },
  { key: "map", gateKey: "journey", label: "Journey", sub: "Where the family has lived, on a map", Icon: MapIcon },
  { key: "japa", gateKey: "japa", label: "Japa & Chanting", sub: "Every mala round and recitation, counted", Icon: JapaIcon },
];

export default function MoreMenu({ onNav, canModerate }) {
  return (
    <section className="wrap">
      <div className="section-head">
        <h2>More</h2>
        <p>Everything else the archive holds.</p>
      </div>
      <div className="more-menu-grid">
        {ITEMS.map(({ key, label, sub, Icon, gateKey }) => {
          const enabled = isModuleEnabled(gateKey);
          // Named rather than a vague "upgrade required" — the tier whose
          // own default actually turns this on, same reasoning as every
          // other gated button in the app (PDF export, AI features, etc).
          const minTier = enabled ? null : minimumTierForFlag(gateKey, true);
          return (
            <button
              key={key} type="button" className="card more-menu-item" onClick={() => onNav(key)}
              style={!enabled ? { opacity: 0.6 } : undefined}
            >
              <span className="more-menu-icon"><Icon /></span>
              <span className="more-menu-text">
                <b>{label}{!enabled && minTier && <span className="tag" style={{ marginLeft: 8, fontSize: 11 }}>{PLAN_TIERS[minTier].label}</span>}</b>
                <span>{enabled ? sub : `Included from ${minTier ? PLAN_TIERS[minTier].label : "a paid plan"} — tap to see plans`}</span>
              </span>
            </button>
          );
        })}
        {!IS_DEMO && (
          <button type="button" className="card more-menu-item" onClick={() => onNav("admin")}>
            <span className="more-menu-icon"><AdminIcon /></span>
            <span className="more-menu-text">
              <b>Admin</b>
              <span>{canModerate ? "Manage members and review the queue" : "See what's pending review"}</span>
            </span>
          </button>
        )}
        {!IS_DEMO && (
          <button type="button" className="card more-menu-item" onClick={() => onNav("connectWhatsapp")}>
            <span className="more-menu-icon"><ChatIcon /></span>
            <span className="more-menu-text">
              <b>Connect on WhatsApp</b>
              <span>Send photos and stories straight from WhatsApp</span>
            </span>
          </button>
        )}
        {!IS_DEMO && (
          <button type="button" className="card more-menu-item" onClick={() => onNav("notifications")}>
            <span className="more-menu-icon"><BellIcon /></span>
            <span className="more-menu-text">
              <b>Notifications</b>
              <span>Get pushed a message here from your family</span>
            </span>
          </button>
        )}
        {!IS_DEMO && (
          <button type="button" className="card more-menu-item" onClick={() => onNav("account")}>
            <span className="more-menu-icon">⚙️</span>
            <span className="more-menu-text">
              <b>Account</b>
              <span>Download your data, or delete your account</span>
            </span>
          </button>
        )}
      </div>

      {/* Until now these were only linked from the sign-in screen, so anyone
          already signed in had no way to reach them at all. */}
      <div className="more-menu-legal">
        <button type="button" onClick={() => onNav("blog")}>Blog</button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => onNav("privacy")}>Privacy Policy</button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => onNav("terms")}>Terms of Use</button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => onNav("help")}>Help</button>
      </div>
    </section>
  );
}
