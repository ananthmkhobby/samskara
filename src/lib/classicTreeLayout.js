// Cartesian generation-row layout: each generation is a horizontal band,
// siblings ordered left-to-right, couples kept adjacent.
//
// Sibling/spouse spacing is sized off the rendered *label* footprint
// (LABEL_W), not the avatar circle (NODE_D) — the name/role/years text
// underneath each avatar is wider than the avatar itself, so reserving only
// avatar width left married couples' name labels almost touching (~4px
// clearance at full scale, guaranteed to collide on a longer name).
// LABEL_CLEARANCE is how far below an avatar its own name/role/years label
// block extends — connector lines to children must start below this, or
// they cut straight through the parent's own name on the way down.
export const NODE_D = 64, NODE_R = 32, NODE_GAP = 46, LABEL_W = 106, SPOUSE_GAP = 56, LABEL_CLEARANCE = 58, LEVEL_H = 200, TOP_PAD = 70, SIDE_PAD = 90;

export function computeClassicLayout(people) {
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
    // Couple footprint = distance between avatar centers (NODE_D + SPOUSE_GAP)
    // plus one full label width on each outer side, so neighbouring units
    // never encroach on either spouse's name.
    const own = u.members.length === 2 ? (NODE_D + SPOUSE_GAP) + LABEL_W : LABEL_W;
    if (!u.children.length) { u.width = own; return; }
    const kidsWidth = u.children.reduce((s, c) => s + c.width, 0) + NODE_GAP * (u.children.length - 1);
    u.width = Math.max(own, kidsWidth);
  });
  const roots = units.filter((u) => u.gen === minGen);
  function assignX(u, left) {
    if (!u.children.length) { u.x = left + u.width / 2; return; }
    const kidsWidth = u.children.reduce((s, c) => s + c.width, 0) + NODE_GAP * (u.children.length - 1);
    let childLeft = left + (u.width - kidsWidth) / 2;
    u.children.forEach((c) => { assignX(c, childLeft); childLeft += c.width + NODE_GAP; });
    u.x = (u.children[0].x + u.children[u.children.length - 1].x) / 2;
  }
  let cursor = 0;
  roots.forEach((r) => { assignX(r, cursor); cursor += r.width + NODE_GAP * 2; });
  const totalWidth = cursor - NODE_GAP * 2;

  units.forEach((u) => {
    u.y = (u.gen - minGen) * LEVEL_H + TOP_PAD;
    if (u.members.length === 2) {
      u.members[0].tx = u.x - (NODE_D + SPOUSE_GAP) / 2; u.members[0].ty = u.y;
      u.members[1].tx = u.x + (NODE_D + SPOUSE_GAP) / 2; u.members[1].ty = u.y;
    } else {
      u.members[0].tx = u.x; u.members[0].ty = u.y;
    }
  });

  return { units, width: totalWidth + SIDE_PAD * 2, height: (maxGen - minGen) * LEVEL_H + TOP_PAD * 2 + 40 };
}
