import { useEffect, useRef, useState } from "react";
import { INTERACTION_TYPES, ROOM_SPOTS, ICON_KEYS, MOOD_KEYS, interactionTypeFor } from "../lib/chitrashale";
import { ChitrashaleIcon } from "./ChitrashaleIcons";
import { useMediaRecorder } from "../hooks/useMediaRecorder";
import { resizeImage } from "../lib/imageResize";
import { uploadFamilyMedia } from "../lib/mediaUpload";
import { CURRENT_FAMILY_ID } from "../data/session";

function AudioRecorderRow({ onMediaReady }) {
  const { recording, mediaUrl, mediaBlob, error, start, stop, reset } = useMediaRecorder("audio");

  useEffect(() => { onMediaReady(mediaBlob, mediaUrl); }, [mediaBlob, mediaUrl, onMediaReady]);

  return (
    <div className="form-row">
      <label>Recording (optional)</label>
      {mediaUrl && !recording && <audio src={mediaUrl} controls style={{ width: "100%", marginBottom: 10 }} />}
      <div className="record-toggle">
        <span className={`record-dot${recording ? " on" : ""}`} />
        {!mediaUrl ? (
          <button type="button" className="btn small" onClick={recording ? stop : start}>{recording ? "Stop recording" : "Start recording"}</button>
        ) : (
          <button type="button" className="btn small" onClick={reset}>Re-record</button>
        )}
        <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
          {recording ? "Recording…" : mediaUrl ? "Recorded" : "Not recording"}
        </span>
      </div>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      <p className="form-hint">A relative's own voice, or just a sound — no words needed either way.</p>
    </div>
  );
}

export default function ChitrashaleAddModal({ person, occupiedSpots, initialSpot, onCancel, onSubmit, canModerate }) {
  const openSpots = ROOM_SPOTS.filter((s) => !occupiedSpots[s.key]);
  const [label, setLabel] = useState("");
  const [spotKey, setSpotKey] = useState((initialSpot && !occupiedSpots[initialSpot] ? initialSpot : openSpots[0]?.key) || "");
  const [iconKey, setIconKey] = useState(ICON_KEYS[0]);
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [mediaBlob, setMediaBlob] = useState(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [interactionType, setInteractionType] = useState("textOnly");
  const [moodKey, setMoodKey] = useState(MOOD_KEYS[0].key);
  const [memoryText, setMemoryText] = useState("");
  const [contributor, setContributor] = useState("");
  const [relation, setRelation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const mediaBlobRef = useRef(null);

  const typeDef = interactionTypeFor(interactionType);
  const needsText = interactionType === "textOnly" || interactionType === "silenceThenText";

  function handleMediaReady(blob) {
    mediaBlobRef.current = blob;
    setMediaBlob(blob);
    setHasAudio(!!blob);
    // The two audio-dependent types are only ever selectable once a clip
    // actually exists — if the contributor re-records to nothing (reset),
    // silently fall back rather than leave the form pointed at a type that
    // can no longer be submitted.
    if (!blob && (interactionType === "voiceNarrated" || interactionType === "pureAmbientAudio")) {
      setInteractionType("textOnly");
    }
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

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (!label.trim()) { setError("Give the object a short label."); return; }
    if (!spotKey) { setError("Every spot in the room is already taken — nothing left to add it to."); return; }
    if (needsText && !memoryText.trim()) { setError("This type needs a line of text."); return; }
    if (typeDef.needsAudio && !mediaBlob) { setError("This type needs a recording first."); return; }

    let photoPath = null;
    let audioPath = null;
    try {
      setSubmitting(true);
      if (photoBlob) photoPath = await uploadFamilyMedia(CURRENT_FAMILY_ID, "chitrashale", photoBlob, "jpg");
      if (mediaBlob) audioPath = await uploadFamilyMedia(CURRENT_FAMILY_ID, "chitrashale", mediaBlob, "webm");
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }

    const content = {
      interactionType,
      iconKey: photoPath ? null : iconKey,
      photoPath,
      audioPath,
      memoryText: memoryText.trim() || null,
      moodKey: interactionType === "ambientShift" ? moodKey : null,
    };
    await onSubmit({
      type: "chitrashalaObject", personId: person.id, field: spotKey, title: label.trim(),
      relation: relation.trim() || null, content: JSON.stringify(content), contributor: contributor.trim() || "Anonymous",
    });
    setSubmitting(false);
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-panel">
        <button className="modal-close on-paper" onClick={onCancel} aria-label="Close">✕</button>
        <div className="modal-body">
          <span className="eyebrow">Anubhava Chitrashale</span>
          <h2 style={{ fontSize: 20, marginTop: 6 }}>Add something to {person.name.split(" ")[0]}'s room</h2>
          <form onSubmit={submit}>
            <div className="form-row">
              <label>What is it?</label>
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Jasmine flowers" />
            </div>

            <div className="form-row">
              <label>Where does it sit?</label>
              <div className="type-grid">
                {ROOM_SPOTS.map((s) => {
                  const occupant = occupiedSpots[s.key];
                  return (
                    <button
                      type="button" key={s.key} disabled={!!occupant}
                      className={spotKey === s.key ? "active" : ""}
                      onClick={() => setSpotKey(s.key)}
                      title={occupant ? `Already holds "${occupant.title}"` : undefined}
                    >
                      <span>{s.label}</span>
                      {occupant && <span style={{ fontSize: 10, opacity: 0.7 }}>— taken</span>}
                    </button>
                  );
                })}
              </div>
              {!openSpots.length && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>Every spot in this room is already filled.</p>}
            </div>

            <div className="form-row">
              <label>Photo of the real object (optional)</label>
              <input type="file" accept="image/*" onChange={handlePhotoFile} />
              {photoDataUrl && <img src={photoDataUrl} alt="" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 8, marginTop: 10, border: "1px solid var(--line-strong)" }} />}
              {photoError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{photoError}</p>}
              {!photoDataUrl && (
                <div className="type-grid" style={{ marginTop: 10 }}>
                  {ICON_KEYS.map((k) => (
                    <button type="button" key={k} className={iconKey === k ? "active" : ""} onClick={() => setIconKey(k)} style={{ padding: 8 }}>
                      <span style={{ width: 32, height: 22, display: "inline-block" }}><ChitrashaleIcon iconKey={k} /></span>
                    </button>
                  ))}
                </div>
              )}
              <p className="form-hint">No photo? Pick an icon to stand in for it instead.</p>
            </div>

            <AudioRecorderRow onMediaReady={handleMediaReady} />

            <div className="form-row">
              <label>How is this shared, when touched?</label>
              <div className="type-grid">
                {INTERACTION_TYPES.filter((t) => !t.needsAudio || hasAudio).map((t) => (
                  <button type="button" key={t.key} className={interactionType === t.key ? "active" : ""} onClick={() => setInteractionType(t.key)}>{t.label}</button>
                ))}
              </div>
              <p className="form-hint">{typeDef.prompt}</p>
              {typeDef.needsAudio && !hasAudio && <p className="form-hint">Record something above to unlock this.</p>}
            </div>

            {interactionType === "ambientShift" && (
              <div className="form-row">
                <label>Mood</label>
                <select value={moodKey} onChange={(e) => setMoodKey(e.target.value)}>
                  {MOOD_KEYS.map((m) => <option value={m.key} key={m.key}>{m.label}</option>)}
                </select>
              </div>
            )}

            {(needsText || interactionType === "ambientShift" || interactionType === "voiceNarrated") && (
              <div className="form-row">
                <label>{needsText ? "The line" : "A line to go with it (optional)"}</label>
                <textarea value={memoryText} onChange={(e) => setMemoryText(e.target.value)} placeholder="A single sentence is plenty." />
              </div>
            )}

            <div className="form-row">
              <label>Your relation to {person.name.split(" ")[0]}</label>
              <input type="text" value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="e.g. her daughter, a grandson" />
            </div>
            <div className="form-row">
              <label>Your name</label>
              <input type="text" value={contributor} onChange={(e) => setContributor(e.target.value)} placeholder="e.g. Kavya Reddy" />
            </div>

            {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
            <div className="folio-actions">
              <button type="submit" className="btn primary" disabled={submitting || !openSpots.length}>{submitting ? "Adding…" : canModerate ? "Add now" : "Submit for review"}</button>
              <button type="button" className="btn ghost" onClick={onCancel} disabled={submitting}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
