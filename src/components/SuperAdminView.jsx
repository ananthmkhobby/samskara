import { useState } from "react";
import { callApi } from "../lib/apiFetch";

const SECRET_SESSION_KEY = "vamsha.superadminSecret";

export default function SuperAdminView() {
  const [adminSecret, setAdminSecret] = useState(() => sessionStorage.getItem(SECRET_SESSION_KEY) || "");
  const [familyName, setFamilyName] = useState("");
  const [headEmail, setHeadEmail] = useState("");
  const [headName, setHeadName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await callApi("/api/provision-family", { adminSecret, familyName, headEmail, headName });
      setResult(data);
      sessionStorage.setItem(SECRET_SESSION_KEY, adminSecret);
      setFamilyName("");
      setHeadEmail("");
      setHeadName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 2000);
    } catch { /* clipboard unavailable */ }
  }

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>Provision a new family</h2>
        <p>Internal tool — not linked from anywhere in the app. Creates a real login account and hands the family head credentials to pass along yourself.</p>
      </div>
      <form onSubmit={submit} className="card" style={{ maxWidth: 460, padding: 20 }}>
        <div className="form-row">
          <label>Admin secret</label>
          <input type="password" required value={adminSecret} onChange={(e) => setAdminSecret(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Family name</label>
          <input type="text" required placeholder="e.g. The Sharma Family" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Head's email</label>
          <input type="email" required placeholder="head@example.com" value={headEmail} onChange={(e) => setHeadEmail(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Head's name (optional)</label>
          <input type="text" placeholder="e.g. Kavya Reddy" value={headName} onChange={(e) => setHeadName(e.target.value)} />
        </div>
        {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
        <button type="submit" className="btn primary" disabled={busy} style={{ marginTop: 8 }}>{busy ? "Creating…" : "Create family"}</button>
      </form>

      {result && (
        <div className="card" style={{ maxWidth: 460, padding: 20, marginTop: 16 }}>
          <h4 style={{ marginTop: 0 }}>Family created</h4>
          <div className="tag-row" style={{ alignItems: "center", marginBottom: 8 }}>
            <span style={{ minWidth: 90, fontSize: 13, color: "var(--ink-faint)" }}>Family</span>
            <input type="text" readOnly value={result.familyName} style={{ flex: 1 }} />
          </div>
          <div className="tag-row" style={{ alignItems: "center", marginBottom: 8 }}>
            <span style={{ minWidth: 90, fontSize: 13, color: "var(--ink-faint)" }}>Email</span>
            <input type="text" readOnly value={result.headEmail} style={{ flex: 1 }} />
            <button type="button" className="btn small ghost" onClick={() => copy(result.headEmail, "email")}>{copied === "email" ? "Copied!" : "Copy"}</button>
          </div>
          <div className="tag-row" style={{ alignItems: "center" }}>
            <span style={{ minWidth: 90, fontSize: 13, color: "var(--ink-faint)" }}>Password</span>
            <input type="text" readOnly value={result.password} style={{ flex: 1 }} />
            <button type="button" className="btn small ghost" onClick={() => copy(result.password, "password")}>{copied === "password" ? "Copied!" : "Copy"}</button>
          </div>
          <p className="form-hint">Hand these to the family head yourself — there's no email sent automatically.</p>
        </div>
      )}
    </section>
  );
}
