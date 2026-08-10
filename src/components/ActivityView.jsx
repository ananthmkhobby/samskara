import { PEOPLE, PRACTICE_LOGS } from "../data/people";
import { byId, MIN_GEN, MAX_GEN } from "../data/helpers";
import { categoryFor } from "../lib/parampara";
import PersonAvatar from "./PersonAvatar";

// Everything the family has actually done, newest first — the answer to
// "has anything happened since I last looked?", which until now you could
// only get by hunting through the Gallery, the Vault and each Folio in turn.
//
// Built entirely from records that already exist (contributions and practice
// logs); there's no separate activity table to keep in sync, and therefore
// nothing that can silently drift out of step with what really happened.

const SEEN_KEY_PREFIX = "vamsha.activitySeen.";

export function seenKeyFor(familyId) {
  return `${SEEN_KEY_PREFIX}${familyId}`;
}

// The highest contribution id this device has already looked at. Kept in
// localStorage rather than the database: "have I seen this?" is a per-device
// question, and storing it server-side would mean a write on every visit.
export function lastSeenId(familyId) {
  try {
    return Number(localStorage.getItem(seenKeyFor(familyId))) || 0;
  } catch {
    return 0;
  }
}

export function markAllSeen(familyId, highestId) {
  try {
    localStorage.setItem(seenKeyFor(familyId), String(highestId));
  } catch { /* storage unavailable — badge just won't persist */ }
}

// One plain sentence per kind of thing, in the family's own language rather
// than the database's ("edit", "chitrashalaObject").
function describe(c) {
  const person = c.personId ? byId(c.personId) : null;
  const who = person ? person.name : null;
  switch (c.type) {
    case "memory": return who ? `shared a memory about ${who}` : "shared a family memory";
    case "photo": return who ? `added a photo of ${who}` : "added a photo";
    case "audio": return who ? `added a recording of ${who}` : "added a recording";
    case "video": return who ? `added a video of ${who}` : "added a video";
    case "document": return who ? `added a document to ${who}'s folio` : "added a document";
    case "date": return who ? `added an important date for ${who}` : "added an important date";
    case "edit": return who ? `updated ${c.fieldLabel || "a detail"} on ${who}'s folio` : `updated ${c.fieldLabel || "a detail"}`;
    case "newPerson": return `added ${c.name || c.newPersonName || "someone new"} to the tree`;
    case "interview": return who ? `recorded a guided interview with ${who}` : "recorded a guided interview";
    case "parampara": return `added to Parampara — ${categoryFor(c.field).label}`;
    case "newBook": return `added ${c.name || "a book"} to the Family Library`;
    case "library_entry": return "added to a book's story in the Library";
    case "chitrashalaObject": return who ? `placed something in ${who}'s room` : "placed something in a room";
    case "chitrashalaReflection": return who ? `left a reflection about ${who}` : "left a reflection";
    default: return "added something to the archive";
  }
}

function dayBucket(dateStr) {
  if (!dateStr) return "Earlier";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateStr}T00:00:00`);
  const diff = Math.round((today - d) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff <= 7) return "This week";
  if (diff <= 30) return "This month";
  return "Earlier";
}

const BUCKET_ORDER = ["Today", "Yesterday", "This week", "This month", "Earlier"];

export default function ActivityView({ contributions, canModerate, onSelectPerson, onNav, familyId }) {
  // Only things that actually landed — a pending proposal isn't family news
  // yet, and showing it here would leak an unreviewed claim to everyone.
  // Moderators get a separate nudge to the review queue instead.
  const verified = contributions.filter((c) => c.status === "Verified");
  const pendingCount = contributions.filter((c) => c.status === "Pending").length;

  const items = [
    ...verified.map((c) => ({
      key: `c${c.id}`, sortId: c.id, date: c.date,
      who: c.contributor || "Someone", text: describe(c), personId: c.personId,
    })),
    ...PRACTICE_LOGS.map((l) => ({
      key: `p${l.id}`, sortId: 0, date: l.loggedDate,
      who: l.contributor || "Someone",
      text: `logged ${l.count} × ${l.practiceLabel}${byId(l.personId) ? ` for ${byId(l.personId).name}` : ""}`,
      personId: l.personId,
    })),
  ].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.sortId - a.sortId);

  const grouped = BUCKET_ORDER
    .map((label) => ({ label, rows: items.filter((i) => dayBucket(i.date) === label) }))
    .filter((g) => g.rows.length);

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>What's new</h2>
        <p>Everything the family has added lately, newest first.</p>
      </div>

      {canModerate && pendingCount > 0 && (
        <button type="button" className="card activity-review-nudge" onClick={() => onNav("admin")}>
          <b>{pendingCount} {pendingCount === 1 ? "item is" : "items are"} waiting for your review</b>
          <span>Nothing a member proposes appears below until you approve it →</span>
        </button>
      )}

      {!items.length ? (
        <div className="card" style={{ padding: 22, textAlign: "center" }}>
          <p className="folio-summary">Nothing yet. The moment someone adds a memory, a photo or a date, it'll show up here.</p>
        </div>
      ) : grouped.map(({ label, rows }) => (
        <div key={label} style={{ marginBottom: 18 }}>
          <div className="home-section-label">{label}</div>
          <div className="card" style={{ padding: "6px 16px" }}>
            {rows.map((row) => {
              const person = row.personId ? byId(row.personId) : null;
              return (
                <button
                  key={row.key} type="button" className="today-row"
                  onClick={() => (person ? onSelectPerson(person.id) : undefined)}
                  style={{ cursor: person ? "pointer" : "default" }}
                >
                  {person
                    ? <PersonAvatar person={person} size={36} minGen={MIN_GEN} maxGen={MAX_GEN} className="avatar" />
                    : <div className="avatar" style={{ width: 36, height: 36, background: "var(--ink-faint)" }} />}
                  <span><b>{row.who}</b> {row.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
