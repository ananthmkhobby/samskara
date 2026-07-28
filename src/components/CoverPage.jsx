import { PEOPLE, CHALLENGES } from "../data/people";
import { IS_DEMO, CURRENT_FAMILY_NAME, FAMILY_FLAME_STREAK } from "../data/session";
import { useCountUp } from "../hooks/useCountUp";
import { parseParamparaContent } from "../lib/parampara";
import { personIdsWithRooms } from "../lib/chitrashale";
import { byId } from "../data/helpers";
import AuthPanel from "./AuthPanel";
import InstallAppCard from "./InstallAppCard";
import HeritageIntro, { FamilyBondIcon } from "./HeritageIntro";
import FamilyFlame from "./FamilyFlame";

function Counter({ value, label, delay }) {
  const shown = useCountUp(value);
  return (
    <div className="counter cover-enter" style={{ "--enter-delay": `${delay}s` }}>
      <b className="tnum">{shown}</b><span>{label}</span>
    </div>
  );
}

// A new one "arrives" each day rather than reshuffling on every render —
// deterministic per calendar day, not truly random, so it doesn't jitter
// between re-renders within the same visit.
function pickOfTheDay(list) {
  if (!list.length) return null;
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return list[dayOfYear % list.length];
}

export default function CoverPage({ contributions, onNav, onContribute, onOpenRoom }) {
  const gens = new Set(PEOPLE.map((p) => p.gen));
  const verifiedStories = contributions.filter((c) => c.status === "Verified" && c.type !== "edit" && c.type !== "parampara").length;
  const lessons = PEOPLE.filter((p) => p.lifeLesson).length;
  const challenge = CHALLENGES[new Date().getMonth()];
  const familyLabel = CURRENT_FAMILY_NAME || (IS_DEMO ? "The Rao family" : "Your family");

  const paramparaEntries = contributions.filter((c) => c.type === "parampara" && c.status === "Verified" && c.field !== "lineage");
  const wisdomEntries = paramparaEntries.filter((c) => c.field === "wisdom");
  const featuredParampara = pickOfTheDay(wisdomEntries.length ? wisdomEntries : paramparaEntries);
  const featuredText = featuredParampara ? parseParamparaContent(featuredParampara.content) : null;

  // Only ever picks among people whose room already has content — same
  // reasoning as the Parampara card above, never an invitation to fill an
  // empty one.
  const roomPersonId = pickOfTheDay(personIdsWithRooms(contributions));
  const featuredRoomPerson = roomPersonId ? byId(roomPersonId) : null;

  return (
    <section className="wrap" style={{ paddingTop: 0 }}>
      <HeritageIntro icon={<FamilyBondIcon />} />
      <div className="cover-hero cover-enter" style={{ "--enter-delay": "0s" }}>
        <span className="eyebrow">{IS_DEMO ? "Public demo · try it out" : "Your family's archive"} · {gens.size} generation{gens.size === 1 ? "" : "s"}</span>
        <h1>संस्कार वंश वृक्ष<span className="translit">Samskara Vamsha Vruksha</span></h1>
        <p className="lede">{familyLabel}'s living record — every birth, marriage, memory, and hard-won lesson, kept in one place and added to by everyone who belongs to it.</p>
      </div>

      <FamilyFlame streak={FAMILY_FLAME_STREAK} />

      <div className="cover-enter" style={{ "--enter-delay": "0.06s" }}>
        <InstallAppCard dismissible />
      </div>

      <div className="counters">
        <Counter value={PEOPLE.length} label="Members" delay={0.1} />
        <Counter value={gens.size} label="Generations" delay={0.18} />
        <Counter value={verifiedStories} label="Verified stories" delay={0.26} />
        <Counter value={lessons} label="Life lessons" delay={0.34} />
      </div>

      <div className="challenge-card cover-enter" style={{ "--enter-delay": "0.42s" }}>
        <span className="eyebrow">This month's family challenge</span>
        <h3>{challenge.title}</h3>
        <p>{challenge.text}</p>
        <button className="btn primary small" onClick={() => onContribute({ type: challenge.type })}>Contribute now</button>
      </div>

      {featuredParampara && (
        <button type="button" className="parampara-highlight-card cover-enter" style={{ "--enter-delay": "0.46s", width: "100%" }} onClick={() => onNav("parampara")}>
          <span className="eyebrow">✨ Parampara — {wisdomEntries.length ? "Ancestor wisdom, today" : "From your family's heritage"}</span>
          <p className="quote">{featuredText.description}</p>
          <p className="who">— {featuredParampara.title} · tap to explore your family's Parampara</p>
        </button>
      )}

      {featuredRoomPerson && (
        <button
          type="button" className="parampara-highlight-card chitrashale-highlight-card cover-enter"
          style={{ "--enter-delay": "0.48s", width: "100%" }} onClick={() => onOpenRoom(featuredRoomPerson.id)}
        >
          <span className="eyebrow">🪔 Anubhava Chitrashale</span>
          <p className="quote">Visit {featuredRoomPerson.name.split(" ")[0]}'s room today</p>
          <p className="who">Objects the family has placed there, waiting to be touched</p>
        </button>
      )}

      <div className="cover-cta cover-enter" style={{ "--enter-delay": "0.5s" }}>
        <button className="btn primary" onClick={() => onNav("tree")}>Enter the family tree</button>
      </div>
      <div className="cover-links cover-enter" style={{ "--enter-delay": "0.56s" }}>
        <button onClick={() => onNav("parampara")}>✨ Discover your family's Parampara →</button>
        <button onClick={() => onNav("treasury")}>Browse the Treasury of Wisdom →</button>
        <button onClick={() => onNav("vault")}>Check the Dates Vault →</button>
        <button onClick={() => onNav("map")}>See the family's journey →</button>
      </div>
      <div className="cover-links cover-enter" style={{ "--enter-delay": "0.62s", marginTop: 10 }}>
        <button onClick={() => onNav("builder")}>Add to this family tree →</button>
      </div>

      {IS_DEMO && (
        <div className="cover-enter" style={{ "--enter-delay": "0.7s" }}>
          <AuthPanel />
        </div>
      )}
    </section>
  );
}
