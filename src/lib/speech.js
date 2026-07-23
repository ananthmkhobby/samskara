// Text-to-speech via the browser's built-in speechSynthesis — free, no key,
// no server call. Which *voice* actually gets spoken depends entirely on
// what the OS/browser has installed; setting utterance.lang alone is only a
// request — most engines silently fall back to a default voice (often US
// English) if no matching voice object is explicitly assigned. This picks
// the best real voice available for the requested language, when one
// exists, instead of leaving that choice to chance.
let cachedVoices = [];
let voicesReady = false;

function loadVoices() {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) {
      cachedVoices = existing;
      voicesReady = true;
      resolve(existing);
      return;
    }
    // Voices often load asynchronously on first use — wait for the browser
    // to tell us they're ready rather than reading an empty list too early.
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      voicesReady = true;
      resolve(cachedVoices);
    };
    // Some engines never fire onvoiceschanged if nothing is queued yet —
    // don't hang forever waiting for a voice list that may never arrive.
    setTimeout(() => resolve(cachedVoices), 800);
  });
}

// Returns the best match plus whether it's genuinely the Indian regional
// voice (not just "some voice in the same base language") — that distinction
// matters because falling back to e.g. a generic US English voice still
// produces *sound*, just not the accent anyone asked for.
function pickVoice(voices, lang) {
  const exact = voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase());
  if (exact) return { voice: exact, authentic: true };
  const prefix = lang.split("-")[0].toLowerCase();
  const sameLanguage = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  if (!sameLanguage.length) return { voice: null, authentic: false };
  const indian = sameLanguage.find((v) => v.lang.toLowerCase().endsWith("-in") || /india/i.test(v.name));
  if (indian) return { voice: indian, authentic: true };
  return { voice: sameLanguage[0], authentic: false };
}

export async function speakQuestion(text, lang) {
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const voices = voicesReady ? cachedVoices : await loadVoices();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    const { voice } = pickVoice(voices, lang);
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  } catch { /* speech synthesis unavailable — the question is already on screen as text */ }
}

// Lets the UI be honest about accent limits — true only when this device
// has a genuine Indian-region voice for this language, not merely *a* voice
// in the same base language (which would still sound off-accent).
export async function hasVoiceFor(lang) {
  const voices = voicesReady ? cachedVoices : await loadVoices();
  return pickVoice(voices, lang).authentic;
}
