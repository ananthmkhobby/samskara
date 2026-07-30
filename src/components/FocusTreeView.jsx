import { useRef, useState } from "react";
import { byId, yearsLabel, relationshipCaption, MIN_GEN, MAX_GEN } from "../data/helpers";
import { MY_PERSON_ID } from "../data/session";
import PersonAvatar from "./PersonAvatar";

// Prefers the logged-in user's own linked person (see Admin -> Roster) so
// they land on themselves first, not a stranger's name — falls back to the
// oldest generation on record for anyone who hasn't linked yet.
function pickDefaultRoot(people) {
  if (MY_PERSON_ID && people.some((p) => p.id === MY_PERSON_ID)) return MY_PERSON_ID;
  const minGen = Math.min(...people.map((p) => p.gen));
  return (people.find((p) => p.gen === minGen) || people[0]).id;
}

// Two distinct actions on one card, not one: tapping the photo/name moves
// the focus view to that relative (keeps browsing, same as before);
// "Open folio →" is a separate button that jumps straight to their full
// Folio instead, which previously had no path from here at all.
function RelativeCard({ person, onGoTo, onOpenFolio }) {
  return (
    <div className="focus-kin-card">
      <button type="button" className="focus-kin-main" onClick={() => onGoTo(person.id)} aria-label={`View ${person.name} in focus`}>
        <PersonAvatar person={person} size={60} minGen={MIN_GEN} maxGen={MAX_GEN} className="focus-kin-avatar" />
        <span className="focus-kin-name">{person.name}</span>
        <span className="focus-kin-years tnum">{yearsLabel(person)}</span>
      </button>
      <button type="button" className="focus-kin-hint" onClick={() => onOpenFolio(person.id)}>Open folio →</button>
    </div>
  );
}

export default function FocusTreeView({ people, onSelectPerson }) {
  const [history, setHistory] = useState(() => [pickDefaultRoot(people)]);
  const topRef = useRef(null);

  function afterNav() {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function goTo(id) {
    setHistory((h) => [...h, id]);
    afterNav();
  }
  function goBack() {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
    afterNav();
  }
  function goHome() {
    setHistory([pickDefaultRoot(people)]);
    afterNav();
  }

  const currentId = history[history.length - 1];
  const person = byId(currentId);
  if (!person) return null;

  const parents = (person.parents || []).map((id) => byId(id)).filter(Boolean);
  const spouse = person.spouse ? byId(person.spouse) : null;
  const children = people.filter((p) => p.parents?.includes(person.id));
  const relationship = relationshipCaption(person);
  const crumbNames = history.map((id) => byId(id)?.name || "?");
  const atStart = history.length <= 1;

  return (
    <div className="focus-tree" ref={topRef}>
      <div className="focus-topbar">
        <button type="button" className="focus-icon-btn" aria-label="Back" onClick={goBack} disabled={atStart}>‹</button>
        <div className="focus-crumb-wrap">
          <p className="focus-crumb-eyebrow">The family tree</p>
          <p className="focus-crumb">
            {atStart
              ? <><b>{crumbNames[0]}</b> · start</>
              : <>{crumbNames.slice(0, -1).join(" → ")} → <b>{crumbNames[crumbNames.length - 1]}</b></>}
          </p>
        </div>
        <button type="button" className="focus-icon-btn" aria-label="Back to start" title="Back to start" onClick={goHome} disabled={atStart}>⌂</button>
      </div>

      {parents.length > 0 ? (
        <>
          <p className="focus-section-label">Parents</p>
          <div className="focus-kin-row">
            {parents.map((p) => <RelativeCard key={p.id} person={p} onGoTo={goTo} onOpenFolio={onSelectPerson} />)}
          </div>
          <div className="focus-connector" aria-hidden="true" />
        </>
      ) : (
        <p className="focus-empty-note">Top of this branch — no parents recorded</p>
      )}

      <div className="focus-person">
        <PersonAvatar person={person} size={104} minGen={MIN_GEN} maxGen={MAX_GEN} className="focus-avatar" />
        <p className="focus-name">{person.name}</p>
        <p className="focus-years tnum">{yearsLabel(person)}</p>
        {relationship && <p className="focus-relation">{relationship}</p>}
        {spouse && (
          <div className="focus-spouse-row">
            <button type="button" className="focus-spouse-pill" onClick={() => goTo(spouse.id)} aria-label={`View ${spouse.name} in focus`}>
              <PersonAvatar person={spouse} size={34} minGen={MIN_GEN} maxGen={MAX_GEN} className="focus-kin-avatar" />
              <span className="focus-spouse-text"><span className="focus-spouse-label">Married to</span><b>{spouse.name}</b></span>
            </button>
            <button type="button" className="focus-spouse-folio-btn" aria-label={`Open ${spouse.name}'s folio`} title="Open folio" onClick={() => onSelectPerson(spouse.id)}>→</button>
          </div>
        )}
      </div>

      {children.length > 0 ? (
        <>
          <div className="focus-connector" aria-hidden="true" />
          <p className="focus-section-label">Children</p>
          <div className="focus-kin-row">
            {children.map((p) => <RelativeCard key={p.id} person={p} onGoTo={goTo} onOpenFolio={onSelectPerson} />)}
          </div>
        </>
      ) : (
        <p className="focus-empty-note" style={{ marginTop: 18 }}>No children recorded yet</p>
      )}

      <div className="focus-actions">
        <button type="button" className="btn primary" onClick={() => onSelectPerson(person.id)}>Open full folio →</button>
      </div>
    </div>
  );
}
