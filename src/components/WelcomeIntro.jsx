import { useState } from "react";
import { DiyaIcon } from "./HeritageIntro";

// A rangoli-style mandala: concentric rings of dots around the title,
// generated parametrically rather than hand-placed. Delay increases per ring
// then per dot within a ring, so it blooms outward like a rangoli being
// drawn, dot by dot.
function buildRangoliDots() {
  const rings = [
    { radius: 16, count: 6, size: 3.4 },
    { radius: 32, count: 10, size: 3 },
    { radius: 48, count: 14, size: 2.5 },
    { radius: 64, count: 18, size: 2 },
    { radius: 80, count: 22, size: 1.6 }
  ];
  const dots = [];
  rings.forEach((ring, ringIdx) => {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + ringIdx * 0.22;
      dots.push({
        cx: 100 + Math.cos(angle) * ring.radius,
        cy: 100 + Math.sin(angle) * ring.radius,
        r: ring.size,
        delay: 0.15 + ringIdx * 0.13 + (i / ring.count) * 0.15,
        gold: (ringIdx + i) % 2 === 0
      });
    }
  });
  return dots;
}
const RANGOLI_DOTS = buildRangoliDots();
const RANGOLI_RINGS = [16, 42, 80];

// A toran — the mango-leaf and marigold garland traditionally hung across a
// threshold to welcome whoever's about to walk through it. Positions follow
// the same sag as the string it hangs from, rather than a flat row.
function buildToranItems() {
  const n = 9;
  return Array.from({ length: n }).map((_, i) => {
    const t = i / (n - 1);
    return { x: 20 + t * 360, y: 8 + 15 * Math.sin(Math.PI * t), isLeaf: i % 2 === 0, delay: i * 0.06 };
  });
}
const TORAN_ITEMS = buildToranItems();

function Toran() {
  return (
    <svg className="welcome-toran" viewBox="0 0 400 62" preserveAspectRatio="xMidYMin meet" aria-hidden="true">
      <path d="M0,8 Q200,38 400,8" fill="none" stroke="var(--bark-deep)" strokeWidth="1.5" opacity=".55" />
      {TORAN_ITEMS.map((it, i) => (
        <g key={i} transform={`translate(${it.x},${it.y})`}>
          <g className="toran-item" style={{ "--sway-delay": `${it.delay}s` }}>
            {it.isLeaf
              ? <path d="M0,0 Q-7,15 0,28 Q7,15 0,0 Z" fill="var(--forest)" />
              : <circle cx="0" cy="11" r="7" fill="var(--gold)" />}
          </g>
        </g>
      ))}
    </svg>
  );
}

const AMBIENT_MOTES = [
  { x: "8%", delay: "0s" }, { x: "22%", delay: "1.4s" }, { x: "37%", delay: "2.8s" },
  { x: "52%", delay: "0.7s" }, { x: "68%", delay: "2.1s" }, { x: "82%", delay: "3.5s" }, { x: "93%", delay: "1.9s" }
];

export default function WelcomeIntro({ onDismiss }) {
  const [exiting, setExiting] = useState(false);

  function finish() {
    if (exiting) return;
    setExiting(true);
    window.setTimeout(onDismiss, 420);
  }

  return (
    <div className={`welcome-intro${exiting ? " welcome-exit" : ""}`}>
      <div className="welcome-ambient" aria-hidden="true">
        {AMBIENT_MOTES.map((m, i) => (
          <span key={i} className="welcome-mote" style={{ left: m.x, "--md": m.delay }} />
        ))}
      </div>
      <button className="welcome-skip" onClick={finish}>Not now</button>
      <Toran />
      <div className="welcome-diyas" aria-hidden="true">
        <span className="welcome-diya left"><DiyaIcon /></span>
        <span className="welcome-diya right"><DiyaIcon /></span>
      </div>
      <svg className="welcome-rangoli" viewBox="0 0 200 200" aria-hidden="true">
        {RANGOLI_RINGS.map((r, i) => (
          <circle
            key={r} className="rangoli-ring" cx="100" cy="100" r={r}
            pathLength="1" strokeDasharray="1"
            style={{ "--grow-delay": `${i * 0.3}s` }}
          />
        ))}
        {RANGOLI_DOTS.map((d, i) => (
          <circle
            key={i} className={`rangoli-dot${d.gold ? " gold" : ""}`}
            cx={d.cx} cy={d.cy} r={d.r}
            style={{ "--grow-delay": `${d.delay}s` }}
          />
        ))}
      </svg>
      <div className="welcome-content">
        <span className="welcome-swagatam welcome-fade" style={{ "--d": "0.95s" }}>स्वागतम्</span>
        <span className="eyebrow welcome-fade" style={{ "--d": "1.55s" }}>A living family archive</span>
        <h1 className="welcome-title">
          <span className="welcome-devanagari">संस्कार वंश वृक्ष</span>
          <span className="welcome-translit welcome-fade" style={{ "--d": "2.35s" }}>Samskara Vamsha Vruksha</span>
        </h1>
        <p className="welcome-tagline welcome-fade" style={{ "--d": "2.6s" }}>
          Every birth, marriage, memory, and hard-won lesson — kept in one place, for the generations after.
        </p>
        <button className="btn primary welcome-enter-btn welcome-fade" style={{ "--d": "2.9s" }} onClick={finish}>
          Step into the family home →
        </button>
      </div>
    </div>
  );
}
