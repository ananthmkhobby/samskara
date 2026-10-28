import { useEffect, useState } from "react";
import { callApi } from "../lib/apiFetch";
import { resizeImage } from "../lib/imageResize";
import { uploadSharePreviewImage } from "../lib/mediaUpload";
import { CURRENT_FAMILY_ID } from "../data/session";
import { useModalA11y } from "../hooks/useModalA11y";
import { CloseIcon } from "./Icons";

const DEFAULT_TITLE = "A family memory";
const DEFAULT_DESCRIPTION = "Someone shared a memory with you on Samskara — your family's living record.";

// Owner-facing half of the Share Preview Service (see api/share.js and
// docs/SHARE_PREVIEW_SERVICE.md) — Gallery photo only, "members" audience
// only, for this MVP. Fetches the already-resolved photo (contribution.
// mediaUrl, a signed URL the browser can already read) as a blob only
// when the owner explicitly opts into "Use this photo" — the default
// stays the generic branded card, no upload at all, matching the PRD's
// "default to private/safe" posture.
export default function ShareModal({ contribution, onClose }) {
  const modalA11y = useModalA11y(onClose);
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState(null); // { shareId, shareUrl } | null
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [previewMode, setPreviewMode] = useState("brand");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    callApi("/api/share", { action: "status", contentType: "gallery_photo", contentId: contribution.id })
      .then((data) => { if (!cancelled) setExisting(data.share); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [contribution.id]);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      let previewImagePath;
      if (previewMode === "photo") {
        const resp = await fetch(contribution.mediaUrl);
        if (!resp.ok) throw new Error("Couldn't read that photo to prepare the preview.");
        const sourceBlob = await resp.blob();
        const { blob } = await resizeImage(sourceBlob, 1200);
        previewImagePath = await uploadSharePreviewImage(CURRENT_FAMILY_ID, contribution.id, blob);
      }
      const data = await callApi("/api/share", {
        action: "create", contentType: "gallery_photo", contentId: contribution.id,
        previewTitle: title, previewDescription: description, previewImageMode: previewMode, previewImagePath,
      });
      setExisting({ shareId: data.shareId, shareUrl: data.shareUrl });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setError("");
    try {
      await callApi("/api/share", { action: "revoke", shareId: existing.shareId });
      setExisting(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function shareOnWhatsApp() {
    const message = `${title}\n\n${existing.shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    callApi("/api/share", { action: "log-event", token: existing.shareUrl.split("/").pop(), eventType: "share_wa_clicked" }).catch(() => {});
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(existing.shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      callApi("/api/share", { action: "log-event", token: existing.shareUrl.split("/").pop(), eventType: "share_copied" }).catch(() => {});
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel" {...modalA11y}>
        <button className="modal-close on-paper" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        <div className="modal-body">
          <span className="eyebrow">Share this photo</span>
          <h2 style={{ fontSize: 20, marginTop: 6 }}>Share on WhatsApp</h2>

          {loading ? (
            <p className="form-hint">Checking…</p>
          ) : existing ? (
            <>
              <p className="form-hint" style={{ marginTop: 10 }}>
                This link is live — anyone who opens it will see this photo only if they're signed in as a member of your family.
              </p>
              <div className="form-row">
                <label>Link</label>
                <input type="text" readOnly value={existing.shareUrl} onFocus={(e) => e.target.select()} />
              </div>
              <div className="folio-actions">
                <button type="button" className="btn primary" onClick={shareOnWhatsApp}>Share on WhatsApp →</button>
                <button type="button" className="btn ghost" onClick={copyLink}>{copied ? "Copied!" : "Copy link"}</button>
              </div>
              {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
              <p className="form-hint" style={{ marginTop: 14 }}>
                <button type="button" className="link-btn" disabled={busy} onClick={revoke}>{busy ? "Revoking…" : "Revoke this link"}</button>
                {" "}— stops anyone opening it from here on. A copy anyone already saved of the preview thumbnail may still exist.
              </p>
            </>
          ) : (
            <>
              <p className="form-hint" style={{ marginTop: 10 }}>
                Only your family (anyone signed in to this family's account) can actually see the photo, no matter who the link is forwarded to — the WhatsApp preview card below is the only thing anyone else ever sees.
              </p>
              <div className="form-row">
                <label>Preview card title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
              </div>
              <div className="form-row">
                <label>Preview card description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
              </div>
              <div className="form-row">
                <label>Preview image</label>
                <div className="tag-row">
                  <button type="button" className={`chip${previewMode === "brand" ? " active" : ""}`} onClick={() => setPreviewMode("brand")}>Samskara branded (safest)</button>
                  <button type="button" className={`chip${previewMode === "photo" ? " active" : ""}`} onClick={() => setPreviewMode("photo")}>Use this photo</button>
                </div>
                {previewMode === "photo" && (
                  <p className="form-hint">A resized copy of this photo becomes visible to anyone who sees a WhatsApp preview of the link — even someone it was forwarded to, before they're asked to sign in.</p>
                )}
              </div>
              {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
              <div className="folio-actions">
                <button type="submit" className="btn primary" disabled={busy || !title.trim() || !description.trim()} onClick={generate}>
                  {busy ? "Generating…" : "Generate link →"}
                </button>
                <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
