import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { callApi } from "../lib/apiFetch";
import { IS_DEMO } from "../data/session";

// Self-service export/delete (export_my_data()/request_account_deletion(),
// see 20261029160000_account_deletion.sql) are temporarily off, swapped
// for a manual, support-mediated process instead — see the clause added
// to PrivacyPolicyView.jsx. Nothing about the RPCs/API or the DB
// functions changed; this is a front-end-only toggle so re-enabling later
// needs no backend work. Both buttons replaced with the same explainer +
// a mailto: link, rather than removed outright, so "how do I get my data
// or delete my account" still has an obvious, prominent answer on this
// screen instead of becoming undiscoverable.
const SELF_SERVICE_ENABLED = false;
const SUPPORT_EMAIL = "support@oursamskara.com";

export default function AccountSettingsView({ onDone }) {
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleExport() {
    setExportBusy(true);
    setExportError("");
    try {
      const { data } = await callApi("/api/account", { action: "export_data" });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "samskara-my-data.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExportBusy(false);
    }
  }

  async function handleDelete() {
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await callApi("/api/account", { action: "delete_account" });
      if (supabase) await supabase.auth.signOut();
      window.location.href = "/";
    } catch (err) {
      setDeleteError(err.message);
      setDeleteBusy(false);
    }
  }

  if (IS_DEMO) {
    return (
      <section className="wrap" style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="section-head"><h2>Account</h2></div>
        <div className="card" style={{ padding: 24 }}>
          <p>Account settings aren't available in the demo.</p>
          <button type="button" className="btn ghost" style={{ marginTop: 20 }} onClick={onDone}>Back</button>
        </div>
      </section>
    );
  }

  return (
    <section className="wrap" style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="section-head"><h2>Account</h2></div>

      {SELF_SERVICE_ENABLED ? (
        <>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ marginTop: 0 }}>Download your data</h3>
            <p className="form-hint">
              Get everything tied to your account — your contributions, blog posts, family memberships, and consent history — as a JSON file.
            </p>
            <button type="button" className="btn ghost" disabled={exportBusy} onClick={handleExport}>
              {exportBusy ? "Preparing…" : "Download my data"}
            </button>
            {exportError && <p className="form-hint" style={{ color: "var(--maroon-ink)", marginTop: 10 }}>{exportError}</p>}
          </div>

          <div className="card" style={{ padding: 24, marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Delete your account</h3>
            <p className="form-hint">
              Permanently removes your login and your membership in every family. A family you created on your own
              (with no one else in it) is deleted along with everything in it. In a family you share with others,
              anything you've contributed stays in the archive but is no longer linked to you.
            </p>

            {!showConfirm ? (
              <button type="button" className="btn ghost" style={{ color: "var(--maroon-ink)" }} onClick={() => setShowConfirm(true)}>
                Delete my account…
              </button>
            ) : (
              <div style={{ marginTop: 10 }}>
                <p className="form-hint">This can't be undone. Type <b>DELETE</b> below to confirm.</p>
                <input
                  type="text" className="field" value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  style={{ marginTop: 8, maxWidth: 200 }}
                />
                <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                  <button
                    type="button" className="btn primary" style={{ background: "var(--maroon-ink)" }}
                    disabled={confirmText !== "DELETE" || deleteBusy}
                    onClick={handleDelete}
                  >
                    {deleteBusy ? "Deleting…" : "Permanently delete"}
                  </button>
                  <button type="button" className="btn ghost" onClick={() => { setShowConfirm(false); setConfirmText(""); }}>
                    Cancel
                  </button>
                </div>
                {deleteError && <p className="form-hint" style={{ color: "var(--maroon-ink)", marginTop: 10 }}>{deleteError}</p>}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ marginTop: 0 }}>Download your data, or delete your account</h3>
          <p className="form-hint">
            Email <b>{SUPPORT_EMAIL}</b> from your account's address and we'll export everything tied to your
            account, or delete it, and send you a copy before anything is removed.
          </p>
          <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Account data request")}`} className="btn ghost">
            Email {SUPPORT_EMAIL}
          </a>
        </div>
      )}

      <button type="button" className="btn ghost" style={{ marginTop: 20 }} onClick={onDone}>Back</button>
    </section>
  );
}
