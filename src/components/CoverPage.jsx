import { PEOPLE, CHALLENGES, IS_CUSTOM_FAMILY } from "../data/people";
import { useCountUp } from "../hooks/useCountUp";

function Counter({ value, label, delay }) {
  const shown = useCountUp(value);
  return (
    <div className="counter cover-enter" style={{ "--enter-delay": `${delay}s` }}>
      <b className="tnum">{shown}</b><span>{label}</span>
    </div>
  );
}

export default function CoverPage({ contributions, onNav, onContribute }) {
  const gens = new Set(PEOPLE.map((p) => p.gen));
  const verifiedStories = contributions.filter((c) => c.status === "Verified" && c.type !== "edit").length;
  const lessons = PEOPLE.filter((p) => p.lifeLesson).length;
  const challenge = CHALLENGES[new Date().getMonth()];

  return (
    <section className="wrap" style={{ paddingTop: 0 }}>
      <div className="cover-hero cover-enter" style={{ "--enter-delay": "0s" }}>
        <span className="eyebrow">{IS_CUSTOM_FAMILY ? "Your family's archive" : "Est. sample archive"} · {gens.size} generation{gens.size === 1 ? "" : "s"}</span>
        <h1>संस्कार वंश वृक्ष<span className="translit">Samskara Vamsha Vruksha</span></h1>
        <p className="lede">
          {IS_CUSTOM_FAMILY
            ? "Your family's living record — every birth, marriage, memory, and hard-won lesson, kept in one place and added to by everyone who belongs to it."
            : "The Rao family's living record — every birth, marriage, memory, and hard-won lesson, kept in one place and added to by everyone who belongs to it."}
        </p>
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

      <div className="cover-cta cover-enter" style={{ "--enter-delay": "0.5s" }}>
        <button className="btn primary" onClick={() => onNav("tree")}>Enter the family tree</button>
      </div>
      <div className="cover-links cover-enter" style={{ "--enter-delay": "0.56s" }}>
        <button onClick={() => onNav("treasury")}>Browse the Treasury of Wisdom →</button>
        <button onClick={() => onNav("vault")}>Check the Dates Vault →</button>
        <button onClick={() => onNav("map")}>See the family's journey →</button>
      </div>
      <div className="cover-links cover-enter" style={{ "--enter-delay": "0.62s", marginTop: 10 }}>
        <button onClick={() => onNav("builder")}>{IS_CUSTOM_FAMILY ? "Rebuild your family tree from scratch →" : "Start your own family tree →"}</button>
      </div>
    </section>
  );
}
