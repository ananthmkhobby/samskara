import { useEffect, useState } from "react";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { speakQuestion, hasVoiceFor } from "../lib/speech";
import { AudioIcon } from "./Icons";
import { callApi } from "../lib/apiFetch";

const MAX_ROUNDS = 4;
const SPEECH_LANGS = [
  { code: "en-IN", label: "English" },
  { code: "kn-IN", label: "ಕನ್ನಡ (Kannada)" },
  { code: "te-IN", label: "తెలుగు (Telugu)" },
  { code: "ta-IN", label: "தமிழ் (Tamil)" }
];

// The opening question needs no AI call — it's templated from whatever this
// person already has on record, so the interview can start instantly (and
// still works if /api isn't running, e.g. under plain `vite dev`).
function openingQuestion(name, context) {
  const first = name.split(" ")[0];
  if (context) {
    const snippet = context.length > 100 ? `${context.slice(0, 100)}…` : context;
    return `To start — you mentioned "${snippet}" Could you tell that story in your own words?`;
  }
  return `Let's start with something simple — what's a memory of ${first} that always makes you smile?`;
}

export default function AIInterviewModal({ request, onCancel, onSubmit }) {
  const [started, setStarted] = useState(false);
  const [history, setHistory] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(() => openingQuestion(request.name, request.context));
  const [answerText, setAnswerText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);
  const [contributor, setContributor] = useState("");
  const [speechLang, setSpeechLang] = useState("en-IN");
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const { listening, supported: speechSupported, start: startSpeech, stop: stopSpeech } = useSpeechToText();

  const roundsDone = history.length;
  const atMax = roundsDone >= MAX_ROUNDS;

  // Reads each question aloud as it appears (opening question once started,
  // then every follow-up) — matches the voice walkthrough's behavior.
  useEffect(() => {
    if (started) speakQuestion(currentQuestion, speechLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, currentQuestion]);

  // Lets the intro screen be honest about accent limits — there's no way to
  // fake an Indian-accented voice client-side if this device has none
  // installed for the chosen language.
  useEffect(() => {
    let cancelled = false;
    hasVoiceFor(speechLang).then((has) => { if (!cancelled) setVoiceAvailable(has); });
    return () => { cancelled = true; };
  }, [speechLang]);

  function begin() {
    setStarted(true);
  }

  function toggleSpeech() {
    if (listening) { stopSpeech(); return; }
    startSpeech(speechLang, (finalText) => setAnswerText((prev) => (prev ? `${prev} ${finalText}` : finalText)));
  }

  async function askNext() {
    if (!answerText.trim() || busy || atMax) return;
    const newHistory = [...history, { question: currentQuestion, answer: answerText.trim() }];
    if (listening) stopSpeech();
    setHistory(newHistory);
    setAnswerText("");
    setBusy(true);
    setError("");
    try {
      const data = await callApi("/api/interview-followup", { personName: request.name, context: request.context, history: newHistory });
      setCurrentQuestion(data.question);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function finishAndDraft() {
    if (busy) return;
    const finalHistory = answerText.trim() ? [...history, { question: currentQuestion, answer: answerText.trim() }] : history;
    if (!finalHistory.length) return;
    if (listening) stopSpeech();
    setBusy(true);
    setError("");
    try {
      const data = await callApi("/api/interview-draft", { personName: request.name, history: finalHistory });
      setDraft({ title: data.title, text: data.text });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    onSubmit({ title: draft.title, text: draft.text, contributor: contributor.trim() || "Anonymous" });
  }

  if (!started) {
    return (
      <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
        <div className="modal-panel">
          <button className="modal-close on-paper" onClick={onCancel} aria-label="Close">✕</button>
          <div className="modal-body">
            <span className="eyebrow">AI-guided interview</span>
            <h2 style={{ fontSize: 20, marginTop: 6 }}>Record {request.name}'s story</h2>
            <p className="form-hint" style={{ marginTop: 6 }}>
              A few spoken questions, up to {MAX_ROUNDS} rounds — answer by speaking or typing. The AI drafts a biography chapter from the conversation once you're done.
            </p>
            <div className="form-row">
              <label>Language</label>
              <select value={speechLang} onChange={(e) => setSpeechLang(e.target.value)}>
                {SPEECH_LANGS.map((l) => <option value={l.code} key={l.code}>{l.label}</option>)}
              </select>
              {!voiceAvailable && (
                <p className="form-hint">This device doesn't have a spoken voice installed for this language yet — questions will still show as text, just not read aloud.</p>
              )}
            </div>
            <div className="folio-actions">
              <button className="btn primary" onClick={begin}>Begin →</button>
              <button className="btn ghost" onClick={onCancel}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (draft) {
    return (
      <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
        <div className="modal-panel">
          <button className="modal-close on-paper" onClick={onCancel} aria-label="Close">✕</button>
          <div className="modal-body">
            <span className="eyebrow">Drafted from your interview</span>
            <h2 style={{ fontSize: 20, marginTop: 6 }}>Review the chapter</h2>
            <p className="form-hint" style={{ marginTop: 6 }}>Edit anything before it's added to {request.name}'s biography.</p>
            <div className="form-row">
              <label>Chapter title</label>
              <input type="text" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Chapter text</label>
              <textarea style={{ minHeight: 200 }} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Your name</label>
              <input type="text" placeholder="e.g. Kavya Reddy" value={contributor} onChange={(e) => setContributor(e.target.value)} />
            </div>
            <div className="folio-actions">
              <button className="btn primary" onClick={submit}>Add this chapter</button>
              <button className="btn ghost" onClick={onCancel}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-panel">
        <button className="modal-close on-paper" onClick={onCancel} aria-label="Close">✕</button>
        <div className="modal-body">
          <span className="eyebrow">AI-guided interview · {request.name}</span>
          <h2 style={{ fontSize: 20, marginTop: 6 }}>Question {roundsDone + 1}</h2>
          <p className="interview-question">{currentQuestion}</p>
          <div className="form-row">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <label style={{ marginBottom: 0 }}>Answer</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <select value={speechLang} onChange={(e) => setSpeechLang(e.target.value)} style={{ width: "auto", padding: "4px 8px", fontSize: 11.5 }}>
                  {SPEECH_LANGS.map((l) => <option value={l.code} key={l.code}>{l.label}</option>)}
                </select>
                {speechSupported && (
                  <button type="button" className={`icon-only${listening ? " playing" : ""}`} style={listening ? { borderColor: "var(--maroon-deep)", color: "var(--maroon-deep)" } : undefined} aria-label={listening ? "Stop dictation" : "Start dictation"} onClick={toggleSpeech}>
                    <AudioIcon />
                  </button>
                )}
              </div>
            </div>
            <textarea placeholder="Speak using the mic, or type the answer here…" value={answerText} onChange={(e) => setAnswerText(e.target.value)} />
            {listening && <p className="form-hint">Listening… speak naturally, it'll appear above.</p>}
            {!speechSupported && <p className="form-hint">Voice dictation isn't supported in this browser — Chrome or Edge work best. You can still type.</p>}
          </div>
          {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
          {atMax && <p className="form-hint">That's a good amount to work with — ready to draft the chapter whenever you are.</p>}
          <div className="folio-actions">
            <button className="btn primary" onClick={askNext} disabled={!answerText.trim() || busy || atMax}>{busy ? "Thinking…" : "Next question →"}</button>
            <button className="btn" onClick={finishAndDraft} disabled={busy || (!answerText.trim() && !history.length)}>{busy ? "Drafting…" : "Finish & draft chapter"}</button>
            <button className="btn ghost" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
