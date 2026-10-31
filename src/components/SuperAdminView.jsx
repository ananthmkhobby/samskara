import { useState, useEffect } from "react";
import JSZip from "jszip";
import { callApi } from "../lib/apiFetch";
import { supabase } from "../lib/supabaseClient";
import { PLAN_TIERS, PLAN_ORDER, LIMIT_LABELS } from "../lib/planTiers";
import { CURRENT_USER_ID } from "../data/session";
import { getPushSubscriptionState, enablePush, disablePush } from "../lib/push";

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
  // Unlike every other key above, this one is false by DEFAULT in every
  // plan tier (see planTiers.js) — it's an opt-in pilot cohort flag, not
  // an opt-out module, so checking this box for a family is what actually
  // turns Fast Family Onboarding on for them specifically.
  { key: "fastOnboarding", label: "Fast Family Onboarding (pilot — off by default)" },
];

// Every key above defaults to pre-checked in the "provision a new family"
// form except the opt-in pilot flags — checking one of those by default
// would silently write nothing to module_flags (only explicit `false`s are
// ever sent) and leave the superadmin thinking it's on when the tier
// default (false) actually wins.
const OPT_IN_MODULES = new Set(["fastOnboarding"]);
function defaultEnabledModules() {
  return Object.fromEntries(GATABLE_MODULES.map((m) => [m.key, !OPT_IN_MODULES.has(m.key)]));
}

// Interim stopgap until a real email service exists (see api/
// api/password-reset-requests.js) — lists requests filed from the login page's
// "Can't get in at all?" link. Resolving a password still happens manually
// (a service-role script, same call api/reset-member-password.js already
// makes) — this list only tracks who's waiting, "Mark resolved" is just
// bookkeeping once you've actually reset them and told them the new one.
function PasswordResetRequestsSection() {
  const [requests, setRequests] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resolvingId, setResolvingId] = useState(null);

  async function load() {
    setBusy(true);
    setError("");
    try {
      const data = await callApi("/api/password-reset-requests", { action: "list" });
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
      await callApi("/api/password-reset-requests", { action: "resolve", id });
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

// Fulfills the "email support for your data or to delete your account"
// path (AccountSettingsView.jsx's SELF_SERVICE_ENABLED is off; see the
// Privacy Policy clause) — api/export-user-data.js returns the same
// metadata export_my_data() always did, PLUS a signed URL for every real
// photo/audio/video/document the person contributed, so what gets sent
// back is an actual export, not a JSON file of storage paths nobody but
// the app itself can resolve. Bundled client-side into one .zip (fetches
// each signed URL in the browser, not server-side — keeps this endpoint
// fast and avoids holding potentially large media in a serverless
// function's memory) so there's one file to attach to the reply email,
// not a folder of loose links to forward by hand.
function UserDataExportSection() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function buildExport() {
    setBusy(true);
    setError("");
    setStatus("Fetching account data…");
    try {
      const data = await callApi("/api/export-user-data", { email: email.trim() });
      const zip = new JSZip();
      zip.file("data.json", JSON.stringify(data, null, 2));

      const mediaFolder = zip.folder("media");
      for (let i = 0; i < data.media.length; i++) {
        const m = data.media[i];
        setStatus(`Downloading media ${i + 1} of ${data.media.length}…`);
        try {
          const res = await fetch(m.url);
          if (!res.ok) continue;
          const blob = await res.blob();
          const ext = (m.url.split("?")[0].match(/\.[a-zA-Z0-9]+$/) || [""])[0] || "";
          const safeName = (m.title || m.contributionId).toString().replace(/[^a-z0-9-_]+/gi, "_");
          mediaFolder.file(`${m.type}-${safeName}${ext}`, blob);
        } catch {
          // One failed download shouldn't lose the rest of the export —
          // data.json still lists it (the signed URL), just not bundled.
        }
      }

      setStatus("Zipping…");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `samskara-export-${email.trim().replace(/[^a-z0-9-_@.]+/gi, "_")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`Done — ${data.media.length} media file(s) bundled, ${data.contributions.length} contribution(s) recorded.`);
    } catch (err) {
      setError(err.message);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 460, padding: 20, marginTop: 24 }}>
      <h4 style={{ marginTop: 0 }}>Export a member's data (for a support request)</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>
        Builds a single .zip — their contributions, memberships, and consent history as JSON, plus every real photo,
        audio, video, and document they contributed — ready to attach to a reply email.
      </p>
      <input
        type="email" className="field" placeholder="their-account@example.com" value={email}
        onChange={(e) => setEmail(e.target.value)} style={{ marginTop: 10, marginBottom: 10 }}
      />
      <button type="button" className="btn primary small" disabled={busy || !email.trim()} onClick={buildExport}>
        {busy ? "Building…" : "Build export (.zip)"}
      </button>
      {status && <p className="form-hint" style={{ marginTop: 10 }}>{status}</p>}
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)", marginTop: 10 }}>{error}</p>}
    </div>
  );
}

// Lists the most recent real ad-click landings (api/track-click.js) — for
// cross-referencing against what an ad platform's own dashboard reports.
// A gap between the two counts for the same day/campaign is the invalid-
// click rate you're actually paying for.
// Spike test control, not the real feature UI — proves the whole push
// pipeline (subscribe -> save -> encrypt -> push service -> OS
// notification) end to end before any real targeting/opt-in UI exists.
// Sends only to the signed-in superadmin's own subscriptions (see
// api/push.js's send_test_push action).
function PushTestSection() {
  const [state, setState] = useState("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  async function refresh() {
    setState(await getPushSubscriptionState());
  }
  useEffect(() => { refresh(); }, []);

  async function toggle() {
    setBusy(true);
    setError("");
    setResult("");
    try {
      if (state === "subscribed") await disablePush(CURRENT_USER_ID);
      else await enablePush(CURRENT_USER_ID);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError("");
    setResult("");
    try {
      const data = await callApi("/api/push", { action: "send_test_push" });
      setResult(`Sent ${data.sent}/${data.total} subscription(s).${data.removedDead ? ` Removed ${data.removedDead} dead subscription(s).` : ""}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // /superadmin is deliberately reachable while signed out (so it works
  // for provisioning a brand-new family) — but a push subscription needs
  // a real auth.uid() to attach to (push_subscriptions' RLS requires
  // user_id = auth.uid()). Without this check, "Enable push" would
  // silently fail the save with a confusing generic error instead of the
  // actual, simple reason — found live when testing this for real.
  if (!CURRENT_USER_ID) {
    return (
      <div className="card" style={{ maxWidth: 620, padding: 20, marginTop: 24 }}>
        <h4 style={{ marginTop: 0 }}>Push notification test</h4>
        <p className="form-hint" style={{ marginTop: 0 }}>
          You need to be signed in to a Samskara account to test this — log in at the main site first, then come back to this page in the same browser tab.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 620, padding: 20, marginTop: 24 }}>
      <h4 style={{ marginTop: 0 }}>Push notification test</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>
        Spike control — enables push for this browser, then sends one real test notification to it. State: <strong>{state}</strong>
      </p>
      {(state === "unsubscribed" || state === "subscribed") && (
        <button type="button" className="btn ghost small" disabled={busy} onClick={toggle}>
          {busy ? "Working…" : state === "subscribed" ? "Disable push on this browser" : "Enable push on this browser"}
        </button>
      )}
      {state === "subscribed" && (
        <button type="button" className="btn primary small" disabled={busy} onClick={sendTest} style={{ marginLeft: 8 }}>
          {busy ? "Sending…" : "Send test notification"}
        </button>
      )}
      {state === "unsupported" && <p className="form-hint">Push isn't supported in this browser, or VITE_PUSH_VAPID_PUBLIC_KEY isn't set.</p>}
      {state === "denied" && <p className="form-hint">Notification permission was denied at the OS level — re-enable it in the browser's site settings.</p>}
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      {result && <p className="form-hint">{result}</p>}
    </div>
  );
}

function AdClickLogSection() {
  const [clicks, setClicks] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    try {
      const data = await callApi("/api/track-click", { action: "list" });
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

// Creates a Samskara blog-author login — api/blog-team.js, superadmin-
// secret gated instead of requireModerator since a blog author isn't
// scoped to any family. This is the ONLY way a blog author account gets
// created — no self-signup, no invite link.
// Grants blog access to an account that already exists — a family member,
// or anyone who self-signed-up with their own email/password — instead of
// minting a brand-new login just for the blog. No password to generate or
// hand over; they keep using whatever they already log in with.
function GrantBlogAccessSection() {
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
      const data = await callApi("/api/blog-team", { mode: "grant", email, displayName });
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

function BlogTeamSection() {
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
      const data = await callApi("/api/blog-team", { username, password, displayName });
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
      <GrantBlogAccessSection />
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
function ManagePlanSection() {
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
    setBusy(true);
    setError("");
    try {
      const data = await callApi("/api/manage-plan", { action: "search-families", query });
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
    const moduleFlags = family.module_flags || {};
    // A module explicitly flagged (true or false) wins; otherwise fall back
    // to the tier default — matches getEffectiveModules()' own semantics.
    // Loading this family's ACTUAL current flags here (not just the tier
    // default) is what makes "Save plan" an edit instead of a silent reset
    // of whatever an earlier admin session already set.
    setEnabledModules(Object.fromEntries(GATABLE_MODULES.map((m) =>
      [m.key, m.key in moduleFlags ? moduleFlags[m.key] !== false : tierModules[m.key] !== false]
    )));
    const overrides = family.plan_limit_overrides || {};
    setOverrides({
      ...Object.fromEntries(OVERRIDABLE_LIMIT_KEYS.map((k) => [k, k in overrides && overrides[k] !== null ? String(overrides[k]) : ""])),
      ...Object.fromEntries(OVERRIDABLE_BOOLEAN_KEYS.map((k) => [k, k in overrides && overrides[k] !== null ? String(overrides[k]) : ""])),
    });
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
      // Write an explicit flag only when a module's checked state DIFFERS
      // from the selected tier's own default for that key — in EITHER
      // direction. This used to only ever write explicit `false`s, which
      // silently dropped any attempt to turn on an opt-in module whose
      // tier default is false (fastOnboarding) — checking its box saved
      // nothing, every time, with no error. Every ordinary opt-out module
      // (tier default true) behaves identically to before: unchecking it
      // still writes `false`, leaving it checked still omits the key.
      const tierModuleDefaults = PLAN_TIERS[planTier].modules;
      const moduleFlags = Object.fromEntries(
        Object.entries(enabledModules)
          .filter(([key, enabled]) => enabled !== (tierModuleDefaults[key] !== false))
          .map(([key, enabled]) => [key, enabled])
      );
      const numericOverrides = Object.fromEntries(
        OVERRIDABLE_LIMIT_KEYS.filter((k) => overrides[k] !== "").map((k) => [k, Number(overrides[k])])
      );
      const booleanOverrides = Object.fromEntries(
        OVERRIDABLE_BOOLEAN_KEYS.filter((k) => overrides[k] !== "").map((k) => [k, overrides[k] === "true"])
      );
      const limitOverrides = { ...numericOverrides, ...booleanOverrides };
      const data = await callApi("/api/manage-plan", {
        action: "update-plan", familyId: selected.id, planTier, moduleFlags, limitOverrides,
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
    setBusy(true);
    setError("");
    try {
      const data = await callApi("/api/manage-plan", { action: "list-upgrade-requests" });
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
      await callApi("/api/manage-plan", { action: "resolve-upgrade-request", id });
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

// Composes one recurring, app-wide push notification — not tied to any
// family. Separate from PushTestSection (which only ever pushes to the
// superadmin's own browser, for pipeline testing) and NotificationsAdminTab
// in AdminView.jsx (a family Head/Admin's one-off send to their own
// family only). The cron that actually fires this on schedule lives in
// api/broadcast.js's GET branch — see vercel.json's `crons` entry.
function PlatformBroadcastSection() {
  const [cfg, setCfg] = useState(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [frequencyDays, setFrequencyDays] = useState(7);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  async function load() {
    try {
      const data = await callApi("/api/broadcast", { action: "get-broadcast" });
      setCfg(data.broadcast);
      setTitle(data.broadcast.title || "");
      setBody(data.broadcast.body || "");
      setUrl(data.broadcast.url || "/");
      setFrequencyDays(data.broadcast.frequency_days || 7);
      setEnabled(!!data.broadcast.enabled);
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult("");
    try {
      const data = await callApi("/api/broadcast", {
        action: "set-broadcast", title, body, url, frequencyDays: Number(frequencyDays), enabled,
      });
      setCfg(data.broadcast);
      setResult("Saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendNow() {
    setSending(true);
    setError("");
    setResult("");
    try {
      const data = await callApi("/api/broadcast", { action: "send-broadcast-now" });
      setResult(`Sent to ${data.sent}/${data.total} subscription(s) (${data.recipients} ${data.recipients === 1 ? "person" : "people"}).${data.removedDead ? ` Removed ${data.removedDead} dead subscription(s).` : ""}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 460, padding: 20, marginTop: 16 }}>
      <h4 style={{ marginTop: 0 }}>Platform notification</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>
        One recurring push sent to every subscribed person across every family — a platform-wide announcement, not scoped to one family. Fires once a day's cron checks whether the interval below has elapsed; change the frequency any time, or send it immediately below regardless of schedule.
      </p>
      <form onSubmit={save}>
        <div className="form-row">
          <label>Title</label>
          <input type="text" placeholder="e.g. Samskara" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Message</label>
          <textarea placeholder="What you want everyone to see" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Link (opened on tap, optional)</label>
          <input type="text" placeholder="/" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Repeat every (days)</label>
          <input type="number" min="1" value={frequencyDays} onChange={(e) => setFrequencyDays(e.target.value)} style={{ maxWidth: 100 }} />
        </div>
        <div className="form-row">
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enabled — send automatically on schedule
          </label>
        </div>
        {cfg?.last_sent_at && (
          <p className="form-hint">Last sent: {new Date(cfg.last_sent_at).toLocaleString()}</p>
        )}
        {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
        {result && <p className="form-hint">{result}</p>}
        <div className="tag-row" style={{ marginTop: 8 }}>
          <button type="submit" className="btn primary small" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          <button type="button" className="btn ghost small" disabled={sending} onClick={sendNow}>{sending ? "Sending…" : "Send now"}</button>
        </div>
      </form>
    </div>
  );
}

// A plain RLS self-read (not a serverless round trip) — superadmins' own
// policy lets a signed-in user see only their own row, so "null back" and
// "no row" are indistinguishable from "not a superadmin," which is exactly
// the behavior wanted here: no information leak either way.
function useSuperadminCheck() {
  const [state, setState] = useState("checking"); // "checking" | "signed-out" | "denied" | "ok"
  useEffect(() => {
    let cancelled = false;
    if (!CURRENT_USER_ID || !supabase) { setState("signed-out"); return; }
    supabase.from("superadmins").select("user_id").eq("user_id", CURRENT_USER_ID).maybeSingle()
      .then(({ data }) => { if (!cancelled) setState(data ? "ok" : "denied"); })
      .catch(() => { if (!cancelled) setState("denied"); });
    return () => { cancelled = true; };
  }, []);
  return state;
}

export default function SuperAdminView() {
  const [familyName, setFamilyName] = useState("");
  const [headEmail, setHeadEmail] = useState("");
  const [headName, setHeadName] = useState("");
  // Everything on by default (premium) — unchecking a box disables that
  // module for this family from day one. Only the unchecked ones are ever
  // sent as explicit `false`s; module_flags stays an empty object (meaning
  // "everything enabled") when nothing's been unchecked.
  const [enabledModules, setEnabledModules] = useState(() => defaultEnabledModules());
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
      // Same fix as ManagePlanSection's savePlan() — compare against the
      // tier's actual default (a new family always starts on 'starter'),
      // not just "unchecked = false", so checking an opt-in module like
      // fastOnboarding here doesn't silently get dropped.
      const starterModuleDefaults = PLAN_TIERS.starter.modules;
      const moduleFlags = Object.fromEntries(
        Object.entries(enabledModules)
          .filter(([key, enabled]) => enabled !== (starterModuleDefaults[key] !== false))
          .map(([key, enabled]) => [key, enabled])
      );
      const data = await callApi("/api/provision-family", { familyName, headEmail, headName, moduleFlags });
      setResult(data);
      setFamilyName("");
      setHeadEmail("");
      setHeadName("");
      setEnabledModules(defaultEnabledModules());
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

  const superadminState = useSuperadminCheck();

  if (superadminState === "checking") {
    return (
      <section className="wrap">
        <div className="section-head"><h2>Provision a new family</h2></div>
        <p className="form-hint">Checking…</p>
      </section>
    );
  }
  if (superadminState === "signed-out") {
    return (
      <section className="wrap">
        <div className="section-head"><h2>Provision a new family</h2></div>
        <p className="form-hint">You need to be signed in with a superadmin account to see this — log in at the main site first, then come back to this page in the same browser tab.</p>
      </section>
    );
  }
  if (superadminState === "denied") {
    return (
      <section className="wrap">
        <div className="section-head"><h2>Provision a new family</h2></div>
        <p className="form-hint">Your account isn't a superadmin.</p>
      </section>
    );
  }

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>Provision a new family</h2>
        <p>Internal tool — not linked from anywhere in the app. Creates a real login account and hands the family head credentials to pass along yourself.</p>
      </div>
      <form onSubmit={submit} className="card" style={{ maxWidth: 460, padding: 20 }}>
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

      <ManagePlanSection />
      <BlogTeamSection />
      <PasswordResetRequestsSection />
      <UserDataExportSection />
      <AdClickLogSection />
      <PushTestSection />
      <PlatformBroadcastSection />
    </section>
  );
}
