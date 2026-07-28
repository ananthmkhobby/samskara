import { useEffect, useMemo, useRef, useState } from "react";
import { ROOM_SPOTS, parseChitrashaleContent, verifiedObjectsBySpot } from "../lib/chitrashale";
import { ChitrashaleIcon } from "./ChitrashaleIcons";
import { batchResolveMediaUrls } from "../lib/mediaUpload";

const SILENCE_DELAY_MS = 5000;
const MOOD_SETTLE_MS = 900;

function ObjectSpot({ spot, entry, urlMap, onOpenObject }) {
  const [revealed, setRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [moodActive, setMoodActive] = useState(false);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (!entry) {
    return (
      <button
        type="button" className="chitra-spot chitra-spot-empty"
        style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
        onClick={() => onOpenObject(spot.key)}
        aria-label={`Add something ${spot.label.toLowerCase()}`}
      >
        <span className="chitra-spot-plus">+</span>
        <span className="chitra-spot-label">{spot.label}</span>
      </button>
    );
  }

  const c = parseChitrashaleContent(entry.content);
  const photoUrl = c.photoPath ? urlMap[c.photoPath] : null;
  const audioUrl = c.audioPath ? urlMap[c.audioPath] : null;
  const credit = entry.relation || entry.contributor;

  function handleTap() {
    if (c.interactionType === "silenceThenText") {
      if (revealed || revealing) return;
      setRevealing(true);
      timerRef.current = setTimeout(() => { setRevealing(false); setRevealed(true); }, SILENCE_DELAY_MS);
      return;
    }
    if (c.interactionType === "ambientShift") {
      if (moodActive) return;
      setMoodActive(true);
      timerRef.current = setTimeout(() => {
        setRevealed(true);
        if (audioUrl && audioRef.current) audioRef.current.play().catch(() => {});
      }, MOOD_SETTLE_MS);
      return;
    }
    if (c.interactionType === "voiceNarrated" || c.interactionType === "pureAmbientAudio") {
      if (audioUrl && audioRef.current) audioRef.current.play().catch(() => {});
      setRevealed(true);
      return;
    }
    setRevealed((r) => !r);
  }

  return (
    <>
      {c.interactionType === "ambientShift" && moodActive && (
        <div className={`chitra-mood-overlay chitra-mood-${c.moodKey || "rain"}`} aria-hidden="true">
          {c.moodKey === "rain" || !c.moodKey ? Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="chitra-mood-drop" style={{ left: `${(i * 97) % 100}%`, animationDelay: `${(i % 5) * 0.3}s` }} />
          )) : null}
        </div>
      )}
      <button
        type="button" className={`chitra-spot${revealed ? " revealed" : ""}${revealing ? " revealing" : ""}`}
        style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
        onClick={handleTap}
        aria-label={entry.title}
      >
        <span className="chitra-spot-icon">
          {photoUrl ? <img src={photoUrl} alt={entry.title} /> : <ChitrashaleIcon iconKey={c.iconKey} />}
        </span>
        <span className="chitra-spot-label">{entry.title}</span>
      </button>
      {(revealed || revealing) && (
        <div className="chitra-reveal" style={{ left: `${spot.x}%`, top: `${spot.y}%` }}>
          {revealing && <span className="chitra-reveal-hush" aria-hidden="true" />}
          {revealed && (
            <>
              {c.memoryText && <p className="chitra-reveal-text">{c.memoryText}</p>}
              {credit && <p className="chitra-reveal-credit">— {credit}</p>}
            </>
          )}
        </div>
      )}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="none" />}
    </>
  );
}

export default function ChitrashaleRoom({ person, contributions, onClose, onOpenAdd, onSubmit }) {
  const [phase, setPhase] = useState("room"); // room | exit
  const [urlMap, setUrlMap] = useState({});
  const [reflectionText, setReflectionText] = useState("");
  const [reflectionSubmitting, setReflectionSubmitting] = useState(false);

  const objectsBySpot = useMemo(() => verifiedObjectsBySpot(contributions, person.id), [contributions, person.id]);
  const hasAnyObjects = Object.keys(objectsBySpot).length > 0;

  useEffect(() => {
    const paths = [];
    Object.values(objectsBySpot).forEach((c) => {
      const parsed = parseChitrashaleContent(c.content);
      if (parsed.photoPath) paths.push(parsed.photoPath);
      if (parsed.audioPath) paths.push(parsed.audioPath);
    });
    if (!paths.length) return;
    batchResolveMediaUrls(paths).then(setUrlMap);
  }, [objectsBySpot]);

  function requestClose() {
    setPhase("exit");
  }

  async function submitReflection() {
    if (!reflectionText.trim()) { onClose(); return; }
    setReflectionSubmitting(true);
    try {
      await onSubmit({ type: "chitrashalaReflection", personId: person.id, content: reflectionText.trim(), contributor: "Anonymous" });
    } finally {
      setReflectionSubmitting(false);
    }
  }

  const firstName = person.name.split(" ")[0];

  return (
    <div className="modal-backdrop chitra-room-backdrop" onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}>
      <div className="chitra-room-panel">
        <button className="modal-close on-paper" onClick={requestClose} aria-label="Close">✕</button>

        {phase === "room" && (
          <>
            <div className="chitra-room-scene">
              <div className="chitra-room-motes" aria-hidden="true">
                {[18, 38, 50, 64, 82].map((x, i) => <span key={i} className="chitra-mote" style={{ "--mote-x": `${x}%`, "--mote-delay": `${i * 0.6}s` }} />)}
              </div>
              {ROOM_SPOTS.map((spot) => (
                <ObjectSpot key={spot.key} spot={spot} entry={objectsBySpot[spot.key]} urlMap={urlMap} onOpenObject={onOpenAdd} />
              ))}
            </div>
            <div className="chitra-room-footer">
              <p className="chitra-room-title">{firstName}'s room</p>
              {!hasAnyObjects && <p className="form-hint" style={{ marginTop: 0 }}>Nothing here yet — be the first to begin {firstName}'s room.</p>}
              <button type="button" className="btn primary small" onClick={() => onOpenAdd(true)}>+ Add something to this room</button>
            </div>
          </>
        )}

        {phase === "exit" && (
          <div className="chitra-exit">
            <p className="chitra-exit-question">If someone had to remember {firstName} with only one sentence, what would you add?</p>
            <textarea
              className="chitra-exit-input" value={reflectionText} onChange={(e) => setReflectionText(e.target.value)}
              placeholder="One sentence is plenty…" rows={3}
            />
            <div className="folio-actions">
              <button type="button" className="btn primary" disabled={reflectionSubmitting} onClick={submitReflection}>
                {reflectionSubmitting ? "Adding…" : "Add this"}
              </button>
              <button type="button" className="btn ghost" onClick={onClose} disabled={reflectionSubmitting}>Not now</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
