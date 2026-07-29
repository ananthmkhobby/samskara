// A small custom icon set for room objects that have no real photo yet —
// same gold/maroon gradient style as the diya/book icons already built for
// Parampara/Library (see HeritageIntro.jsx), so a room never looks like a
// mismatched pile of unrelated iconography. "lamp" and "book" reuse
// DiyaIcon/OpenBookIcon directly rather than duplicating them — see
// ICON_COMPONENTS at the bottom of this file.
import { DiyaIcon, OpenBookIcon } from "./HeritageIntro";

export function TumblerIcon() {
  return (
    <svg className="heritage-icon chitra-icon-tumbler" viewBox="0 0 120 80" aria-hidden="true">
      <defs>
        <linearGradient id="tumblerGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE9B0" />
          <stop offset="55%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--bark-deep)" />
        </linearGradient>
      </defs>
      <path d="M42,20 L78,20 L72,64 Q60,70 48,64 Z" fill="url(#tumblerGrad)" stroke="var(--gold-deep)" strokeWidth="1.5" />
      <ellipse cx="60" cy="20" rx="18" ry="4" fill="var(--gold-wash)" stroke="var(--gold-deep)" strokeWidth="1.2" />
    </svg>
  );
}

export function FlowerIcon() {
  return (
    <svg className="heritage-icon chitra-icon-flowers" viewBox="0 0 120 80" aria-hidden="true">
      <defs>
        <radialGradient id="flowerGrad" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FFF6E2" />
          <stop offset="60%" stopColor="var(--gold-wash)" />
          <stop offset="100%" stopColor="var(--gold-deep)" />
        </radialGradient>
      </defs>
      <path d="M60,66 Q58,42 60,20" fill="none" stroke="var(--bark-deep)" strokeWidth="2" />
      <g className="flower-head" style={{ transformOrigin: "60px 66px" }}>
        <circle cx="60" cy="20" r="7" fill="url(#flowerGrad)" />
        <circle cx="46" cy="30" r="6" fill="url(#flowerGrad)" />
        <circle cx="74" cy="30" r="6" fill="url(#flowerGrad)" />
        <circle cx="40" cy="46" r="5.5" fill="url(#flowerGrad)" />
        <circle cx="80" cy="46" r="5.5" fill="url(#flowerGrad)" />
      </g>
    </svg>
  );
}

export function BeadsIcon() {
  const beads = Array.from({ length: 9 }, (_, i) => {
    const t = (i / 8) * Math.PI;
    return { cx: 20 + t * 25.5, cy: 20 + Math.sin(t) * 42 };
  });
  return (
    <svg className="heritage-icon chitra-icon-beads" viewBox="0 0 120 80" aria-hidden="true">
      <defs>
        <radialGradient id="beadGrad" cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FFE9B0" />
          <stop offset="60%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--maroon)" />
        </radialGradient>
      </defs>
      <g className="beads-string" style={{ transformOrigin: "60px 20px" }}>
        <path d={`M20,20 Q60,${20 + 42} 100,20`} fill="none" stroke="var(--gold-deep)" strokeWidth="1.2" opacity="0.6" />
        {beads.map((b, i) => <circle key={i} cx={b.cx} cy={b.cy} r="5" fill="url(#beadGrad)" />)}
      </g>
    </svg>
  );
}

export function SlippersIcon() {
  return (
    <svg className="heritage-icon chitra-icon-slippers" viewBox="0 0 120 80" aria-hidden="true">
      <defs>
        <linearGradient id="slipperGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--bark-deep)" />
        </linearGradient>
      </defs>
      <path d="M18,50 Q18,34 34,34 Q50,34 50,50 Q50,60 34,60 Q18,60 18,50 Z" fill="url(#slipperGrad)" stroke="var(--gold-deep)" strokeWidth="1.2" />
      <path d="M70,50 Q70,34 86,34 Q102,34 102,50 Q102,60 86,60 Q70,60 70,50 Z" fill="url(#slipperGrad)" stroke="var(--gold-deep)" strokeWidth="1.2" />
      <path d="M34,34 L34,44" stroke="var(--maroon-deep)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M86,34 L86,44" stroke="var(--maroon-deep)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function PotIcon() {
  return (
    <svg className="heritage-icon chitra-icon-pot" viewBox="0 0 120 80" aria-hidden="true">
      <defs>
        <linearGradient id="potGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--bark-deep)" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="24" rx="14" ry="4" fill="var(--gold-wash)" stroke="var(--gold-deep)" strokeWidth="1.2" />
      <path d="M46,24 Q30,40 40,58 Q48,68 60,68 Q72,68 80,58 Q90,40 74,24 Z" fill="url(#potGrad)" stroke="var(--gold-deep)" strokeWidth="1.5" />
      <path d="M60,10 L60,20" stroke="var(--bark-deep)" strokeWidth="2" />
      <circle cx="60" cy="8" r="4" fill="var(--gold-wash)" stroke="var(--gold-deep)" strokeWidth="1" />
    </svg>
  );
}

export function RainIcon() {
  const drops = [
    { x: 30, delay: "0s" }, { x: 46, delay: "0.4s" }, { x: 62, delay: "0.15s" },
    { x: 78, delay: "0.55s" }, { x: 92, delay: "0.3s" },
  ];
  return (
    <svg className="heritage-icon chitra-icon-rain" viewBox="0 0 120 80" aria-hidden="true">
      <defs>
        <linearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--parchment-paper)" />
          <stop offset="100%" stopColor="var(--gold-wash)" />
        </linearGradient>
      </defs>
      <path d="M30,26 Q30,14 44,14 Q50,4 64,8 Q78,4 82,16 Q96,16 96,28 Q96,36 86,36 L36,36 Q26,36 30,26 Z" fill="url(#cloudGrad)" stroke="var(--gold-deep)" strokeWidth="1.2" />
      {drops.map((d, i) => (
        <line key={i} className="rain-drop" x1={d.x} y1="42" x2={d.x - 4} y2="60" stroke="var(--gold-deep)" strokeWidth="2.4" strokeLinecap="round" style={{ "--drop-delay": d.delay }} />
      ))}
    </svg>
  );
}

export function ChairIcon() {
  return (
    <svg className="heritage-icon chitra-icon-chair" viewBox="0 0 120 80" aria-hidden="true">
      <defs>
        <linearGradient id="chairGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--bark-deep)" />
        </linearGradient>
      </defs>
      <path d="M32,14 L32,44 L82,44 L82,14" fill="none" stroke="url(#chairGrad)" strokeWidth="4" strokeLinecap="round" />
      <rect x="28" y="44" width="58" height="6" rx="2" fill="url(#chairGrad)" />
      <path d="M32,50 L28,70 M82,50 L86,70 M50,50 L48,70 M64,50 L66,70" stroke="var(--bark-deep)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg className="heritage-icon chitra-icon-bell" viewBox="0 0 120 80" aria-hidden="true">
      <defs>
        <radialGradient id="bellGrad" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFE9B0" />
          <stop offset="60%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--gold-deep)" />
        </radialGradient>
      </defs>
      <path
        d="M60,10 Q56,10 56,16 Q40,20 40,38 L40,52 L32,64 L88,64 L80,52 L80,38 Q80,20 64,16 Q64,10 60,10 Z"
        fill="url(#bellGrad)" stroke="var(--gold-deep)" strokeWidth="1.5"
      />
      <circle cx="60" cy="70" r="5" fill="var(--gold-deep)" />
    </svg>
  );
}

export function PocketWatchIcon() {
  return (
    <svg className="heritage-icon chitra-icon-watch" viewBox="0 0 120 80" aria-hidden="true">
      <defs>
        <radialGradient id="watchGrad" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="var(--parchment-paper)" />
          <stop offset="100%" stopColor="var(--gold-wash)" />
        </radialGradient>
      </defs>
      <rect x="54" y="6" width="12" height="8" rx="2" fill="var(--gold-deep)" />
      <circle cx="60" cy="42" r="28" fill="url(#watchGrad)" stroke="var(--gold-deep)" strokeWidth="3.5" />
      <circle cx="60" cy="42" r="20" fill="none" stroke="var(--gold)" strokeWidth="1.4" />
      <line x1="60" y1="42" x2="60" y2="26" stroke="var(--bark-deep)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="60" y1="42" x2="72" y2="42" stroke="var(--bark-deep)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="60" cy="42" r="2.6" fill="var(--bark-deep)" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg className="heritage-icon chitra-icon-clock" viewBox="0 0 120 80" aria-hidden="true">
      <defs>
        <radialGradient id="clockGrad" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="var(--parchment-paper)" />
          <stop offset="100%" stopColor="var(--gold-wash)" />
        </radialGradient>
      </defs>
      <path d="M40,68 L80,68 L80,72 L40,72 Z" fill="var(--bark-deep)" />
      <circle cx="60" cy="12" r="4" fill="var(--gold)" />
      <rect x="58.5" y="6" width="3" height="7" fill="var(--gold-deep)" />
      <circle cx="60" cy="40" r="26" fill="url(#clockGrad)" stroke="var(--gold-deep)" strokeWidth="3.5" />
      <line x1="60" y1="40" x2="60" y2="24" stroke="var(--bark-deep)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="60" y1="40" x2="70" y2="46" stroke="var(--bark-deep)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="60" cy="40" r="2.6" fill="var(--bark-deep)" />
    </svg>
  );
}

export const ICON_COMPONENTS = {
  lamp: DiyaIcon,
  book: OpenBookIcon,
  tumbler: TumblerIcon,
  flowers: FlowerIcon,
  beads: BeadsIcon,
  slippers: SlippersIcon,
  pot: PotIcon,
  rain: RainIcon,
  chair: ChairIcon,
  bell: BellIcon,
  watch: PocketWatchIcon,
  clock: ClockIcon,
};

export function ChitrashaleIcon({ iconKey }) {
  const Cmp = ICON_COMPONENTS[iconKey] || DiyaIcon;
  return <Cmp />;
}
