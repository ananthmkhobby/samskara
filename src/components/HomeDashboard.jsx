import { useState } from "react";
import { PEOPLE, CHALLENGES } from "../data/people";
import { IS_DEMO, CURRENT_FAMILY_NAME, FAMILY_FLAME_STREAK } from "../data/session";
import { useCountUp } from "../hooks/useCountUp";
import { parseParamparaContent } from "../lib/parampara";
import { personIdsWithRooms } from "../lib/chitrashale";
import { yearsLabel, byId, MIN_GEN, MAX_GEN } from "../data/helpers";
import { DateIcon } from "./Icons";
import { TreeIcon } from "./NavIcons";
import AuthPanel from "./AuthPanel";
import InstallAppCard from "./InstallAppCard";
import HeritageIntro, { FamilyBondIcon } from "./HeritageIntro";
import FamilyFlame from "./FamilyFlame";
import PersonAvatar from "./PersonAvatar";
import IllustratedTree from "./IllustratedTree";
import { SHOW_CHITRASHALE } from "./FolioModal";

// A small, fixed-size preview — just the top 2 generation rows from the
// root, capped so the crest never gets crowded even on a family with a wide
// generation. Same layout math as the full illustrated Tree page (see
// TreeView.jsx), just a truncated slice and non-interactive except the
// "View tree" button / "View more" note.
//
// Each generation is filtered to children of whoever was ALREADY kept from
// the row above — never just "the first N people at this gen" — so every
// included person (past the root row) is guaranteed a parent inside the
// slice. Slicing rows independently produced real, visible breakage: a
// kept child whose actual parent got truncated out renders as an orphaned
// node with no branch line to anything, since computeClassicLayout can
// only position/connect a unit it can reach by walking children from a root.
const CREST_GEN_CAP = [2, 4];
function crestSlice(people) {
  const gens = [...new Set(people.map((p) => p.gen))].sort((a, b) => a - b);
  const take = gens.slice(0, 2);
  if (!take.length) return [];
  let currentGen = people.filter((p) => p.gen === take[0]).slice(0, CREST_GEN_CAP[0]);
  let result = [...currentGen];
  for (let i = 1; i < take.length; i++) {
    const parentIds = new Set(currentGen.map((p) => p.id));
    const nextGen = people.filter((p) => p.gen === take[i] && p.parents?.some((pid) => parentIds.has(pid))).slice(0, CREST_GEN_CAP[i]);
    if (!nextGen.length) break;
    result = result.concat(nextGen);
    currentGen = nextGen;
  }
  return result;
}

// Redesign v2 — a dashboard-style Home replacing the old scrolling Cover
// page, per the reference mockups. Deliberately keeps the illustrated
// "everyone on one tree" idea OUT of here as functional navigation (that's
// what Tree/Focus view are for, and they're what actually scales) — this
// page is a jumping-off point and a daily digest, not the tree itself.

function Counter({ value, label, delay }) {
  const shown = useCountUp(value);
  return (
    <div className="counter cover-enter" style={{ "--enter-delay": `${delay}s` }}>
      <b className="tnum">{shown}</b><span>{label}</span>
    </div>
  );
}

const QUOTE_TRUNCATE_LEN = 140;
// Breaks at the last whole word before the limit, not mid-word, so a long
// Parampara entry never gets cut off looking like a rendering bug.
function truncateAtWord(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max)}…`;
}

function pickOfTheDay(list) {
  if (!list.length) return null;
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return list[dayOfYear % list.length];
}

function monthDayOf(dateStr) {
  const parts = (dateStr || "").split("-");
  if (parts.length < 3) return null;
  return { m: Number(parts[1]), d: Number(parts[2]) };
}

// Real remembrance/birthday matching — deliberately excludes anyone whose
// date is year-only (bornYearOnly/diedYearOnly), since that day-of-month
// is a fabricated placeholder (see the Vault's own "known only by year"
// handling), not a real date to celebrate or mourn on.
function todaysFamilyMoments(people) {
  const now = new Date();
  const todayM = now.getMonth() + 1, todayD = now.getDate();
  const birthdays = [];
  const remembrances = [];
  for (const p of people) {
    if (p.born && !p.bornYearOnly) {
      const md = monthDayOf(p.born);
      if (md && md.m === todayM && md.d === todayD) birthdays.push(p);
    }
    if (p.died && !p.diedYearOnly) {
      const md = monthDayOf(p.died);
      if (md && md.m === todayM && md.d === todayD) remembrances.push(p);
    }
  }
  return { birthdays, remembrances };
}

// When nothing falls on today exactly, the nearest upcoming birthday (next
// 30 days, living people only) is still a real, useful thing to surface —
// not invented, just the next actual date on record.
function nextUpcomingBirthday(people) {
  const now = new Date();
  let best = null, bestDiff = Infinity;
  for (const p of people) {
    if (p.died || !p.born || p.bornYearOnly) continue;
    const md = monthDayOf(p.born);
    if (!md) continue;
    let next = new Date(now.getFullYear(), md.m - 1, md.d);
    if (next < now) next = new Date(now.getFullYear() + 1, md.m - 1, md.d);
    const diff = (next - now) / 86400000;
    if (diff <= 30 && diff < bestDiff) { best = { p, date: next }; bestDiff = diff; }
  }
  return best;
}

// Four evenly-spaced milestones across everyone with a known birth year —
// a real, factual slice through the family's timeline, not an invented
// narrative per stop.
function timelineMilestones(people) {
  const withBorn = people
    .filter((p) => p.born)
    .map((p) => ({ p, year: Number(p.born.slice(0, 4)) }))
    .filter((x) => !Number.isNaN(x.year))
    .sort((a, b) => a.year - b.year);
  if (!withBorn.length) return [];
  const count = Math.min(4, withBorn.length);
  const seen = new Set();
  const picks = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i * (withBorn.length - 1)) / Math.max(count - 1, 1));
    const item = withBorn[idx];
    if (!seen.has(item.p.id)) { seen.add(item.p.id); picks.push(item); }
  }
  return picks;
}

export default function HomeDashboard({ contributions, onNav, onContribute, onParamparaContribute, onSelectPerson, onOpenRoom }) {
  const [quoteExpanded, setQuoteExpanded] = useState(false);
  const gens = new Set(PEOPLE.map((p) => p.gen));
  const verifiedStories = contributions.filter((c) => c.status === "Verified" && c.type !== "edit" && c.type !== "parampara").length;
  const lessons = PEOPLE.filter((p) => p.lifeLesson).length;
  const challenge = CHALLENGES[new Date().getMonth()];
  const familyLabel = CURRENT_FAMILY_NAME || (IS_DEMO ? "The Rao family" : "Your family");

  const paramparaEntries = contributions.filter((c) => c.type === "parampara" && c.status === "Verified" && c.field !== "lineage");
  const wisdomEntries = paramparaEntries.filter((c) => c.field === "wisdom");
  const featuredParampara = pickOfTheDay(wisdomEntries.length ? wisdomEntries : paramparaEntries);
  const featuredText = featuredParampara ? parseParamparaContent(featuredParampara.content) : null;

  const roomPersonId = pickOfTheDay(personIdsWithRooms(contributions));
  const featuredRoomPerson = roomPersonId ? byId(roomPersonId) : null;

  const { birthdays, remembrances } = todaysFamilyMoments(PEOPLE);
  const upcoming = (!birthdays.length && !remembrances.length) ? nextUpcomingBirthday(PEOPLE) : null;
  const milestones = timelineMilestones(PEOPLE);
  const crestPeople = crestSlice(PEOPLE);

  return (
    <section className="wrap home-dashboard" style={{ paddingTop: 0 }}>
      <HeritageIntro icon={<FamilyBondIcon />} />
      <div className="home-hero cover-enter" style={{ "--enter-delay": "0s" }}>
        <span className="eyebrow">Namaskara</span>
        <h1>Welcome Home</h1>
        <p className="lede">{familyLabel}'s living record — every birth, marriage, memory, and hard-won lesson, kept in one place.</p>
        {featuredParampara && (
          <div className="home-quote-card">
            <p>
              “{quoteExpanded ? featuredText.description : truncateAtWord(featuredText.description, QUOTE_TRUNCATE_LEN)}”
              {featuredText.description.length > QUOTE_TRUNCATE_LEN && (
                <button
                  type="button" className="home-quote-readmore"
                  onClick={(e) => { e.stopPropagation(); setQuoteExpanded((x) => !x); }}
                >
                  {quoteExpanded ? " Show less" : " Read more"}
                </button>
              )}
            </p>
            <button type="button" className="home-quote-source" onClick={() => onNav("parampara")}>— Our Parampara</button>
          </div>
        )}
      </div>

      {(birthdays.length > 0 || remembrances.length > 0 || upcoming) && (
        <div className="today-card cover-enter" style={{ "--enter-delay": "0.02s" }}>
          <div className="today-card-head">
            <span className="eyebrow">Today in our family</span>
            <span className="today-card-icon"><DateIcon /></span>
          </div>
          {birthdays.map((p) => (
            <button key={p.id} type="button" className="today-row" onClick={() => onSelectPerson(p.id)}>
              <PersonAvatar person={p} size={40} minGen={MIN_GEN} maxGen={MAX_GEN} className="avatar" />
              <span><b className="today-tag today-tag-birthday">Birthday</b>{p.name} · {yearsLabel(p)}</span>
            </button>
          ))}
          {remembrances.map((p) => (
            <button key={p.id} type="button" className="today-row" onClick={() => onSelectPerson(p.id)}>
              <PersonAvatar person={p} size={40} minGen={MIN_GEN} maxGen={MAX_GEN} className="avatar" />
              <span><b className="today-tag today-tag-remembrance">Remembrance</b>{p.name} · {yearsLabel(p)}</span>
            </button>
          ))}
          {upcoming && (
            <button type="button" className="today-row" onClick={() => onSelectPerson(upcoming.p.id)}>
              <PersonAvatar person={upcoming.p} size={40} minGen={MIN_GEN} maxGen={MAX_GEN} className="avatar" />
              <span><b className="today-tag today-tag-upcoming">Coming up</b>{upcoming.p.name}'s birthday, {upcoming.date.toLocaleDateString("en-IN", { day: "numeric", month: "long" })}</span>
            </button>
          )}
          <button type="button" className="home-section-link today-view-all" onClick={() => onNav("vault")}>View all →</button>
        </div>
      )}

      {crestPeople.length > 0 && (
        <div className="card tree-crest-card cover-enter" style={{ "--enter-delay": "0.04s" }}>
          <div className="tree-crest-head">
            <span className="tree-crest-badge">{gens.size} generation{gens.size === 1 ? "" : "s"}</span>
            <button type="button" className="tree-crest-view-btn" onClick={() => onNav("tree")} aria-label="View full tree">
              <TreeIcon /><span>View</span>
            </button>
          </div>
          <div className="tree-crest-canvas-wrap">
            <IllustratedTree people={crestPeople} interactive={false} avatarSize={52} fitToWidth />
          </div>
          {gens.size > 2 && (
            <p className="tree-crest-partial-note">
              Showing the top 2 generations — <button type="button" onClick={() => onNav("tree")}>View more →</button>
            </p>
          )}
        </div>
      )}

      {SHOW_CHITRASHALE && featuredRoomPerson && (
        <button
          type="button" className="parampara-highlight-card chitrashale-highlight-card cover-enter"
          style={{ "--enter-delay": "0.48s", width: "100%" }} onClick={() => onOpenRoom(featuredRoomPerson.id)}
        >
          <span className="eyebrow">🪔 Anubhava Chitrashale</span>
          <p className="quote">Visit {featuredRoomPerson.name.split(" ")[0]}'s room today</p>
          <p className="who">Objects the family has placed there, waiting to be touched</p>
        </button>
      )}

      <FamilyFlame streak={FAMILY_FLAME_STREAK} onContinue={() => onContribute({ type: "memory" })} />

      <div className="cover-enter" style={{ "--enter-delay": "0.06s", marginTop: 24 }}>
        <InstallAppCard dismissible />
      </div>

      <div className="counters">
        <Counter value={PEOPLE.length} label="Members" delay={0.1} />
        <Counter value={gens.size} label="Generations" delay={0.18} />
        <Counter value={verifiedStories} label="Verified stories" delay={0.26} />
        <Counter value={lessons} label="Life lessons" delay={0.34} />
      </div>

      <div className="home-section-label cover-enter" style={{ "--enter-delay": "0.38s" }}>Quick actions</div>
      <div className="quick-actions cover-enter" style={{ "--enter-delay": "0.4s" }}>
        <button type="button" onClick={() => onNav("builder")}>
          <span className="quick-action-icon">👪</span>Add member
        </button>
        <button type="button" onClick={() => onContribute({ type: "date" })}>
          <span className="quick-action-icon">📅</span>Add event
        </button>
        <button type="button" onClick={() => onContribute({ type: "memory" })}>
          <span className="quick-action-icon">📝</span>Share story
        </button>
        <button type="button" className="quick-action-primary" onClick={onParamparaContribute}>
          <span className="quick-action-icon">🪔</span>Add tradition
        </button>
        <button type="button" onClick={() => onContribute({ type: "photo" })}>
          <span className="quick-action-icon">🖼️</span>Upload memory
        </button>
      </div>

      <div className="challenge-card cover-enter" style={{ "--enter-delay": "0.42s" }}>
        <span className="eyebrow">This month's family challenge</span>
        <h3>{challenge.title}</h3>
        <p>{challenge.text}</p>
        <button className="btn primary small" onClick={() => onContribute({ type: challenge.type })}>Contribute now</button>
      </div>

      {milestones.length > 1 && (
        <>
          <div className="home-section-head cover-enter" style={{ "--enter-delay": "0.46s" }}>
            <div className="home-section-label" style={{ marginTop: 0 }}>Journey through time</div>
            <button type="button" className="home-section-link" onClick={() => onNav("vault")}>View timeline →</button>
          </div>
          <div className="timeline-strip-wrap cover-enter" style={{ "--enter-delay": "0.48s" }}>
            <div className="timeline-strip">
              <div className="timeline-connector" aria-hidden="true" />
              {milestones.map(({ p, year }) => (
                <button key={p.id} type="button" className="timeline-stop" onClick={() => onSelectPerson(p.id)}>
                  <PersonAvatar person={p} size={56} minGen={MIN_GEN} maxGen={MAX_GEN} className="avatar" />
                  <b className="tnum">{year}</b>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="cover-cta cover-enter" style={{ "--enter-delay": "0.58s" }}>
        <button className="btn primary" onClick={() => onNav("tree")}>Enter the family tree</button>
      </div>

      <div className="home-quote-banner cover-enter" style={{ "--enter-delay": "0.64s" }}>
        <span className="home-quote-banner-icon">🪔</span>
        <p>“We do not inherit the earth from our ancestors, we borrow it from our children.”<span>— Indian Proverb</span></p>
      </div>

      {IS_DEMO && (
        <div className="cover-enter" style={{ "--enter-delay": "0.7s" }}>
          <AuthPanel />
        </div>
      )}
    </section>
  );
}
