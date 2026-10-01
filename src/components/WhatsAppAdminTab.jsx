import { useEffect, useState } from "react";
import { CURRENT_FAMILY_ID } from "../data/session";
import { fetchWhatsAppMessages } from "../data/familyDb";

const STATUS_LABELS = {
  received: "Received", processing: "Processing", completed: "Completed",
  failed: "Failed", duplicate: "Duplicate",
};

// Developer/debug surface for the WhatsApp integration (spec section 26) —
// a moderator-only log of recent inbound messages and what happened to
// each one. The actual resulting memories show up exactly like any other
// submission, in the Review queue tab above — this is purely for tracing
// what the webhook did, not a second place to approve content.
export default function WhatsAppAdminTab() {
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState("");

  function load() {
    setError("");
    fetchWhatsAppMessages(CURRENT_FAMILY_ID).then(setMessages).catch((err) => setError(err.message));
  }

  useEffect(load, []);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 14px 0" }}>
        <button type="button" className="btn small ghost" onClick={load}>Refresh</button>
      </div>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)", padding: "0 14px" }}>{error}</p>}
      {messages === null && !error && <p className="form-hint" style={{ padding: "0 14px 14px" }}>Loading…</p>}
      {messages && !messages.length && <p className="form-hint" style={{ padding: "0 14px 14px" }}>No WhatsApp messages received yet.</p>}
      {messages && messages.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "8px 14px" }}>When</th>
                <th style={{ padding: "8px 14px" }}>From</th>
                <th style={{ padding: "8px 14px" }}>Type</th>
                <th style={{ padding: "8px 14px" }}>Status</th>
                <th style={{ padding: "8px 14px" }}>Error</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>{new Date(m.createdAt).toLocaleString()}</td>
                  <td style={{ padding: "8px 14px" }}>{m.phoneNumber}</td>
                  <td style={{ padding: "8px 14px" }}>{m.messageType}</td>
                  <td style={{ padding: "8px 14px" }}>{STATUS_LABELS[m.processingStatus] || m.processingStatus}</td>
                  <td style={{ padding: "8px 14px", color: "var(--ink-soft)" }}>{m.errorMessage || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
