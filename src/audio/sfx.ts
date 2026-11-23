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
  structure_destroyed: { wave: 'sawtooth', from: 200, to: 40, dur: 0.3, vol: 0.35 },
  fizzle: { wave: 'sawtooth', from: 150, to: 100, dur: 0.15, vol: 0.25 },
  reflect: { wave: 'triangle', from: 900, to: 1400, dur: 0.08, vol: 0.35 },
  staff_fire: { wave: 'triangle', from: 600, to: 300, dur: 0.1, vol: 0.3 },
  shield_up: { wave: 'sine', from: 300, to: 900, dur: 0.2, vol: 0.4 },
  tower_build: { wave: 'square', from: 120, to: 240, dur: 0.25, vol: 0.25 },
  tower_fire: { wave: 'triangle', from: 500, to: 350, dur: 0.07, vol: 0.2 },
  switch: { wave: 'sine', from: 1000, to: 200, dur: 0.4, vol: 0.4 },
  teleport_start: { wave: 'sine', from: 400, to: 1200, dur: 0.3, vol: 0.3 },
  teleport: { wave: 'sine', from: 1200, to: 500, dur: 0.15, vol: 0.35 },
  bounce: { wave: 'square', from: 1500, to: 900, dur: 0.05, vol: 0.2 },
  gun_fire: { wave: 'sawtooth', from: 900, to: 120, dur: 0.08, vol: 0.3 },
  lasso_throw: { wave: 'triangle', from: 300, to: 600, dur: 0.15, vol: 0.25 },
  lasso_hit: { wave: 'square', from: 250, to: 500, dur: 0.12, vol: 0.3 },
  bramble_spawn: { wave: 'sawtooth', from: 180, to: 260, dur: 0.15, vol: 0.2 },
  bramble_hit: { wave: 'sawtooth', from: 400, to: 60, dur: 0.25, vol: 0.35 },
  pierce_charge: { wave: 'sine', from: 200, to: 800, dur: 0.6, vol: 0.25 },
  pierce_fire: { wave: 'sawtooth', from: 1400, to: 80, dur: 0.25, vol: 0.45 },
  roll: { wave: 'triangle', from: 220, to: 160, dur: 0.15, vol: 0.25 },
  dummy_fire: { wave: 'square', from: 500, to: 300, dur: 0.06, vol: 0.15 },
};

/** Play a sound by name if it exists (the simulation reports sounds by name). */
export function playSoundByName(name: string): void {
  if (name in SOUNDS) playSound(name as SoundId);
}

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
