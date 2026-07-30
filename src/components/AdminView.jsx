import { useEffect, useState } from "react";
import { MIN_GEN, MAX_GEN, byId, yearsLabel } from "../data/helpers";
import { IS_DEMO, CURRENT_FAMILY_ID, CURRENT_USER_ID, CURRENT_ROLE } from "../data/session";
import {
  createInvite, fetchFamilyMembers, updateMemberRole, setMemberPersonLink,
  updateMemberDisplayName, fetchInvites, revokeInvite, fetchMemberEmail,
  createMemberLogin, resetMemberPassword,
} from "../data/familyDb";
import { categoryFor } from "../lib/parampara";
import { libraryCategoryFor } from "../lib/library";
import { spotFor } from "../lib/chitrashale";
import { BOOKS, PEOPLE } from "../data/people";
import PersonAvatar from "./PersonAvatar";

const TABS = ["Pending", "Verified", "Rejected", "All"];
const ADMIN_TABS = ["Members", "Review queue"];
const ROLE_LABELS = { head: "Family Head", admin: "Admin", member: "Member" };

function RosterCard() {
  const [members, setMembers] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [nameDraft, setNameDraft] = useState("");
  const [emails, setEmails] = useState({});
  const [resettingId, setResettingId] = useState(null);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [resetDone, setResetDone] = useState({});
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

  function startRename(member) {
    setRenamingId(member.id);
    setNameDraft(member.displayName || "");
  }

  async function showEmail(member) {
    setEmails((prev) => ({ ...prev, [member.id]: "…" }));
    try {
      const email = await fetchMemberEmail(member.id);
      setEmails((prev) => ({ ...prev, [member.id]: email || "(no email on file)" }));
    } catch (err) {
      setEmails((prev) => ({ ...prev, [member.id]: null }));
      setError(err.message);
    }
  }

  async function saveReset(member) {
    if (passwordDraft.length < 6) { setError("Password must be at least 6 characters."); return; }
    setBusyId(member.id);
    setError("");
    try {
      await resetMemberPassword(CURRENT_FAMILY_ID, member.id, passwordDraft);
      setResetDone((prev) => ({ ...prev, [member.id]: passwordDraft }));
      setResettingId(null);
      setPasswordDraft("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function saveRename(member) {
    setBusyId(member.id);
    setError("");
    try {
      await updateMemberDisplayName(member.id, nameDraft);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, displayName: nameDraft.trim() || null } : m)));
      setRenamingId(null);
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
            {renamingId === m.id ? (
              <div className="tag-row" style={{ alignItems: "center", marginBottom: 4 }}>
                <input
                  type="text" autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Display name" style={{ fontSize: 13, padding: "4px 6px" }}
                />
                <button type="button" className="btn small" disabled={busyId === m.id} onClick={() => saveRename(m)}>
                  {busyId === m.id ? "…" : "Save"}
                </button>
                <button type="button" className="btn small ghost" onClick={() => setRenamingId(null)}>Cancel</button>
              </div>
            ) : (
              <b>
                {m.displayName || "Unnamed member"}
                {isModerator && (
                  <button type="button" className="link-btn" style={{ marginLeft: 8, fontSize: 12 }} onClick={() => startRename(m)}>Rename</button>
                )}
              </b>
            )}
            <div className="queue-meta">{ROLE_LABELS[m.role]} · joined {m.createdAt?.slice(0, 10)}</div>
            {isModerator && (
              emails[m.id] !== undefined ? (
                <div className="queue-meta">{emails[m.id] === null ? "Couldn't load email" : emails[m.id]}</div>
              ) : (
                <button type="button" className="link-btn" style={{ fontSize: 11 }} onClick={() => showEmail(m)}>
                  Show sign-up email
                </button>
              )
            )}
            {isModerator && (
              resetDone[m.id] ? (
                <p className="form-hint" style={{ marginTop: 4 }}>
                  New password: <b>{resetDone[m.id]}</b> — write it down, it won't be shown again.
                </p>
              ) : resettingId === m.id ? (
                <div className="tag-row" style={{ alignItems: "center", marginTop: 4 }}>
                  <input
                    type="text" autoFocus minLength={6} value={passwordDraft} onChange={(e) => setPasswordDraft(e.target.value)}
                    placeholder="New password (min 6 chars)" style={{ fontSize: 13, padding: "4px 6px" }}
                  />
                  <button type="button" className="btn small" disabled={busyId === m.id} onClick={() => saveReset(m)}>
                    {busyId === m.id ? "…" : "Set"}
                  </button>
                  <button type="button" className="btn small ghost" onClick={() => { setResettingId(null); setPasswordDraft(""); }}>Cancel</button>
                </div>
              ) : (
                <button type="button" className="link-btn" style={{ fontSize: 11 }} onClick={() => setResettingId(m.id)}>
                  Reset password
                </button>
              )
            )}
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

function InviteCard({ onCreated }) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [personId, setPersonId] = useState("");

  async function generate() {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const code = await createInvite(CURRENT_FAMILY_ID, CURRENT_USER_ID, personId || null);
      setLink(`${window.location.origin}/?code=${code}`);
      onCreated?.();
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
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--ink-faint)", display: "block", marginBottom: 3 }}>
          Who is this invite for? (optional — saves them a step in Roster later)
        </label>
        <select value={personId} onChange={(e) => setPersonId(e.target.value)} style={{ fontSize: 13, padding: "4px 6px" }}>
          <option value="">— not sure yet, they'll pick themselves —</option>
          {[...PEOPLE].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
            <option key={p.id} value={p.id}>{p.name}{yearsLabel(p) ? ` (${yearsLabel(p)})` : ""}</option>
          ))}
        </select>
      </div>
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

// Every invite generated for this family, so a link that was created and
// then navigated away from isn't invisible — and so an unused one can be
// revoked (e.g. sent to the wrong person, or no longer needed).
function InvitesList({ refreshKey }) {
  const [invites, setInvites] = useState(null);
  const [members, setMembers] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchInvites(CURRENT_FAMILY_ID).then(setInvites).catch((err) => setError(err.message));
    fetchFamilyMembers(CURRENT_FAMILY_ID).then(setMembers).catch(() => {});
  }, [refreshKey]);

  function statusFor(inv) {
    if (inv.usedAt) return "used";
    if (new Date(inv.expiresAt) < new Date()) return "expired";
    return "pending";
  }

  async function copy(inv) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?code=${inv.code}`);
      setCopiedId(inv.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch { /* clipboard unavailable */ }
  }

  async function revoke(inv) {
    setBusyId(inv.id);
    setError("");
    try {
      await revokeInvite(inv.id);
      setInvites((prev) => prev.filter((i) => i.id !== inv.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (invites !== null && !invites.length) return null;

  return (
    <div className="card" style={{ marginBottom: 18, padding: 16 }}>
      <h4 style={{ marginTop: 0 }}>Invite links</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>Every link generated so far, and whether it's been used yet.</p>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      {invites === null ? null : invites.map((inv) => {
        const status = statusFor(inv);
        const person = inv.personId ? byId(inv.personId) : null;
        const usedByMember = inv.usedBy ? members?.find((m) => m.userId === inv.usedBy) : null;
        return (
          <div className="queue-row" key={inv.id} style={{ gridTemplateColumns: "1fr auto", padding: "10px 0" }}>
            <div className="queue-main">
              <b>{person ? `For ${person.name}` : "Open invite"}</b>
              <div className="queue-meta">
                {status === "used" && `Used by ${usedByMember?.displayName || "a member"} · ${inv.usedAt.slice(0, 10)}`}
                {status === "expired" && `Expired ${inv.expiresAt.slice(0, 10)} · never used`}
                {status === "pending" && `Generated ${inv.createdAt.slice(0, 10)} · expires ${inv.expiresAt.slice(0, 10)}`}
              </div>
            </div>
            <div className="queue-actions">
              {status === "pending" && (
                <>
                  <button type="button" className="btn small" onClick={() => copy(inv)}>{copiedId === inv.id ? "Copied!" : "Copy link"}</button>
                  <button type="button" className="btn small ghost" disabled={busyId === inv.id} onClick={() => revoke(inv)}>
                    {busyId === inv.id ? "…" : "Revoke"}
                  </button>
                </>
              )}
              {status !== "pending" && <span className={`status-pill ${status === "used" ? "Verified" : "Rejected"}`}>{status === "used" ? "Used" : "Expired"}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Most elders have no email at all — the invite-link flow above needs one
// (Supabase accounts are always email-backed), so this gives Head/Admin a
// second path: pick a username and a password directly, hand them over on
// paper or by voice, done. The email is synthesized from the username
// under the hood (see usernameToEmail in api/_memberAuth.js) — the person
// never needs to know or type an email anywhere.
function CreateLoginCard({ onCreated }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [personId, setPersonId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await createMemberLogin(CURRENT_FAMILY_ID, { username, password, displayName, personId: personId || null });
      setCreated(result);
      setUsername(""); setPassword(""); setDisplayName(""); setPersonId("");
      onCreated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 18, padding: 16 }}>
      <h4 style={{ marginTop: 0 }}>Create a login without email</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>
        For anyone without an email address — pick a username and password for them, then tell them directly. They'll log in with "No email? Log in with username" on the login page.
      </p>
      {created && (
        <p className="form-hint" style={{ marginBottom: 12 }}>
          Created — username <b>{created.username}</b>, password <b>{created.password}</b>. Write these down; the password won't be shown again.
        </p>
      )}
      <form onSubmit={submit}>
        <div className="form-row">
          <label>Username</label>
          <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. amma1950" style={{ fontSize: 13, padding: "4px 6px" }} />
        </div>
        <div className="form-row">
          <label>Password</label>
          <input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 6 characters" style={{ fontSize: 13, padding: "4px 6px" }} />
        </div>
        <div className="form-row">
          <label>Their name</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Lakshmi Devi" style={{ fontSize: 13, padding: "4px 6px" }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: "var(--ink-faint)", display: "block", marginBottom: 3 }}>
            Which one is this in the tree? (optional)
          </label>
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} style={{ fontSize: 13, padding: "4px 6px" }}>
            <option value="">— not sure yet —</option>
            {[...PEOPLE].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
              <option key={p.id} value={p.id}>{p.name}{yearsLabel(p) ? ` (${yearsLabel(p)})` : ""}</option>
            ))}
          </select>
        </div>
        {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
        <button type="submit" className="btn small primary" disabled={busy}>{busy ? "Creating…" : "Create login"}</button>
      </form>
    </div>
  );
}

function MembersPage() {
  const [invitesRefreshKey, setInvitesRefreshKey] = useState(0);
  const [membersRefreshKey, setMembersRefreshKey] = useState(0);
  return (
    <>
      <InviteCard onCreated={() => setInvitesRefreshKey((k) => k + 1)} />
      <InvitesList refreshKey={invitesRefreshKey} />
      <CreateLoginCard onCreated={() => setMembersRefreshKey((k) => k + 1)} />
      <RosterCard key={membersRefreshKey} />
    </>
  );
}

export default function AdminView({ contributions, onApprove, onReject, canModerate }) {
  const showMembersTab = !IS_DEMO && canModerate;
  const [adminTab, setAdminTab] = useState(showMembersTab ? "Members" : "Review queue");
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
        <h2>{adminTab === "Members" ? "Manage members" : "Review queue"}</h2>
        <p>
          {adminTab === "Members"
            ? "Invite people, see who's joined, fix a name, or set which person in the tree someone is — for themselves or, if they never got around to it, for anyone."
            : "Everything the family has submitted or proposed to edit, waiting for a second pair of eyes before it changes the archive."}
        </p>
        {adminTab !== "Members" && !canModerate && <p className="form-hint" style={{ marginTop: 6 }}>You can see what's pending, but only Admins or the Family Head can approve or reject.</p>}
      </div>
      {showMembersTab && (
        <div className="admin-tabs">
          {ADMIN_TABS.map((t) => (
            <button key={t} className={`chip${adminTab === t ? " active" : ""}`} onClick={() => setAdminTab(t)}>{t}</button>
          ))}
        </div>
      )}
      {adminTab === "Members" ? <MembersPage /> : (
      <>
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
      </>
      )}
    </section>
  );
}
