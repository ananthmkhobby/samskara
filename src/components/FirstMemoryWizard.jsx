import { useEffect, useRef, useState } from "react";
import { resizeImage } from "../lib/imageResize";
import { uploadFamilyMedia } from "../lib/mediaUpload";
import { insertContribution, updateContribution } from "../data/familyDb";
import { todayStr } from "../data/helpers";
import { CURRENT_USER_ID, CURRENT_FAMILY_ID, CURRENT_ROLE, IS_DEMO } from "../data/session";
import AuthPanel from "./AuthPanel";

// "Preserve your first memory" — lets a completely anonymous visitor pick
// a photo, write an optional short story, and preview it entirely in
// their own browser before ever being asked to sign in. See the PRD this
// was built from (Samskara_Guest_First_Memory_PRD_Technical_Design.docx)
// for the full requirements; this is the MVP scope it specifies: Gallery
// photo only, P0 requirements only.
//
// Reconciled against this app's real architecture (the PRD's own "open
// engineering decisions" section flags these as unresolved, so recording
// what was actually decided):
//
// - Auth is already INLINE here (AuthPanel), never a redirect — so the
//   PRD's IndexedDB/opaque-draft-key recovery machinery is overkill.
//   AuthPanel does call window.location.reload() on every successful
//   login/signup/family-creation, though (same as every other auth path
//   in this app), so the draft still needs to survive one reload — a
//   small localStorage entry (the photo, already resized small by this
//   point, as a data URL) is enough, no IndexedDB needed.
// - This app's contributions.family_id is NOT NULL — there's no concept
//   of a family-less personal memory. A brand-new signup has zero
//   family_members rows until they explicitly create or join one
//   (register_new_family()), which the existing app-level
//   ACCOUNT_NEEDS_FAMILY gate already handles automatically on the very
//   next reload — this component never needs to special-case "no family
//   yet" itself, since it can only ever mount once that gate has already
//   resolved (or the visitor hasn't signed in at all yet).
// - "Private by default" maps directly onto the visibility: 'private'
//   this app already has for contributions (powers the existing "Private
//   to me" Gallery tab) — no new table needed.
const DRAFT_KEY = "vamsha.firstMemoryDraft";
const MAX_BYTES = 15 * 1024 * 1024; // ~PRD's suggested 10MB, with headroom for a real phone photo
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function track(eventName, props) {
  if (typeof window.gtag === "function") window.gtag("event", eventName, props);
}

function saveDraft(dataUrl, story) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ dataUrl, story, savedAt: Date.now() }));
  } catch { /* storage unavailable or full — the inline auth step still works, just without recovery */ }
}
function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    // PRD's suggested 24h expiry — a much older draft is more likely a
    // long-abandoned attempt than something worth silently resuming.
    if (Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) { localStorage.removeItem(DRAFT_KEY); return null; }
    return draft;
  } catch { return null; }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function FirstMemoryWizard({ onGoHome }) {
  // "photo" | "compose" (story + local preview) | "auth" | "saving" | "done" | "error"
  const [step, setStep] = useState("photo");
  const [dataUrl, setDataUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [imageHash, setImageHash] = useState(null);
  const [story, setStory] = useState("");
  const [fileError, setFileError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) { startedRef.current = true; track("first_memory_started", {}); }
  }, []);

  // Resume after the reload AuthPanel always triggers — either finish the
  // real save (now signed in, with a family, per this file's own header
  // comment on why that's guaranteed by this point) or restore the draft
  // back into the editable compose step (still signed out — e.g. they
  // closed the tab mid-login and came back later).
  useEffect(() => {
    const draft = loadDraft();
    if (!draft) return;
    if (CURRENT_USER_ID) {
      setDataUrl(draft.dataUrl);
      setStory(draft.story || "");
      setBlob(dataUrlToBlob(draft.dataUrl));
      setStep("saving");
    } else {
      setDataUrl(draft.dataUrl);
      setStory(draft.story || "");
      setStep("compose");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The actual persist — runs either right after a fresh "Save" click
  // (already signed in) or on resume-after-reload (see above).
  useEffect(() => {
    if (step !== "saving" || !blob) return;
    let cancelled = false;
    (async () => {
      try {
        const canModerate = IS_DEMO || CURRENT_ROLE === "admin" || CURRENT_ROLE === "head";
        const path = await uploadFamilyMedia(CURRENT_FAMILY_ID, "unassigned", blob, "jpg");
        const contribution = await insertContribution(CURRENT_FAMILY_ID, {
          type: "photo", content: path, imageHash, text: story.trim() || undefined,
          contributor: "Me", contributorUserId: CURRENT_USER_ID, date: todayStr(),
          status: canModerate ? "Verified" : "Pending", visibility: "private",
        });
        if (cancelled) return;
        clearDraft();
        setSavedId(contribution.id);
        track("first_memory_saved", { memory_id: contribution.id, has_story: !!story.trim() });
        setStep("done");
      } catch (err) {
        if (!cancelled) { setSaveError(err.message); setStep("error"); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileError("");
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError("Please choose a JPEG, PNG, or WebP photo.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError(`That photo is too large (${(file.size / 1024 / 1024).toFixed(1)} MB) — up to 15 MB is fine.`);
      return;
    }
    try {
      const resized = await resizeImage(file);
      setDataUrl(resized.dataUrl);
      setBlob(resized.blob);
      setImageHash(resized.imageHash);
      track("first_memory_photo_selected", { file_type: file.type });
      setStep("compose");
    } catch {
      setFileError("Couldn't read that photo — try a different file.");
    }
  }

  function handlePreviewed() {
    track("first_memory_previewed", { has_story: !!story.trim() });
  }

  function handleSaveClick() {
    track("first_memory_save_clicked", { auth_state: CURRENT_USER_ID ? "signed_in" : "signed_out" });
    if (CURRENT_USER_ID) {
      setStep("saving");
      return;
    }
    saveDraft(dataUrl, story);
    track("first_memory_auth_started", {});
    setStep("auth");
  }

  async function shareToFamily() {
    setSharing(true);
    try {
      await updateContribution(savedId, { visibility: "shared" });
      setShared(true);
      track("first_memory_family_added", { memory_id: savedId });
    } catch {
      // Matches this app's existing, consistent rule: only a Head/Admin
      // can edit a contribution after the fact, moderator or not — not a
      // bug specific to this flow, so just explain it plainly.
      setSaveError("Ask a Head/Admin in your family to move this into the shared Gallery.");
    } finally {
      setSharing(false);
    }
  }

  if (step === "photo") {
    return (
      <div className="login-page login-page-scroll">
        <div className="login-help-wrap">
          <section className="wrap" style={{ maxWidth: 480 }}>
            <div className="section-head">
              <span className="eyebrow">🪔 Samskara</span>
              <h2>Every family has a story worth saving</h2>
              <p>Choose one photo to start. It stays on your screen only — nothing is uploaded until you decide to save it.</p>
            </div>
            <div className="card" style={{ padding: 20, textAlign: "center" }}>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} style={{ marginBottom: 10 }} />
              {fileError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{fileError}</p>}
            </div>
            <button type="button" className="btn ghost" style={{ marginTop: 16 }} onClick={onGoHome}>Not now</button>
          </section>
        </div>
      </div>
    );
  }

  if (step === "compose") {
    return (
      <div className="login-page login-page-scroll">
        <div className="login-help-wrap">
          <section className="wrap" style={{ maxWidth: 480 }}>
            <div className="section-head">
              <h2>What do you remember about this moment?</h2>
              <p>Totally optional — you can save with just the photo.</p>
            </div>
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <img src={dataUrl} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 10 }} onLoad={handlePreviewed} />
              <p className="form-hint" style={{ textAlign: "center", marginBottom: 10 }}>🔒 Not saved yet — only visible to you, right now</p>
              <textarea placeholder="A short story, if you'd like…" value={story} onChange={(e) => setStory(e.target.value)} />
            </div>
            {saveError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{saveError}</p>}
            <div className="folio-actions">
              <button type="button" className="btn primary" onClick={handleSaveClick}>Save this memory →</button>
              <button type="button" className="btn ghost" onClick={() => setStep("photo")}>Choose a different photo</button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (step === "auth") {
    return (
      <div className="login-page login-page-scroll">
        <div className="login-help-wrap">
          <section className="wrap" style={{ maxWidth: 480 }}>
            <div className="section-head">
              <h2>Sign in to save it</h2>
              <p>Your photo stays private — only you will ever see it. We'll bring you right back here once you're signed in.</p>
            </div>
            <AuthPanel onShowPrivacy={() => {}} onShowTerms={() => {}} />
          </section>
        </div>
      </div>
    );
  }

  if (step === "saving") {
    return (
      <div className="login-page login-page-scroll">
        <div className="login-help-wrap"><p className="form-hint">Saving your memory…</p></div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="login-page login-page-scroll">
        <div className="login-help-wrap">
          <section className="wrap" style={{ maxWidth: 480 }}>
            <div className="section-head"><h2>Couldn't save that</h2></div>
            {saveError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{saveError}</p>}
            <button type="button" className="btn primary" onClick={() => setStep("saving")}>Try again</button>
          </section>
        </div>
      </div>
    );
  }

  // done
  return (
    <div className="login-page login-page-scroll">
      <div className="login-help-wrap">
        <section className="wrap" style={{ maxWidth: 480 }}>
          <div className="section-head">
            <span className="eyebrow">🔒 Saved, privately</span>
            <h2>Your memory is kept</h2>
            <p>Only you can see it — find it anytime under Gallery → Private to me.</p>
          </div>
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            {dataUrl && <img src={dataUrl} alt="" style={{ width: "100%", borderRadius: 8 }} />}
          </div>
          {shared ? (
            <p className="form-hint">Added to your family's shared Gallery.</p>
          ) : (
            <button type="button" className="btn ghost" disabled={sharing} onClick={shareToFamily} style={{ marginBottom: 10 }}>
              {sharing ? "Adding…" : "Add to family Gallery"}
            </button>
          )}
          {saveError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{saveError}</p>}
          {/* Straight to the one tab a private memory actually shows up
              in — the main Gallery tab it would otherwise land on by
              default never shows a private item at all, which is exactly
              what looked like "it didn't save" before this existed. */}
          <button type="button" className="btn primary" onClick={() => { window.location.href = "/gallery?tab=private"; }}>
            See it in My Memories →
          </button>
          <button type="button" className="btn ghost" style={{ marginTop: 10 }} onClick={onGoHome}>Go to Samskara →</button>
        </section>
      </div>
    </div>
  );
}
