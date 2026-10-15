// One run: the busker, the band on its sequencer, the Hush closing in, and everything flying between them.
// Nothing here makes a sound or draws a pixel: the world lists the notes it played for audio.ts,
// and render.ts draws what it holds.
import { Rng } from './rng';
import { Song, STEPS, LOOP } from './song';
import {
  InstId, GearId, MAX_LEVEL, MAX_INSTRUMENTS, MAX_GEAR, INSTRUMENTS, GEAR, GEARS, STEP_FRAMES, shots, accent, stats,
} from './band';

export const W = 256;
export const H = 224;

export type EnemyKind = 'shh' | 'static' | 'plug' | 'heckler' | 'feedback' | 'neighbor' | 'silence';

interface KindDef {
  hp: number;
  speed: number;
  dmg: number;
  r: number;
  xp: number;
  pts: number;
  boss?: boolean;
}

export const KINDS: Record<EnemyKind, KindDef> = {
  shh: { hp: 12, speed: 0.42, dmg: 8, r: 5, xp: 1, pts: 10 },
  static: { hp: 7, speed: 0.82, dmg: 5, r: 4, xp: 1, pts: 10 },
  plug: { hp: 60, speed: 0.3, dmg: 14, r: 7, xp: 5, pts: 40 },
  heckler: { hp: 20, speed: 0.5, dmg: 8, r: 5, xp: 3, pts: 30 },
  feedback: { hp: 26, speed: 0.42, dmg: 15, r: 5, xp: 3, pts: 30 },
  neighbor: { hp: 1100, speed: 0.4, dmg: 20, r: 11, xp: 0, pts: 2000, boss: true },
  silence: { hp: 12000, speed: 0.3, dmg: 30, r: 18, xp: 0, pts: 20000, boss: true },
};

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  r: number;
  speed: number;
  dmg: number;
  /** Frames of white after a hit. */
  flash: number;
  /** A behaviour clock and state: hecklers throw, feedback screeches then dashes, bosses attack. */
  t: number;
  mode: 0 | 1 | 2;
  dx: number;
  dy: number;
  /** Knocked back this frame. */
  kx: number;
  ky: number;
  /** Inside the PAD's chord: slowed. */
  slow: boolean;
  /** Facing left. */
  flip: boolean;
}

export type ShotKind = 'bolt' | 'needle' | 'wave' | 'note';

export interface Shot {
  inst: InstId;
  kind: ShotKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  r: number;
  life: number;
  pierce: number;
  /** Enemies already hit, for shots that go through. */
  hit: Set<number>;
  /** Homing target id, or -1. */
  target: number;
  /** An echo: drawn fainter. */
  echo: boolean;
}

export type BulletKind = 'tomato' | 'shock' | 'rest';

export interface Bullet {
  kind: BulletKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
}

export interface Gem {
  x: number;
  y: number;
  value: number;
  /** On its way to the player. */
  pulled: boolean;
  v: number;
}

export type PickupKind = 'tea' | 'mic' | 'record';

export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
}

export interface Ring {
  x: number;
  y: number;
  r: number;
  max: number;
  life: number;
  color: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface Popup {
  text: string;
  x: number;
  y: number;
  life: number;
  color: string;
}

/** A note the band played on this frame, for the synth. */
export interface NoteEvent {
  inst: InstId;
  step: number;
  lv: number;
  /** Shots fired (the LEAD's harmonies). */
  count: number;
  /** Loudness: 1, less for an echo or a ghost note. */
  vol: number;
}

export interface Controls {
  /** Wanted movement, each axis -1..1. */
  dx: number;
  dy: number;
}

export interface Slot<T> {
  id: T;
  lv: number;
}

export type Card =
  | { kind: 'inst'; id: InstId; lv: number }
  | { kind: 'gear'; id: GearId; lv: number }
  | { kind: 'tea' }
  | { kind: 'tips' };

export type Mode = 'set' | 'endless';

export interface WorldOptions {
  rng: Rng;
  song: Song;
  mode: Mode;
  start: InstId;
  /** The title screen's demo: no notes for the synth. */
  demo?: boolean;
}

export type WorldState = 'play' | 'dead' | 'won';

/** A run of SET lasts this long, then THE SILENCE comes. */
export const SET_FRAMES = 10 * 60 * 60;
const MAX_ENEMIES = 360;
const MAX_GEMS = 260;
const MAX_PARTICLES = 320;
const PLAYER_R = 4;
const BASE_SPEED = 1.05;
const PULL = 20;
const IFRAMES = 30;
/** Enemies further than this from the player are moved back round in front of them. */
const LEASH = 300;
const SPAWN_R = 178;
/** Echoes come a dotted eighth late. */
const ECHO_STEPS = 3;
const ECHO_VOL = [0, 0.3, 0.45, 0.6];
const GRID = 24;
/** How the Hush toughen by the minute. */
export let HP_LINEAR = 0.5;
export let HP_SQUARE = 0.1;
export function tune(lin: number, sq: number) {
  HP_LINEAR = lin;
  HP_SQUARE = sq;
}

/** XP for the next level. */
export const xpFor = (lv: number) => Math.round(5 + 6 * (lv - 1) + 0.3 * (lv - 1) ** 2);

export class World {
  readonly rng: Rng;
  readonly song: Song;
  readonly mode: Mode;
  readonly demo: boolean;
  state: WorldState = 'play';
  frames = 0;

  // The busker.
  px = 0;
  py = 0;
  /** Last direction moved, as a unit vector: HATS and BASS go that way. */
  fx = 1;
  fy = 0;
  moving = false;
  hp = 100;
  maxHp = 100;
  iframes = 0;
  level = 1;
  xp = 0;
  /** Level-ups waiting for a card to be chosen. */
  pending = 0;
  instruments: Slot<InstId>[] = [];
  gear: Slot<GearId>[] = [];
  revives = 0;

  // The beat.
  /** Sixteenths played since the start. */
  step = -1;
  private stepClock = 0;
  /** ARP orbit angle. */
  orbit = 0;
  /** Shots waiting to echo: [step to fire on, instrument, level, damage scale]. */
  private echoes: [number, InstId, number, number][] = [];
  notes: NoteEvent[] = [];
  /** Sounds this frame, for the synth. */
  sounds: string[] = [];

  enemies: Enemy[] = [];
  shots: Shot[] = [];
  bullets: Bullet[] = [];
  gems: Gem[] = [];
  pickups: Pickup[] = [];
  rings: Ring[] = [];
  particles: Particle[] = [];
  popups: Popup[] = [];
  /** Frames of white over the screen after a CRASH. */
  flash = 0;
  shake = 0;

  score = 0;
  kills = 0;
  /** The boss on screen, for its health bar. */
  boss: Enemy | null = null;
  /** SET only: THE SILENCE has been beaten. */
  bossesBeaten = 0;
  /** A warning on screen: [text, frames left]. */
  warning: [string, number] | null = null;
  private nextId = 1;
  private spawnAcc = 0;
  /** Scripted events already run, by key. */
  private done = new Set<string>();
  private grid = new Map<number, Enemy[]>();

  constructor(opt: WorldOptions) {
    this.rng = opt.rng;
    this.song = opt.song;
    this.mode = opt.mode;
    this.demo = !!opt.demo;
    this.instruments.push({ id: opt.start, lv: 1 });
  }

  // ---------- what the busker carries ----------

  instLevel(id: InstId) {
    return this.instruments.find((s) => s.id === id)?.lv ?? 0;
  }

  gearLevel(id: GearId) {
    return this.gear.find((s) => s.id === id)?.lv ?? 0;
  }

  get dmgMult() {
    return 1 + 0.15 * this.gearLevel('amp');
  }

  get areaMult() {
    return 1 + 0.12 * this.gearLevel('reverb');
  }

  get stepFrames() {
    return STEP_FRAMES[this.gearLevel('tempo')];
  }

  get speed() {
    return BASE_SPEED * (1 + 0.1 * this.gearLevel('sneakers'));
  }

  get pullRadius() {
    return PULL * (1 + 0.4 * this.gearLevel('fans'));
  }

  get xpNext() {
    return xpFor(this.level);
  }

  /** Seconds since the start. */
  get time() {
    return this.frames / 60;
  }

  /** Where the camera's top-left corner is. */
  get camX() {
    return Math.round(this.px - W / 2);
  }

  get camY() {
    return Math.round(this.py - H / 2);
  }

  /** Three cards to choose from at a level-up. */
  offer(): Card[] {
    const pool: [Card, number][] = [];
    for (const s of this.instruments) if (s.lv < MAX_LEVEL) pool.push([{ kind: 'inst', id: s.id, lv: s.lv + 1 }, 1.3]);
    if (this.instruments.length < MAX_INSTRUMENTS)
      for (const d of INSTRUMENTS) if (!this.instLevel(d.id)) pool.push([{ kind: 'inst', id: d.id, lv: 1 }, 1]);
    for (const s of this.gear) if (s.lv < GEARS[s.id].max) pool.push([{ kind: 'gear', id: s.id, lv: s.lv + 1 }, 1]);
    if (this.gear.length < MAX_GEAR) for (const d of GEAR) if (!this.gearLevel(d.id)) pool.push([{ kind: 'gear', id: d.id, lv: 1 }, 0.8]);
    const out: Card[] = [];
    while (out.length < 3 && pool.length) {
      const total = pool.reduce((a, [, w]) => a + w, 0);
      let r = this.rng() * total;
      const i = pool.findIndex(([, w]) => (r -= w) < 0);
      out.push(pool.splice(i < 0 ? pool.length - 1 : i, 1)[0][0]);
    }
    if (out.length < 3) out.push({ kind: 'tea' });
    if (out.length < 3) out.push({ kind: 'tips' });
    return out;
  }

  choose(c: Card) {
    this.pending = Math.max(0, this.pending - 1);
    if (c.kind === 'inst') {
      const s = this.instruments.find((x) => x.id === c.id);
      if (s) s.lv = c.lv;
      else this.instruments.push({ id: c.id, lv: 1 });
    } else if (c.kind === 'gear') {
      const s = this.gear.find((x) => x.id === c.id);
      if (s) s.lv = c.lv;
      else this.gear.push({ id: c.id, lv: 1 });
      if (c.id === 'heart') {
        this.maxHp += 20;
        this.hp = Math.min(this.maxHp, this.hp + 40);
      }
      if (c.id === 'encore') this.revives++;
    } else if (c.kind === 'tea') this.hp = Math.min(this.maxHp, this.hp + 50);
    else this.addScore(1000);
  }

  // ---------- the frame ----------

  update(c: Controls) {
    this.notes.length = 0;
    this.sounds.length = 0;
    this.frames++;
    if (this.flash > 0) this.flash--;
    if (this.shake > 0) this.shake--;
    if (this.warning && --this.warning[1] <= 0) this.warning = null;
    this.stepFx();
    if (this.state !== 'play') return;

    this.movePlayer(c);
    this.clock(true);
    this.direct();
    this.buildGrid();
    this.moveEnemies();
    this.moveShots();
    this.moveBullets();
    this.moveGems();
    this.touchPlayer();
  }

  /** Between levels the band plays on, but nothing fires. */
  idle() {
    this.notes.length = 0;
    this.sounds.length = 0;
    this.clock(false);
  }

  private movePlayer(c: Controls) {
    let { dx, dy } = c;
    const len = Math.hypot(dx, dy);
    if (len > 1) (dx /= len), (dy /= len);
    this.moving = len > 0.1;
    if (this.moving) {
      this.px += dx * this.speed;
      this.py += dy * this.speed;
      const l = Math.hypot(dx, dy);
      this.fx = dx / l;
      this.fy = dy / l;
    }
    if (this.iframes > 0) this.iframes--;
  }

  /** Counts frames to the next sixteenth and plays it. */
  private clock(fire: boolean) {
    this.orbit += (Math.PI * 2) / (STEPS * this.stepFrames);
    if (++this.stepClock < this.stepFrames && this.step >= 0) return;
    this.stepClock = 0;
    this.step++;
    for (const s of this.instruments) {
      const n = shots(s.id, s.lv, this.step, this.song);
      if (!n) continue;
      const vol = accent(s.id, this.step);
      this.notes.push({ inst: s.id, step: this.step, lv: s.lv, count: n, vol });
      if (!fire) continue;
      this.fire(s.id, s.lv, n, vol < 1 ? 0.7 : 1);
      const echo = this.gearLevel('echo');
      if (echo && s.id !== 'crash') this.echoes.push([this.step + ECHO_STEPS, s.id, s.lv, ECHO_VOL[echo]]);
    }
    const due = this.echoes.filter((e) => e[0] <= this.step);
    if (due.length) this.echoes = this.echoes.filter((e) => e[0] > this.step);
    for (const [, id, lv, k] of due) {
      if (!this.instLevel(id)) continue;
      const n = Math.max(1, shots(id, lv, this.step - ECHO_STEPS, this.song));
      this.notes.push({ inst: id, step: this.step - ECHO_STEPS, lv, count: n, vol: k });
      if (fire) this.fire(id, lv, n, k, true);
    }
  }

  // ---------- the band ----------

  private fire(id: InstId, lv: number, n: number, scale: number, echo = false) {
    const st = stats(id, lv);
    const dmg = st.dmg * this.dmgMult * scale;
    const area = st.area * this.areaMult;
    const { px, py } = this;
    switch (id) {
      case 'kick': {
        this.rings.push({ x: px, y: py, r: 4, max: area, life: 12, color: '#f83800' });
        for (const e of this.near(px, py, area + 12))
          if (Math.hypot(e.x - px, e.y - py) < area + e.r) this.hurt(e, dmg, 3);
        break;
      }
      case 'snare': {
        const targets: (Enemy | null)[] = this.nearest(px, py, st.count, 170);
        if (!targets.length) targets.push(null);
        for (const t of targets) {
          const a = t ? Math.atan2(t.y - py, t.x - px) : Math.atan2(this.fy, this.fx);
          this.shoot(id, 'bolt', a, st.speed, dmg, st.area, 50, st.pierce, echo);
        }
        break;
      }
      case 'hats': {
        const a0 = this.aim(140);
        for (let k = 0; k < st.count; k++) {
          const a = a0 + (k - (st.count - 1) / 2) * 0.22;
          this.shoot(id, 'needle', a, st.speed, dmg, st.area, 18, st.pierce, echo);
        }
        break;
      }
      case 'bass':
        this.shoot(id, 'wave', this.aim(150), st.speed, dmg, area, 80, Infinity, echo);
        break;
      case 'lead': {
        const targets = this.nearest(px, py, 6, 200);
        for (let k = 0; k < n; k++) {
          const t = targets.length ? targets[(this.step + k) % targets.length] : null;
          const a = (t ? Math.atan2(t.y - py, t.x - px) : Math.atan2(this.fy, this.fx)) + (k - (n - 1) / 2) * 0.6;
          const s = this.shoot(id, 'note', a, st.speed, dmg, st.area, 110, st.pierce, echo);
          s.target = t ? t.id : -1;
        }
        break;
      }
      case 'arp': {
        const r = area;
        const reach = 7 * this.areaMult;
        for (let k = 0; k < st.count; k++) {
          const a = this.orbit + (k * Math.PI * 2) / st.count;
          const ox = px + Math.cos(a) * r, oy = py + Math.sin(a) * r;
          for (const e of this.near(ox, oy, reach + 12)) if (Math.hypot(e.x - ox, e.y - oy) < reach + e.r) this.hurt(e, dmg, 1);
        }
        break;
      }
      case 'pad': {
        this.rings.push({ x: px, y: py, r: area, max: area, life: 10, color: '#f878f8' });
        for (const e of this.near(px, py, area + 12)) if (Math.hypot(e.x - px, e.y - py) < area + e.r) this.hurt(e, dmg, 0);
        break;
      }
      case 'crash': {
        this.flash = 6;
        this.shake = 6;
        this.rings.push({ x: px, y: py, r: 8, max: 180, life: 18, color: '#fca044' });
        for (const e of this.enemies) if (Math.abs(e.x - px) < W / 2 + 8 && Math.abs(e.y - py) < H / 2 + 8) this.hurt(e, dmg, 2);
        this.bullets = this.bullets.filter((b) => Math.abs(b.x - px) > W / 2 || Math.abs(b.y - py) > H / 2);
        break;
      }
    }
  }

  /** The angle to the nearest enemy within range, or the way the busker last walked. */
  private aim(range: number) {
    const [t] = this.nearest(this.px, this.py, 1, range);
    return t ? Math.atan2(t.y - this.py, t.x - this.px) : Math.atan2(this.fy, this.fx);
  }

  private shoot(inst: InstId, kind: ShotKind, a: number, speed: number, dmg: number, r: number, life: number, pierce: number, echo: boolean) {
    const s: Shot = {
      inst, kind, x: this.px, y: this.py, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      dmg, r, life, pierce, hit: new Set(), target: -1, echo,
    };
    this.shots.push(s);
    return s;
  }

  /** The ARP's notes, where they are now. */
  orbiters(): [number, number][] {
    const lv = this.instLevel('arp');
    if (!lv) return [];
    const st = stats('arp', lv);
    const r = st.area * this.areaMult;
    const out: [number, number][] = [];
    for (let k = 0; k < st.count; k++) {
      const a = this.orbit + (k * Math.PI * 2) / st.count;
      out.push([this.px + Math.cos(a) * r, this.py + Math.sin(a) * r]);
    }
    return out;
  }

  /** The PAD's chord around the busker, 0 without one. */
  get padRadius() {
    const lv = this.instLevel('pad');
    return lv ? stats('pad', lv).area * this.areaMult : 0;
  }

  // ---------- enemies ----------

  private buildGrid() {
    this.grid.clear();
    for (const e of this.enemies) {
      const k = this.cell(e.x, e.y);
      const list = this.grid.get(k);
      if (list) list.push(e);
      else this.grid.set(k, [e]);
    }
  }

  private cell(x: number, y: number) {
    return (Math.floor(x / GRID) + 2048) * 4096 + (Math.floor(y / GRID) + 2048);
  }

  /** Enemies in the grid cells within r of (x, y). */
  private near(x: number, y: number, r: number): Enemy[] {
    const out: Enemy[] = [];
    const x0 = Math.floor((x - r) / GRID), x1 = Math.floor((x + r) / GRID);
    const y0 = Math.floor((y - r) / GRID), y1 = Math.floor((y + r) / GRID);
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const list = this.grid.get((cx + 2048) * 4096 + (cy + 2048));
        if (list) for (const e of list) if (e.hp > 0) out.push(e);
      }
    return out;
  }

  private nearest(x: number, y: number, n: number, range: number): Enemy[] {
    return this.enemies
      .filter((e) => e.hp > 0 && Math.abs(e.x - x) < range && Math.abs(e.y - y) < range)
      .map((e) => [e, (e.x - x) ** 2 + (e.y - y) ** 2] as const)
      .sort((a, b) => a[1] - b[1])
      .slice(0, n)
      .map(([e]) => e);
  }

  private spawn(kind: EnemyKind, x: number, y: number) {
    const d = KINDS[kind];
    const m = this.time / 60;
    // Regulars toughen with the minutes; bosses with each one met.
    const scale = d.boss ? 1 + 0.5 * this.bossesBeaten + (kind === 'neighbor' ? m / 6 : 0) : 1 + HP_LINEAR * m + HP_SQUARE * m * m;
    const hp = Math.round(d.hp * scale);
    const e: Enemy = {
      id: this.nextId++, kind, x, y, hp, maxHp: hp, r: d.r, speed: d.speed * (d.boss ? 1 : 1 + Math.min(0.3, m * 0.02)),
      dmg: d.dmg, flash: 0, t: Math.floor(this.rng() * 120), mode: 0, dx: 0, dy: 0, kx: 0, ky: 0, slow: false, flip: false,
    };
    this.enemies.push(e);
    if (d.boss) this.boss = e;
    return e;
  }

  /** A point just off screen, in a random direction (or that one). */
  private offscreen(a = this.rng() * Math.PI * 2): [number, number] {
    return [this.px + Math.cos(a) * SPAWN_R, this.py + Math.sin(a) * SPAWN_R * 0.85];
  }

  /** How many of the Hush there should be, and of what kinds, by the minute. */
  private direct() {
    const t = this.time;
    const m = t / 60;
    this.events(t);
    const silence = this.boss?.kind === 'silence';
    const target = Math.min(MAX_ENEMIES, Math.floor((10 + 18 * m + 3.2 * m * m) * (silence ? 0.5 : 1)));
    const alive = this.enemies.length;
    if (alive >= target) return;
    this.spawnAcc += Math.max(0.05, (target - alive) / 40);
    while (this.spawnAcc >= 1 && this.enemies.length < MAX_ENEMIES) {
      this.spawnAcc--;
      const weights: [EnemyKind, number][] = [
        ['shh', 1],
        ['static', m >= 1 ? 0.6 : 0],
        ['heckler', m >= 2 ? 0.25 : 0],
        ['plug', m >= 3 ? 0.3 + m * 0.02 : 0],
        ['feedback', m >= 4 ? 0.28 : 0],
      ];
      const total = weights.reduce((a, [, w]) => a + w, 0);
      let r = this.rng() * total;
      const kind = weights.find(([, w]) => (r -= w) < 0)?.[0] ?? 'shh';
      // Swarms: in a minute's second half the same kind comes in a little group.
      const group = kind === 'static' && this.rng() < 0.3 ? 4 : 1;
      const [x, y] = this.offscreen();
      for (let k = 0; k < group; k++) this.spawn(kind, x + (this.rng() - 0.5) * 16, y + (this.rng() - 0.5) * 16);
    }
  }

  /** What happens on the clock: mini-bosses, rings closing in, THE SILENCE at ten minutes. */
  private events(t: number) {
    // In ENDLESS the schedule comes round again every ten minutes, tougher.
    const lap = this.mode === 'endless' ? Math.floor(t / 600) : 0;
    const at = t - lap * 600;
    const once = (key: string, when: number, f: () => void) => {
      const k = `${lap}:${key}`;
      if (at >= when && !this.done.has(k)) {
        this.done.add(k);
        f();
      }
    };
    const neighbor = (n: number) => () => {
      this.warn('NOISE COMPLAINT!');
      for (let k = 0; k < n; k++) this.spawn('neighbor', ...this.offscreen());
    };
    const ring = (kind: EnemyKind, n: number) => () => {
      this.warn('THEY CLOSE IN');
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        this.spawn(kind, this.px + Math.cos(a) * 150, this.py + Math.sin(a) * 120);
      }
    };
    once('n1', 180, neighbor(1));
    once('r1', 270, ring('shh', 28));
    once('n2', 360, neighbor(1));
    once('r2', 450, ring('static', 34));
    once('n3', 510, neighbor(2));
    once('r3', 560, ring('plug', 20));
    if (this.mode === 'set' && t >= SET_FRAMES / 60 && !this.done.has('silence')) {
      this.done.add('silence');
      this.warn('THE SILENCE');
      this.spawn('silence', ...this.offscreen(-Math.PI / 2));
    }
    if (this.mode === 'endless') once('s', 599.9, () => {
      this.warn('THE SILENCE');
      this.spawn('silence', ...this.offscreen(-Math.PI / 2));
    });
  }

  private warn(text: string) {
    this.warning = [text, 150];
    this.sounds.push('warning');
  }

  private moveEnemies() {
    const pad = this.padRadius;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (e.flash > 0) e.flash--;
      let dx = this.px - e.x, dy = this.py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      e.slow = pad > 0 && d < pad + e.r;
      let sp = e.speed * (e.slow ? 0.55 : 1);
      e.t++;
      // Far behind: round in front again.
      if (d > LEASH && !KINDS[e.kind].boss) {
        const a = Math.atan2(this.fy, this.fx) + (this.rng() - 0.5) * 1.6;
        [e.x, e.y] = this.offscreen(a);
        continue;
      }
      switch (e.kind) {
        case 'static':
          // Fizzes about on its way.
          dx += Math.sin(e.t * 0.3 + e.id) * 0.8;
          dy += Math.cos(e.t * 0.27 + e.id * 2) * 0.8;
          break;
        case 'heckler':
          // Keeps its distance and throws tomatoes.
          if (d < 70) sp *= -0.6;
          else if (d < 95) sp = 0;
          if (e.t % 160 === 0 && d < 150) {
            this.bullet('tomato', e.x, e.y, Math.atan2(this.py - e.y, this.px - e.x), 1.5, 3, 9);
            this.sounds.push('throw');
          }
          break;
        case 'feedback':
          // Walks, screeches, then dashes the way it was looking.
          if (e.mode === 0 && e.t > 200 && d < 140) {
            e.mode = 1;
            e.t = 0;
            this.sounds.push('screech');
          } else if (e.mode === 1) {
            sp = 0;
            e.dx = dx;
            e.dy = dy;
            if (e.t > 40) (e.mode = 2), (e.t = 0);
          } else if (e.mode === 2) {
            dx = e.dx;
            dy = e.dy;
            sp = 3;
            if (e.t > 32) (e.mode = 0), (e.t = 0);
          }
          break;
        case 'neighbor':
          // Stops, raises the broom, and slams a ring of shockwaves.
          if (e.mode === 0 && e.t > 220) (e.mode = 1), (e.t = 0);
          if (e.mode === 1) {
            sp = 0;
            if (e.t === 40) {
              const n = 14;
              for (let k = 0; k < n; k++) this.bullet('shock', e.x, e.y, (k / n) * Math.PI * 2 + e.id, 1.3, 4, 12);
              this.shake = 8;
              this.sounds.push('slam');
            }
            if (e.t > 60) (e.mode = 0), (e.t = 0);
          }
          break;
        case 'silence':
          this.stepSilence(e);
          break;
      }
      const len = Math.hypot(dx, dy) || 1;
      e.x += (dx / len) * sp + e.kx;
      e.y += (dy / len) * sp + e.ky;
      e.kx *= 0.6;
      e.ky *= 0.6;
      if (Math.abs(dx) > 0.2) e.flip = dx < 0;
    }
    this.separate();
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (this.boss && this.boss.hp <= 0) this.boss = null;
  }

  /** THE SILENCE: rings of rests, then a spiral, and it calls the Hush to it. */
  private stepSilence(e: Enemy) {
    const half = e.hp < e.maxHp / 2;
    if (e.t % (half ? 90 : 130) === 0) {
      const n = half ? 22 : 16;
      for (let k = 0; k < n; k++) this.bullet('rest', e.x, e.y, (k / n) * Math.PI * 2 + e.t * 0.01, 1.1, 4, 14);
      this.sounds.push('slam');
    }
    if (half && e.t % 8 === 0) this.bullet('rest', e.x, e.y, e.t * 0.09, 1.4, 4, 12);
    if (e.t % 600 === 300) {
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        this.spawn('shh', e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30);
      }
    }
  }

  /** Pushes overlapping enemies apart, so a crowd spreads out instead of stacking. */
  private separate() {
    for (const list of this.grid.values())
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i], b = list[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const min = a.r + b.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * 0.25;
          const ab = KINDS[a.kind].boss, bb = KINDS[b.kind].boss;
          if (!ab) (a.x -= dx * push), (a.y -= dy * push);
          if (!bb) (b.x += dx * push), (b.y += dy * push);
        }
  }

  private bullet(kind: BulletKind, x: number, y: number, a: number, speed: number, r: number, dmg: number) {
    this.bullets.push({ kind, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, dmg, life: 300 });
  }

  /** Damage, a white flash and a shove; at zero the enemy bursts into notes. */
  private hurt(e: Enemy, dmg: number, knock: number) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.flash = 5;
    if (knock && !KINDS[e.kind].boss) {
      const d = Math.hypot(e.x - this.px, e.y - this.py) || 1;
      e.kx += ((e.x - this.px) / d) * knock;
      e.ky += ((e.y - this.py) / d) * knock;
    }
    if (e.hp <= 0) this.kill(e);
  }

  private kill(e: Enemy) {
    const d = KINDS[e.kind];
    this.kills++;
    this.addScore(d.pts);
    this.burst(e.x, e.y, d.boss ? 40 : 6, e.kind === 'plug' ? '#fca044' : e.kind === 'silence' ? '#fcfcfc' : '#bcbcbc');
    this.sounds.push(d.boss ? 'bossDie' : 'pop');
    if (d.xp) this.dropGem(e.x, e.y, d.xp);
    if (e.kind === 'neighbor') this.pickups.push({ kind: 'record', x: e.x, y: e.y });
    if (e.kind === 'silence') {
      this.bossesBeaten++;
      this.shake = 30;
      this.flash = 20;
      for (let k = 0; k < 30; k++) this.dropGem(e.x + (this.rng() - 0.5) * 60, e.y + (this.rng() - 0.5) * 60, 25);
      if (this.mode === 'set') {
        this.state = 'won';
        this.addScore(50000);
      }
    } else if (!d.boss) {
      const r = this.rng();
      if (r < 0.006) this.pickups.push({ kind: 'tea', x: e.x, y: e.y });
      else if (r < 0.009) this.pickups.push({ kind: 'mic', x: e.x, y: e.y });
    }
  }

  private dropGem(x: number, y: number, value: number) {
    if (this.gems.length >= MAX_GEMS) {
      // Too many on the ground: the value joins one of them instead.
      this.gems[Math.floor(this.rng() * this.gems.length)].value += value;
      return;
    }
    this.gems.push({ x, y, value, pulled: false, v: 0 });
  }

  addScore(n: number) {
    this.score += n;
  }

  // ---------- things in flight ----------

  private moveShots() {
    const byId = new Map(this.enemies.map((e) => [e.id, e]));
    for (const s of this.shots) {
      s.life--;
      if (s.kind === 'note' && s.target >= 0) {
        // Notes curve towards their target.
        const t = byId.get(s.target);
        if (t && t.hp > 0) {
          const want = Math.atan2(t.y - s.y, t.x - s.x);
          const cur = Math.atan2(s.vy, s.vx);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const a = cur + Math.max(-0.14, Math.min(0.14, diff));
          const sp = Math.hypot(s.vx, s.vy);
          s.vx = Math.cos(a) * sp;
          s.vy = Math.sin(a) * sp;
        } else s.target = -1;
      }
      s.x += s.vx;
      s.y += s.vy;
      for (const e of this.near(s.x, s.y, s.r + 12)) {
        if (s.hit.has(e.id) || Math.hypot(e.x - s.x, e.y - s.y) > s.r + e.r) continue;
        s.hit.add(e.id);
        this.hurt(e, s.dmg, s.kind === 'wave' ? 2 : 1);
        if (s.hit.size >= s.pierce) {
          s.life = 0;
          break;
        }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }

  private moveBullets() {
    for (const b of this.bullets) {
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
      if (Math.hypot(b.x - this.px, b.y - this.py) < b.r + PLAYER_R) {
        b.life = 0;
        this.damagePlayer(b.dmg);
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  private moveGems() {
    const pull = this.pullRadius;
    for (const g of this.gems) {
      const dx = this.px - g.x, dy = this.py - g.y;
      const d = Math.hypot(dx, dy);
      if (!g.pulled && d < pull) g.pulled = true;
      if (!g.pulled) continue;
      g.v = Math.min(6, g.v + 0.25);
      if (d < 4 + g.v) {
        g.value = -g.value;
        this.gainXp(-g.value);
        continue;
      }
      g.x += (dx / d) * g.v;
      g.y += (dy / d) * g.v;
    }
    this.gems = this.gems.filter((g) => g.value > 0);
    for (const p of this.pickups) {
      if (Math.hypot(this.px - p.x, this.py - p.y) > 10) continue;
      p.x = NaN;
      if (p.kind === 'tea') {
        this.hp = Math.min(this.maxHp, this.hp + 30);
        this.popup('+30', '#58d854');
      } else if (p.kind === 'mic') {
        for (const g of this.gems) g.pulled = true;
        this.popup('MIC DROP', '#fcfcfc');
      } else {
        // A gold record: an armful of level-ups.
        this.pending += 3;
        this.popup('GOLD RECORD!', '#f8d838');
      }
      this.sounds.push('pickup');
    }
    this.pickups = this.pickups.filter((p) => !Number.isNaN(p.x));
  }

  private gainXp(n: number) {
    this.xp += n;
    this.addScore(n);
    this.sounds.push('gem');
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.pending++;
    }
  }

  private touchPlayer() {
    if (this.iframes > 0) return;
    for (const e of this.near(this.px, this.py, 30))
      if (Math.hypot(e.x - this.px, e.y - this.py) < e.r + PLAYER_R) {
        this.damagePlayer(e.dmg);
        return;
      }
  }

  private damagePlayer(dmg: number) {
    if (this.iframes > 0 || this.state !== 'play') return;
    this.hp -= dmg;
    this.iframes = IFRAMES;
    this.shake = Math.max(this.shake, 6);
    this.sounds.push('hurt');
    if (this.hp > 0) return;
    if (this.revives > 0) {
      // ENCORE: back up, and the crowd is thrown back.
      this.revives--;
      const s = this.gear.find((g) => g.id === 'encore');
      if (s) s.lv = Math.max(0, s.lv - 1);
      this.gear = this.gear.filter((g) => g.lv > 0);
      this.hp = Math.round(this.maxHp * 0.6);
      this.iframes = 150;
      this.flash = 12;
      this.rings.push({ x: this.px, y: this.py, r: 6, max: 140, life: 24, color: '#fcfcfc' });
      for (const e of this.enemies) if (Math.hypot(e.x - this.px, e.y - this.py) < 140) this.hurt(e, 40, 10);
      this.bullets = [];
      this.popup('ONE MORE SONG!', '#f8d838');
      this.sounds.push('revive');
      return;
    }
    this.hp = 0;
    this.state = 'dead';
    this.burst(this.px, this.py, 30, '#f8d838');
    this.sounds.push('die');
  }

  // ---------- effects ----------

  private burst(x: number, y: number, n: number, color: string) {
    for (let k = 0; k < n && this.particles.length < MAX_PARTICLES; k++) {
      const a = this.rng() * Math.PI * 2, v = 0.4 + this.rng() * 1.6;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 14 + Math.floor(this.rng() * 14), color });
    }
  }

  private popup(text: string, color: string) {
    this.popups.push({ text, x: this.px, y: this.py - 14, life: 70, color });
  }

  private stepFx() {
    for (const r of this.rings) {
      r.life--;
      r.r += (r.max - r.r) * 0.35;
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.life--;
      p.y -= 0.3;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  /** Step within the loop, for the sequencer display. */
  get barStep() {
    return Math.max(0, this.step) % STEPS;
  }

  get loopStep() {
    return Math.max(0, this.step) % LOOP;
  }
}

/** The title screen's demo: a busker who keeps away from the crowd and picks up what is safe. */
export function autopilot(w: World): Controls {
  let ax = 0, ay = 0;
  // With a KICK or a PAD it lets the crowd come into reach.
  const reach = Math.max(w.instLevel('kick') ? 34 * w.areaMult : 0, w.padRadius);
  const keep = reach ? Math.max(24, reach - 6) : 46;
  for (const e of w.enemies) {
    const dx = w.px - e.x, dy = w.py - e.y;
    const d2 = dx * dx + dy * dy;
    const boss = KINDS[e.kind].boss;
    if (d2 > (boss ? 70 * 70 : keep * keep)) continue;
    const k = (boss ? 4 : 1) / Math.max(30, d2);
    ax += dx * k;
    ay += dy * k;
  }
  for (const b of w.bullets) {
    const dx = w.px - b.x, dy = w.py - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 40 * 40) (ax += (dx * 2) / Math.max(20, d2)), (ay += (dy * 2) / Math.max(20, d2));
  }
  const danger = Math.hypot(ax, ay);
  let gx = 0, gy = 0, best = 170 * 170;
  for (const g of w.gems) {
    const d2 = (g.x - w.px) ** 2 + (g.y - w.py) ** 2;
    if (d2 < best) (best = d2), (gx = g.x - w.px), (gy = g.y - w.py);
  }
  for (const p of w.pickups) {
    const d2 = (p.x - w.px) ** 2 + (p.y - w.py) ** 2;
    if (d2 < 200 * 200) (gx = p.x - w.px), (gy = p.y - w.py);
  }
  const gl = Math.hypot(gx, gy);
  let dx = ax * 40, dy = ay * 40;
  if (gl > 0 && danger < 0.2) (dx += (gx / gl) * 0.8), (dy += (gy / gl) * 0.8);
  // Drift in a slow circle so it isn't cornered.
  dx += Math.cos(w.frames / 300) * 0.3;
  dy += Math.sin(w.frames / 300) * 0.3;
  const l = Math.hypot(dx, dy);
  return l > 0.15 ? { dx: dx / l, dy: dy / l } : { dx: 0, dy: 0 };
}
