import { useEffect, useState } from "react";
import { CURRENT_USER_ID, CURRENT_FAMILY_ID, IS_DEMO } from "../data/session";
import {
  getPushSubscriptionState, enablePush, disablePush,
  fetchNotificationPrefs, setNotificationPref,
} from "../lib/push";
import { callApi } from "../lib/apiFetch";

// MoreMenu's "Notifications" entry — the real, user-facing subscribe
// toggle that the SuperAdminView "Push notification test" panel never was
// (that one's an internal debug control). Same explainer-plus-toggle shape
// as ConnectWhatsAppView: one primary action (enable/disable push on this
// browser), plus opt-ins for the two automated categories once subscribed.
export default function NotificationSettingsView({ onDone }) {
  const [state, setState] = useState("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [prefs, setPrefs] = useState({ reengagementEnabled: false, photoPromptEnabled: false });
  const [prefBusy, setPrefBusy] = useState("");
  const [photoPromptBusy, setPhotoPromptBusy] = useState(false);
  const [photoPromptResult, setPhotoPromptResult] = useState("");

  async function refresh() {
    setState(await getPushSubscriptionState());
  }
  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (state !== "subscribed" || IS_DEMO || !CURRENT_USER_ID) return;
    let cancelled = false;
    fetchNotificationPrefs(CURRENT_USER_ID).then((p) => { if (!cancelled) setPrefs(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, [state]);

  async function toggleSubscription() {
    setBusy(true);
    setError("");
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

  async function sendPhotoPromptTest() {
    setPhotoPromptBusy(true);
    setPhotoPromptResult("");
    setError("");
    try {
      const data = await callApi("/api/reset-member-password", { action: "send_photo_prompt_test", familyId: CURRENT_FAMILY_ID });
      setPhotoPromptResult(data.sent ? "Sent — check your notifications." : "Couldn't reach a device — try enabling notifications again.");
    } catch (err) {
      setError(err.message);
    } finally {
      setPhotoPromptBusy(false);
    }
  }

  async function togglePref(key) {
    const field = key === "reengagement" ? "reengagementEnabled" : "photoPromptEnabled";
    const next = !prefs[field];
    setPrefBusy(key);
    setPrefs((p) => ({ ...p, [field]: next })); // optimistic — same low-stakes reasoning as the WhatsApp nudge toggle
    try {
      await setNotificationPref(CURRENT_USER_ID, key, next);
    } catch {
      setPrefs((p) => ({ ...p, [field]: !next }));
    } finally {
      setPrefBusy("");
    }
  }

  return (
    <section className="wrap" style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="section-head">
        <h2>Notifications</h2>
      </div>
      <div className="card" style={{ padding: 24 }}>
        {state === "checking" && <p className="form-hint">Checking…</p>}

        {state === "unsupported" && (
          <p>Notifications aren't supported in this browser. Try a recent version of Chrome, Edge, or Safari — on iPhone, the app needs to be added to your Home Screen first.</p>
        )}

        {state === "denied" && (
          <>
            <p>Notifications are currently blocked for Samskara in this browser.</p>
            <p className="form-hint">To turn them on, open this browser's site settings for this page and allow notifications, then come back here.</p>
          </>
        )}

        {(state === "unsubscribed" || state === "subscribed") && (
          <>
            <p>
              {state === "subscribed"
                ? "Notifications are on for this browser — you'll get pushed here when a Head or Admin sends one, or for anything you opt into below."
                : "Turn on notifications to get pushed a message here when a Head or Admin sends one to the family."}
            </p>
            <button type="button" className="btn primary" disabled={busy} onClick={toggleSubscription}>
              {busy ? "Working…" : state === "subscribed" ? "Turn off notifications" : "Turn on notifications"}
            </button>
          </>
        )}

        {state === "subscribed" && !IS_DEMO && (
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="form-hint" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox" checked={prefs.reengagementEnabled} disabled={prefBusy === "reengagement"}
                onChange={() => togglePref("reengagement")}
              />
              Remind me if I haven't checked in for a while
            </label>
            <label className="form-hint" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox" checked={prefs.photoPromptEnabled} disabled={prefBusy === "photo_prompt"}
                onChange={() => togglePref("photo_prompt")}
              />
              Occasionally ask me to add a story to a photo that doesn't have one yet
            </label>
            {prefs.photoPromptEnabled && (
              <div style={{ marginLeft: 26 }}>
                <button type="button" className="btn ghost small" disabled={photoPromptBusy} onClick={sendPhotoPromptTest}>
                  {photoPromptBusy ? "Finding a photo…" : "Send me one now, to test"}
                </button>
                {photoPromptResult && <p className="form-hint" style={{ marginTop: 6 }}>{photoPromptResult}</p>}
              </div>
            )}
          </div>
        )}

        {error && <p className="form-hint" style={{ color: "var(--maroon-ink)", marginTop: 10 }}>{error}</p>}
        <button type="button" className="btn ghost" style={{ marginTop: 20 }} onClick={onDone}>Back</button>
      </div>
    </section>
  );
}
