import { useState } from "react";
import { MIN_GEN, MAX_GEN, byId } from "../data/helpers";
import { IS_DEMO, CURRENT_FAMILY_ID, CURRENT_USER_ID } from "../data/session";
import { createInvite } from "../data/familyDb";
import { categoryFor } from "../lib/parampara";
import PersonAvatar from "./PersonAvatar";

const TABS = ["Pending", "Verified", "Rejected", "All"];

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
    if (c.type === "parampara") {
      if (c.field === "lineage") return "🕉️ Proposed family lineage details";
      try {
        const { description } = JSON.parse(c.content);
        return `${categoryFor(c.field).icon} ${description.slice(0, 90)}${description.length > 90 ? "…" : ""}`;
      } catch { return "New Parampara entry"; }
    }
    if (c.type === "interview") return `🎙️ AI-drafted chapter "${c.title}": "${c.text.slice(0, 80)}${c.text.length > 80 ? "…" : ""}"`;
    if (c.type === "newPerson") {
      const anchor = c.anchorPersonId ? byId(c.anchorPersonId) : null;
      const anchorName = anchor ? anchor.name : "someone in the tree";
      return c.relation === "spouse"
        ? `👪 Add ${c.name} as spouse of ${anchorName}`
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
          const target = person ? person.name : c.type === "newPerson" ? `New: ${c.name}` : c.type === "parampara" ? (c.title || categoryFor(c.field).label) : `New: ${c.newPersonName}`;
          const isRealAudio = c.type === "audio" && !!c.mediaUrl;
          const isRealVideo = c.type === "video" && !!c.mediaUrl;
          return (
            <div className="queue-row" key={c.id}>
              {person
                ? <PersonAvatar person={person} size={40} minGen={MIN_GEN} maxGen={MAX_GEN} />
                : <div className="avatar" style={{ width: 40, height: 40, background: "var(--ink-faint)" }}>?</div>}
              <div className="queue-main">
                <b>{target}</b>
                <div className="queue-meta"><span className={`type-badge${c.type === "edit" ? " edit" : ""}`}>{c.type === "newPerson" ? "new family member" : c.type === "interview" ? "AI interview" : c.type === "parampara" ? `parampara · ${categoryFor(c.field).label}` : c.type}</span> · from {c.contributor} · {c.date}</div>
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
