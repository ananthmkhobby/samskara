// Converts the wizard's plain-language nested tree (one node per person, an
// optional spouse name, and a list of children) into the flat PEOPLE/MARRIAGES
// shape every view in the app already understands.
let keyCounter = 0;
export function newNodeKey() {
  keyCounter += 1;
  return `n${Date.now()}-${keyCounter}`;
}

export function makeNode(name = "", spouseName = "") {
  return { key: newNodeKey(), name, spouseName, birthYear: "", spouseBirthYear: "", children: [] };
}

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "person";
}

export function flattenFamily(root) {
  const people = [];
  const marriages = [];
  const usedIds = new Set();

  function uniqueId(name) {
    const base = slugify(name);
    let id = base, n = 2;
    while (usedIds.has(id)) id = `${base}-${n++}`;
    usedIds.add(id);
    return id;
  }

  function walk(node, gen, parentIds) {
    if (!node.name.trim()) return;
    const id = uniqueId(node.name.trim());
    const hasSpouse = !!node.spouseName?.trim();
    const spouseId = hasSpouse ? uniqueId(node.spouseName.trim()) : undefined;

    const person = { id, name: node.name.trim(), gen, parents: parentIds, trust: "approx" };
    if (node.birthYear?.trim()) person.born = `${node.birthYear.trim()}-01-01`;
    if (spouseId) person.spouse = spouseId;
    people.push(person);

    if (spouseId) {
      const spouse = { id: spouseId, name: node.spouseName.trim(), gen, parents: [], spouse: id, trust: "approx" };
      if (node.spouseBirthYear?.trim()) spouse.born = `${node.spouseBirthYear.trim()}-01-01`;
      people.push(spouse);
      marriages.push({ a: id, b: spouseId, date: null });
    }

    const childParents = spouseId ? [id, spouseId] : [id];
    (node.children || []).forEach((child) => walk(child, gen + 1, childParents));
  }

  walk(root, 1, []);
  return { people, marriages };
}

// Turns a plain {name, spouseName, children} structure (e.g. from the AI
// photo-scan) into properly keyed nodes the wizard's React state can use.
export function hydrateNode(plain) {
  return {
    key: newNodeKey(),
    name: plain?.name || "",
    spouseName: plain?.spouseName || "",
    birthYear: plain?.birthYear ? String(plain.birthYear) : "",
    spouseBirthYear: plain?.spouseBirthYear ? String(plain.spouseBirthYear) : "",
    children: Array.isArray(plain?.children) ? plain.children.map(hydrateNode) : []
  };
}

export function countPeople(node) {
  if (!node.name.trim()) return 0;
  let n = 1 + (node.spouseName?.trim() ? 1 : 0);
  (node.children || []).forEach((c) => { n += countPeople(c); });
  return n;
}
