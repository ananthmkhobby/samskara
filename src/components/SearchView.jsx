import { useState } from "react";
import { PEOPLE } from "../data/people";
import { yearsLabel, relationshipCaption, MIN_GEN, MAX_GEN } from "../data/helpers";
import PersonAvatar from "./PersonAvatar";

export default function SearchView({ onSelectPerson }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const results = query
    ? PEOPLE.filter((p) => p.name.toLowerCase().includes(query)).sort((a, b) => a.name.localeCompare(b.name))
    : [];

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>Search the family</h2>
        <p>Find anyone in the tree by name.</p>
      </div>
      <input
        type="text" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="e.g. Lakshmi" className="search-input"
      />
      {query && (
        results.length ? (
          <div className="search-results">
            {results.map((p) => (
              <button key={p.id} type="button" className="card search-result-row" onClick={() => onSelectPerson(p.id)}>
                <PersonAvatar person={p} size={44} minGen={MIN_GEN} maxGen={MAX_GEN} className="avatar" />
                <span className="search-result-text">
                  <b>{p.name}</b>
                  <span>{[relationshipCaption(p), yearsLabel(p)].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">No one named “{q.trim()}” found.</div>
        )
      )}
    </section>
  );
}
