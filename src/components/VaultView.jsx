import { PEOPLE, MARRIAGES } from "../data/people";
import { byId, monthName } from "../data/helpers";

// Contributed "Important date" entries are stored as a single string —
// "YYYY-MM-DD — Label" (or "date TBD — Label" if no date was picked) — not
// structured JSON like newer fields. Split it back apart and treat anything
// that doesn't parse to a real date as unusable rather than crashing the
// whole Vault (new Date(...) failing silently produces NaN, and pushing
// into months[NaN] throws).
function parseDateContribution(content) {
  const [datePart, ...rest] = (content || "").split(" — ");
  const d = new Date(datePart);
  if (isNaN(d.getTime())) return null;
  return { date: d, label: rest.join(" — ") || "Untitled date" };
}

export default function VaultView({ contributions }) {
  const people = PEOPLE;
  const months = Array.from({ length: 12 }, () => []);
  // Born/died values that only ever had a year on record (bulk import, the
  // quick +Add flow, or the Builder wizard all only ask for a year) — no
  // real day to show, so they're listed separately rather than falsely
  // pinned to January 1st.
  const yearOnlyEntries = [];

  function addIfValid(d, entry) {
    if (isNaN(d.getTime())) return;
    months[d.getMonth()].push({ day: d.getDate(), ...entry });
  }

  people.forEach((p) => {
    if (p.born) {
      if (p.bornYearOnly) yearOnlyEntries.push({ type: "birth", label: `${p.name} born`, year: p.born.slice(0, 4) });
      else addIfValid(new Date(p.born), { type: "birth", label: `${p.name} born` });
    }
    if (p.died) {
      if (p.diedYearOnly) yearOnlyEntries.push({ type: "remembrance", label: `${p.name} remembered`, year: p.died.slice(0, 4) });
      else addIfValid(new Date(p.died), { type: "remembrance", label: `${p.name} remembered` });
    }
  });
  MARRIAGES.forEach((m) => {
    if (!m.date) return;
    addIfValid(new Date(m.date), { type: "marriage", label: `${byId(m.a)?.name.split(" ")[0]} & ${byId(m.b)?.name.split(" ")[0]} married` });
  });
  (contributions || []).forEach((c) => {
    if (c.type !== "date" || c.status !== "Verified") return;
    const parsed = parseDateContribution(c.content);
    if (!parsed) return;
    const person = c.personId ? byId(c.personId) : null;
    addIfValid(parsed.date, { type: "milestone", label: person ? `${person.name.split(" ")[0]}: ${parsed.label}` : parsed.label });
  });

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>Dates Vault</h2>
        <p>Birthdays, anniversaries, and remembrance days, grouped by month so they surface every year regardless of when they happened.</p>
        <div className="tag-row" style={{ marginTop: 12 }}>
          <span className="tag" style={{ color: "var(--forest-ink)", borderColor: "var(--forest)" }}>● Birth</span>
          <span className="tag" style={{ color: "var(--gold-deep)", borderColor: "var(--gold-deep)" }}>● Marriage</span>
          <span className="tag" style={{ color: "var(--maroon-ink)", borderColor: "var(--maroon)" }}>● Remembrance</span>
          <span className="tag" style={{ color: "var(--bark-deep)", borderColor: "var(--bark)" }}>● Other milestone</span>
        </div>
      </div>
      <div className="vault-grid">
        {months.map((entries, i) => {
          const sorted = [...entries].sort((a, b) => a.day - b.day);
          return (
            <div className="card month-card" key={i} style={{ "--flip-delay": `${i * 0.055}s` }}>
              <h4>{monthName(i)} <span>{sorted.length ? `${sorted.length} dates` : ""}</span></h4>
              {sorted.length ? sorted.map((e, j) => (
                <div className="date-row" key={j}>
                  <span className={`date-dot ${e.type}`} />
                  <span className="date-day tnum">{String(e.day).padStart(2, "0")}</span>
                  <span className="date-label">{e.label}</span>
                </div>
              )) : <div className="date-row" style={{ borderTop: 0, color: "var(--ink-faint)" }}>No dates recorded yet.</div>}
            </div>
          );
        })}
      </div>
      {yearOnlyEntries.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <h4 style={{ marginTop: 0 }}>Known only by year</h4>
          <p className="form-hint" style={{ marginTop: 0 }}>
            Only a year is on record for these — no specific day to place them on above.
          </p>
          {[...yearOnlyEntries].sort((a, b) => a.year.localeCompare(b.year)).map((e, j) => (
            <div className="date-row" key={j}>
              <span className={`date-dot ${e.type}`} />
              <span className="date-day tnum">{e.year}</span>
              <span className="date-label">{e.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
