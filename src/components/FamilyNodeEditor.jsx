import { makeNode } from "../lib/familyBuilder";

export default function FamilyNodeEditor({ node, depth, onUpdate, onAddChild, onRemove }) {
  return (
    <div className="fam-node" style={{ "--depth": depth }}>
      <div className="fam-node-card">
        <div className="fam-node-row">
          <div className="fam-node-field">
            <label>{depth === 0 ? "Their name" : "Name"}</label>
            <input type="text" placeholder="e.g. Lakshmamma" value={node.name} onChange={(e) => onUpdate(node.key, { name: e.target.value })} />
          </div>
          <div className="fam-node-field">
            <label>Birth year (optional)</label>
            <input type="text" inputMode="numeric" placeholder="e.g. 1948" value={node.birthYear} onChange={(e) => onUpdate(node.key, { birthYear: e.target.value })} />
          </div>
        </div>
        <div className="fam-node-row">
          <div className="fam-node-field">
            <label>Spouse's name (optional)</label>
            <input type="text" placeholder="Leave blank if none" value={node.spouseName} onChange={(e) => onUpdate(node.key, { spouseName: e.target.value })} />
          </div>
          {node.spouseName.trim() && (
            <div className="fam-node-field">
              <label>Spouse's birth year (optional)</label>
              <input type="text" inputMode="numeric" placeholder="e.g. 1951" value={node.spouseBirthYear} onChange={(e) => onUpdate(node.key, { spouseBirthYear: e.target.value })} />
            </div>
          )}
        </div>
        <div className="fam-node-actions">
          <button type="button" className="btn small" onClick={() => onAddChild(node.key, makeNode())}>+ Add a son or daughter</button>
          {depth > 0 && <button type="button" className="btn small ghost" onClick={() => onRemove(node.key)}>Remove</button>}
        </div>
      </div>
      {node.children.length > 0 && (
        <div className="fam-children">
          {node.children.map((child) => (
            <FamilyNodeEditor key={child.key} node={child} depth={depth + 1} onUpdate={onUpdate} onAddChild={onAddChild} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
