import { useEffect, useId, useMemo, useRef, useState } from "react";
import { computeClassicLayout, NODE_R, SIDE_PAD, LABEL_CLEARANCE } from "../lib/classicTreeLayout";
import { yearsLabel } from "../data/helpers";
import PersonAvatar from "./PersonAvatar";

// A small leaf, seeded off the branch it's decorating so it doesn't jitter
// between re-renders. The offset is deliberately small (a few px) — this is
// meant to sit ON the branch path it's passed, not float near it, so it's
// anchored directly at that path's own coordinates by the caller rather
// than at a generic per-node position independent of where any real branch is.
function Leaf({ x, y, seed, scale = 1 }) {
  const angle = (seed * 47) % 360;
  const dx = ((seed * 13) % 10) - 5;
  const dy = ((seed * 29) % 8) - 4;
  return (
    <path
      d="M0,0 C4,-6 10,-6 13,0 C10,6 4,6 0,0 Z"
      fill="var(--forest-light)" opacity="0.7"
      transform={`translate(${x + dx},${y + dy}) rotate(${angle}) scale(${scale})`}
    />
  );
}

// Reused by both the full illustrated Tree page (small families only, see
// TreeView.jsx's size gate) and the small Home-dashboard crest (a truncated
// slice of the same family). Same computeClassicLayout positions as the
// plain Classic Tree — this is a visual skin over the identical, proven
// layout math, not a second tree-layout implementation, which is exactly
// why it can never drift out of sync or fail differently at the edges.
// fitToWidth is for the non-interactive Home crest, which has no pan/zoom
// wrapper of its own — it measures its own container and scales the whole
// canvas down to fit, the same way the pan-zoom hook's fitToView does for
// the full interactive page (ClassicTree/TreeView already own that wrapper
// for the interactive case, so this component doesn't duplicate it there).
export default function IllustratedTree({ people, onSelectPerson, interactive = true, avatarSize = 76, fitToWidth = false, valueFilter = null }) {
  const layout = useMemo(() => computeClassicLayout(people), [people]);
  const gens = useMemo(() => Array.from(new Set(people.map((p) => p.gen))).sort((a, b) => a - b), [people]);
  const minGen = gens[0], maxGen = gens[gens.length - 1];
  // Wide enough to hold a full two/three-word name across a couple of
  // lines rather than truncating it — a name is the one thing on this card
  // that shouldn't ever get cut short.
  const labelW = Math.round(avatarSize * 2.1);
  const gradientUid = useId();

  const outerRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!fitToWidth || !outerRef.current) return;
    const el = outerRef.current;
    const measure = () => setScale(Math.min(1, el.clientWidth / layout.width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToWidth, layout.width]);

  const gradientId = `branchGrad-${gradientUid}`;
  const tree = (
    <div className="illustrated-tree" style={{ width: layout.width, height: layout.height }}>
      <svg width={layout.width} height={layout.height} style={{ position: "absolute", top: 0, left: 0, overflow: "visible", pointerEvents: "none" }}>
        <defs>
          {/* userSpaceOnUse with absolute coordinates, not the default
              objectBoundingBox — a branch to an only child runs perfectly
              vertical (zero horizontal offset), giving that path a
              zero-width bounding box. objectBoundingBox gradients are
              undefined/degenerate against a zero-width (or zero-height)
              bbox, so the browser silently fails to paint the stroke —
              exactly the "some branches just don't appear" bug this fixes. */}
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={layout.height}>
            <stop offset="0%" stopColor="var(--bark)" />
            <stop offset="100%" stopColor="var(--bark-deep)" />
          </linearGradient>
        </defs>
        {layout.units.map((u, i) => (
          <g key={i}>
            {u.members.length === 2 && (
              <>
                <path
                  className="branch-fill"
                  d={`M ${u.members[0].tx + SIDE_PAD},${u.members[0].ty} L ${u.members[1].tx + SIDE_PAD},${u.members[1].ty}`}
                  stroke={`url(#${gradientId})`} strokeWidth="5" strokeLinecap="round" fill="none"
                />
                <Leaf x={(u.members[0].tx + u.members[1].tx) / 2 + SIDE_PAD} y={u.members[0].ty} seed={i * 7 + 1} />
              </>
            )}
            {u.children.map((c, j) => {
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
                <g key={j}>
                  <path
                    className="branch-fill"
                    d={`M ${startX + SIDE_PAD},${startY} C ${startX + SIDE_PAD},${midY} ${endX + SIDE_PAD},${midY} ${endX + SIDE_PAD},${endY}`}
                    fill="none" stroke={`url(#${gradientId})`} strokeWidth="6" strokeLinecap="round" opacity="0.85"
                  />
                  {/* Anchored at the branch's own midpoint and end, not a
                      generic per-node offset — this is what actually keeps
                      leaves visually attached to the curve they decorate. */}
                  <Leaf x={(startX + endX) / 2 + SIDE_PAD} y={midY} seed={i * 13 + j * 5 + 2} />
                  <Leaf x={endX + SIDE_PAD} y={endY + 4} seed={i * 13 + j * 5 + 4} scale={0.8} />
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      {people.map((p) => {
        const Wrap = interactive ? "button" : "div";
        const classes = ["illustrated-node"];
        if (valueFilter) {
          if (p.lifeLesson && p.lifeLesson.values.includes(valueFilter)) classes.push("highlighted");
          else classes.push("dimmed");
        }
        return (
          <Wrap
            key={p.id} type={interactive ? "button" : undefined}
            className={classes.join(" ")} aria-label={interactive ? `Open ${p.name}'s folio` : undefined}
            style={{ left: p.tx + SIDE_PAD - labelW / 2, top: p.ty - avatarSize / 2, width: labelW }}
            onClick={interactive ? () => onSelectPerson(p.id) : undefined}
          >
            <PersonAvatar person={p} size={avatarSize} minGen={minGen} maxGen={maxGen} className="illustrated-avatar" />
            <div className="illustrated-label">
              <div className="illustrated-name">{p.name}</div>
              <div className="illustrated-years tnum">{yearsLabel(p)}</div>
            </div>
          </Wrap>
        );
      })}
    </div>
  );

  if (!fitToWidth) return tree;
  return (
    <div ref={outerRef} style={{ width: "100%", height: layout.height * scale, overflow: "hidden" }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {tree}
      </div>
    </div>
  );
}
