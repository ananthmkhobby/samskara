import { useState } from "react";
import { PEOPLE, VALUES } from "../data/people";
import BanyanTree from "./BanyanTree";
import ClassicTree from "./ClassicTree";
import FocusTreeView from "./FocusTreeView";
import IllustratedTree from "./IllustratedTree";

// Banyan view is hidden for now (Classic only) — kept mounted-but-unused
// rather than deleted so it's a one-line change to bring the toggle back.
const SHOW_BANYAN_TOGGLE = false;

// Families small enough to stay legible in the illustrated style (per the
// reference mockup) get it automatically; anyone past this size falls back
// to the plain Classic Tree, which is the same proven layout underneath —
// just without the organic-branch/gold-ring skin — and was specifically
// verified against a 90-person synthetic family to hold up at that scale.
const ILLUSTRATED_MAX_PEOPLE = 20;

export default function TreeView({ contributions, onSelectPerson, onNav }) {
  const [valueFilter, setValueFilter] = useState(null);
  const [mode, setMode] = useState(SHOW_BANYAN_TOGGLE ? "banyan" : "classic");
  // A fresh array reference each render — PEOPLE is mutated in place after
  // edits, and BanyanTree/ClassicTree's own layout memoization is keyed on
  // this reference.
  const people = [...PEOPLE];
  const gens = new Set(people.map((p) => p.gen));
  const illustrated = mode === "classic" && people.length <= ILLUSTRATED_MAX_PEOPLE;

  if (!people.length) {
    return (
      <section className="wrap">
        <div className="section-head">
          <h2>The family tree</h2>
          <p>Nobody's been added yet — this is where it all starts.</p>
        </div>
        <div className="empty-state" style={{ padding: "48px 24px" }}>
          <p style={{ marginBottom: 16 }}>
            Add your first few family members to get the tree started. Once there's at least one person on
            record, you can add their parents, children, and spouse right from that person's own folio.
          </p>
          <button type="button" className="btn primary" onClick={() => onNav("builder")}>+ Start building your family tree</button>
          <p className="form-hint" style={{ marginTop: 18 }}>
            Once the tree has a few people in it, head to the Admin page to invite the rest of the family with a link.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>The family tree</h2>
        <p>
          {mode === "banyan"
            ? "Five generations, from Narasimha & Kamala's founding household to the youngest leaves. Tap anyone glowing in the canopy to open their folio."
            : mode === "focus"
              ? "One person at a time, in large print — tap a parent, spouse, or child to move there, or open their full folio."
              : illustrated
                ? "Tap anyone in the branches to open their folio. Highlight a value to see whose life carried it."
                : "Five generations, laid out generation by generation. Drag to pan, use the controls to zoom, tap anyone to open their folio."}
          {mode !== "focus" && !illustrated && " Highlight a value to see whose life carried it."}
        </p>
        {illustrated && <span className="tree-crest-badge" style={{ marginTop: 10 }}>{gens.size} generation{gens.size === 1 ? "" : "s"}</span>}
      </div>
      <div className="tree-mode-toggle" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {SHOW_BANYAN_TOGGLE && (
          <button className={`chip${mode === "banyan" ? " active" : ""}`} onClick={() => setMode("banyan")}>Banyan tree</button>
        )}
        <button className={`chip${mode === "classic" ? " active" : ""}`} onClick={() => setMode("classic")}>Tree</button>
        <button className={`chip${mode === "focus" ? " active" : ""}`} onClick={() => setMode("focus")}>Focus view</button>
      </div>
      {mode !== "focus" && (
        <div className="banyan-toolbar">
          {VALUES.map((v) => (
            <button key={v} className={`chip${valueFilter === v ? " active" : ""}`} onClick={() => setValueFilter(valueFilter === v ? null : v)}>{v}</button>
          ))}
          <button className={`chip${valueFilter === null ? " active" : ""}`} onClick={() => setValueFilter(null)}>All</button>
        </div>
      )}
      {mode !== "focus" && valueFilter && (
        <div className="value-filter-banner">
          Showing only who carried <b>{valueFilter}</b> — everyone else is faded.{" "}
          <button type="button" className="link-btn" onClick={() => setValueFilter(null)}>Clear filter</button>
        </div>
      )}
      {mode === "banyan"
        ? <BanyanTree people={people} contributions={contributions} valueFilter={valueFilter} onSelectPerson={onSelectPerson} />
        : mode === "focus"
          ? <FocusTreeView people={people} onSelectPerson={onSelectPerson} />
          : illustrated
            ? (
              <div className="illustrated-tree-page-wrap">
                <IllustratedTree people={people} onSelectPerson={onSelectPerson} interactive avatarSize={76} valueFilter={valueFilter} />
              </div>
            )
            : <ClassicTree people={people} contributions={contributions} valueFilter={valueFilter} onSelectPerson={onSelectPerson} />}
    </section>
  );
}
