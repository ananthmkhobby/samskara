import { useState } from "react";

// A rangoli-style mandala: concentric rings of dots around the title,
// generated parametrically rather than hand-placed. Delay increases per ring
// then per dot within a ring, so it blooms outward like a rangoli being
// drawn, dot by dot.
function buildRangoliDots() {
  const rings = [
    { radius: 16, count: 6, size: 3.4 },
    { radius: 32, count: 10, size: 3 },
    { radius: 48, count: 14, size: 2.5 },
    { radius: 64, count: 18, size: 2 }
  ];
  const dots = [];
  rings.forEach((ring, ringIdx) => {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + ringIdx * 0.22;
      dots.push({
        cx: 100 + Math.cos(angle) * ring.radius,
        cy: 100 + Math.sin(angle) * ring.radius,
        r: ring.size,
        delay: 0.15 + ringIdx * 0.14 + (i / ring.count) * 0.16,
        gold: (ringIdx + i) % 2 === 0
      });
    }
  });
  return dots;
}
const RANGOLI_DOTS = buildRangoliDots();
const RANGOLI_RINGS = [16, 64];

export default function WelcomeIntro({ onDismiss }) {
  const [exiting, setExiting] = useState(false);

  function finish() {
    if (exiting) return;
    setExiting(true);
    window.setTimeout(onDismiss, 420);
  }

  return (
    <div className={`welcome-intro${exiting ? " welcome-exit" : ""}`}>
      <button className="welcome-skip" onClick={finish}>Skip →</button>
      <svg className="welcome-rangoli" viewBox="0 0 200 200" aria-hidden="true">
        {RANGOLI_RINGS.map((r, i) => (
          <circle
            key={r} className="rangoli-ring" cx="100" cy="100" r={r}
            pathLength="1" strokeDasharray="1"
            style={{ "--grow-delay": `${i * 0.35}s` }}
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
        <span className="eyebrow welcome-fade" style={{ "--d": "1.5s" }}>A living family archive</span>
        <h1 className="welcome-title">
          <span className="welcome-devanagari">संस्कार वंश वृक्ष</span>
          <span className="welcome-translit welcome-fade" style={{ "--d": "2.25s" }}>Samskara Vamsha Vruksha</span>
        </h1>
        <p className="welcome-tagline welcome-fade" style={{ "--d": "2.5s" }}>
          Every birth, marriage, memory, and hard-won lesson — kept in one place, for the generations after.
        </p>
        <button className="btn primary welcome-enter-btn welcome-fade" style={{ "--d": "2.8s" }} onClick={finish}>
          Begin →
        </button>
      </div>
    </div>
  );
}
