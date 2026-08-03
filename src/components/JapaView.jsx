import { PRACTICE_LOGS } from "../data/people";
import { byId, MIN_GEN, MAX_GEN } from "../data/helpers";
import { familyTotal, totalsByPerson, totalsByPractice } from "../lib/japa";
import PersonAvatar from "./PersonAvatar";

export default function JapaView({ onLogCount, onSelectPerson }) {
  const total = familyTotal(PRACTICE_LOGS);
  const byPerson = totalsByPerson(PRACTICE_LOGS);
  const byPractice = totalsByPractice(PRACTICE_LOGS);

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>Japa &amp; Chanting</h2>
        <p>Every mala round, every Hanuman Chalisa, every Vishnu Sahasranama — counted, together.</p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20, textAlign: "center" }}>
        <span className="eyebrow">Family total</span>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 700, color: "var(--maroon-deep)", margin: "6px 0" }}>
          {total.toLocaleString("en-IN")}
        </div>
        <button type="button" className="btn primary" onClick={onLogCount}>🪔 Log a count</button>
      </div>

      {byPerson.length > 0 && (
        <div className="card" style={{ marginBottom: 18, padding: 20 }}>
          <h4 style={{ fontSize: 15, marginBottom: 14 }}>By person</h4>
          {byPerson.map(({ personId, total: t }) => {
            const person = byId(personId);
            if (!person) return null;
            return (
              <button key={personId} type="button" className="today-row" onClick={() => onSelectPerson(personId)}>
                <PersonAvatar person={person} size={40} minGen={MIN_GEN} maxGen={MAX_GEN} className="avatar" />
                <span>{person.name} <b className="tnum">· {t.toLocaleString("en-IN")}</b></span>
              </button>
            );
          })}
        </div>
      )}

      {byPractice.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h4 style={{ fontSize: 15, marginBottom: 14 }}>By practice</h4>
          {byPractice.map(({ label, total: t }) => (
            <div key={label} className="tag-row" style={{ marginBottom: 10, justifyContent: "space-between" }}>
              <span>{label}</span>
              <b className="tnum">{t.toLocaleString("en-IN")}</b>
            </div>
          ))}
        </div>
      )}

      {!PRACTICE_LOGS.length && (
        <div className="card" style={{ padding: 20, textAlign: "center" }}>
          <p className="folio-summary" style={{ marginBottom: 12 }}>No counts logged yet — be the first.</p>
          <button type="button" className="btn primary" onClick={onLogCount}>🪔 Log a count</button>
        </div>
      )}
    </section>
  );
}
