import { useState } from "react";
import { callApi } from "../lib/apiFetch";
import { PLAN_TIERS, PLAN_ORDER, LIMIT_LABELS } from "../lib/planTiers";

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

// Lists the most recent real ad-click landings (api/track-click.js) — for
// cross-referencing against what an ad platform's own dashboard reports.
// A gap between the two counts for the same day/campaign is the invalid-
// click rate you're actually paying for.
function AdClickLogSection({ adminSecret }) {
  const [clicks, setClicks] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!adminSecret) { setError("Enter the admin secret above first."); return; }
    setBusy(true);
    setError("");
    try {
      const data = await callApi("/api/track-click", { adminSecret, action: "list" });
      setClicks(data.clicks);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 620, padding: 20, marginTop: 24 }}>
      <h4 style={{ marginTop: 0 }}>Ad click log</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>
        Every real landing tagged with a utm_source, newest first (most recent 200) — tag your ad's destination URL with utm_source/utm_medium/utm_campaign to show up here.
      </p>
      <button type="button" className="btn ghost small" disabled={busy} onClick={load}>{busy ? "Loading…" : "Load clicks"}</button>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      {clicks && clicks.length === 0 && <p className="form-hint">No clicks logged yet.</p>}
      {clicks && clicks.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" }}>
          {clicks.map((c) => (
            <div key={c.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10, fontSize: 13 }}>
              <strong>{c.utm_source}</strong>{c.utm_medium ? ` · ${c.utm_medium}` : ""}{c.utm_campaign ? ` · ${c.utm_campaign}` : ""}
              <p className="form-hint" style={{ margin: "2px 0" }}>
                {[c.city, c.region, c.country].filter(Boolean).join(", ") || "Unknown location"}
                {c.referrer ? ` — from ${c.referrer}` : ""}
              </p>
              <span className="form-hint">{new Date(c.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Creates a Samskara blog-author login — api/create-member-login.js's
// `kind: "blog"` branch (folded into that one endpoint rather than its own
// file, to stay under Vercel Hobby's 12-function cap), superadmin-secret
// gated instead of requireModerator since a blog author isn't scoped to
// any family. This is the ONLY way a blog author account gets created —
// no self-signup, no invite link.
// Grants blog access to an account that already exists — a family member,
// or anyone who self-signed-up with their own email/password — instead of
// minting a brand-new login just for the blog. No password to generate or
// hand over; they keep using whatever they already log in with.
function GrantBlogAccessSection({ adminSecret }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await callApi("/api/create-member-login", { kind: "blog", mode: "grant", adminSecret, email, displayName });
      setResult(data);
      setEmail("");
      setDisplayName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 460, padding: 20, marginTop: 16 }}>
      <h4 style={{ marginTop: 0 }}>Add an existing account to the blog team</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>
        For someone who already has a login — a family member, or anyone who signed up themselves. Finds their account by email and flips on blog access; they keep their existing password, nothing new to hand them.
      </p>
      <form onSubmit={submit}>
        <div className="form-row">
          <label>Their email (whatever they already sign in with)</label>
          <input type="email" required placeholder="them@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Display name (shown as the post's byline, optional — defaults to their email)</label>
          <input type="text" placeholder="e.g. Priya Raghavan" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
        <button type="submit" className="btn primary small" disabled={busy} style={{ marginTop: 8 }}>{busy ? "Granting…" : "Grant blog access"}</button>
      </form>
      {result && (
        <p className="form-hint" style={{ marginTop: 12 }}>
          {result.alreadyOnTeam
            ? <>{result.email} was already on the blog team — nothing to do.</>
            : <>Done — {result.email} can now log in as usual and reach <strong>oursamskara.com/blog/editor</strong>.</>}
        </p>
      )}
    </div>
  );
}

function BlogTeamSection({ adminSecret }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
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
      const data = await callApi("/api/create-member-login", { kind: "blog", adminSecret, username, password, displayName });
      setResult(data);
      setUsername("");
      setPassword("");
      setDisplayName("");
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
    <>
      <div className="card" style={{ maxWidth: 460, padding: 20, marginTop: 24 }}>
        <h4 style={{ marginTop: 0 }}>Blog team — create a new login</h4>
        <p className="form-hint" style={{ marginTop: 0 }}>
          For someone with no account at all (e.g. a ScanJunction collaborator with no email they want to use here) — no access to any family's data, only the public blog's editor at /blog/editor. If they already have a login, use "Add an existing account" below instead — no new password needed.
        </p>
        <form onSubmit={submit}>
          <div className="form-row">
            <label>Username</label>
            <input type="text" required placeholder="e.g. priya-sj" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Display name (shown as the post's byline)</label>
            <input type="text" required placeholder="e.g. Priya Raghavan" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
          <button type="submit" className="btn primary small" disabled={busy} style={{ marginTop: 8 }}>{busy ? "Creating…" : "Create login"}</button>
        </form>
        {result && (
          <div style={{ marginTop: 14 }}>
            <div className="tag-row" style={{ alignItems: "center", marginBottom: 8 }}>
              <span style={{ minWidth: 90, fontSize: 13, color: "var(--ink-faint)" }}>Username</span>
              <input type="text" readOnly value={result.username} style={{ flex: 1 }} />
              <button type="button" className="btn small ghost" onClick={() => copy(result.username, "username")}>{copied === "username" ? "Copied!" : "Copy"}</button>
            </div>
            <div className="tag-row" style={{ alignItems: "center" }}>
              <span style={{ minWidth: 90, fontSize: 13, color: "var(--ink-faint)" }}>Password</span>
              <input type="text" readOnly value={result.password} style={{ flex: 1 }} />
              <button type="button" className="btn small ghost" onClick={() => copy(result.password, "password")}>{copied === "password" ? "Copied!" : "Copy"}</button>
            </div>
            <p className="form-hint">
              Hand these to them directly. They log in at the normal login screen using "No email? Log in with username", then go to <strong>oursamskara.com/blog/editor</strong>.
            </p>
          </div>
        )}
      </div>
      <GrantBlogAccessSection adminSecret={adminSecret} />
    </>
  );
}

// Numeric limit keys an admin can override per family — mirrors
// planTiers.js's `limits` shape minus the boolean ones (handled separately
// below). printedBook stays out of scope — no code enforces it, it's a
// physical-fulfillment process, not a software gate.
const OVERRIDABLE_LIMIT_KEYS = Object.keys(LIMIT_LABELS);
const OVERRIDABLE_BOOLEAN_KEYS = ["pdfExport"];
const BOOLEAN_LABELS = { pdfExport: "PDF export" };

function emptyOverrides() {
  return {
    ...Object.fromEntries(OVERRIDABLE_LIMIT_KEYS.map((k) => [k, ""])),
    // "" = inherit the tier default, "true"/"false" = forced — a plain
    // checkbox can't represent "unset," so this is a tri-state select.
    ...Object.fromEntries(OVERRIDABLE_BOOLEAN_KEYS.map((k) => [k, ""])),
  };
}

// "Manage a family's plan" — search a family, change its plan_tier, reuse
// the same GATABLE_MODULES checkboxes as the provisioning form above (this
// is already exactly "pick and choose a feature, on/off"), add numeric
// limit overrides, and review/resolve that family's upgrade requests.
function ManagePlanSection({ adminSecret }) {
  const [query, setQuery] = useState("");
  const [families, setFamilies] = useState(null);
  const [selected, setSelected] = useState(null);
  const [planTier, setPlanTier] = useState("starter");
  const [enabledModules, setEnabledModules] = useState(() => Object.fromEntries(GATABLE_MODULES.map((m) => [m.key, true])));
  const [overrides, setOverrides] = useState(emptyOverrides);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [requests, setRequests] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);

  async function search(e) {
    e.preventDefault();
    if (!adminSecret) { setError("Enter the admin secret above first."); return; }
    setBusy(true);
    setError("");
    try {
      const data = await callApi("/api/provision-family", { adminSecret, action: "search-families", query });
      setFamilies(data.families);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function selectFamily(family) {
    setSelected(family);
    setSaved(false);
    const tier = family.plan_tier || "starter";
    setPlanTier(tier);
    const tierModules = PLAN_TIERS[tier].modules;
    setEnabledModules(Object.fromEntries(GATABLE_MODULES.map((m) => [m.key, tierModules[m.key] !== false])));
    setOverrides(emptyOverrides());
  }

  // Re-filling to the new tier's defaults on change, same as the plan's
  // intent — admin can still edit before saving, nothing auto-submits.
  function changeTier(tier) {
    setPlanTier(tier);
    const tierModules = PLAN_TIERS[tier].modules;
    setEnabledModules(Object.fromEntries(GATABLE_MODULES.map((m) => [m.key, tierModules[m.key] !== false])));
    setOverrides(emptyOverrides());
  }

  function toggleModule(key) {
    setEnabledModules((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function savePlan(e) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const moduleFlags = Object.fromEntries(
        Object.entries(enabledModules).filter(([, enabled]) => !enabled).map(([key]) => [key, false])
      );
      const numericOverrides = Object.fromEntries(
        OVERRIDABLE_LIMIT_KEYS.filter((k) => overrides[k] !== "").map((k) => [k, Number(overrides[k])])
      );
      const booleanOverrides = Object.fromEntries(
        OVERRIDABLE_BOOLEAN_KEYS.filter((k) => overrides[k] !== "").map((k) => [k, overrides[k] === "true"])
      );
      const limitOverrides = { ...numericOverrides, ...booleanOverrides };
      const data = await callApi("/api/provision-family", {
        adminSecret, action: "update-plan", familyId: selected.id, planTier, moduleFlags, limitOverrides,
      });
      setSelected(data.family);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadRequests() {
    if (!adminSecret) { setError("Enter the admin secret above first."); return; }
    setBusy(true);
    setError("");
    try {
      const data = await callApi("/api/provision-family", { adminSecret, action: "list-upgrade-requests" });
      setRequests(data.requests);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resolveRequest(id) {
    setResolvingId(id);
    try {
      await callApi("/api/provision-family", { adminSecret, action: "resolve-upgrade-request", id });
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 520, padding: 20, marginTop: 24 }}>
      <h4 style={{ marginTop: 0 }}>Manage a family's plan</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>
        Move a family between Starter/Rooted/Legacy, toggle individual features, or override a numeric limit for that family specifically.
      </p>
      <form onSubmit={search} className="tag-row" style={{ alignItems: "center" }}>
        <input type="text" placeholder="Search family by name" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1 }} />
        <button type="submit" className="btn ghost small" disabled={busy}>{busy ? "…" : "Search"}</button>
      </form>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      {families && families.length === 0 && <p className="form-hint">No families matched.</p>}
      {families && families.length > 0 && !selected && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {families.map((f) => (
            <button key={f.id} type="button" className="btn ghost small" style={{ justifyContent: "flex-start" }} onClick={() => selectFamily(f)}>
              {f.name} <span className="form-hint" style={{ marginLeft: 6 }}>({f.plan_tier})</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <form onSubmit={savePlan} style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          <div className="tag-row" style={{ alignItems: "center", marginBottom: 10 }}>
            <strong>{selected.name}</strong>
            <button type="button" className="btn ghost small" onClick={() => { setSelected(null); setFamilies(null); }}>Change family</button>
          </div>
          <div className="form-row">
            <label>Plan</label>
            <select value={planTier} onChange={(e) => changeTier(e.target.value)}>
              {PLAN_ORDER.map((t) => <option key={t} value={t}>{PLAN_TIERS[t].label}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>Modules included</label>
            {GATABLE_MODULES.map(({ key, label }) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 400, textTransform: "none", padding: "4px 0" }}>
                <input type="checkbox" checked={enabledModules[key]} onChange={() => toggleModule(key)} />
                {label}
              </label>
            ))}
          </div>
          <div className="form-row">
            <label>Limit overrides (blank = use {PLAN_TIERS[planTier].label}'s default)</label>
            {OVERRIDABLE_LIMIT_KEYS.map((key) => (
              <div key={key} className="tag-row" style={{ alignItems: "center", marginBottom: 6 }}>
                <span style={{ minWidth: 140, fontSize: 13, color: "var(--ink-faint)" }}>{LIMIT_LABELS[key]}</span>
                <input
                  type="number" min={0}
                  placeholder={String(PLAN_TIERS[planTier].limits[key] ?? "Unlimited")}
                  value={overrides[key]}
                  onChange={(e) => setOverrides((prev) => ({ ...prev, [key]: e.target.value }))}
                  style={{ flex: 1 }}
                />
              </div>
            ))}
            {OVERRIDABLE_BOOLEAN_KEYS.map((key) => (
              <div key={key} className="tag-row" style={{ alignItems: "center", marginBottom: 6 }}>
                <span style={{ minWidth: 140, fontSize: 13, color: "var(--ink-faint)" }}>{BOOLEAN_LABELS[key]}</span>
                <select
                  value={overrides[key]}
                  onChange={(e) => setOverrides((prev) => ({ ...prev, [key]: e.target.value }))}
                  style={{ flex: 1 }}
                >
                  <option value="">Use {PLAN_TIERS[planTier].label}'s default ({PLAN_TIERS[planTier].limits[key] ? "On" : "Off"})</option>
                  <option value="true">Force on</option>
                  <option value="false">Force off</option>
                </select>
              </div>
            ))}
          </div>
          <button type="submit" className="btn primary small" disabled={busy} style={{ marginTop: 4 }}>{busy ? "Saving…" : "Save plan"}</button>
          {saved && <span className="form-hint" style={{ marginLeft: 10, color: "var(--maroon-ink)" }}>Saved.</span>}
        </form>
      )}

      <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <div className="tag-row" style={{ alignItems: "center" }}>
          <strong style={{ fontSize: 14 }}>Open upgrade requests</strong>
          <button type="button" className="btn ghost small" disabled={busy} onClick={loadRequests}>{busy ? "Loading…" : "Load"}</button>
        </div>
        {requests && requests.length === 0 && <p className="form-hint">Nothing open right now.</p>}
        {requests && requests.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {requests.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                <div>
                  <strong>{r.familyName}</strong> → {PLAN_TIERS[r.requestedTier]?.label || r.requestedTier}
                  {r.note && <p className="form-hint" style={{ margin: "2px 0" }}>{r.note}</p>}
                  <span className="form-hint">{new Date(r.createdAt).toLocaleString()}</span>
                </div>
                <button type="button" className="btn small ghost" disabled={resolvingId === r.id} onClick={() => resolveRequest(r.id)}>
                  {resolvingId === r.id ? "…" : "Mark resolved"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
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

      <ManagePlanSection adminSecret={adminSecret} />
      <BlogTeamSection adminSecret={adminSecret} />
      <PasswordResetRequestsSection adminSecret={adminSecret} />
      <AdClickLogSection adminSecret={adminSecret} />
    </section>
  );
}
