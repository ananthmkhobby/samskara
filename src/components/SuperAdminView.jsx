import { useState } from "react";
import { callApi } from "../lib/apiFetch";

const SECRET_SESSION_KEY = "vamsha.superadminSecret";

// Mirrors the gatable-module list in src/data/session.js's isModuleEnabled()
// / the `families.module_flags` column — kept here as the one place that
// turns a flag key into a human label for this onboarding form.
const GATABLE_MODULES = [
  { key: "parampara", label: "Parampare" },
  { key: "library", label: "Family Library" },
  { key: "treasury", label: "Treasury of Wisdom" },
  { key: "journey", label: "Journey (map)" },
  { key: "japa", label: "Japa & Chanting" },
  { key: "vault", label: "Vault" },
  { key: "aiFeatures", label: "AI features (interview, photo-scan, translate)" },
];

// Interim stopgap until a real email service exists (see api/
// api/password-reset-requests.js) — lists requests filed from the login page's
// "Can't get in at all?" link. Resolving a password still happens manually
// (a service-role script, same call api/reset-member-password.js already
// makes) — this list only tracks who's waiting, "Mark resolved" is just
// bookkeeping once you've actually reset them and told them the new one.
function PasswordResetRequestsSection({ adminSecret }) {
  const [requests, setRequests] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resolvingId, setResolvingId] = useState(null);

  async function load() {
    if (!adminSecret) { setError("Enter the admin secret above first."); return; }
    setBusy(true);
    setError("");
    try {
      const data = await callApi("/api/password-reset-requests", { adminSecret, action: "list" });
      setRequests(data.requests);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resolve(id) {
    setResolvingId(id);
    try {
      await callApi("/api/password-reset-requests", { adminSecret, action: "resolve", id });
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 460, padding: 20, marginTop: 24 }}>
      <h4 style={{ marginTop: 0 }}>Password reset requests</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>
        Filed from the login page by anyone who couldn't get in and had no working "Forgot password" email. Reset them manually, then mark it resolved.
      </p>
      <button type="button" className="btn ghost small" disabled={busy} onClick={load}>{busy ? "Loading…" : "Load requests"}</button>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      {requests && requests.length === 0 && <p className="form-hint">Nothing open right now.</p>}
      {requests && requests.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          {requests.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
              <div>
                <strong>{r.email}</strong>
                <p className="form-hint" style={{ margin: "2px 0" }}>{r.note || "(no note)"}</p>
                <span className="form-hint">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <button type="button" className="btn small ghost" disabled={resolvingId === r.id} onClick={() => resolve(r.id)}>
                {resolvingId === r.id ? "…" : "Mark resolved"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SuperAdminView() {
  const [adminSecret, setAdminSecret] = useState(() => sessionStorage.getItem(SECRET_SESSION_KEY) || "");
  const [familyName, setFamilyName] = useState("");
  const [headEmail, setHeadEmail] = useState("");
  const [headName, setHeadName] = useState("");
  // Everything on by default (premium) — unchecking a box disables that
  // module for this family from day one. Only the unchecked ones are ever
  // sent as explicit `false`s; module_flags stays an empty object (meaning
  // "everything enabled") when nothing's been unchecked.
  const [enabledModules, setEnabledModules] = useState(() => Object.fromEntries(GATABLE_MODULES.map((m) => [m.key, true])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState("");

  function toggleModule(key) {
    setEnabledModules((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const moduleFlags = Object.fromEntries(
        Object.entries(enabledModules).filter(([, enabled]) => !enabled).map(([key]) => [key, false])
      );
      const data = await callApi("/api/provision-family", { adminSecret, familyName, headEmail, headName, moduleFlags });
      setResult(data);
      sessionStorage.setItem(SECRET_SESSION_KEY, adminSecret);
      setFamilyName("");
      setHeadEmail("");
      setHeadName("");
      setEnabledModules(Object.fromEntries(GATABLE_MODULES.map((m) => [m.key, true])));
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
        <div className="form-row">
          <label>Modules included in this family's plan</label>
          <p className="form-hint" style={{ marginTop: 0 }}>All on = full/premium access. Uncheck anything not included in a lesser package — can be changed later by editing the family directly.</p>
          {GATABLE_MODULES.map(({ key, label }) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 400, textTransform: "none", padding: "4px 0" }}>
              <input type="checkbox" checked={enabledModules[key]} onChange={() => toggleModule(key)} />
              {label}
            </label>
          ))}
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

      <PasswordResetRequestsSection adminSecret={adminSecret} />
    </section>
  );
}
