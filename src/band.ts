// The band: every weapon is an instrument on a 16-step sequencer, and gear changes how they play.
// Here is what each plays and hits at each level; world.ts makes it happen, audio.ts makes it heard.
import { Song, STEPS, LOOP } from './song';

export type InstId = 'kick' | 'snare' | 'hats' | 'bass' | 'lead' | 'arp' | 'pad' | 'crash';
export type GearId = 'amp' | 'tempo' | 'sneakers' | 'fans' | 'reverb' | 'echo' | 'heart' | 'encore';

export const MAX_LEVEL = 5;
/** Instruments and gear you can hold at once. */
export const MAX_INSTRUMENTS = 6;
export const MAX_GEAR = 6;

export interface InstDef {
  id: InstId;
  name: string;
  color: string;
  /** One line a level: what you get on reaching it (the first is the instrument itself). */
  levels: string[];
}

export const INSTRUMENTS: InstDef[] = [
  {
    id: 'kick',
    name: 'KICK',
    color: '#f83800',
    levels: ['A SHOCKWAVE ALL ROUND YOU', 'AN EXTRA BEAT', 'WIDER AND HARDER', 'A DOUBLE KICK', 'EVEN MORE KICKS'],
  },
  {
    id: 'snare',
    name: 'SNARE',
    color: '#fcfcfc',
    levels: ['SHOTS AT THE TWO NEAREST', 'A GHOST NOTE', 'THREE TARGETS AT ONCE', 'SHOTS GO FURTHER THROUGH', 'A ROLL TO END THE BAR'],
  },
  {
    id: 'hats',
    name: 'HATS',
    color: '#f8d838',
    levels: ['A STREAM OF NEEDLES', 'A SPREAD OF THREE', 'SIXTEENTHS', 'HARDER', 'A SPREAD OF FIVE'],
  },
  {
    id: 'bass',
    name: 'BASS',
    color: '#a858f8',
    levels: ['A SLOW WAVE THAT GOES THROUGH ALL', 'SYNCOPATED', 'HEAVIER', 'A BUSIER LINE', 'A WALKING LINE'],
  },
  {
    id: 'lead',
    name: 'LEAD',
    color: '#3cbcfc',
    levels: ['HOMING NOTES ON THE TUNE', 'BRIGHTER', 'A HARMONY A THIRD UP', 'NOTES GO THROUGH', 'AN OCTAVE ON TOP'],
  },
  {
    id: 'arp',
    name: 'ARP',
    color: '#58d854',
    levels: ['NOTES CIRCLE YOU', 'A THIRD NOTE', 'A FOURTH NOTE', 'SIXTEENTHS, A FIFTH', 'A SIXTH, A WIDER RING'],
  },
  {
    id: 'pad',
    name: 'PAD',
    color: '#f878f8',
    levels: ['A CHORD THAT HURTS AND SLOWS', 'ON EVERY BEAT', 'A BIGGER CHORD', 'HARDER', 'A HUGE CHORD'],
  },
  {
    id: 'crash',
    name: 'CRASH',
    color: '#fca044',
    levels: ['HITS ALL ON SCREEN, EVERY 4 BARS', 'HARDER', 'EVERY 2 BARS', 'HARDER', 'HARDER STILL'],
  },
];

export interface GearDef {
  id: GearId;
  name: string;
  max: number;
  levels: string[];
}

export const GEAR: GearDef[] = [
  { id: 'amp', name: 'AMP', max: 5, levels: ['+15% DAMAGE'] },
  { id: 'tempo', name: 'TEMPO', max: 2, levels: ['THE SONG GOES FASTER: EVERYTHING FIRES MORE OFTEN'] },
  { id: 'sneakers', name: 'SNEAKERS', max: 5, levels: ['+10% SPEED'] },
  { id: 'fans', name: 'FANS', max: 5, levels: ['THEY BRING YOU NOTES FROM FURTHER'] },
  { id: 'reverb', name: 'REVERB', max: 5, levels: ['+12% AREA'] },
  { id: 'echo', name: 'ECHO', max: 3, levels: ['EVERY SHOT ECHOES A BEAT LATER'] },
  { id: 'heart', name: 'HEART', max: 5, levels: ['+20 MAX HEALTH, AND HEALS'] },
  { id: 'encore', name: 'ENCORE', max: 2, levels: ['ONE MORE SONG: UP AGAIN WHEN YOU FALL'] },
];

export const INST = Object.fromEntries(INSTRUMENTS.map((d) => [d.id, d])) as Record<InstId, InstDef>;
export const GEARS = Object.fromEntries(GEAR.map((d) => [d.id, d])) as Record<GearId, GearDef>;

/** The steps of a bar each drum plays at each level. */
const DRUMS: Record<'kick' | 'snare' | 'hats' | 'bass' | 'pad', number[][]> = {
  kick: [[0, 4, 8, 12], [0, 4, 8, 10, 12], [0, 4, 8, 10, 12], [0, 3, 4, 8, 11, 12], [0, 3, 4, 6, 8, 11, 12, 14]],
  snare: [[4, 12], [4, 12, 15], [4, 12, 15], [4, 7, 12, 15], [4, 7, 12, 13, 14, 15]],
  hats: [[0, 2, 4, 6, 8, 10, 12, 14], [0, 2, 4, 6, 8, 10, 12, 14], [...Array(16).keys()], [...Array(16).keys()], [...Array(16).keys()]],
  bass: [[0, 8], [0, 6, 8, 14], [0, 6, 8, 14], [0, 3, 6, 8, 11, 14], [0, 2, 4, 6, 8, 10, 12, 14]],
  pad: [[0, 8], [0, 4, 8, 12], [0, 4, 8, 12], [0, 4, 8, 12], [0, 4, 8, 12]],
};
const ARP_EVERY = [2, 2, 2, 1, 1];
const CRASH_EVERY = [4, 4, 2, 2, 2];

/** The parts that play a fixed pattern and can be linked; the LEAD follows the tune and the CRASH the bars. */
export const EDITABLE: InstId[] = ['kick', 'snare', 'hats', 'bass', 'pad', 'arp'];
export const editable = (id: InstId) => EDITABLE.includes(id);

/** The steps of a bar an editable part plays at a level, before you move any. */
export function basePattern(id: InstId, lv: number): number[] {
  if (id === 'arp') return [...Array(STEPS).keys()].filter((s) => s % ARP_EVERY[lv - 1] === 0);
  return DRUMS[id as keyof typeof DRUMS][lv - 1];
}

/** Two parts linked by a LINK card: on every step both play, each lends the other its trait. */
export type Trait = 'punch' | 'stun' | 'double' | 'weight' | 'warmth' | 'wide';
/** `does`: what a part that borrows the trait does on a linked step. */
export const TRAITS: Partial<Record<InstId, { trait: Trait; name: string; text: string; does: string }>> = {
  kick: { trait: 'punch', name: 'PUNCH', text: 'HALF AGAIN THE DAMAGE', does: 'HITS HARDER' },
  snare: { trait: 'stun', name: 'STUN', text: 'HITS STOP THE HUSH SHORT', does: 'STUNS' },
  hats: { trait: 'double', name: 'DOUBLE', text: 'PLAYS AGAIN A STEP LATER', does: 'PLAYS TWICE' },
  bass: { trait: 'weight', name: 'WEIGHT', text: 'HITS SLOW THE HUSH DOWN', does: 'SLOWS' },
  pad: { trait: 'warmth', name: 'WARMTH', text: 'PULLS NOTES IN, HEALS A LITTLE', does: 'HEALS' },
  arp: { trait: 'wide', name: 'WIDE', text: 'HALF AGAIN THE SIZE', does: 'GOES WIDER' },
};

/** What linking `a` and `b` does, e.g. KICK STUNS, SNARE HITS HARDER. */
export const linkText = (a: InstId, b: InstId) => `${INST[b].name} ${TRAITS[a]!.does}, ${INST[a].name} ${TRAITS[b]!.does}`;

/**
 * How many shots an instrument at a level fires on a step of the song (0: it is silent).
 * `step` counts sixteenths since the start of the run.
 */
export function shots(id: InstId, lv: number, step: number, song: Song): number {
  const s = step % STEPS;
  const i = lv - 1;
  switch (id) {
    case 'kick':
    case 'snare':
    case 'hats':
    case 'bass':
    case 'pad':
      return DRUMS[id][i].includes(s) ? 1 : 0;
    case 'lead': {
      const at = step % LOOP;
      if (!song.melody[at]) return 0;
      return lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
    }
    case 'arp':
      return s % ARP_EVERY[i] === 0 ? 1 : 0;
    case 'crash':
      return s === 0 && Math.floor(step / STEPS) % CRASH_EVERY[i] === 0 ? 1 : 0;
  }
}

/** A step played softly: a snare ghost note, a roll, an off-beat hat. */
export function accent(id: InstId, step: number) {
  const s = step % STEPS;
  if (id === 'snare') return s === 4 || s === 12 ? 1 : 0.5;
  if (id === 'hats') return s % 2 === 0 ? 1 : 0.6;
  if (id === 'kick') return s % 4 === 0 ? 1 : 0.7;
  return 1;
}

export interface Stats {
  dmg: number;
  /** Radius or size in pixels, before REVERB. */
  area: number;
  /** Projectiles, orbiters or targets. */
  count: number;
  /** Enemies a shot goes through before it is spent (Infinity: all). */
  pierce: number;
  speed: number;
}

export function stats(id: InstId, lv: number): Stats {
  const i = lv - 1;
  switch (id) {
    case 'kick':
      return { dmg: [16, 18, 22, 25, 28][i], area: [38, 40, 44, 46, 50][i], count: 1, pierce: Infinity, speed: 0 };
    case 'snare':
      return { dmg: [20, 22, 24, 26, 28][i], area: 3, count: lv >= 3 ? 3 : 2, pierce: lv >= 4 ? 4 : 2, speed: 4.2 };
    case 'hats':
      return { dmg: [11, 11, 12, 15, 17][i], area: 2, count: lv >= 5 ? 5 : lv >= 2 ? 3 : 1, pierce: 1, speed: 5 };
    case 'bass':
      return { dmg: [7, 8, 9, 10, 12][i], area: [12, 12, 15, 15, 16][i], count: 1, pierce: Infinity, speed: 1.5 };
    case 'lead':
      return { dmg: [30, 38, 38, 40, 42][i], area: 3, count: 1, pierce: lv >= 4 ? 2 : 1, speed: 2.4 };
    case 'arp':
      return { dmg: [14, 15, 16, 17, 19][i], area: lv >= 5 ? 40 : 34, count: lv + 1, pierce: Infinity, speed: 0 };
    case 'pad':
      return { dmg: [9, 11, 14, 18, 22][i], area: [32, 34, 42, 44, 54][i], count: 1, pierce: Infinity, speed: 0 };
    case 'crash':
      return { dmg: [14, 20, 20, 26, 30][i], area: 0, count: 1, pierce: Infinity, speed: 0 };
  }
}

/** Frames a sixteenth lasts at each TEMPO level: 112, 128 and 150 beats a minute. */
export const STEP_FRAMES = [8, 7, 6];
export const bpm = (tempoLv: number) => Math.round(3600 / (STEP_FRAMES[tempoLv] * 4));
