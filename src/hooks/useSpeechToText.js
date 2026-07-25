import { useCallback, useRef, useState } from "react";

// Real speech-to-text via the browser's built-in Web Speech API — free,
// client-side, no account or API key. Supported in Chrome/Edge; Safari/Firefox
// support varies, hence the `supported` flag callers should check.
export function useSpeechToText() {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const manualStopRef = useRef(false);
  const supported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const start = useCallback((lang, onResult) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    manualStopRef.current = false;
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = true;
    rec.onresult = (e) => {
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      }
      if (finalText) onResult(finalText);
    };
    // Chrome's speech engine ends the session on a brief pause even with
    // continuous:true — from the user's side that reads as "the mic turned
    // itself off after a second" mid-sentence. Restart transparently
    // unless they explicitly tapped stop, so a short pause doesn't end
    // dictation.
    rec.onend = () => {
      if (manualStopRef.current) { setListening(false); return; }
      try { rec.start(); } catch { setListening(false); }
    };
    rec.onerror = (e) => {
      // 'no-speech' and 'aborted' are the same transient pauses onend
      // already recovers from — anything else is a real failure.
      if (e.error !== "no-speech" && e.error !== "aborted") manualStopRef.current = true;
    };
    rec.start();
    recRef.current = rec;
    setListening(true);
  }, []);

  const stop = useCallback(() => {
    manualStopRef.current = true;
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}
