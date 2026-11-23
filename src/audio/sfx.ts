/**
 * Sound effects. Each sound in config/assets.ts plays public/sfx/<file> if it
 * exists, otherwise a simple generated placeholder beep (defined below).
 */
import { SOUNDS, type SoundId } from '../config/assets.ts';
import { loadSetting, saveSetting } from '../platform/storage.ts';

/** Placeholder beeps: wave shape, start and end pitch (Hz), length (s), loudness 0..1. */
const BEEPS: Record<SoundId, { wave: OscillatorType; from: number; to: number; dur: number; vol: number }> = {
  hit: { wave: 'square', from: 320, to: 90, dur: 0.09, vol: 0.35 },
  reset: { wave: 'triangle', from: 440, to: 880, dur: 0.15, vol: 0.4 },
  ui_click: { wave: 'square', from: 700, to: 700, dur: 0.04, vol: 0.2 },
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<SoundId, AudioBuffer>();
let volume = loadSetting('volume', 0.6);
let muted = loadSetting('muted', false);

/** Browsers only allow sound after the first click/key, so this starts lazily. */
function audio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
    applyVolume();
    loadFiles(ctx);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function loadFiles(ac: AudioContext): void {
  for (const id of Object.keys(SOUNDS) as SoundId[]) {
    fetch(`${import.meta.env.BASE_URL}sfx/${SOUNDS[id].file}`)
      .then((r) => (r.ok && !(r.headers.get('content-type') ?? '').includes('text/html') ? r.arrayBuffer() : Promise.reject()))
      .then((data) => ac.decodeAudioData(data))
      .then((buf) => buffers.set(id, buf))
      .catch(() => {}); // no custom sound: use the beep
  }
}

function applyVolume(): void {
  if (master) master.gain.value = muted ? 0 : volume;
}

export function playSound(id: SoundId): void {
  const ac = audio();
  const out = master!;
  const buf = buffers.get(id);
  if (buf) {
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(out);
    src.start();
    return;
  }
  const b = BEEPS[id];
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const t = ac.currentTime;
  osc.type = b.wave;
  osc.frequency.setValueAtTime(b.from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, b.to), t + b.dur);
  gain.gain.setValueAtTime(b.vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + b.dur);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + b.dur + 0.02);
}

export function getVolume(): number {
  return volume;
}
export function setVolume(v: number): void {
  volume = v;
  saveSetting('volume', v);
  applyVolume();
}
export function isMuted(): boolean {
  return muted;
}
export function setMuted(m: boolean): void {
  muted = m;
  saveSetting('muted', m);
  applyVolume();
}
