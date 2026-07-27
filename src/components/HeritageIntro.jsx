// Five motes is plenty to read as "drifting light" without looking busy —
// spread across the icon's width, each on its own delay so they don't rise
// in lockstep.
const MOTE_POSITIONS = [
  { x: "18%", delay: "0s" },
  { x: "38%", delay: "0.7s" },
  { x: "50%", delay: "1.7s" },
  { x: "64%", delay: "0.35s" },
  { x: "82%", delay: "1.2s" },
];

function Motes() {
  return (
    <div className="heritage-motes" aria-hidden="true">
      {MOTE_POSITIONS.map((m, i) => (
        <span key={i} className="heritage-mote" style={{ "--mote-x": m.x, "--mote-delay": m.delay }} />
      ))}
    </div>
  );
}

export function DiyaIcon() {
  return (
    <svg className="heritage-icon" viewBox="0 0 120 80" aria-hidden="true">
      <defs>
        <linearGradient id="diyaBowl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--bark-deep)" />
        </linearGradient>
        <radialGradient id="diyaFlameGrad" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFE9B0" />
          <stop offset="55%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--maroon)" />
        </radialGradient>
      </defs>
      <path d="M10,54 Q60,80 110,54 Q98,46 60,46 Q22,46 10,54 Z" fill="url(#diyaBowl)" />
      <path className="diya-flame" d="M60,10 C69,26 73,36 60,44 C47,36 51,26 60,10 Z" fill="url(#diyaFlameGrad)" />
    </svg>
  );
}

export function OpenBookIcon() {
  return (
    <svg className="heritage-icon" viewBox="0 0 120 80" aria-hidden="true">
      <defs>
        <linearGradient id="bookPageGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--parchment-paper)" />
          <stop offset="100%" stopColor="var(--gold-wash)" />
        </linearGradient>
      </defs>
      <path className="book-page left" d="M60,18 L14,27 L14,62 L60,54 Z" fill="url(#bookPageGrad)" stroke="var(--gold-deep)" strokeWidth="1.5" />
      <path className="book-page right" d="M60,18 L106,27 L106,62 L60,54 Z" fill="url(#bookPageGrad)" stroke="var(--gold-deep)" strokeWidth="1.5" transform="scale(-1,1) translate(-120,0)" />
      <line x1="60" y1="18" x2="60" y2="54" stroke="var(--maroon-deep)" strokeWidth="2" />
    </svg>
  );
}

export function FamilyBondIcon() {
  return (
    <svg className="heritage-icon" viewBox="0 0 120 80" aria-hidden="true">
      <defs>
        <radialGradient id="bondNodeGrad" cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FFE9B0" />
          <stop offset="60%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--maroon)" />
        </radialGradient>
      </defs>
      <path className="bond-line" d="M30,26 L60,54 L90,26" fill="none" stroke="var(--gold-deep)" strokeWidth="2" pathLength="1" strokeDasharray="1" />
      <circle className="bond-node n1" cx="30" cy="26" r="10" fill="url(#bondNodeGrad)" />
      <circle className="bond-node n2" cx="90" cy="26" r="10" fill="url(#bondNodeGrad)" />
      <circle className="bond-node n3" cx="60" cy="54" r="11" fill="url(#bondNodeGrad)" />
    </svg>
  );
}

export default function HeritageIntro({ icon }) {
  return (
    <div className="heritage-intro">
      <div className="heritage-glow" aria-hidden="true" />
      <Motes />
      {icon}
    </div>
  );
}
