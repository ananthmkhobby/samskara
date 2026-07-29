import { useEffect, useState } from "react";
import { MIN_GEN, MAX_GEN, byId, yearsLabel } from "../data/helpers";
import { IS_DEMO, CURRENT_FAMILY_ID, CURRENT_USER_ID, CURRENT_ROLE } from "../data/session";
import { createInvite, fetchFamilyMembers, updateMemberRole, setMemberPersonLink } from "../data/familyDb";
import { categoryFor } from "../lib/parampara";
import { libraryCategoryFor } from "../lib/library";
import { spotFor } from "../lib/chitrashale";
import { BOOKS, PEOPLE } from "../data/people";
import PersonAvatar from "./PersonAvatar";

const TABS = ["Pending", "Verified", "Rejected", "All"];
const ROLE_LABELS = { head: "Family Head", admin: "Admin", member: "Member" };

function RosterCard() {
  const [members, setMembers] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const isHead = CURRENT_ROLE === "head";
  const isModerator = CURRENT_ROLE === "head" || CURRENT_ROLE === "admin";

  useEffect(() => {
    fetchFamilyMembers(CURRENT_FAMILY_ID).then(setMembers).catch((err) => setError(err.message));
  }, []);

  async function changeRole(member, role) {
    setBusyId(member.id);
    setError("");
    try {
      await updateMemberRole(member.id, role);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role } : m)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function changePersonLink(member, personId) {
    setBusyId(member.id);
    setError("");
    try {
      await setMemberPersonLink(member.id, personId || null);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, personId: personId || null } : m)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 18, padding: 16 }}>
      <h4 style={{ marginTop: 0 }}>Family roster</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>
        {isHead ? "As Family Head, you can promote a Member to Admin (or step one back down) here." : "Only the Family Head can change roles — you can see who's who below."}
      </p>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      {members === null ? null : members.map((m) => (
        <div className="queue-row" key={m.id} style={{ gridTemplateColumns: "auto 1fr auto", padding: "10px 0" }}>
          <div className="avatar" style={{ width: 34, height: 34, background: "var(--ink-faint)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>
            {(m.displayName || "?")[0].toUpperCase()}
          </div>
          <div className="queue-main">
            <b>{m.displayName || "Unnamed member"}</b>
            <div className="queue-meta">{ROLE_LABELS[m.role]} · joined {m.createdAt?.slice(0, 10)}</div>
            {(m.userId === CURRENT_USER_ID || isModerator) && (
              <div style={{ marginTop: 6 }}>
                <label style={{ fontSize: 11, color: "var(--ink-faint)", display: "block", marginBottom: 3 }}>
                  Which one is {m.userId === CURRENT_USER_ID ? "you" : "this"} in the tree?
                </label>
                <select
                  value={m.personId || ""} disabled={busyId === m.id}
                  onChange={(e) => changePersonLink(m, e.target.value)}
                  style={{ fontSize: 13, padding: "4px 6px" }}
                >
                  <option value="">— not linked —</option>
                  {[...PEOPLE].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{yearsLabel(p) ? ` (${yearsLabel(p)})` : ""}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {isHead && m.role !== "head" && (
            <div className="queue-actions">
              {m.role === "member" ? (
                <button type="button" className="btn small" disabled={busyId === m.id} onClick={() => changeRole(m, "admin")}>
                  {busyId === m.id ? "…" : "Make Admin"}
                </button>
              ) : (
                <button type="button" className="btn small ghost" disabled={busyId === m.id} onClick={() => changeRole(m, "member")}>
                  {busyId === m.id ? "…" : "Remove Admin"}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function InviteCard() {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const code = await createInvite(CURRENT_FAMILY_ID, CURRENT_USER_ID);
      setLink(`${window.location.origin}/?code=${code}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — link is still visible to copy manually */ }
  }

  return (
    <div className="card" style={{ marginBottom: 18, padding: 16 }}>
      <h4 style={{ marginTop: 0 }}>Invite a new member</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>Generates a one-time link — anyone who opens it can create an account and join this family as a member.</p>
      {link ? (
        <div className="tag-row" style={{ alignItems: "center" }}>
          <input type="text" readOnly value={link} style={{ flex: 1, minWidth: 240 }} onFocus={(e) => e.target.select()} />
          <button type="button" className="btn small" onClick={copy}>{copied ? "Copied!" : "Copy link"}</button>
          <button type="button" className="btn small ghost" onClick={generate} disabled={busy}>New link</button>
        </div>
      ) : (
        <button type="button" className="btn small primary" onClick={generate} disabled={busy}>{busy ? "Generating…" : "Generate invite link"}</button>
      )}
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
    </div>
  );
}

export default function AdminView({ contributions, onApprove, onReject, canModerate }) {
  const [tab, setTab] = useState("Pending");
  const pendingCount = contributions.filter((c) => c.status === "Pending").length;
  const rows = contributions.filter((c) => tab === "All" || c.status === tab).slice().reverse();

  function snippetFor(c) {
    if (c.type === "newBook") {
      try {
        const { story } = JSON.parse(c.content);
        return story ? `📚 ${story.slice(0, 90)}${story.length > 90 ? "…" : ""}` : `📚 New book — ${libraryCategoryFor(c.field).label}`;
      } catch { return "📚 New book"; }
    }
    if (c.type === "library_entry") {
      const book = BOOKS.find((b) => b.id === c.bookId);
      const kindLabel = { wisdom: "Lesson", memory: "Memory", discussion: "Discussion" }[c.field] || c.field;
      return `${kindLabel} on "${book?.title || "a book"}": "${c.content.slice(0, 70)}${c.content.length > 70 ? "…" : ""}"`;
    }
    if (c.type === "parampara") {
      if (c.field === "lineage") return "🕉️ Proposed family lineage details";
      try {
        const { description } = JSON.parse(c.content);
        return `${categoryFor(c.field).icon} ${description.slice(0, 90)}${description.length > 90 ? "…" : ""}`;
      } catch { return "New Parampara entry"; }
    }
    if (c.type === "chitrashalaObject") {
      const spot = spotFor(c.field);
      return `🪔 "${c.title}"${spot ? ` — ${spot.label.toLowerCase()}` : ""}`;
    }
    if (c.type === "chitrashalaReflection") return `🪔 "${c.content.slice(0, 90)}${c.content.length > 90 ? "…" : ""}"`;
    if (c.type === "interview") return `🎙️ AI-drafted chapter "${c.title}": "${c.text.slice(0, 80)}${c.text.length > 80 ? "…" : ""}"`;
    if (c.type === "newPerson") {
      const anchor = c.anchorPersonId ? byId(c.anchorPersonId) : null;
      const anchorName = anchor ? anchor.name : "someone in the tree";
      return c.relation === "spouse"
        ? `👪 Add ${c.name} as spouse of ${anchorName}`
        : c.relation === "parent"
        ? `👪 Add ${c.name} as a parent of ${anchorName}`
        : `👪 Add ${c.name} as son/daughter of ${anchorName}`;
    }
    if (c.field === "heritage") {
      try {
        const { rashi, gotra } = JSON.parse(c.content);
        return `✎ Proposed heritage details: ${[rashi && `Rashi: ${rashi}`, gotra && `Gotra: ${gotra}`].filter(Boolean).join(", ") || "(cleared)"}`;
      } catch { return "✎ Proposed heritage details"; }
    }
    if (c.type === "edit") return `✎ Proposed ${c.fieldLabel}: "${c.content.slice(0, 90)}${c.content.length > 90 ? "…" : ""}"`;
    if (c.type === "photo") return `📷 Photo — ${c.content}`;
    if (c.type === "document") return `📄 Document — ${c.content}`;
    if (c.type === "date") return `📅 ${c.content}`;
    return c.content;
  }

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>Review queue</h2>
        <p>Everything the family has submitted or proposed to edit, waiting for a second pair of eyes before it changes the archive.</p>
        {!canModerate && <p className="form-hint" style={{ marginTop: 6 }}>You can see what's pending, but only Admins or the Family Head can approve or reject.</p>}
      </div>
      {!IS_DEMO && canModerate && <InviteCard />}
      {!IS_DEMO && canModerate && <RosterCard />}
      <div className="admin-tabs">
        {TABS.map((t) => (
          <button key={t} className={`chip${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t}{t === "Pending" ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>
      <div className="card">
        {rows.length ? rows.map((c) => {
          const person = c.personId ? byId(c.personId) : null;
          const target = person ? person.name
            : c.type === "newPerson" ? `New: ${c.name}`
            : c.type === "parampara" ? (c.title || categoryFor(c.field).label)
            : c.type === "newBook" ? `New book: ${c.name}`
            : c.type === "library_entry" ? (BOOKS.find((b) => b.id === c.bookId)?.title || "A book")
            : c.type === "chitrashalaObject" || c.type === "chitrashalaReflection" ? "Someone's room"
            : `New: ${c.newPersonName}`;
          const isRealAudio = c.type === "audio" && !!c.mediaUrl;
          const isRealVideo = c.type === "video" && !!c.mediaUrl;
          return (
            <div className="queue-row" key={c.id}>
              {person
                ? <PersonAvatar person={person} size={40} minGen={MIN_GEN} maxGen={MAX_GEN} />
                : <div className="avatar" style={{ width: 40, height: 40, background: "var(--ink-faint)" }}>?</div>}
              <div className="queue-main">
                <b>{target}</b>
                <div className="queue-meta">
                  <span className={`type-badge${c.type === "edit" ? " edit" : ""}`}>
                    {c.type === "newPerson" ? "new family member"
                      : c.type === "interview" ? "AI interview"
                      : c.type === "parampara" ? `parampara · ${categoryFor(c.field).label}`
                      : c.type === "newBook" ? `library · ${libraryCategoryFor(c.field).label}`
                      : c.type === "library_entry" ? `library · ${c.field}`
                      : c.type === "chitrashalaObject" ? "chitrashale · object"
                      : c.type === "chitrashalaReflection" ? "chitrashale · reflection"
                      : c.type}
                  </span> · from {c.contributor} · {c.date}
                </div>
                {isRealAudio ? <audio src={c.mediaUrl} controls style={{ maxWidth: 260, marginTop: 6 }} />
                  : isRealVideo ? <video src={c.mediaUrl} controls style={{ maxWidth: 260, marginTop: 6, borderRadius: 6 }} />
                    : <div className="queue-snippet">{snippetFor(c)}</div>}
              </div>
              <div className="queue-actions">
                {c.status === "Pending" ? (
                  canModerate ? (
                    <>
                      <button className="btn small" onClick={() => onApprove(c)}>Approve</button>
                      <button className="btn small ghost" onClick={() => onReject(c)}>Reject</button>
                    </>
                  ) : <span className="status-pill Pending">Awaiting admin</span>
                ) : <span className={`status-pill ${c.status}`}>{c.status}</span>}
              </div>
            </div>
          );
        }) : <div className="empty-state">Nothing in “{tab}” right now.</div>}
      </div>
    </section>
  );
}
