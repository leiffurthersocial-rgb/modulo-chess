/**
 * Tiny synthesized sound kit (WebAudio): no audio assets, nothing to license,
 * and it works offline. The AudioContext is created lazily on first use, which
 * always happens inside a user gesture or right after one.
 */
export type SoundKind = "move" | "capture" | "check" | "castle" | "promote" | "end" | "illegal" | "start";

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ac.sampleRate) return noise;
  const len = Math.floor(ac.sampleRate * 0.25);
  noise = ac.createBuffer(1, len, ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  return noise;
}

/** A short filtered noise burst plus a low body: sounds like a piece set on wood. */
function knock(
  ac: AudioContext,
  out: AudioNode,
  t: number,
  { freq = 1900, body = 180, gain = 1, decay = 0.06 } = {},
) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 1.4;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.9 * gain, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
  src.stop(t + decay + 0.02);

  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(body * 1.6, t);
  osc.frequency.exponentialRampToValueAtTime(body, t + 0.05);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.5 * gain, t + 0.004);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  osc.connect(og).connect(out);
  osc.start(t);
  osc.stop(t + 0.12);
}

function tone(ac: AudioContext, out: AudioNode, t: number, freq: number, dur: number, gain = 0.25) {
  const osc = ac.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function playSound(kind: SoundKind, volume = 0.6): void {
  const ac = audio();
  if (!ac || volume <= 0) return;
  const master = ac.createGain();
  master.gain.value = Math.min(1, volume) * 0.7;
  master.connect(ac.destination);
  const t = ac.currentTime + 0.005;
  switch (kind) {
    case "move":
      knock(ac, master, t);
      break;
    case "capture":
      knock(ac, master, t, { freq: 2600, body: 150, gain: 1.15, decay: 0.08 });
      knock(ac, master, t + 0.035, { freq: 1500, body: 120, gain: 0.6, decay: 0.07 });
      break;
    case "castle":
      knock(ac, master, t);
      knock(ac, master, t + 0.09, { gain: 0.8 });
      break;
    case "check":
      knock(ac, master, t, { gain: 0.9 });
      tone(ac, master, t + 0.02, 880, 0.22, 0.12);
      tone(ac, master, t + 0.1, 1320, 0.28, 0.09);
      break;
    case "promote":
      knock(ac, master, t);
      tone(ac, master, t + 0.03, 660, 0.18, 0.1);
      tone(ac, master, t + 0.1, 990, 0.24, 0.1);
      break;
    case "end":
      [523.25, 659.25, 783.99].forEach((f, i) => tone(ac, master, t + i * 0.08, f, 0.6, 0.12));
      break;
    case "start":
      tone(ac, master, t, 587.33, 0.18, 0.08);
      tone(ac, master, t + 0.09, 880, 0.3, 0.08);
      break;
    case "illegal":
      tone(ac, master, t, 220, 0.12, 0.08);
      break;
  }
}

/** Picks the sound for a SAN move. */
export function soundForSan(san: string, gameOver = false): SoundKind {
  if (gameOver || san.includes("#")) return "end";
  if (san.includes("+")) return "check";
  if (san.includes("=")) return "promote";
  if (san.startsWith("O-O")) return "castle";
  if (san.includes("x")) return "capture";
  return "move";
}
