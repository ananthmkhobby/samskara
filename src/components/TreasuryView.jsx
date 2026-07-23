import { useState } from "react";
import { PEOPLE, VALUES } from "../data/people";
import { yearsLabel, MIN_GEN, MAX_GEN } from "../data/helpers";
import PersonAvatar from "./PersonAvatar";

export default function TreasuryView({ onSelectPerson }) {
  const [filter, setFilter] = useState(null);
  const withLessons = PEOPLE.filter((p) => p.lifeLesson && (!filter || p.lifeLesson.values.includes(filter)));

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>Treasury of Wisdom</h2>
        <p>The one lesson each storyteller wanted the family to keep. Filter by value to find what you need today.</p>
      </div>
      <div className="value-filters">
        {VALUES.map((v) => (
          <button key={v} className={`chip${filter === v ? " active" : ""}`} onClick={() => setFilter(v)}>{v}</button>
        ))}
        <button className={`chip${filter === null ? " active" : ""}`} onClick={() => setFilter(null)}>All</button>
      </div>
      {withLessons.length ? (
        <div className="treasury-grid">
          {withLessons.map((p) => (
            <button key={p.id} className="card lesson-card" onClick={() => onSelectPerson(p.id)} aria-label={`Open ${p.name}'s folio`}>
              <p className="quote">{p.lifeLesson.quote}</p>
              <div className="lesson-who">
                <PersonAvatar person={p} size={36} minGen={MIN_GEN} maxGen={MAX_GEN} className="avatar" />
                <div><b>{p.name}</b><span>{yearsLabel(p)}</span></div>
              </div>
              <div className="tag-row">{p.lifeLesson.values.map((v) => <span className="tag" key={v}>{v}</span>)}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">No life lessons recorded for “{filter}” yet.</div>
      )}
    </section>
  );
}
