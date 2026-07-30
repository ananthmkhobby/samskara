import { useMemo } from "react";
import { computeClassicLayout, NODE_R, SIDE_PAD, LABEL_CLEARANCE, LABEL_W } from "../lib/classicTreeLayout";
import { yearsLabel, roleTag } from "../data/helpers";
import { usePanZoom } from "../hooks/usePanZoom";
import { MY_PERSON_ID } from "../data/session";
import PersonAvatar from "./PersonAvatar";

// Matches the Banyan tree's own bloom-in stagger (0.32s per generation, 0.06s
// per sibling) so both views share one motion language: elders settle first,
// the thread of lineage draws out to each child, then the child appears.
const GEN_STAGGER = 0.32;

export default function ClassicTree({ people, contributions, valueFilter, onSelectPerson }) {
  const layout = useMemo(() => computeClassicLayout(people), [people]);
  const gens = useMemo(() => Array.from(new Set(people.map((p) => p.gen))).sort((a, b) => a - b), [people]);
  const minGen = gens[0], maxGen = gens[gens.length - 1];
  const { wrapRef, transform, fitToView, zoomBy, startDrag } = usePanZoom({ contentWidth: layout.width, contentHeight: layout.height });
  const genCounts = {};

  return (
    <div
      className="tree-canvas-wrap" ref={wrapRef}
      onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
    >
      <div className="tree-hud">{people.length} people across {gens.length} generations</div>
      <div className="tree-canvas" style={{ width: layout.width, height: layout.height, transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})` }}>
        <svg width={layout.width} height={layout.height} style={{ position: "absolute", top: 0, left: 0, overflow: "visible", pointerEvents: "none" }}>
          {layout.units.map((u, i) => {
            const unitDelay = (u.gen - minGen) * GEN_STAGGER;
            return (
              <g key={i}>
                {u.members.length === 2 && (
                  <line
                    className="tree-link"
                    x1={u.members[0].tx + SIDE_PAD} y1={u.members[0].ty} x2={u.members[1].tx + SIDE_PAD} y2={u.members[1].ty}
                    pathLength="1" strokeDasharray="1"
                    style={{ "--grow-delay": `${unitDelay}s` }}
                    stroke="var(--gold-deep)" strokeWidth="2"
                  />
                )}
                {u.children.map((c, j) => {
                  // A unit's members can have DIFFERENT recorded parents (the
                  // normal case for any married-in spouse), so the line must
                  // terminate at the one member who actually lists this unit
                  // as a parent — not at the couple's shared center x, or two
                  // unrelated parents both appear to feed into the same point.
                  const parentIds = u.members.map((m) => m.id);
                  const childMatches = c.members.filter((m) => m.parents?.some((pid) => parentIds.includes(pid)));
                  const referencedParentIds = new Set();
                  childMatches.forEach((m) => m.parents.forEach((pid) => { if (parentIds.includes(pid)) referencedParentIds.add(pid); }));
                  const parentMatches = u.members.filter((m) => referencedParentIds.has(m.id));
                  const startX = (u.members.length === 2 && parentMatches.length === 1) ? parentMatches[0].tx : u.x;
                  const endX = (c.members.length === 2 && childMatches.length === 1) ? childMatches[0].tx : c.x;
                  const startY = u.y + NODE_R + LABEL_CLEARANCE;
                  const endY = c.y - NODE_R;
                  const midY = (startY + endY) / 2;
                  return (
                    <path
                      key={j}
                      className="tree-link"
                      d={`M ${startX + SIDE_PAD},${startY} C ${startX + SIDE_PAD},${midY} ${endX + SIDE_PAD},${midY} ${endX + SIDE_PAD},${endY}`}
                      pathLength="1" strokeDasharray="1"
                      style={{ "--grow-delay": `${unitDelay}s` }}
                      fill="none" stroke="var(--maroon-deep)" strokeWidth="2" opacity="0.55"
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
        {people.map((p) => {
          const role = roleTag(contributions, p);
          const isUnwritten = role === "Unwritten leaf";
          const classes = ["tnode"];
          if (p.isLegacy) classes.push("legacy");
          if (isUnwritten) classes.push("unwritten");
          if (p.id === MY_PERSON_ID) classes.push("me");
          if (valueFilter) {
            const matches = p.lifeLesson && p.lifeLesson.values.includes(valueFilter);
            if (matches) classes.push("highlighted");
            else if (p.id !== MY_PERSON_ID) classes.push("dimmed");
          }
          genCounts[p.gen] = (genCounts[p.gen] || 0) + 1;
          const delay = (p.gen - minGen) * GEN_STAGGER + (genCounts[p.gen] - 1) * 0.06;
          return (
            <button
              key={p.id} type="button" className={classes.join(" ")}
              style={{ left: p.tx + SIDE_PAD - LABEL_W / 2, top: p.ty - NODE_R, "--grow-delay": `${delay}s` }}
              aria-label={`Open ${p.name}'s folio`}
              onClick={() => onSelectPerson(p.id)}
            >
              {p.id === MY_PERSON_ID && <span className="me-badge">You</span>}
              <PersonAvatar person={p} size={64} minGen={minGen} maxGen={maxGen} className="avatar" />
              <div className="label">
                <div className="p-name">{p.name}</div>
                <div className="p-role">{role || " "}</div>
                <div className="p-years tnum">{yearsLabel(p)}</div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="tree-zoom">
        <button aria-label="Zoom in" onClick={() => zoomBy(0.2)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <button aria-label="Reset view" onClick={fitToView}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>
        </button>
        <button aria-label="Zoom out" onClick={() => zoomBy(-0.2)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
      </div>
    </div>
  );
}
