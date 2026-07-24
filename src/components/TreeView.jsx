import { useState } from "react";
import { PEOPLE, VALUES } from "../data/people";
import BanyanTree from "./BanyanTree";
import ClassicTree from "./ClassicTree";

// Banyan view is hidden for now (Classic only) — kept mounted-but-unused
// rather than deleted so it's a one-line change to bring the toggle back.
const SHOW_BANYAN_TOGGLE = false;

export default function TreeView({ contributions, onSelectPerson }) {
  const [valueFilter, setValueFilter] = useState(null);
  const [mode, setMode] = useState(SHOW_BANYAN_TOGGLE ? "banyan" : "classic");
  // A fresh array reference each render — PEOPLE is mutated in place after
  // edits, and BanyanTree/ClassicTree's own layout memoization is keyed on
  // this reference.
  const people = [...PEOPLE];

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>The family tree</h2>
        <p>
          {mode === "banyan"
            ? "Five generations, from Narasimha & Kamala's founding household to the youngest leaves. Tap anyone glowing in the canopy to open their folio."
            : "Five generations, laid out generation by generation. Drag to pan, use the controls to zoom, tap anyone to open their folio."}
          {" "}Highlight a value to see whose life carried it.
        </p>
      </div>
      {SHOW_BANYAN_TOGGLE && (
        <div className="tree-mode-toggle" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button className={`chip${mode === "banyan" ? " active" : ""}`} onClick={() => setMode("banyan")}>Banyan tree</button>
          <button className={`chip${mode === "classic" ? " active" : ""}`} onClick={() => setMode("classic")}>Classic tree</button>
        </div>
      )}
      <div className="banyan-toolbar">
        {VALUES.map((v) => (
          <button key={v} className={`chip${valueFilter === v ? " active" : ""}`} onClick={() => setValueFilter(valueFilter === v ? null : v)}>{v}</button>
        ))}
        <button className={`chip${valueFilter === null ? " active" : ""}`} onClick={() => setValueFilter(null)}>All</button>
      </div>
      {mode === "banyan"
        ? <BanyanTree people={people} contributions={contributions} valueFilter={valueFilter} onSelectPerson={onSelectPerson} />
        : <ClassicTree people={people} contributions={contributions} valueFilter={valueFilter} onSelectPerson={onSelectPerson} />}
    </section>
  );
}
