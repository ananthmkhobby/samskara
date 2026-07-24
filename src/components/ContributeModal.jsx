import { useEffect, useRef, useState } from "react";
import { PEOPLE } from "../data/people";
import { PhotoIcon, AudioIcon, VideoIcon, DocumentIcon, DateIcon, MemoryIcon, EXP_LABELS, EXP_CATEGORIES_BY_TYPE } from "./Icons";
import { useMediaRecorder } from "../hooks/useMediaRecorder";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { callApi } from "../lib/apiFetch";
import { resizeImage } from "../lib/imageResize";
import { uploadFamilyMedia } from "../lib/mediaUpload";
import { CURRENT_FAMILY_ID } from "../data/session";

const TYPE_DEFS = [
  { key: "memory", label: "Memory", Icon: MemoryIcon },
  { key: "audio", label: "Audio", Icon: AudioIcon },
  { key: "video", label: "Video", Icon: VideoIcon },
  { key: "photo", label: "Photo", Icon: PhotoIcon },
  { key: "document", label: "Document", Icon: DocumentIcon },
  { key: "date", label: "Important date", Icon: DateIcon }
];

const SPEECH_LANGS = [
  { code: "en-IN", label: "English" },
  { code: "kn-IN", label: "ಕನ್ನಡ (Kannada)" }
];

function RecorderPanel({ kind, onMediaReady }) {
  const { recording, mediaUrl, mediaBlob, stream, error, start, stop, reset } = useMediaRecorder(kind);
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream]);

  // Lifts the recorded blob up to the parent form — the actual upload
  // happens at submit time, not here, so a re-recorded or cancelled take
  // never gets uploaded needlessly.
  useEffect(() => {
    onMediaReady(mediaBlob, mediaUrl);
  }, [mediaBlob, mediaUrl, onMediaReady]);

  return (
    <div>
      <label>{kind === "audio" ? "Record audio" : "Record video"}</label>
      {kind === "video" && (recording || mediaUrl) && (
        <video
          ref={recording ? videoRef : undefined}
          src={!recording ? mediaUrl : undefined}
          autoPlay muted={recording} controls={!recording} playsInline
          style={{ width: "100%", borderRadius: 9, marginBottom: 10, background: "#000", maxHeight: 220 }}
        />
      )}
      {kind === "audio" && mediaUrl && !recording && (
        <audio src={mediaUrl} controls style={{ width: "100%", marginBottom: 10 }} />
      )}
      <div className="record-toggle">
        <span className={`record-dot${recording ? " on" : ""}`} />
        {!mediaUrl ? (
          <button type="button" className="btn small" onClick={recording ? stop : start}>
            {recording ? "Stop recording" : "Start recording"}
          </button>
        ) : (
          <button type="button" className="btn small" onClick={reset}>Re-record</button>
        )}
        <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
          {recording ? "Recording…" : mediaUrl ? "Recorded — ready to submit" : "Not recording"}
        </span>
      </div>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
    </div>
  );
}

export default function ContributeModal({ initial, onCancel, onSubmit, canModerate }) {
  const [personId, setPersonId] = useState(initial.personId || "__new__");
  const [newName, setNewName] = useState("");
  const [type, setType] = useState(initial.type || "memory");
  const [text, setText] = useState("");
  const [speechLang, setSpeechLang] = useState("en-IN");
  const [fileName, setFileName] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [avBlob, setAvBlob] = useState(null);
  const [avUrl, setAvUrl] = useState(null);
  const [expCategory, setExpCategory] = useState("");
  const [date, setDate] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [contributor, setContributor] = useState("");
  const [recorderKey, setRecorderKey] = useState(0);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const { listening, supported: speechSupported, start: startSpeech, stop: stopSpeech } = useSpeechToText();

  const locked = !!initial.personId;
  const sortedPeople = [...PEOPLE].sort((a, b) => a.name.localeCompare(b.name));

  function changeType(key) {
    setType(key);
    setRecorderKey((k) => k + 1);
    setExpCategory("");
    setAvBlob(null);
    setAvUrl(null);
    if (listening) stopSpeech();
  }

  async function handlePhotoFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoError("");
    try {
      const { dataUrl, blob } = await resizeImage(file);
      setPhotoDataUrl(dataUrl);
      setPhotoBlob(blob);
    } catch {
      setPhotoError("Couldn't read that image — try a different file.");
    }
  }

  function toggleSpeech() {
    if (listening) { stopSpeech(); return; }
    startSpeech(speechLang, (finalText) => {
      setText((prev) => (prev ? `${prev} ${finalText}` : finalText));
    });
  }

  async function translateText() {
    if (!text.trim() || translating) return;
    const targetLang = speechLang === "kn-IN" ? "en" : "kn";
    setTranslating(true);
    setTranslateError("");
    try {
      const data = await callApi("/api/translate", { text, targetLang });
      setText(data.translated);
      setSpeechLang(targetLang === "kn" ? "kn-IN" : "en-IN");
    } catch (err) {
      setTranslateError(err.message || "Translation failed.");
    } finally {
      setTranslating(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    // Media contributions about someone not yet in the tree have no real
    // person id to scope the Storage path under yet — "unassigned" is safe
    // since Storage RLS only checks the family_id segment of the path.
    const uploadPersonId = personId === "__new__" ? "unassigned" : personId;

    let content = "";
    setSubmitError("");
    try {
      if (type === "memory") content = text.trim() || "(no text provided)";
      else if (type === "audio" || type === "video") {
        if (!avBlob) return;
        setSubmitting(true);
        content = await uploadFamilyMedia(CURRENT_FAMILY_ID, uploadPersonId, avBlob, type === "video" ? "webm" : "webm");
      } else if (type === "photo") {
        if (!photoBlob) return;
        setSubmitting(true);
        content = await uploadFamilyMedia(CURRENT_FAMILY_ID, uploadPersonId, photoBlob, "jpg");
      } else if (type === "document") content = fileName || "document.pdf";
      else if (type === "date") content = `${date || "date TBD"} — ${dateLabel.trim() || "Untitled date"}`;
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
      return;
    }

    await onSubmit({
      personId: personId === "__new__" ? null : personId,
      newPersonName: personId === "__new__" ? (newName.trim() || "Unnamed relative") : undefined,
      type, content, expCategory: expCategory || undefined, contributor: contributor.trim() || "Anonymous"
    });
    setSubmitting(false);
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-panel">
        <button className="modal-close on-paper" onClick={onCancel} aria-label="Close">✕</button>
        <div className="modal-body">
          <span className="eyebrow">Share what you know</span>
          <h2 style={{ fontSize: 20, marginTop: 6 }}>Add to the archive</h2>
          <form onSubmit={submit}>
            <div className="form-row">
              <label>About whom</label>
              <select value={personId} disabled={locked} onChange={(e) => setPersonId(e.target.value)}>
                {sortedPeople.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}
                <option value="__new__">Someone not listed yet</option>
              </select>
            </div>
            {personId === "__new__" && (
              <div className="form-row">
                <label>Their name</label>
                <input type="text" placeholder="e.g. Great-aunt Kamala" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
            )}
            <div className="form-row">
              <label>What are you sharing</label>
              <div className="type-grid">
                {TYPE_DEFS.map(({ key, label, Icon }) => (
                  <button type="button" key={key} className={type === key ? "active" : ""} onClick={() => changeType(key)}>
                    <Icon /><span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="form-row">
              {type === "memory" && (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <label style={{ marginBottom: 0 }}>Your memory</label>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <select value={speechLang} onChange={(e) => setSpeechLang(e.target.value)} style={{ width: "auto", padding: "4px 8px", fontSize: 11.5 }}>
                        {SPEECH_LANGS.map((l) => <option value={l.code} key={l.code}>{l.label}</option>)}
                      </select>
                      {speechSupported && (
                        <button type="button" className={`icon-only${listening ? " playing" : ""}`} style={listening ? { borderColor: "var(--maroon-deep)", color: "var(--maroon-deep)" } : undefined} aria-label={listening ? "Stop dictation" : "Start dictation"} onClick={toggleSpeech}>
                          <AudioIcon />
                        </button>
                      )}
                      <button
                        type="button" className="btn small ghost" disabled={!text.trim() || translating}
                        onClick={translateText}
                      >
                        {translating ? "Translating…" : speechLang === "kn-IN" ? "Translate to English" : "ಕನ್ನಡಕ್ಕೆ ಅನುವಾದಿಸಿ"}
                      </button>
                    </div>
                  </div>
                  <textarea placeholder="Write what you remember, or use the mic to dictate…" value={text} onChange={(e) => setText(e.target.value)} />
                  {translateError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{translateError}</p>}
                  {listening && <p className="form-hint">Listening… speak naturally, it'll appear above.</p>}
                  {!speechSupported && <p className="form-hint">Voice dictation isn't supported in this browser — Chrome or Edge work best.</p>}
                </>
              )}
              {(type === "audio" || type === "video") && <RecorderPanel key={recorderKey} kind={type} onMediaReady={(blob, url) => { setAvBlob(blob); setAvUrl(url); }} />}
              {type === "photo" && (
                <>
                  <label>Upload photo</label>
                  <input type="file" accept="image/*" onChange={handlePhotoFile} />
                  {photoDataUrl && <img src={photoDataUrl} alt="" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, marginTop: 10, border: "1px solid var(--line-strong)" }} />}
                  {photoError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{photoError}</p>}
                </>
              )}
              {type === "document" && (
                <>
                  <label>Upload document</label>
                  <input type="file" onChange={(e) => setFileName(e.target.files[0]?.name || "")} />
                </>
              )}
              {type === "date" && (
                <>
                  <label>Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  <div style={{ height: 12 }} />
                  <label>Label</label>
                  <input type="text" placeholder="e.g. Graduation, Housewarming" value={dateLabel} onChange={(e) => setDateLabel(e.target.value)} />
                </>
              )}
            </div>
            {EXP_CATEGORIES_BY_TYPE[type] && (
              <div className="form-row">
                <label>Tag as an experience (optional)</label>
                <div className="tag-row">
                  {EXP_CATEGORIES_BY_TYPE[type].map((cat) => (
                    <button type="button" key={cat} className={`chip${expCategory === cat ? " active" : ""}`} onClick={() => setExpCategory((c) => (c === cat ? "" : cat))}>{EXP_LABELS[cat]}</button>
                  ))}
                </div>
                <p className="form-hint">Tagging adds this to their "Their Experience" grid once verified.</p>
              </div>
            )}
            <div className="form-row">
              <label>Your name</label>
              <input type="text" placeholder="e.g. Kavya Reddy" value={contributor} onChange={(e) => setContributor(e.target.value)} />
            </div>
            {submitError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{submitError}</p>}
            <div className="folio-actions">
              <button type="submit" className="btn primary" disabled={submitting}>{submitting ? "Uploading…" : canModerate ? "Add now" : "Submit for review"}</button>
              <button type="button" className="btn ghost" onClick={onCancel} disabled={submitting}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
