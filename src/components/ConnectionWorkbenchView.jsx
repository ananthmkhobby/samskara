import { useEffect, useState } from "react";
import { PEOPLE } from "../data/people";
import { byId } from "../data/helpers";
import { CURRENT_FAMILY_ID } from "../data/session";
import { fetchWorkbenchTasks, fetchWorkbenchClaims, fetchFamilyMembers, resolveWorkbenchTask, setMemberPersonLink } from "../data/familyDb";

const TABS = [
  { key: "UNLINKED_MEMBER", label: "Unlinked members" },
  { key: "UNRESOLVED_PATH", label: "Unresolved paths" },
  { key: "PROVISIONAL_PERSON", label: "Provisional people" },
  { key: "POSSIBLE_DUPLICATE", label: "Possible duplicates" },
];

// Fast Family Onboarding Phase 1's admin "Needs Connection" queue — see
// docs/FAST_FAMILY_ONBOARDING.md. Deliberately a thin layer: every action
// here calls the single resolve_workbench_task() RPC and then reloads,
// same interaction shape AdminView.jsx's existing EditRelationshipsCard
// already uses for "fix relationships" (the RPC's own validation/cascade
// logic means local state can't safely be patched in place). An admin can
// always ignore this entirely and fix anything directly through the
// ordinary Folio/EditModal/EditRelationshipsCard tools instead — this is a
// convenience layer on top, never a gate.
export default function ConnectionWorkbenchView({ onDone }) {
  const [tab, setTab] = useState("UNLINKED_MEMBER");
  const [tasks, setTasks] = useState(null);
  const [claims, setClaims] = useState(null);
  const [members, setMembers] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [picks, setPicks] = useState({}); // taskId -> chosen existing-person id, for link_existing_person

  useEffect(() => {
    Promise.all([
      fetchWorkbenchTasks(CURRENT_FAMILY_ID),
      fetchWorkbenchClaims(CURRENT_FAMILY_ID),
      fetchFamilyMembers(CURRENT_FAMILY_ID),
    ]).then(([t, c, m]) => { setTasks(t); setClaims(c); setMembers(m); }).catch((err) => setError(err.message));
  }, []);

  // "Unlinked members" isn't its own task_type in the DB — it's derived
  // live from family_members.placement_status, since that's the direct
  // source of truth and a member can become unlinked (fresh join, flag
  // off, no claim submitted) without ever generating a task row.
  const unlinkedMembers = (members || []).filter((m) => m.placementStatus !== "PLACED_CONFIRMED" && !m.personId);
  const openTasks = (tasks || []).filter((t) => t.status === "OPEN");

  async function act(taskId, action, payload) {
    setBusyId(taskId);
    setError("");
    try {
      await resolveWorkbenchTask(taskId, action, payload || {});
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusyId(null);
    }
  }

  function claimFor(task) {
    return claims?.find((c) => c.id === task.pathClaimId);
  }
  function memberFor(task) {
    return members?.find((m) => m.id === task.familyMemberId);
  }

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>Needs Connection</h2>
        <p>Every member or person Fast Family Onboarding couldn't fully place yet — each has a real action to resolve it.</p>
      </div>

      <div className="admin-tabs" style={{ marginBottom: 16 }}>
        {TABS.map((t) => <button key={t.key} className={`chip${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
      </div>

      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      {tasks === null && <div className="empty-state">Loading…</div>}

      {tasks !== null && tab === "UNLINKED_MEMBER" && (
        unlinkedMembers.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {unlinkedMembers.map((m) => (
              <div key={m.id} className="card" style={{ padding: 16 }}>
                <strong>{m.displayName || "(no display name)"}</strong>
                <p className="form-hint" style={{ margin: "4px 0" }}>Status: {m.placementStatus}</p>
                <select value={picks[m.id] || ""} onChange={(e) => setPicks((p) => ({ ...p, [m.id]: e.target.value }))} style={{ marginRight: 8 }}>
                  <option value="">— pick who they are in the tree —</option>
                  {[...PEOPLE].sort((a, b) => a.name.localeCompare(b.name)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button
                  type="button" className="btn small primary" disabled={!picks[m.id] || busyId === m.id}
                  onClick={async () => {
                    setBusyId(m.id);
                    try {
                      await setMemberPersonLink(m.id, picks[m.id]);
                      window.location.reload();
                    } catch (err) { setError(err.message); setBusyId(null); }
                  }}
                >
                  Link
                </button>
              </div>
            ))}
          </div>
        ) : <div className="empty-state">No unlinked members right now.</div>
      )}

      {tasks !== null && tab === "UNRESOLVED_PATH" && (
        openTasks.filter((t) => t.taskType === "UNRESOLVED_PATH").length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {openTasks.filter((t) => t.taskType === "UNRESOLVED_PATH").map((t) => {
              const claim = claimFor(t);
              const member = memberFor(t);
              const anchor = claim?.anchorPersonId ? byId(claim.anchorPersonId) : null;
              return (
                <div key={t.id} className="card" style={{ padding: 16 }}>
                  <strong>{member?.displayName || "(unknown member)"}</strong>
                  <p className="form-hint" style={{ margin: "4px 0" }}>
                    Claims to be {claim?.relationship || "?"} of {anchor?.name || "someone unspecified"}
                    {claim?.branchSide ? ` (${claim.branchSide})` : ""}
                    {claim?.connectingPersonName ? ` — connecting person: ${claim.connectingPersonName}` : ""}
                  </p>
                  <div className="tag-row">
                    <button type="button" className="btn small ghost" disabled={busyId === t.id} onClick={() => act(t.id, "invite_missing_person", { proposed_name: claim?.connectingPersonName })}>
                      Invite missing person
                    </button>
                    <button type="button" className="btn small ghost" disabled={busyId === t.id} onClick={() => act(t.id, "close_unresolved", {})}>
                      Close unresolved
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <div className="empty-state">No unresolved paths right now.</div>
      )}

      {tasks !== null && tab === "PROVISIONAL_PERSON" && (
        openTasks.filter((t) => t.taskType === "PROVISIONAL_PERSON").length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {openTasks.filter((t) => t.taskType === "PROVISIONAL_PERSON").map((t) => {
              const person = t.provisionalPersonId ? byId(t.provisionalPersonId) : null;
              return (
                <div key={t.id} className="card" style={{ padding: 16 }}>
                  <strong>{person?.name || t.provisionalPersonId}</strong>
                  <p className="form-hint" style={{ margin: "4px 0" }}>
                    Named, not yet confirmed. Set their parents/spouse via the normal "Fix relationships" tool below first if needed, then confirm.
                  </p>
                  <div className="tag-row">
                    <button type="button" className="btn small primary" disabled={busyId === t.id} onClick={() => act(t.id, "confirm_provisional", {})}>
                      Confirm into the tree
                    </button>
                    <button type="button" className="btn small ghost" disabled={busyId === t.id} onClick={() => act(t.id, "invite_missing_person", {})}>
                      Invite this person
                    </button>
                    <button type="button" className="btn small ghost" disabled={busyId === t.id} onClick={() => act(t.id, "close_unresolved", {})}>
                      Close unresolved
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <div className="empty-state">No provisional people waiting right now.</div>
      )}

      {tasks !== null && tab === "POSSIBLE_DUPLICATE" && (
        <div className="empty-state">Automatic duplicate-person detection isn't built yet — this tab is a placeholder for a later phase.</div>
      )}

      <button type="button" className="btn ghost" style={{ marginTop: 20 }} onClick={onDone}>Back</button>
    </section>
  );
}
