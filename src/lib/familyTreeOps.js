// Small immutable tree operations keyed by node.key, used by the Family
// Builder wizard's React state.
export function updateNode(node, key, patch) {
  if (node.key === key) return { ...node, ...patch };
  return { ...node, children: node.children.map((c) => updateNode(c, key, patch)) };
}

export function addChild(node, key, child) {
  if (node.key === key) return { ...node, children: [...node.children, child] };
  return { ...node, children: node.children.map((c) => addChild(c, key, child)) };
}

export function removeChild(node, key) {
  return { ...node, children: node.children.filter((c) => c.key !== key).map((c) => removeChild(c, key)) };
}
