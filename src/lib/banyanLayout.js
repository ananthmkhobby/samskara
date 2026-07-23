// Positions each person as a percentage point within the canopy area of the
// background tree photograph, and produces thin lineage connector lines.
// Sibling ordering reuses the same width-based nesting used by a classic
// node-link family tree; only the final mapping (into % coordinates over a
// photo) differs.
const NODE_W = 1, SPOUSE_GAP = 0.5, CHILD_GAP = 0.45;
const CANOPY_LEFT = 12, CANOPY_RIGHT = 88, CANOPY_TOP = 7, TRUNK_Y = 57;

export function computeBanyanLayout(people) {
  const minGen = Math.min(...people.map((p) => p.gen));
  const maxGen = Math.max(...people.map((p) => p.gen));

  const consumed = new Set();
  const byGen = {};
  people.forEach((p) => { (byGen[p.gen] = byGen[p.gen] || []).push(p); });
  const units = [];
  Object.keys(byGen).sort((a, b) => a - b).forEach((g) => {
    byGen[g].forEach((p) => {
      if (consumed.has(p.id)) return;
      const spouse = p.spouse && people.find((x) => x.id === p.spouse);
      let members;
      if (spouse && !consumed.has(spouse.id)) {
        members = [p, spouse];
        consumed.add(spouse.id);
      } else {
        members = [p];
      }
      consumed.add(p.id);
      units.push({ members, gen: +g, children: [], width: 0, x: 0 });
    });
  });
  units.forEach((u) => {
    const ids = u.members.map((m) => m.id);
    u.children = units.filter((u2) => u2.gen === u.gen + 1 && u2.members.some((m) => m.parents?.some((pid) => ids.includes(pid))));
  });
  units.slice().sort((a, b) => b.gen - a.gen).forEach((u) => {
    const own = u.members.length === 2 ? NODE_W * 2 + SPOUSE_GAP : NODE_W;
    if (!u.children.length) { u.width = own; return; }
    const kidsWidth = u.children.reduce((s, c) => s + c.width, 0) + CHILD_GAP * (u.children.length - 1);
    u.width = Math.max(own, kidsWidth);
  });

  const roots = units.filter((u) => u.gen === minGen);
  function assignX(u, left) {
    if (!u.children.length) { u.x = left + u.width / 2; return; }
    const kidsWidth = u.children.reduce((s, c) => s + c.width, 0) + CHILD_GAP * (u.children.length - 1);
    let childLeft = left + (u.width - kidsWidth) / 2;
    u.children.forEach((c) => { assignX(c, childLeft); childLeft += c.width + CHILD_GAP; });
    u.x = (u.children[0].x + u.children[u.children.length - 1].x) / 2;
  }
  let cursor = 0;
  roots.forEach((r) => { assignX(r, cursor); cursor += r.width + CHILD_GAP * 2; });
  const totalWidth = Math.max(1, cursor - CHILD_GAP * 2);

  const ux = {};
  units.forEach((u) => {
    if (u.members.length === 2) {
      ux[u.members[0].id] = u.x - (NODE_W + SPOUSE_GAP) / 2;
      ux[u.members[1].id] = u.x + (NODE_W + SPOUSE_GAP) / 2;
    } else {
      ux[u.members[0].id] = u.x;
    }
  });

  const genStep = maxGen > minGen ? (TRUNK_Y - CANOPY_TOP) / (maxGen - minGen) : 0;
  const positions = {};
  people.forEach((p) => {
    const xPct = CANOPY_LEFT + (ux[p.id] / totalWidth) * (CANOPY_RIGHT - CANOPY_LEFT);
    const yPct = TRUNK_Y - (p.gen - minGen) * genStep;
    positions[p.id] = { xPct, yPct };
  });

  const links = [];
  units.forEach((u) => {
    const parentIds = u.members.map((m) => m.id);
    const parentPts = u.members.map((m) => positions[m.id]);
    const px = parentPts.reduce((s, pt) => s + pt.xPct, 0) / parentPts.length;
    const py = parentPts[0].yPct;
    u.children.forEach((c) => {
      c.members.forEach((cm) => {
        if (cm.parents?.some((pid) => parentIds.includes(pid))) {
          links.push({ x1: px, y1: py, x2: positions[cm.id].xPct, y2: positions[cm.id].yPct, gen: cm.gen });
        }
      });
    });
    if (u.members.length === 2) {
      links.push({ x1: positions[u.members[0].id].xPct, y1: positions[u.members[0].id].yPct, x2: positions[u.members[1].id].xPct, y2: positions[u.members[1].id].yPct, gen: u.gen, spouse: true });
    }
  });

  return { positions, links };
}
