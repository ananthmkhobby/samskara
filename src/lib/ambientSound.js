// Procedural ambient soundscapes for Anubhava Chitrashale — synthesized live
// via the Web Audio API rather than sourced audio files (no external assets
// to license or host). Four beds: "birds" (the room's idle default — sparse,
// irregular chirps, never a loop), "rain"/"dusk"/"festival" (the three
// ambientShift moods). One shared AudioContext + master gain node, so muting
// or switching beds is a single ramp rather than juggling per-bed volume.
const MASTER_VOLUME = 0.14; // quiet — "distant", never competing with a tap-revealed voice or memory
const FADE_S = 0.6;

function makeBirds(ctx, out) {
  let timer = null;
  function chirp() {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const freq = 1800 + Math.random() * 1400;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * (0.85 + Math.random() * 0.3), t + 0.09);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.16);
    timer = setTimeout(chirp, 2200 + Math.random() * 5200);
  }
  timer = setTimeout(chirp, 800 + Math.random() * 1500);
  return { stop() { clearTimeout(timer); } };
}

function makeNoiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function makeRain(ctx, out) {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, 3);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1200;
  filter.Q.value = 0.6;
  const gain = ctx.createGain();
  gain.gain.value = 0.5;
  src.connect(filter).connect(gain).connect(out);
  src.start();
  return { stop() { try { src.stop(); } catch { /* already stopped */ } } };
}

function makeDusk(ctx, out) {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  osc1.type = "sine"; osc1.frequency.value = 110;
  osc2.type = "sine"; osc2.frequency.value = 165;
  gain.gain.value = 0.3;
  // A slow LFO breathes the volume so the drone doesn't sit dead-flat.
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 0.08;
  lfo.connect(lfoGain).connect(gain.gain);
  osc1.connect(gain); osc2.connect(gain); gain.connect(out);
  osc1.start(); osc2.start(); lfo.start();
  return { stop() { try { osc1.stop(); osc2.stop(); lfo.stop(); } catch { /* already stopped */ } } };
}

function makeFestival(ctx, out) {
  let timer = null;
  function pluck() {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880 + Math.random() * 220, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 1);
    timer = setTimeout(pluck, 1800 + Math.random() * 3000);
  }
  timer = setTimeout(pluck, 400);
  return { stop() { clearTimeout(timer); } };
}

const BED_FACTORIES = { birds: makeBirds, rain: makeRain, dusk: makeDusk, festival: makeFestival };

// setMuted should be called with the restored preference before the first
// setBed(), so the very first bed starts at the right volume instead of
// audibly starting loud and then dropping.
export function createAmbientPlayer() {
  let ctx = null;
  let master = null;
  let current = null;
  let currentKind = null;
  let muted = false;

  function ensureContext() {
    if (ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    ctx = new AudioContextClass();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(ctx.destination);
  }

  function setBed(kind) {
    ensureContext();
    if (!ctx || kind === currentKind) return;
    const factory = BED_FACTORIES[kind];
    if (!factory) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0.0001, t + FADE_S);
    const outgoing = current;
    setTimeout(() => {
      outgoing?.stop();
      if (!ctx) return; // stop() may have torn everything down while this was pending
      current = factory(ctx, master);
      currentKind = kind;
      const t2 = ctx.currentTime;
      master.gain.cancelScheduledValues(t2);
      master.gain.setValueAtTime(0.0001, t2);
      master.gain.linearRampToValueAtTime(muted ? 0.0001 : MASTER_VOLUME, t2 + FADE_S);
    }, FADE_S * 1000);
  }

  function setMuted(next) {
    muted = next;
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(muted ? 0.0001 : MASTER_VOLUME, t + 0.25);
  }

  function stop() {
    current?.stop();
    current = null;
    currentKind = null;
    const closing = ctx;
    ctx = null;
    master = null;
    closing?.close().catch(() => {});
  }

  return { setBed, setMuted, stop };
}
