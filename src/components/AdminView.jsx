import { useState } from "react";
import { MIN_GEN, MAX_GEN, byId, applyOverrides } from "../data/helpers";
import PersonAvatar from "./PersonAvatar";

const TABS = ["Pending", "Verified", "Rejected", "All"];

export default function AdminView({ contributions, overrides, onApprove, onReject, canModerate }) {
  const [tab, setTab] = useState("Pending");
  const pendingCount = contributions.filter((c) => c.status === "Pending").length;
  const rows = contributions.filter((c) => tab === "All" || c.status === tab).slice().reverse();

  function snippetFor(c) {
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
        {!canModerate && <p className="form-hint" style={{ marginTop: 6 }}>You're viewing as a Member — you can see what's pending, but only Admins or the Family Head can approve or reject. Switch your role in the top bar.</p>}
      </div>
      <div className="admin-tabs">
        {TABS.map((t) => (
          <button key={t} className={`chip${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t}{t === "Pending" ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>
      <div className="card">
        {rows.length ? rows.map((c) => {
          const person = c.personId ? applyOverrides(byId(c.personId), overrides) : null;
          const target = person ? person.name : c.type === "newPerson" ? `New: ${c.name}` : `New: ${c.newPersonName}`;
          const isRealAudio = c.type === "audio" && c.content?.startsWith("blob:");
          const isRealVideo = c.type === "video" && c.content?.startsWith("blob:");
          return (
            <div className="queue-row" key={c.id}>
              {person
                ? <PersonAvatar person={person} size={40} minGen={MIN_GEN} maxGen={MAX_GEN} />
                : <div className="avatar" style={{ width: 40, height: 40, background: "var(--ink-faint)" }}>?</div>}
              <div className="queue-main">
                <b>{target}</b>
                <div className="queue-meta"><span className={`type-badge${c.type === "edit" ? " edit" : ""}`}>{c.type === "newPerson" ? "new family member" : c.type === "interview" ? "AI interview" : c.type}</span> · from {c.contributor} · {c.date}</div>
                {isRealAudio ? <audio src={c.content} controls style={{ maxWidth: 260, marginTop: 6 }} />
                  : isRealVideo ? <video src={c.content} controls style={{ maxWidth: 260, marginTop: 6, borderRadius: 6 }} />
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
