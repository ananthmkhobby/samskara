import { useCallback, useEffect, useRef, useState } from "react";

// Nothing capped how long an in-browser recording could run — someone
// could record for an hour and only find out it was rejected (or silently
// blew past the family's storage plan) at upload time. See
// docs/ARCHITECTURE_REVIEW.md §4/§9 action item 7 and the matching
// storage.buckets file_size_limit added in
// supabase/migrations/20261029190000_media_size_caps.sql — that's the real
// backstop (enforced server-side, can't be bypassed by a client that skips
// this hook); this is the good-UX half, so nobody loses a 20-minute take to
// a limit they never saw coming. Video is capped tighter than audio since a
// webcam recording is far larger per second at the same duration.
const MAX_SECONDS = { audio: 20 * 60, video: 10 * 60 };

// Real microphone/camera recording via getUserMedia + MediaRecorder. Returns
// a blob: URL for instant in-modal preview/playback (only ever valid in this
// tab), plus the raw Blob itself — the actual durable upload happens at
// submit time (see ContributeModal), not here, so a re-recorded or
// cancelled take never gets uploaded needlessly.
export function useMediaRecorder(kind) {
  const [recording, setRecording] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaBlob, setMediaBlob] = useState(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [autoStopped, setAutoStopped] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const startedAtRef = useRef(0);

  const maxSeconds = MAX_SECONDS[kind] || MAX_SECONDS.audio;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setAutoStopped(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser doesn't support microphone/camera capture.");
      return;
    }
    try {
      const constraints = kind === "video" ? { audio: true, video: { facingMode: "user" } } : { audio: true };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(s);
      chunksRef.current = [];
      const recorder = new MediaRecorder(s);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: kind === "video" ? "video/webm" : "audio/webm" });
        setMediaBlob(blob);
        setMediaUrl(URL.createObjectURL(blob));
        s.getTracks().forEach((t) => t.stop());
        setStream(null);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsedSeconds(0);
      startedAtRef.current = Date.now();
      clearTimer();
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsedSeconds(elapsed);
        if (elapsed >= maxSeconds) {
          clearTimer();
          setAutoStopped(true);
          recorderRef.current?.stop();
          setRecording(false);
        }
      }, 1000);
    } catch {
      setError(kind === "video" ? "Camera/microphone access was denied or unavailable." : "Microphone access was denied or unavailable.");
    }
  }, [kind, maxSeconds, clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
    recorderRef.current?.stop();
    setRecording(false);
  }, [clearTimer]);

  const reset = useCallback(() => {
    setMediaUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setMediaBlob(null);
    setElapsedSeconds(0);
    setAutoStopped(false);
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { recording, mediaUrl, mediaBlob, stream, error, start, stop, reset, elapsedSeconds, maxSeconds, autoStopped };
}
