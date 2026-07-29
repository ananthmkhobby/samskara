import { useMemo } from "react";
import { computeBanyanLayout } from "../lib/banyanLayout";
import { personHasContent } from "../data/helpers";
import { usePanZoom } from "../hooks/usePanZoom";
import { MY_PERSON_ID } from "../data/session";
import PersonAvatar from "./PersonAvatar";

export default function BanyanTree({ people, contributions, valueFilter, onSelectPerson }) {
  const { positions, links } = useMemo(() => computeBanyanLayout(people), [people]);
  const minGen = Math.min(...people.map((p) => p.gen));
  const maxGen = Math.max(...people.map((p) => p.gen));
  const genCounts = {};
  const { wrapRef, transform, fitToView, zoomBy, startDrag } = usePanZoom({ minZoom: 0.6, maxZoom: 3 });

  return (
    <div className="banyan-wrap" ref={wrapRef} onMouseDown={(e) => startDrag(e.clientX, e.clientY)}>
      <div className="banyan-inner" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})` }}>
        <img className="banyan-photo" src="/images/banyan-tree.jpg" alt="A great banyan tree, its many aerial roots grown into supporting trunks" />
        <div className="banyan-scrim" />
        <svg className="banyan-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          {links.map((l, i) => (
            <line
              key={i} className={`banyan-link${l.spouse ? " spouse" : ""}`}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              style={{ "--grow-delay": `${(l.gen - minGen) * 0.32}s` }}
            />
          ))}
        </svg>
        {people.map((p) => {
          const pos = positions[p.id];
          if (!pos) return null;
          const hasExp = p.experience && p.experience.length;
          const has = personHasContent(contributions, p);
          const classes = ["banyan-marker"];
          classes.push(hasExp ? "glow-strong" : has ? "glow-soft" : "");
          if (p.id === MY_PERSON_ID) classes.push("me");
          if (valueFilter) {
            const matches = p.lifeLesson && p.lifeLesson.values.includes(valueFilter);
            classes.push(matches ? "highlighted" : "dimmed");
          }
          genCounts[p.gen] = (genCounts[p.gen] || 0) + 1;
          const delay = (p.gen - minGen) * 0.32 + (genCounts[p.gen] - 1) * 0.06;
          return (
            <button
              key={p.id}
              type="button"
              className={classes.join(" ")}
              style={{ left: `${pos.xPct}%`, top: `${pos.yPct}%`, "--grow-delay": `${delay}s` }}
              aria-label={`Open ${p.name}'s folio`}
              onClick={() => onSelectPerson(p.id)}
            >
              <span className="dot-glow" />
              <PersonAvatar person={p} size={24} minGen={minGen} maxGen={maxGen} className="dot" />
              <span className="m-label">{p.name.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>
      <span className="banyan-credit">Photo: Aritro Mukherjee IN, CC BY-SA 4.0 (Wikimedia Commons)</span>
      <div className="tree-zoom">
        <button aria-label="Zoom in" onClick={() => zoomBy(0.25)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <button aria-label="Reset view" onClick={fitToView}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>
        </button>
        <button aria-label="Zoom out" onClick={() => zoomBy(-0.25)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
      </div>
    </div>
  );
}
