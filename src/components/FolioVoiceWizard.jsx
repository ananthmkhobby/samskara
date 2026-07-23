import { useEffect, useRef, useState } from "react";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { geocodePlace } from "../lib/geocode";
import { speakQuestion, hasVoiceFor } from "../lib/speech";
import { AudioIcon } from "./Icons";

const SPEECH_LANGS = [
  { code: "en-IN", label: "English" },
  { code: "kn-IN", label: "ಕನ್ನಡ (Kannada)" },
  { code: "te-IN", label: "తెలుగు (Telugu)" },
  { code: "ta-IN", label: "தமிழ் (Tamil)" }
];

// Each step maps straight onto an existing edit field/pipeline — the wizard
// is just a friendlier front door onto the same summary/lifeLesson/heritage/
// geo/places edits already available one at a time from the Folio.
const STEPS = [
  {
    key: "heritage", fieldLabel: "Heritage details",
    question: (name) => `What's ${name}'s rashi, or birth star, if you know it? And their gotra?`,
    isFilled: (p) => !!(p.rashi || p.gotra),
    fields: [
      { key: "rashi", label: "Rashi", placeholder: "e.g. Simha" },
      { key: "gotra", label: "Gotra", placeholder: "e.g. Bharadwaja" }
    ],
    buildContent: (v) => JSON.stringify({ rashi: (v.rashi || "").trim(), gotra: (v.gotra || "").trim() })
  },
  {
    key: "geo", fieldLabel: "Location",
    question: (name) => `Which city does ${name} live in now?`,
    isFilled: (p) => !!p.geo,
    fields: [{ key: "city", label: "City", placeholder: "e.g. Mangalore" }],
    geocode: true
  },
  {
    key: "lifeLesson", fieldLabel: "Life lesson",
    question: (name) => `What's a life lesson or piece of advice you'd associate with ${name}?`,
    isFilled: (p) => !!p.lifeLesson,
    fields: [{ key: "quote", label: "Life lesson", placeholder: "e.g. Never let a regular customer leave without credit if they need it" }],
    buildContent: (v) => JSON.stringify({ quote: (v.quote || "").trim(), values: [] })
  },
  {
    key: "summary", fieldLabel: "Summary",
    question: (name) => `In a couple of sentences, how would you describe ${name}'s life?`,
    isFilled: (p) => !!p.summary,
    fields: [{ key: "summary", label: "Summary", placeholder: "A short summary of their life" }],
    buildContent: (v) => (v.summary || "").trim()
  },
  {
    key: "places", fieldLabel: "Places",
    question: (name) => `What places matter in ${name}'s life — where they were born, lived, or settled?`,
    isFilled: (p) => !!(p.places && p.places.length),
    fields: [{ key: "places", label: "Places", placeholder: "e.g. Born in Kundapura, settled in Mangalore" }],
    buildContent: (v) => (v.places || "").trim()
  }
];

export default function FolioVoiceWizard({ request, onSubmitField, onFinish, onOpenInterview }) {
  // Decided once, at open time, from whatever's already filled — this is
  // also what makes it resumable: reopening later just re-evaluates against
  // current data and only asks about what's still empty.
  const [stepsToAsk] = useState(() => STEPS.filter((s) => !s.isFilled(request.person)));
  const [phase, setPhase] = useState("intro"); // intro | asking | done
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState({});
  const [answered, setAnswered] = useState([]);
  const [speechLang, setSpeechLang] = useState("en-IN");
  const [contributor, setContributor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const focusedFieldRef = useRef(null);
  const { listening, supported: speechSupported, start: startSpeech, stop: stopSpeech } = useSpeechToText();

  const step = stepsToAsk[stepIndex];

  useEffect(() => {
    if (phase === "asking" && step) speakQuestion(step.question(request.name), speechLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIndex]);

  // Lets the intro screen be honest about accent limits — TTS only sounds
  // authentic if this device actually has a voice installed for the chosen
  // language; there's no way to fake one client-side if it doesn't.
  useEffect(() => {
    let cancelled = false;
    hasVoiceFor(speechLang).then((has) => { if (!cancelled) setVoiceAvailable(has); });
    return () => { cancelled = true; };
  }, [speechLang]);

  function begin() {
    if (listening) stopSpeech();
    setPhase(stepsToAsk.length ? "asking" : "done");
  }

  function toggleSpeech() {
    if (listening) { stopSpeech(); return; }
    const targetKey = focusedFieldRef.current || step.fields[0].key;
    startSpeech(speechLang, (finalText) => {
      setValues((prev) => ({ ...prev, [targetKey]: prev[targetKey] ? `${prev[targetKey]} ${finalText}` : finalText }));
    });
  }

  function advance(fieldLabel) {
    if (listening) stopSpeech();
    if (fieldLabel) setAnswered((prev) => [...prev, fieldLabel]);
    setValues({});
    setError("");
    const nextIndex = stepIndex + 1;
    if (nextIndex >= stepsToAsk.length) setPhase("done");
    else setStepIndex(nextIndex);
  }

  function skip() {
    advance(null);
  }

  async function next() {
    if (busy) return;
    const hasValue = step.fields.some((f) => (values[f.key] || "").trim());
    if (!hasValue) { skip(); return; }
    if (step.geocode) {
      setBusy(true);
      try {
        const geo = await geocodePlace(values.city.trim());
        onSubmitField("geo", step.fieldLabel, JSON.stringify(geo), contributor);
      } catch (err) {
        setError(err.message);
        setBusy(false);
        return;
      }
      setBusy(false);
    } else {
      onSubmitField(step.key, step.fieldLabel, step.buildContent(values), contributor);
    }
    advance(step.fieldLabel);
  }

  if (phase === "intro") {
    return (
      <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onFinish(); }}>
        <div className="modal-panel">
          <button className="modal-close on-paper" onClick={onFinish} aria-label="Close">✕</button>
          <div className="modal-body">
            <span className="eyebrow">Voice walkthrough</span>
            <h2 style={{ fontSize: 20, marginTop: 6 }}>Fill in {request.name}'s profile by voice</h2>
            {stepsToAsk.length ? (
              <p className="form-hint" style={{ marginTop: 6 }}>
                {stepsToAsk.length} short question{stepsToAsk.length === 1 ? "" : "s"} — answer by speaking or typing, skip anything you don't know. You can stop anytime; whatever's left just stays for next time.
              </p>
            ) : (
              <p className="form-hint" style={{ marginTop: 6 }}>Every field here is already filled in — nothing left to ask.</p>
            )}
            <div className="form-row">
              <label>Language</label>
              <select value={speechLang} onChange={(e) => setSpeechLang(e.target.value)}>
                {SPEECH_LANGS.map((l) => <option value={l.code} key={l.code}>{l.label}</option>)}
              </select>
              {!voiceAvailable && (
                <p className="form-hint">This device doesn't have a spoken voice installed for this language yet — questions will still show as text, just not read aloud. (On Android: Settings → Language → Text-to-speech → install this language's voice data.)</p>
              )}
            </div>
            <div className="form-row">
              <label>Your name</label>
              <input type="text" placeholder="e.g. Kavya Reddy" value={contributor} onChange={(e) => setContributor(e.target.value)} />
            </div>
            <div className="folio-actions">
              <button className="btn primary" onClick={begin}>{stepsToAsk.length ? "Begin →" : "Continue"}</button>
              <button className="btn ghost" onClick={onFinish}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onFinish(); }}>
        <div className="modal-panel">
          <button className="modal-close on-paper" onClick={onFinish} aria-label="Close">✕</button>
          <div className="modal-body">
            <span className="eyebrow">All set</span>
            <h2 style={{ fontSize: 20, marginTop: 6 }}>Thanks for filling in {request.name}'s profile</h2>
            {answered.length > 0 ? (
              <p className="form-hint" style={{ marginTop: 6 }}>Captured: {answered.join(", ")}.</p>
            ) : (
              <p className="form-hint" style={{ marginTop: 6 }}>Nothing new was captured this time — that's fine, it'll ask again next time you run the walkthrough.</p>
            )}
            <p className="form-hint">Want to go deeper? The AI-guided interview has a longer conversation and drafts a full biography chapter.</p>
            <div className="folio-actions">
              <button className="btn primary" onClick={onOpenInterview}>Continue to AI interview →</button>
              <button className="btn ghost" onClick={onFinish}>Done</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onFinish(); }}>
      <div className="modal-panel">
        <button className="modal-close on-paper" onClick={onFinish} aria-label="Close">✕</button>
        <div className="modal-body">
          <span className="eyebrow">Question {stepIndex + 1} of {stepsToAsk.length}</span>
          <h2 style={{ fontSize: 20, marginTop: 6 }}>{step.fieldLabel}</h2>
          <p className="interview-question">{step.question(request.name)}</p>
          <div className="form-row">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <label style={{ marginBottom: 0 }}>Answer</label>
              {speechSupported && (
                <button type="button" className={`icon-only${listening ? " playing" : ""}`} style={listening ? { borderColor: "var(--maroon-deep)", color: "var(--maroon-deep)" } : undefined} aria-label={listening ? "Stop dictation" : "Start dictation"} onClick={toggleSpeech}>
                  <AudioIcon />
                </button>
              )}
            </div>
            {step.fields.map((f) => (
              f.key === "summary" || f.key === "quote" || f.key === "places" ? (
                <textarea
                  key={f.key} placeholder={f.placeholder} value={values[f.key] || ""}
                  onFocus={() => { focusedFieldRef.current = f.key; }}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              ) : (
                <input
                  key={f.key} type="text" placeholder={f.placeholder} value={values[f.key] || ""}
                  style={{ marginTop: f.key === step.fields[0].key ? 0 : 8 }}
                  onFocus={() => { focusedFieldRef.current = f.key; }}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              )
            ))}
            {listening && <p className="form-hint">Listening… speak naturally, it'll appear above.</p>}
            {!speechSupported && <p className="form-hint">Voice dictation isn't supported in this browser — you can still type.</p>}
          </div>
          {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
          <div className="folio-actions">
            <button className="btn primary" onClick={next} disabled={busy}>{busy ? "Looking up city…" : "Next →"}</button>
            <button className="btn ghost" onClick={skip} disabled={busy}>Skip — don't know</button>
          </div>
        </div>
      </div>
    </div>
  );
}
