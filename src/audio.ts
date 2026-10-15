// Tiny Web Audio chiptune synth: sound effects, and the band. There is no music of its own:
// the song is what your instruments play, note for note, as the world fires them.
import { Song, STEPS, LOOP, chordAt, voicing } from './song';
import type { NoteEvent } from './world';

let ctx: AudioContext | null = null;
let master: GainNode;
/** The band goes through its own gain, so music can be switched off or ducked while sounds play on. */
let bandGain: GainNode;
let noiseBuf: AudioBuffer;

export function unlockAudio() {
  // iOS: play through the silent switch like a media app (Safari 16.4+).
  const session = (navigator as { audioSession?: { type: string } }).audioSession;
  if (session && session.type !== 'playback') session.type = 'playback';
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.2;
    master.connect(ctx.destination);
    bandGain = ctx.createGain();
    bandGain.gain.value = 1;
    bandGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

function tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number, out?: AudioNode) {
  if (!ctx) return;
  const t = at || ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(g).connect(out ?? master);
  osc.start(t);
  osc.stop(t + dur + 0.01);
}

function noise(dur: number, vol: number, cutoff: number, at = 0, type: BiquadFilterType = 'lowpass', sweepTo?: number, out?: AudioNode) {
  if (!ctx) return;
  const t = at || ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(cutoff, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(out ?? master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur);
}

function arp(notes: number[], step: number, vol = 0.25, type: OscillatorType = 'square') {
  if (!ctx) return;
  const t = ctx.currentTime;
  notes.forEach((n, i) => n && tone(midiHz(n), step, type, vol, t + i * step));
}

/** Skips a sound already played this many seconds ago, so a crowd bursting doesn't pile up. */
const last: Record<string, number> = {};
function every(key: string, gap: number) {
  if (!ctx) return false;
  if (ctx.currentTime - (last[key] ?? -1) < gap) return false;
  last[key] = ctx.currentTime;
  return true;
}

export const sfx = {
  move: () => tone(1400, 0.02, 'square', 0.12),
  select: () => tone(988, 0.04, 'square', 0.18),
  start: () => arp([57, 64, 69, 0, 72, 76, 81], 0.06, 0.2),
  pause: () => arp([84, 79], 0.06, 0.18),
  gem: () => every('gem', 0.045) && tone(1800 + Math.random() * 600, 0.03, 'square', 0.05),
  pop: () => every('pop', 0.05) && noise(0.06, 0.12, 1800, 0, 'bandpass'),
  hurt: () => {
    tone(220, 0.12, 'square', 0.18, 0, 90);
    noise(0.1, 0.2, 1200);
  },
  die: () => {
    if (!ctx) return;
    for (let k = 0; k < 6; k++) tone(660 - k * 80, 0.12, 'square', 0.15, ctx.currentTime + k * 0.09, 330 - k * 40);
  },
  pickup: () => arp([76, 81, 88], 0.05, 0.18),
  levelup: () => arp([69, 73, 76, 81, 85, 88], 0.045, 0.16),
  choose: () => arp([81, 88], 0.05, 0.18),
  warning: () => {
    if (!ctx) return;
    for (let k = 0; k < 3; k++) {
      tone(880, 0.14, 'square', 0.14, ctx.currentTime + k * 0.32);
      tone(587, 0.14, 'square', 0.12, ctx.currentTime + k * 0.32 + 0.16);
    }
  },
  slam: () => every('slam', 0.08) && (noise(0.3, 0.4, 800, 0, 'lowpass', 80), tone(90, 0.2, 'sine', 0.3, 0, 40)),
  throw: () => every('throw', 0.06) && tone(500, 0.12, 'triangle', 0.08, 0, 200),
  screech: () => every('screech', 0.1) && tone(2400, 0.35, 'sawtooth', 0.05, 0, 3200),
  bossDie: () => {
    noise(1.2, 0.5, 3000, 0, 'lowpass', 60);
    arp([57, 60, 64, 69, 72, 76, 81], 0.07, 0.18);
  },
  revive: () => arp([57, 0, 64, 0, 69, 72, 76, 81, 88], 0.06, 0.2),
  win: () => arp([69, 73, 76, 81, 0, 76, 81, 85, 88, 0, 88, 88, 93], 0.09, 0.22),
  over: () => arp([69, 64, 60, 57, 52, 45], 0.14, 0.2, 'triangle'),
};

// ---------- the band ----------

const waves: Record<string, PeriodicWave> = {};
/** A pulse wave of the given duty. */
function pulse(duty: number) {
  const key = String(duty);
  if (waves[key]) return waves[key];
  const re = new Float32Array(32), im = new Float32Array(32);
  for (let n = 1; n < 32; n++) {
    re[n] = Math.sin(2 * Math.PI * n * duty) / n;
    im[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / n;
  }
  return (waves[key] = ctx!.createPeriodicWave(re, im));
}

interface Opts {
  /** Dies away over this many seconds, whatever the note length. */
  pluck?: number;
  att?: number;
  /** Lowpass cutoff, closing to a quarter over the note. */
  lp?: number;
  det?: number;
  vib?: number;
}

/** A music note at MIDI m into the band's gain. */
function voice(m: number, dur: number, type: OscillatorType | number, vol: number, t: number, o: Opts = {}) {
  if (!ctx || !(dur > 0)) return;
  const osc = ctx.createOscillator();
  if (typeof type === 'number') osc.setPeriodicWave(pulse(type));
  else osc.type = type;
  osc.frequency.setValueAtTime(midiHz(m), t);
  if (o.det) osc.detune.setValueAtTime(o.det, t);
  const end = t + (o.pluck ?? dur);
  const g = ctx.createGain();
  if (o.pluck) {
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  } else {
    const att = Math.min(o.att ?? 0, dur * 0.5);
    g.gain.setValueAtTime(att ? 0 : vol, t);
    if (att) g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.setValueAtTime(vol, t + Math.max(att, dur * 0.7));
    g.gain.linearRampToValueAtTime(0, end);
  }
  if (o.vib && dur > 0.2) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(o.vib * 100, t + Math.min(0.3, dur * 0.6));
    lfo.connect(depth).connect(osc.detune);
    lfo.start(t);
    lfo.stop(end + 0.01);
  }
  if (o.lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 4;
    f.frequency.setValueAtTime(o.lp, t);
    f.frequency.exponentialRampToValueAtTime(o.lp / 4, end);
    osc.connect(f).connect(g);
  } else osc.connect(g);
  g.connect(bandGain);
  osc.start(t);
  osc.stop(end + 0.01);
}

const drum = {
  kick: (t: number, v: number) => {
    tone(150, 0.14, 'sine', 0.75 * v, t, 38, bandGain);
    noise(0.03, 0.25 * v, 600, t, 'lowpass', undefined, bandGain);
  },
  snare: (t: number, v: number) => {
    noise(0.14, 0.3 * v, 1800, t, 'bandpass', 900, bandGain);
    noise(0.06, 0.18 * v, 6000, t, 'highpass', undefined, bandGain);
    tone(200, 0.06, 'triangle', 0.2 * v, t, 140, bandGain);
  },
  hat: (t: number, v: number, open: boolean) => noise(open ? 0.16 : 0.035, 0.09 * v, 9000, t, 'highpass', undefined, bandGain),
  crash: (t: number, v: number) => noise(1.4, 0.22 * v, 4500, t, 'highpass', 2500, bandGain),
};

/** The k-th chord tone up from `base`, climbing octaves. */
function chordTone(song: Song, step: number, base: number, k: number) {
  const v = voicing(song, chordAt(song, step), base);
  return v[((k % v.length) + v.length) % v.length] + 12 * Math.floor(k / v.length);
}

/** The scale-wise third above a melody note: the next chord tone up, or a third if none fits. */
function harmony(song: Song, step: number, m: number) {
  const v = voicing(song, chordAt(song, step), m - 12).flatMap((x) => [x, x + 12, x + 24]);
  return v.find((x) => x > m + 2 && x <= m + 5) ?? m + 3;
}

const LATENCY = 0.08;
/** The audio time of frame 0 of the run, so notes land on an even grid however frames arrive. */
let anchor = -1;

function timeAt(frame: number) {
  const now = ctx!.currentTime;
  let t = anchor + frame / 60;
  if (anchor < 0 || t < now + 0.01 || t > now + 0.3) {
    anchor = now + LATENCY - frame / 60;
    t = anchor + frame / 60;
  }
  return t;
}

let musicOn = true;
let duck = 1;

export const music = {
  /** A new run: the clock starts afresh. */
  reset() {
    anchor = -1;
    this.setDuck(1);
  },
  /**
   * Plays what the band played on a frame. `stepSec` is a sixteenth in seconds;
   * `bar` is true on the first frame of a step that starts a bar, for the drone under it all.
   */
  play(song: Song, notes: NoteEvent[], frame: number, stepSec: number, bar: number | null) {
    if (!ctx || !musicOn) return;
    const t = timeAt(frame);
    if (bar !== null) {
      // A soft drone on each chord's root, so there is a key even with only drums.
      const r = voicing(song, chordAt(song, bar), 33)[0];
      voice(r, stepSec * STEPS * 0.95, 'triangle', 0.07, t, { att: stepSec * 2 });
    }
    for (const n of notes) {
      const v = n.vol;
      const s = n.step;
      switch (n.inst) {
        case 'kick':
          drum.kick(t, v);
          break;
        case 'snare':
          drum.snare(t, v);
          break;
        case 'hats':
          drum.hat(t, v, n.lv >= 3 && s % 8 === 6);
          break;
        case 'bass': {
          const root = voicing(song, chordAt(song, s), 33)[0];
          const walk = n.lv >= 5 ? [0, 12, 7, 12, 0, 10, 7, 12][(s % STEPS) >> 1] : s % 8 === 6 || s % 8 === 3 ? 12 : 0;
          voice(root + walk, stepSec * 1.7, 'sawtooth', 0.16 * v, t, { lp: n.lv >= 4 ? 1400 : 900 });
          voice(root + walk - 12, stepSec * 1.7, 'sine', 0.2 * v, t);
          break;
        }
        case 'lead': {
          const at = s % LOOP;
          const m = song.melody[at];
          if (!m) break;
          const d = Math.max(1, song.dur[at]) * stepSec * 0.92;
          const duty = n.lv >= 3 ? 0.25 : 0.5;
          voice(m, d, duty, 0.09 * v, t, { vib: d > 0.3 ? 0.25 : 0 });
          if (n.count >= 2) voice(harmony(song, s, m), d, 0.125, 0.05 * v, t);
          if (n.count >= 3) voice(m + 12, d, 'triangle', 0.06 * v, t);
          break;
        }
        case 'arp': {
          const pat = [0, 1, 2, 3, 2, 1, 2, 3];
          const k = pat[Math.floor((s % STEPS) / (n.lv >= 4 ? 1 : n.lv >= 2 ? 2 : 4)) % pat.length];
          voice(chordTone(song, s, 64, k), stepSec * 0.9, 'square', 0.035 * v, t, { pluck: 0.18 });
          break;
        }
        case 'pad': {
          if (s % STEPS === 0) {
            for (const m of voicing(song, chordAt(song, s), 55))
              voice(m, stepSec * STEPS * 0.98, 'sawtooth', 0.025 * v, t, { att: stepSec * 3, lp: 1800, det: 7 });
          } else voice(chordTone(song, s, 67, 0), stepSec, 'triangle', 0.03 * v, t, { pluck: 0.3 });
          break;
        }
        case 'crash':
          drum.crash(t, v);
          break;
      }
    }
  },
  /** THE SILENCE swallows the band as it comes. */
  setDuck(k: number) {
    if (!ctx || Math.abs(k - duck) < 0.01) return;
    duck = k;
    bandGain.gain.setTargetAtTime(k, ctx.currentTime, 0.3);
  },
  toggle() {
    musicOn = !musicOn;
    return musicOn;
  },
  set enabled(on: boolean) {
    musicOn = on;
  },
  get enabled() {
    return musicOn;
  },
};
