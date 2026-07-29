import { useEffect, useMemo, useRef, useState } from "react";
import { ROOM_SPOTS, parseChitrashaleContent, verifiedObjectsBySpot } from "../lib/chitrashale";
import { ChitrashaleIcon } from "./ChitrashaleIcons";
import { batchResolveMediaUrls } from "../lib/mediaUpload";
import { createAmbientPlayer } from "../lib/ambientSound";

const SILENCE_DELAY_MS = 5000;
const MOOD_SETTLE_MS = 900;
const MUTE_KEY = "vamsha.chitrashaleMuted";

function ObjectSpot({ spot, entry, urlMap, onOpenObject, onMoodChange, isOpen, onRequestOpen, onRequestClose }) {
  const [revealed, setRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [moodActive, setMoodActive] = useState(false);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // The room only ever shows one open memory at a time (a click elsewhere,
  // the close button, or Escape closes whichever spot is open) — when the
  // shared "open" key stops pointing at this spot, drop its own revealed
  // state too, rather than leaving a stale card no longer tracked above it.
  useEffect(() => {
    if (!isOpen && revealed) setRevealed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

  function closeSelf() {
    setRevealed(false);
    setRevealing(false);
    onRequestClose();
  }

  function handleTap() {
    if (c.interactionType === "silenceThenText") {
      if (revealed || revealing) return;
      onRequestOpen();
      setRevealing(true);
      timerRef.current = setTimeout(() => { setRevealing(false); setRevealed(true); }, SILENCE_DELAY_MS);
      return;
    }
    if (c.interactionType === "ambientShift") {
      if (moodActive) return;
      onRequestOpen();
      setMoodActive(true);
      timerRef.current = setTimeout(() => {
        setRevealed(true);
        onMoodChange?.(c.moodKey || "rain");
        if (audioUrl && audioRef.current) audioRef.current.play().catch(() => {});
      }, MOOD_SETTLE_MS);
      return;
    }
    if (c.interactionType === "voiceNarrated" || c.interactionType === "pureAmbientAudio") {
      if (audioUrl && audioRef.current) audioRef.current.play().catch(() => {});
      onRequestOpen();
      setRevealed(true);
      return;
    }
    if (revealed) { closeSelf(); return; }
    onRequestOpen();
    setRevealed(true);
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
        <span className={`chitra-spot-icon${photoUrl ? " chitra-photo-frame" : ""}`}>
          {photoUrl ? <img className="chitra-photo-treated" src={photoUrl} alt={entry.title} /> : <ChitrashaleIcon iconKey={c.iconKey} />}
        </span>
        <span className="chitra-spot-label">{entry.title}</span>
      </button>
      {(revealed || revealing) && (
        <div className="chitra-reveal" style={{ left: `${spot.x}%`, top: `${spot.y}%` }}>
          {revealed && (
            <button type="button" className="chitra-reveal-close" aria-label="Close" onClick={(e) => { e.stopPropagation(); closeSelf(); }}>✕</button>
          )}
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

// Floor plank lines that genuinely converge on the back wall's vanishing
// line (see .chitra-floor / .chitra-floor-lines in chitrashale.css) — a
// fixed set of straight lines, not generated per-render.
const FLOOR_LINES = [
  [50, 55, 4, 100], [50, 55, 22, 100], [50, 55, 38, 100], [50, 55, 50, 100],
  [50, 55, 62, 100], [50, 55, 78, 100], [50, 55, 96, 100],
  [9.33, 70, 90.67, 70], [3.73, 88, 96.27, 88],
];

export default function ChitrashaleRoom({ person, contributions, onClose, onOpenAdd, onSubmit }) {
  const [phase, setPhase] = useState("room"); // room | exit
  const [urlMap, setUrlMap] = useState({});
  const [reflectionText, setReflectionText] = useState("");
  const [reflectionSubmitting, setReflectionSubmitting] = useState(false);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
  });
  const playerRef = useRef(null);

  // Which spot (if any) currently has its memory open — lifted up here
  // rather than kept purely local to each ObjectSpot, so a click elsewhere
  // in the room, the reveal card's own close button, and Escape can all
  // close whatever's open regardless of which spot it belongs to.
  const [openSpotKey, setOpenSpotKey] = useState(null);
  const closeReveal = () => setOpenSpotKey(null);

  // The wooden-doors entrance animation: closed until tapped, then swings
  // open and gets removed once settled. Purely a visual overlay on top of
  // the already-mounted room scene underneath.
  const [doorsOpening, setDoorsOpening] = useState(false);
  const [doorsSettled, setDoorsSettled] = useState(false);
  const [doorsHidden, setDoorsHidden] = useState(false);
  const doorTimersRef = useRef([]);
  useEffect(() => () => doorTimersRef.current.forEach(clearTimeout), []);
  function openDoors() {
    if (doorsOpening) return;
    setDoorsOpening(true);
    doorTimersRef.current.push(
      setTimeout(() => setDoorsSettled(true), 1300),
      setTimeout(() => setDoorsHidden(true), 1900),
    );
  }

  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") closeReveal(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const objectsBySpot = useMemo(() => verifiedObjectsBySpot(contributions, person.id), [contributions, person.id]);
  const hasAnyObjects = Object.keys(objectsBySpot).length > 0;

  // A soft, sparse "birds" bed on open — quiet enough to never compete with a
  // tap-revealed voice or memory. setMuted must run before the first setBed()
  // so the initial bed starts at the right volume instead of starting loud
  // and then ramping down. Torn down on unmount so nothing keeps playing
  // after the room closes.
  useEffect(() => {
    const player = createAmbientPlayer();
    playerRef.current = player;
    player.setMuted(muted);
    player.setBed("birds");
    return () => player.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMuted() {
    const next = !muted;
    setMuted(next);
    playerRef.current?.setMuted(next);
    try { localStorage.setItem(MUTE_KEY, next ? "1" : "0"); } catch { /* storage unavailable */ }
  }

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
          <button
            type="button" className="chitra-mute-toggle on-paper"
            onClick={toggleMuted} aria-label={muted ? "Unmute room sound" : "Mute room sound"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        )}

        {phase === "room" && (
          <>
            <div
              className="chitra-room-scene"
              onClick={(e) => { if (e.target.closest(".chitra-spot")) return; closeReveal(); }}
            >
              <div className="chitra-wall-left" aria-hidden="true" />
              <div className="chitra-wall-right" aria-hidden="true" />
              <div className="chitra-ceiling" aria-hidden="true" />
              <div className="chitra-wall-back" aria-hidden="true" />
              <div className="chitra-baseboard" aria-hidden="true" />
              <div className="chitra-floor" aria-hidden="true" />
              <svg className="chitra-floor-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {FLOOR_LINES.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
              </svg>
              <div className="chitra-rug" aria-hidden="true" />
              <div className="chitra-keylight" aria-hidden="true" />

              <div className="chitra-window" aria-hidden="true">
                <div className="chitra-light-shaft" />
                <div className="chitra-window-frame">
                  <div className="chitra-window-glass" />
                  <div className="chitra-window-mullion-v" />
                  <div className="chitra-window-mullion-h" />
                </div>
              </div>
              <div className="chitra-room-motes" aria-hidden="true">
                {[18, 38, 50, 64, 82].map((x, i) => <span key={i} className="chitra-mote" style={{ "--mote-x": `${x}%`, "--mote-delay": `${i * 0.6}s` }} />)}
              </div>

              <div className="chitra-alcove" aria-hidden="true"><div className="chitra-alcove-shape"><div className="chitra-alcove-glow" /></div></div>
              <div className="chitra-door-niche" aria-hidden="true">
                <div className="chitra-door-niche-frame"><div className="chitra-door-niche-panel" /><div className="chitra-door-niche-handle" /></div>
              </div>
              <div className="chitra-table" aria-hidden="true">
                <div className="chitra-table-top" /><div className="chitra-table-front" />
                <div className="chitra-table-leg l" /><div className="chitra-table-leg r" />
              </div>
              <div className="chitra-shelf" aria-hidden="true">
                <div className="chitra-shelf-plank" /><div className="chitra-shelf-bracket l" /><div className="chitra-shelf-bracket r" />
              </div>

              {ROOM_SPOTS.map((spot) => (
                <ObjectSpot
                  key={spot.key} spot={spot} entry={objectsBySpot[spot.key]} urlMap={urlMap} onOpenObject={onOpenAdd}
                  onMoodChange={(kind) => playerRef.current?.setBed(kind)}
                  isOpen={openSpotKey === spot.key}
                  onRequestOpen={() => setOpenSpotKey(spot.key)}
                  onRequestClose={closeReveal}
                />
              ))}

              <div className="chitra-vignette" aria-hidden="true" />

              {!doorsHidden && (
                <div
                  className={`chitra-doors${doorsOpening ? " opening" : ""}${doorsSettled ? " settled" : ""}`}
                  onClick={(e) => { e.stopPropagation(); openDoors(); }}
                  role="button" tabIndex={0} aria-label="Step inside"
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDoors(); } }}
                >
                  <div className="chitra-door-panel left"><div className="chitra-door-ring" /></div>
                  <div className="chitra-door-panel right"><div className="chitra-door-ring" /></div>
                  <div className="chitra-door-glow" />
                  <div className="chitra-knock-hint">Tap to step inside</div>
                </div>
              )}
            </div>
            <div className="chitra-room-footer">
              <p className="chitra-room-title">{firstName}'s room</p>
              {!hasAnyObjects && <p className="form-hint" style={{ marginTop: 0 }}>Nothing here yet — be the first to begin {firstName}'s room.</p>}
              <button type="button" className="btn primary small" onClick={() => { closeReveal(); onOpenAdd(true); }}>+ Add something to this room</button>
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
