let keepAlive: HTMLAudioElement | null = null;

/** Keep a silent loop playing so the expiry chime is allowed in a background tab. */
export function armTimerChime() {
  if (keepAlive && !keepAlive.paused) return;
  try {
    if (!keepAlive) {
      keepAlive = new Audio(silentUri());
      keepAlive.loop = true;
      keepAlive.volume = 0.001;
    }
    void keepAlive.play().catch(() => {
      /* Autoplay may be blocked until a later gesture. */
    });
  } catch {
    /* Ignore; the chime still attempts HTMLAudio / oscillator. */
  }
}

export function disarmTimerChime() {
  if (!keepAlive) return;
  keepAlive.pause();
  keepAlive.src = '';
  keepAlive = null;
}

/** Ocarina-style phrase as WAV so it can play while the tab is in the background. */
export function playTimerChime() {
  try {
    const audio = new Audio(chimeUri());
    audio.volume = 0.72;
    void audio.play().catch(() => {
      void playOscillatorFallback();
    });
  } catch {
    void playOscillatorFallback();
  }
}

type PhraseNote = {
  freq: number;
  start: number;
  dur: number;
  vibrato?: boolean;
};

/** Original folk phrase in ocarina register (not Nintendo audio). */
const PHRASE: PhraseNote[] = [
  { freq: 329.63, start: 0.0, dur: 0.32 },
  { freq: 392.0, start: 0.34, dur: 0.26 },
  { freq: 493.88, start: 0.62, dur: 0.22 },
  { freq: 392.0, start: 0.86, dur: 0.24 },
  { freq: 659.25, start: 1.12, dur: 0.7, vibrato: true },
];

const PHRASE_DURATION = 1.92;

async function playOscillatorFallback() {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  if (ctx.state === 'suspended') await ctx.resume();
  const now = ctx.currentTime;
  for (const note of PHRASE) {
    ocarinaBeep(ctx, note.freq, now + note.start, note.dur, !!note.vibrato);
  }
  window.setTimeout(() => void ctx.close(), (PHRASE_DURATION + 0.3) * 1000);
}

function ocarinaBeep(
  ctx: AudioContext,
  freq: number,
  start: number,
  dur: number,
  vibrato: boolean,
) {
  const mix = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq * 4.2, start);
  filter.Q.value = 1.1;

  const fundamental = ctx.createOscillator();
  fundamental.type = 'sine';
  fundamental.frequency.setValueAtTime(freq * 0.985, start);
  fundamental.frequency.exponentialRampToValueAtTime(freq, start + 0.03);
  if (vibrato) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 5.2;
    lfoGain.gain.value = 3.2;
    lfo.connect(lfoGain);
    lfoGain.connect(fundamental.frequency);
    lfo.start(start + 0.08);
    lfo.stop(start + dur + 0.04);
  }

  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(freq, start);

  const fundGain = ctx.createGain();
  fundGain.gain.value = 0.38;
  const bodyGain = ctx.createGain();
  bodyGain.gain.value = 0.08;

  fundamental.connect(fundGain);
  body.connect(bodyGain);
  fundGain.connect(mix);
  bodyGain.connect(mix);
  mix.connect(filter);
  filter.connect(ctx.destination);

  mix.gain.setValueAtTime(0.0001, start);
  mix.gain.exponentialRampToValueAtTime(0.55, start + 0.028);
  mix.gain.setValueAtTime(0.5, start + dur - 0.08);
  mix.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  fundamental.start(start);
  body.start(start);
  fundamental.stop(start + dur + 0.03);
  body.stop(start + dur + 0.03);
}

let cachedChimeUri = '';
let cachedSilentUri = '';

function chimeUri() {
  if (cachedChimeUri) return cachedChimeUri;
  cachedChimeUri = wavUri((pcm, sampleRate) => {
    for (const note of PHRASE) {
      addOcarinaNote(
        pcm,
        sampleRate,
        note.freq,
        note.start,
        note.dur,
        !!note.vibrato,
      );
    }
  }, PHRASE_DURATION);
  return cachedChimeUri;
}

function silentUri() {
  if (cachedSilentUri) return cachedSilentUri;
  cachedSilentUri = wavUri(() => undefined, 0.25);
  return cachedSilentUri;
}

function wavUri(
  fill: (pcm: Int16Array, sampleRate: number) => void,
  durationSec: number,
) {
  const sampleRate = 22050;
  const total = Math.max(1, Math.floor(sampleRate * durationSec));
  const pcm = new Int16Array(total);
  fill(pcm, sampleRate);
  const bytes = pcm.byteLength;
  const buffer = new ArrayBuffer(44 + bytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + bytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, bytes, true);
  new Uint8Array(buffer, 44).set(
    new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength),
  );
  return `data:audio/wav;base64,${bytesToBase64(new Uint8Array(buffer))}`;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function addOcarinaNote(
  pcm: Int16Array,
  sampleRate: number,
  freq: number,
  startSec: number,
  durSec: number,
  vibrato: boolean,
) {
  const start = Math.floor(startSec * sampleRate);
  const len = Math.floor(durSec * sampleRate);
  const attack = Math.max(1, Math.floor(0.03 * sampleRate));
  const release = Math.max(1, Math.floor(0.1 * sampleRate));
  let phase = 0;
  let noise = 1;
  const nrand = () => {
    noise = (noise * 16807) % 2147483647;
    return (noise / 2147483647) * 2 - 1;
  };

  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx >= pcm.length) return;
    const t = i / sampleRate;
    const glide = i < attack ? 1 - 0.018 * (1 - i / attack) : 1;
    const vibDepth = vibrato
      ? 0.007 * Math.min(1, Math.max(0, (t - 0.08) / 0.12))
      : 0.0018;
    const vib = 1 + vibDepth * Math.sin(2 * Math.PI * 5.2 * t);
    const instFreq = freq * glide * vib;
    phase += (2 * Math.PI * instFreq) / sampleRate;

    // Helmholtz-like ocarina: strong fundamental, weak overtones.
    const s =
      Math.sin(phase) +
      0.14 * Math.sin(2 * phase) +
      0.055 * Math.sin(3 * phase) +
      0.02 * Math.sin(4 * phase);
    const chiff = i < attack ? 0.14 * (1 - i / attack) : 0.02;
    const breath = nrand() * chiff;

    let env = 1;
    if (i < attack) env = Math.sin((Math.PI / 2) * (i / attack));
    else if (i > len - release) {
      env = Math.sin((Math.PI / 2) * ((len - i) / release));
    }

    const sample = (s * 0.46 + breath) * env * 0.7;
    pcm[idx] = clamp16(pcm[idx] + Math.round(sample * 32767));
  }
}

function clamp16(n: number) {
  return Math.max(-32767, Math.min(32767, n));
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
