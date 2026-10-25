import { useEffect, useState } from "react";
import { CURRENT_FAMILY_ID } from "../data/session";
import { fetchFamilyMembers } from "../data/familyDb";
import { callApi } from "../lib/apiFetch";

const QUICK_TARGETS = [
  { key: "all", label: "Everyone" },
  { key: "admins", label: "Admins & Head only" },
  { key: "custom", label: "Choose people" },
];

// Moderator-only compose-and-send panel for api/reset-member-password.js's
// send_family_notification action. Reuses the same roster fetch the
// Members tab already uses rather than a new query — this tab doesn't
// need anything the app doesn't already load elsewhere.
export default function NotificationsAdminTab() {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState("");
  const [target, setTarget] = useState("all");
  const [selected, setSelected] = useState(() => new Set());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    fetchFamilyMembers(CURRENT_FAMILY_ID).then(setMembers).catch((err) => setError(err.message));
  }, []);

  function toggleSelected(memberId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  async function send() {
    setBusy(true);
    setError("");
    setResult("");
    try {
      const body2 = {
        familyId: CURRENT_FAMILY_ID,
        target: target === "custom" ? { memberIds: [...selected] } : target,
        title,
        body,
      };
      const data = await callApi("/api/reset-member-password", { action: "send_family_notification", ...body2 });
      setResult(
        data.recipients
          ? `Sent to ${data.recipients} of ${data.targeted} targeted member(s) (${data.sent}/${data.total} device(s)).${data.removedDead ? ` Removed ${data.removedDead} dead subscription(s).` : ""}`
          : "No one in that group has notifications enabled yet."
      );
      setTitle("");
      setBody("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const canSend = title.trim() && body.trim() && (target !== "custom" || selected.size > 0) && !busy;

  return (
    <div className="card" style={{ padding: 20, maxWidth: 560 }}>
      <p className="form-hint" style={{ marginTop: 0 }}>
        Sends a real push notification to the chosen people's devices — only reaches someone who's enabled notifications for Samskara. There's no way to un-send one, so a quick read-through before hitting send is worth it.
      </p>

      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}

      <div className="form-row">
        <label>Who should get this</label>
        <div className="tag-row" style={{ flexWrap: "wrap" }}>
          {QUICK_TARGETS.map((t) => (
            <button
              key={t.key} type="button"
              className={`chip${target === t.key ? " active" : ""}`}
              onClick={() => setTarget(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {target === "custom" && (
        <div className="form-row">
          {members === null && !error && <p className="form-hint">Loading members…</p>}
          {members && members.length === 0 && <p className="form-hint">No other members yet.</p>}
          {members && members.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
              {members.map((m) => (
                <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelected(m.id)} />
                  {m.displayName || "Unnamed member"}
                  <span className="form-hint" style={{ margin: 0 }}>({m.role})</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="form-row">
        <label>Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={65} placeholder="e.g. New photos from Diwali" />
      </div>
      <div className="form-row">
        <label>Message</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={240} rows={3} placeholder="Keep it short — most of a long message won't show in the notification itself." />
      </div>

      <button type="button" className="btn primary" disabled={!canSend} onClick={send}>
        {busy ? "Sending…" : "Send notification"}
      </button>
      {result && <p className="form-hint" style={{ marginTop: 10 }}>{result}</p>}
    </div>
  );
}
