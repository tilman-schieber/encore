import { MODES, TABLES, TableId } from './modes';
import { loadTables, saveTables, rankFor, ScoreEntry, Tables, MAX_SCORES, load, save, fetchGlobal, submitGlobal, flushPending } from './scores';
import { sfx, music } from './audio';
import { hashString, makeRng, randomSeed, today } from 'arcade-kit/rng';
import { makeSong } from './song';
import { World, Controls, Card, autopilot, autoArrange } from './world';
import { InstId, STEP_FRAMES, editable } from './band';
import { STEPS } from './song';
import { HELP_PAGES } from './help';

export type Action = 'up' | 'down' | 'left' | 'right' | 'ok' | 'start' | 'back' | 'quit' | 'mute' | 'scores';

export interface Input {
  held: Set<Action>;
  pressed: Set<Action>;
  /** Raw A-Z / 0-9 / Backspace / Enter, for name entry. */
  typed: string[];
  /** A finger dragged on the screen: the way to go, each axis -1..1 (0, 0 when none). */
  stick: { x: number; y: number };
  /** A tap on the screen, in screen pixels, or null. */
  tap: { x: number; y: number } | null;
}

export type Phase = 'title' | 'intro' | 'play' | 'levelup' | 'arrange' | 'over' | 'entry' | 'scores' | 'help';

export interface Settings {
  /** Index into MODES. */
  mode: number;
  /** Index into STARTERS. */
  start: number;
  daily: boolean;
  /** Index into MUSIC_NAMES. */
  music: number;
  /** M mutes without changing the selection. */
  muted: boolean;
}

/** What you can start the band with. */
export const STARTERS: InstId[] = ['snare', 'kick', 'bass', 'lead', 'hats'];
export const MUSIC_NAMES = ['ON', 'OFF'];
const MUSIC_OFF = 1;
export const MENU = ['MODE', 'START', 'SEED', 'MUSIC', 'HELP'] as const;
export type MenuRow = (typeof MENU)[number];
export const NAME_LEN = 6;
const NAME_CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const DEFAULT_SETTINGS: Settings = { mode: 0, start: 0, daily: false, music: 0, muted: false };
/** The title card before a run: the song's key and tempo. */
export const INTRO_FRAMES = 110;
/** A level-up card can't be taken until it has been on screen this long, so held keys don't pick one. */
const CARD_DELAY = 24;
/** Where the REARRANGE grid is drawn (render.ts draws it, taps are read from it). */
export const ARR_X = 24;
export const ARR_Y = 44;
export const ARR_CELL = 13;
export const ARR_ROW = 14;
export const ARR_DONE_Y = 196;

function loadSettings(): Settings {
  try {
    const s = { ...DEFAULT_SETTINGS, ...JSON.parse(load('encore.settings') ?? '{}') };
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v | 0));
    s.mode = clamp(s.mode, 0, MODES.length - 1);
    s.start = clamp(s.start, 0, STARTERS.length - 1);
    s.daily = !!s.daily;
    s.music = clamp(s.music, 0, MUSIC_NAMES.length - 1);
    s.muted = !!s.muted;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export class Game {
  phase: Phase = 'title';
  settings = loadSettings();
  menuRow = 0;
  paused = false;
  timer = 0;

  world: World | null = null;
  /** A busker playing on behind the title screen. */
  attract: World | null = null;
  cards: Card[] = [];
  cardRow = 0;
  /** The REARRANGE screen: the cursor, and the step picked up (-1: none). */
  arrRow = 0;
  arrCol = 0;
  holding = -1;

  tables: Tables = loadTables();
  /** World top 10s from the server; null until loaded or while offline. */
  global: Tables | null = null;
  globalState: 'loading' | 'ok' | 'offline' = 'loading';
  /** Show the world table (true) or this browser's own (false). */
  scoresGlobal = true;
  /** Row of the last game in the world table, or -1. */
  globalRank = -1;
  /** The table on show: an index into MODES. */
  scoresView = 0;
  entryRank = -1;
  entryName: string[] = [];
  entryCursor = 0;
  private entryFresh = false;

  helpPage = 0;
  /** Started with ?debug in the URL: cheat keys in play, and no high scores. */
  readonly debug = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
  private lastStep = -1;

  constructor() {
    music.enabled = !this.settings.muted && this.settings.music !== MUSIC_OFF;
    this.refreshGlobal();
  }

  private async refreshGlobal() {
    // Games queued while offline go first, so the table includes them.
    await flushPending();
    const tables = await fetchGlobal();
    if (tables) this.global = tables;
    this.globalState = this.global ? 'ok' : 'offline';
    // Without world scores, show this browser's own.
    if (!this.global) this.scoresGlobal = false;
  }

  /** Posts a finished run to the world table and marks where it landed. */
  private async submitGlobal(mode: TableId, e: ScoreEntry) {
    const res = await submitGlobal(mode, e);
    if (!res) return;
    this.global ??= Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Tables;
    this.global[mode] = res.top;
    this.globalState = 'ok';
    this.globalRank = res.rank;
  }

  get mode() {
    return MODES[this.settings.mode];
  }

  best(): ScoreEntry | undefined {
    return this.tables[this.mode.id]?.[0];
  }

  step(input: Input) {
    const { pressed } = input;
    if (this.phase === 'entry') return this.stepEntry(input);
    if (pressed.has('mute')) this.toggleMusic();
    if (this.phase === 'title' || this.phase === 'scores' || this.phase === 'help') this.stepAttract();

    switch (this.phase) {
      case 'title':
        return this.stepTitle(pressed);
      case 'intro':
        return this.stepIntro(input);
      case 'play':
        return this.stepPlay(input);
      case 'levelup':
        return this.stepLevelUp(input);
      case 'arrange':
        return this.stepArrange(input);
      case 'over':
        this.world!.update({ dx: 0, dy: 0 });
        if (++this.timer > 90 && (pressed.has('start') || pressed.has('ok') || input.tap)) {
          if (this.entryRank >= 0) this.phase = 'entry';
          else this.showScores();
          sfx.select();
        }
        return;
      case 'scores':
        return this.stepScores(input);
      case 'help':
        return this.stepHelp(input);
    }
  }

  // ---------- menu ----------

  private saveSettings() {
    save('encore.settings', JSON.stringify(this.settings));
  }

  private toggleMusic() {
    this.settings.muted = !this.settings.muted;
    music.enabled = !this.settings.muted && this.settings.music !== MUSIC_OFF;
    this.saveSettings();
  }

  private stepAttract() {
    const w = this.attract;
    if (!w || w.state !== 'play' || w.frames > 60 * 60 * 3) {
      const seed = randomSeed();
      this.attract = new World({ rng: makeRng(seed), song: makeSong(seed), mode: 'set', start: STARTERS[seed % STARTERS.length], demo: true });
      // The demo gets a head start, so there is something to see.
      const d = this.attract;
      for (let k = 0; k < 3; k++) d.choose(d.offer()[0]);
      return;
    }
    while (w.pending > 0) w.choose(w.offer()[Math.floor(w.rng() * 3)]);
    autoArrange(w);
    w.update(autopilot(w));
  }

  private stepTitle(pressed: Set<Action>) {
    const s = this.settings;
    if (pressed.has('up')) this.menuRow = (this.menuRow + MENU.length - 1) % MENU.length;
    if (pressed.has('down')) this.menuRow = (this.menuRow + 1) % MENU.length;
    if (pressed.has('up') || pressed.has('down')) sfx.move();

    const d = (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0);
    const row = MENU[this.menuRow];
    if (row === 'HELP' && (d || pressed.has('start') || pressed.has('ok'))) {
      this.helpPage = 0;
      this.phase = 'help';
      sfx.select();
      return;
    }
    if (d) {
      const wrap = (v: number, n: number) => (v + d + n) % n;
      if (row === 'MODE') s.mode = wrap(s.mode, MODES.length);
      if (row === 'START') s.start = wrap(s.start, STARTERS.length);
      if (row === 'SEED') s.daily = !s.daily;
      if (row === 'MUSIC') {
        s.music = wrap(s.music, MUSIC_NAMES.length);
        music.enabled = !s.muted && s.music !== MUSIC_OFF;
      }
      sfx.select();
      this.saveSettings();
    }
    if (pressed.has('scores')) {
      this.refreshGlobal();
      this.scoresView = s.mode;
      this.entryRank = -1;
      this.globalRank = -1;
      this.phase = 'scores';
      sfx.select();
    } else if (pressed.has('start') || pressed.has('ok')) this.startGame();
  }

  private stepHelp({ pressed, tap }: Input) {
    const d = (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0) + (tap ? 1 : 0);
    if (d) {
      this.helpPage = (this.helpPage + d + HELP_PAGES.length) % HELP_PAGES.length;
      sfx.move();
    }
    if (pressed.has('start') || pressed.has('back') || pressed.has('quit') || pressed.has('ok')) {
      this.phase = 'title';
      sfx.select();
    }
  }

  // ---------- a run ----------

  startGame() {
    const s = this.settings;
    const seed = s.daily ? hashString(`encore:${today()}:${this.mode.id}`) : randomSeed();
    this.world = new World({ rng: makeRng(seed), song: makeSong(seed), mode: this.mode.id, start: STARTERS[s.start] });
    this.entryRank = -1;
    this.paused = false;
    this.phase = 'intro';
    this.timer = 0;
    this.lastStep = -1;
    this.idleFrames = 0;
    music.reset();
    sfx.start();
  }

  private stepIntro({ pressed }: Input) {
    if (++this.timer >= INTRO_FRAMES || (this.timer > 20 && (pressed.has('start') || pressed.has('ok')))) {
      this.phase = 'play';
      this.timer = 0;
    }
  }

  /** The way to go: a dragged finger, or the held keys and pad. */
  private controls(input: Input): Controls {
    const { held, stick } = input;
    if (stick.x || stick.y) return { dx: stick.x, dy: stick.y };
    return {
      dx: (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
      dy: (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0),
    };
  }

  /** Hands what the band played this frame to the synth. */
  private playNotes(w: World) {
    const stepped = w.step !== this.lastStep;
    this.lastStep = w.step;
    const bar = stepped && w.step % 16 === 0 ? w.step : null;
    music.setDuck(w.boss?.kind === 'silence' ? 0.45 : 1);
    music.play(w.song, w.notes, w.frames + this.idleFrames, (w.stepFrames / 60), bar);
    for (const s of w.sounds) (sfx as Record<string, () => unknown>)[s]?.();
  }

  /** Frames the band played on while a card was being picked: the audio clock counts them too. */
  private idleFrames = 0;

  private stepPlay(input: Input) {
    const { pressed } = input;
    const w = this.world!;
    if (pressed.has('start') || pressed.has('back')) {
      this.paused = !this.paused;
      sfx.pause();
      return;
    }
    if (this.paused) {
      if (pressed.has('quit')) this.toTitle();
      return;
    }
    if (this.debug) this.debugKeys(input.typed);
    w.update(this.controls(input));
    this.playNotes(w);
    if (w.state === 'dead' || w.state === 'won') return this.gameOver();
    if (w.pending > 0) this.levelUp();
  }

  private levelUp() {
    this.cards = this.world!.offer();
    this.cardRow = 0;
    this.phase = 'levelup';
    this.timer = 0;
    sfx.levelup();
  }

  /** Which card a tap on the screen is on (see render.ts for where they are drawn). */
  static cardAt(y: number) {
    const i = Math.floor((y - 52) / 46);
    return i >= 0 && i < 3 ? i : -1;
  }

  private stepLevelUp(input: Input) {
    const { pressed, tap } = input;
    const w = this.world!;
    this.timer++;
    // The band plays on while you choose.
    w.idle();
    this.idleFrames++;
    this.playNotes(w);
    if (pressed.has('up')) this.cardRow = (this.cardRow + this.cards.length - 1) % this.cards.length;
    if (pressed.has('down')) this.cardRow = (this.cardRow + 1) % this.cards.length;
    if (pressed.has('up') || pressed.has('down')) sfx.move();
    let take = this.timer > CARD_DELAY && (pressed.has('ok') || pressed.has('start'));
    if (tap && this.timer > CARD_DELAY) {
      const i = Game.cardAt(tap.y);
      if (i >= 0) {
        this.cardRow = i;
        take = true;
      }
    }
    if (!take) return;
    w.choose(this.cards[this.cardRow]);
    sfx.choose();
    if (w.movesLeft > 0) return this.arrange();
    this.afterCards();
  }

  private afterCards() {
    if (this.world!.pending > 0) this.levelUp();
    else this.phase = 'play';
  }

  // ---------- rearranging the sequencer ----------

  /** The rows of the REARRANGE screen: the parts you can move. */
  arrRows(): InstId[] {
    return this.world!.instruments.filter((s) => editable(s.id)).map((s) => s.id);
  }

  private arrange() {
    if (!this.arrRows().length) {
      this.world!.movesLeft = 0;
      return this.afterCards();
    }
    this.phase = 'arrange';
    this.timer = 0;
    this.arrRow = 0;
    this.arrCol = 0;
    this.holding = -1;
  }

  /** Which cell of the REARRANGE grid a tap is on (see render.ts), or 'done', or null. */
  static arrAt(x: number, y: number, rows: number): [number, number] | 'done' | null {
    if (y >= ARR_DONE_Y && y < ARR_DONE_Y + 16) return 'done';
    const r = Math.floor((y - ARR_Y) / ARR_ROW), c = Math.floor((x - ARR_X) / ARR_CELL);
    return r >= 0 && r < rows && c >= 0 && c < STEPS ? [r, c] : null;
  }

  private stepArrange(input: Input) {
    const { pressed, tap } = input;
    const w = this.world!;
    this.timer++;
    w.idle();
    this.idleFrames++;
    this.playNotes(w);
    if (this.afterArrange) {
      if (this.timer >= 0) (this.afterArrange = false), this.afterCards();
      return;
    }
    const rows = this.arrRows();
    const d = (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0);
    if (d) (this.arrCol = (this.arrCol + d + STEPS) % STEPS), sfx.move();
    // While holding a step it stays in its row.
    if (this.holding < 0) {
      if (pressed.has('up')) (this.arrRow = (this.arrRow + rows.length - 1) % rows.length), sfx.move();
      if (pressed.has('down')) (this.arrRow = (this.arrRow + 1) % rows.length), sfx.move();
    }
    let act = this.timer > CARD_DELAY && (pressed.has('ok') || pressed.has('start'));
    let done = pressed.has('back') && this.holding < 0;
    if (pressed.has('back') && this.holding >= 0) (this.holding = -1), sfx.move();
    if (tap && this.timer > CARD_DELAY) {
      const at = Game.arrAt(tap.x, tap.y, rows.length);
      if (at === 'done') done = true;
      else if (at && (this.holding < 0 || at[0] === this.arrRow)) {
        [this.arrRow, this.arrCol] = at;
        act = true;
      }
    }
    if (done) {
      w.movesLeft = 0;
      sfx.choose();
      return this.afterCards();
    }
    if (!act) return;
    const id = rows[this.arrRow];
    const pat = w.pattern(id);
    if (this.holding < 0) {
      if (pat.has(this.arrCol)) (this.holding = this.arrCol), sfx.select();
    } else if (this.arrCol === this.holding) {
      this.holding = -1;
      sfx.move();
    } else if (w.moveStep(id, this.holding, this.arrCol)) {
      this.holding = -1;
      sfx.choose();
      if (w.movesLeft <= 0) {
        // A moment to see where it landed.
        this.timer = -30;
        this.afterArrange = true;
      }
    }
  }

  /** The last move made: back to the street once the pause after it is over. */
  afterArrange = false;

  private gameOver() {
    const w = this.world!;
    this.phase = 'over';
    this.timer = 0;
    if (w.state === 'won') sfx.win();
    else sfx.over();
    this.prepareEntry();
  }

  private toTitle() {
    this.phase = 'title';
    this.world = null;
    this.paused = false;
    this.entryRank = -1;
    sfx.select();
  }

  // ---------- high scores ----------

  private prepareEntry() {
    const w = this.world!;
    this.entryRank = -1;
    this.globalRank = -1;
    this.scoresGlobal = !!this.global;
    this.scoresView = this.settings.mode;
    if (w.score <= 0 || this.debug) return;
    const entry: ScoreEntry = { name: '', score: w.score, time: Math.floor(w.time), level: w.level, won: w.bossesBeaten > 0 };
    const list = (this.tables[this.mode.id] = this.tables[this.mode.id].filter((e) => e.name.trim()));
    const at = rankFor(list, entry);
    const last = (load('encore.name') ?? '').slice(0, NAME_LEN);
    if (at < 0) {
      // Not a personal record, but it still goes to the world table under the last name used.
      if (last.trim()) this.submitGlobal(this.mode.id, { ...entry, name: last.trim() });
      return;
    }
    list.splice(at, 0, entry);
    list.length = Math.min(list.length, MAX_SCORES);
    this.entryRank = at;
    this.entryName = last.padEnd(NAME_LEN, ' ').split('');
    this.entryCursor = Math.min(NAME_LEN - 1, last.length);
    this.entryFresh = last.length > 0;
  }

  private stepEntry({ pressed, typed }: Input) {
    const name = this.entryName;
    const cycle = (d: number) => {
      const i = NAME_CHARS.indexOf(name[this.entryCursor]);
      name[this.entryCursor] = NAME_CHARS[(i + d + NAME_CHARS.length) % NAME_CHARS.length];
      sfx.move();
    };
    if (pressed.has('up')) cycle(1);
    if (pressed.has('down')) cycle(-1);
    if (pressed.has('left') && this.entryCursor > 0) this.entryCursor--;
    if (pressed.has('right') && this.entryCursor < NAME_LEN - 1) this.entryCursor++;

    for (const key of typed) {
      if (key === 'Enter') return this.commitName();
      if (key === 'Backspace') {
        if (name[this.entryCursor] === ' ' && this.entryCursor > 0) this.entryCursor--;
        name[this.entryCursor] = ' ';
      } else {
        // A suggested name is replaced as soon as you type.
        if (this.entryFresh) {
          name.fill(' ');
          this.entryCursor = 0;
        }
        name[this.entryCursor] = key;
        this.entryCursor = Math.min(NAME_LEN - 1, this.entryCursor + 1);
      }
      this.entryFresh = false;
      sfx.move();
    }
    if (pressed.size) this.entryFresh = false;
  }

  private commitName() {
    const name = this.entryName.join('').trim() || '------';
    const entry = this.tables[this.mode.id][this.entryRank];
    entry.name = name;
    saveTables(this.tables);
    save('encore.name', name);
    this.submitGlobal(this.mode.id, entry);
    this.phase = 'scores';
    this.timer = 0;
    sfx.choose();
  }

  private showScores() {
    this.refreshGlobal();
    this.phase = 'scores';
    this.timer = 0;
  }

  private stepScores({ pressed, tap }: Input) {
    if ((pressed.has('up') || pressed.has('down')) && this.global) {
      this.scoresGlobal = !this.scoresGlobal;
      sfx.move();
    }
    const d = (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0);
    if (d) {
      this.scoresView = (this.scoresView + d + MODES.length) % MODES.length;
      this.entryRank = this.globalRank = -1;
      sfx.move();
    }
    if (pressed.has('start') || pressed.has('back') || pressed.has('scores') || pressed.has('ok') || tap) this.toTitle();
  }

  // ---------- debug mode ----------

  /** L levels up, T jumps a minute on, B calls THE SILENCE's time, I heals to full, R rearranges, U calls a MUTE. */
  private debugKeys(typed: string[]) {
    const w = this.world!;
    for (const k of typed) {
      if (k === 'L') w.pending++;
      if (k === 'T') w.frames += 3600;
      if (k === 'B') w.frames = Math.max(w.frames, 10 * 3600 - 60);
      if (k === 'I') w.hp = w.maxHp;
      if (k === 'U') w.debugMute();
      if (k === 'R') {
        w.movesLeft += 2;
        this.arrange();
        return;
      }
    }
  }

  /** Beats a minute, for the intro card. */
  bpm() {
    return Math.round(3600 / (STEP_FRAMES[this.world?.gearLevel('tempo') ?? 0] * 4));
  }
}
