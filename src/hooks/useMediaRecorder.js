import { useCallback, useRef, useState } from "react";

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
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const start = useCallback(async () => {
    setError(null);
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
    } catch {
      setError(kind === "video" ? "Camera/microphone access was denied or unavailable." : "Microphone access was denied or unavailable.");
    }
  }, [kind]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    setRecording(false);
  }, []);

  const reset = useCallback(() => {
    setMediaUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setMediaBlob(null);
  }, []);

  return { recording, mediaUrl, mediaBlob, stream, error, start, stop, reset };
}
