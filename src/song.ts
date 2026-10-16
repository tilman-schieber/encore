// The song of a run, made up from its seed: a key, eight bars of chords and a melody over them.
// It is plain data: the game reads it to know when the LEAD and the BASS fire, the synth to play it.
import { makeRng, Rng } from 'arcade-kit/rng';

/** Sixteenths in a bar, bars in the loop. */
export const STEPS = 16;
export const BARS = 8;
export const LOOP = STEPS * BARS;

export interface Chord {
  /** Root, in semitones above the key's tonic. */
  root: number;
  /** Chord tones above the root. */
  tones: number[];
  name: string;
}

export interface Song {
  /** MIDI note of the tonic, in the bass octave. */
  tonic: number;
  /** One chord a bar. */
  chords: Chord[];
  /** MIDI note starting at each sixteenth of the loop, 0 for none; dur its length in sixteenths. */
  melody: number[];
  dur: number[];
  /** Name of the key, for the title card: 'A MINOR'. */
  key: string;
}

const MINOR = [0, 3, 7];
const MAJOR = [0, 4, 7];
/** Degrees of the natural minor scale, as [semitones, triad]. */
const DEGREE: Record<string, [number, number[]]> = {
  i: [0, MINOR],
  iv: [5, MINOR],
  v: [7, MINOR],
  V: [7, MAJOR],
  III: [3, MAJOR],
  VI: [8, MAJOR],
  VII: [10, MAJOR],
};
/** Four-bar progressions; a song takes two of them. */
const PROGS = [
  'i VI III VII',
  'i iv VII III',
  'i VI iv V',
  'i VII VI VII',
  'VI VII i i',
  'i III VII iv',
  'i v VI V',
  'iv VI VII i',
];
const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
/** Minor pentatonic plus the second and sixth for passing notes, two octaves. */
const SCALE = [0, 2, 3, 5, 7, 8, 10];

function chordsOf(prog: string, tonicPc: number): Chord[] {
  return prog.split(' ').map((d) => {
    const [root, tones] = DEGREE[d];
    const pc = (tonicPc + root) % 12;
    return { root, tones, name: NOTE_NAMES[pc] + (tones === MINOR ? 'm' : '') };
  });
}

/** A scale note near `target` that belongs to the chord, for strong beats. */
function chordTone(c: Chord, tonic: number, near: number) {
  let best = near, dist = 99;
  for (let o = -24; o <= 24; o += 12)
    for (const t of c.tones) {
      const m = tonic + c.root + t + o;
      if (Math.abs(m - near) < dist) (best = m), (dist = Math.abs(m - near));
    }
  return best;
}

/** Two bars of melody as [start step, note, length] from a random walk on the scale. */
function phrase(rng: Rng, chords: Chord[], tonic: number, bar0: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  // Rhythms of a bar, in sixteenths: a few shapes that sit well on a beat.
  const RHYTHMS = [
    [4, 4, 4, 4],
    [2, 2, 4, 4, 4],
    [4, 2, 2, 4, 4],
    [6, 2, 4, 4],
    [3, 3, 2, 4, 4],
    [4, 4, 2, 2, 4],
    [2, 2, 2, 2, 8],
    [8, 4, 4],
  ];
  let deg = 7 + Math.floor(rng() * 4);
  for (let b = 0; b < 2; b++) {
    const r = RHYTHMS[Math.floor(rng() * RHYTHMS.length)];
    let s = 0;
    for (const len of r) {
      deg = Math.max(3, Math.min(13, deg + [-2, -1, -1, 0, 1, 1, 2, 3, -3][Math.floor(rng() * 9)]));
      let note = tonic + 24 + SCALE[deg % 7] + 12 * Math.floor(deg / 7);
      // On the beat, lean on a chord tone.
      if (s % 4 === 0) note = chordTone(chords[(bar0 + b) % BARS], tonic + 24, note);
      // Now and then a rest instead, but never on the downbeat.
      if (s > 0 && rng() < 0.12) {
        s += len;
        continue;
      }
      out.push([(bar0 + b) * STEPS + s, note, len]);
      s += len;
    }
  }
  return out;
}

export function makeSong(seed: number): Song {
  const rng = makeRng(seed ^ 0x5eed);
  const tonicPc = Math.floor(rng() * 12);
  // The bass tonic between E1 and D#2.
  const tonic = 28 + ((tonicPc - 4 + 12) % 12) + 12;
  const a = Math.floor(rng() * PROGS.length);
  let b = Math.floor(rng() * (PROGS.length - 1));
  if (b >= a) b++;
  const chords = [...chordsOf(PROGS[a], tonicPc), ...chordsOf(PROGS[b], tonicPc)];
  const melody: number[] = Array(LOOP).fill(0);
  const dur: number[] = Array(LOOP).fill(0);
  // A A' B A'': the first phrase comes back, so the tune sticks.
  const A = phrase(rng, chords, tonic, 0);
  const B = phrase(rng, chords, tonic, 4);
  const put = (notes: [number, number, number][], shift: number, fix: boolean) => {
    for (const [s, n, l] of notes) {
      const at = s + shift;
      const bar = Math.floor(at / STEPS);
      // Moved under other chords, strong notes are bent to fit them.
      const m = fix && at % 4 === 0 ? chordTone(chords[bar], tonic + 24, n) : n;
      melody[at] = m;
      dur[at] = l;
    }
  };
  put(A, 0, false);
  put(A, 2 * STEPS, true);
  put(B, 0, false);
  put(A, 6 * STEPS, true);
  // The loop ends on the tonic.
  const end = 7 * STEPS + 8;
  for (let s = end; s < LOOP; s++) (melody[s] = 0), (dur[s] = 0);
  melody[end] = chordTone(chords[7], tonic + 24, tonic + 36);
  dur[end] = 8;
  return { tonic, chords, melody, dur, key: `${NOTE_NAMES[tonicPc]} MINOR` };
}

/** The chord under a step (any step count; the loop wraps). */
export const chordAt = (song: Song, step: number) => song.chords[Math.floor(step / STEPS) % BARS];

/** The chord's notes stacked from its root at or above `base`. */
export function voicing(song: Song, c: Chord, base: number) {
  const root = song.tonic + c.root;
  const r = base + ((((root - base) % 12) + 12) % 12);
  return c.tones.map((t) => r + t);
}
