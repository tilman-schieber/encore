import { Game, Action, Input } from './game';
import { render, W, H } from './render';
import { unlockAudio, music } from './audio';
import { setupTouch, setupStick, TouchButton } from './touch';
import { loadSprites } from './sprites';
import { setupHidPad, padAxes } from './hidpad';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

const touchPanel = setupTouch(onTouch);
setupHidPad();

function resize() {
  const reserved = touchPanel ? touchPanel.el.offsetHeight + 8 : 0;
  const scale = Math.min(innerWidth / W, (innerHeight - reserved) / H);
  // Whole-number scaling keeps pixels crisp; phones may need a fractional fit.
  const s = scale >= 2 ? Math.floor(scale) : Math.max(0.5, scale);
  canvas.style.width = `${Math.floor(W * s)}px`;
  canvas.style.height = `${Math.floor(H * s)}px`;
}
addEventListener('resize', resize);
resize();

// By e.key so labels match any layout.
const ARROWS: Record<string, Action> = { arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right' };
const KEYS: Record<string, Action> = {
  ...ARROWS,
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  ' ': 'ok',
  z: 'ok',
  x: 'ok',
  enter: 'start',
  p: 'start',
  escape: 'back',
  backspace: 'quit',
  m: 'mute',
  h: 'scores',
};

const game = new Game();
// With ?debug the game is reachable from the console (and from browser tests).
if (game.debug) (window as unknown as { game: Game }).game = game;
const input: Input = { held: new Set(), pressed: new Set(), typed: [], stick: { x: 0, y: 0 }, tap: null };
/** Keys currently down: e.code -> lower-cased e.key at press time (key-up may report a different key). */
const heldKeys = new Map<string, string>();
const touchHeld = new Set<TouchButton>();

/** While typing a name, letters are letters. */
const actionFor = (key: string) => (game.phase === 'entry' ? ARROWS[key] ?? (key === 'enter' ? undefined : KEYS[key]) : KEYS[key]);

addEventListener('keydown', (e) => {
  unlockAudio();
  const key = e.key.toLowerCase();
  if (/^[a-z0-9]$/i.test(e.key) && !e.repeat) input.typed.push(e.key.toUpperCase());
  else if (e.key === 'Backspace' || (e.key === 'Enter' && !e.repeat)) input.typed.push(e.key);
  const a = actionFor(key);
  if (a || e.key === 'Backspace') e.preventDefault();
  heldKeys.set(e.code, key);
  if (!e.repeat && a) input.pressed.add(a);
});
addEventListener('keyup', (e) => heldKeys.delete(e.code));
// Any tap unlocks sound; mobile browsers only allow it after a gesture.
for (const ev of ['pointerdown', 'pointerup', 'touchend']) addEventListener(ev, unlockAudio, { passive: true });
addEventListener('blur', () => {
  heldKeys.clear();
  if (game.phase === 'play' && !game.paused) input.pressed.add('start');
});

function onTouch(b: TouchButton, down: boolean) {
  unlockAudio();
  if (!down) return void touchHeld.delete(b);
  touchHeld.add(b);
  input.pressed.add(b.a);
  if (b.typed) input.typed.push(b.typed);
}

setupStick(
  canvas,
  (x, y) => {
    input.stick.x = x;
    input.stick.y = y;
  },
  (x, y) => {
    const k = W / canvas.clientWidth;
    input.tap = { x: x * k, y: y * k };
  },
);

// Gamepads, in the standard mapping: d-pad or left stick to walk (the stick by how far it is
// pushed), A or X to choose, B goes back, Start pauses, Select quits from pause. Y opens the
// scores on the title screen. Typing a name: Up/Down pick a letter, A or Start enters it, B rubs one out.
const STICK = 0.4;
let padHeld = new Set<Action>();
let padStick = { x: 0, y: 0 };

function readPads() {
  const held = new Set<Action>();
  padStick = { x: 0, y: 0 };
  for (const pad of navigator.getGamepads?.() ?? []) {
    if (!pad) continue;
    const on = (i: number) => !!pad.buttons[i]?.pressed;
    if (on(0) || on(2)) held.add('ok');
    if (on(1)) held.add('back');
    if (on(3)) held.add(game.phase === 'title' ? 'scores' : 'ok');
    if (on(9)) held.add('start');
    if (on(8)) held.add('quit');
    const [x = 0, y = 0] = padAxes(pad);
    if (Math.hypot(x, y) > 0.2) padStick = { x, y };
    if (on(12) || y < -STICK) held.add('up');
    if (on(13) || y > STICK) held.add('down');
    if (on(14) || x < -STICK) held.add('left');
    if (on(15) || x > STICK) held.add('right');
  }
  return held;
}

function pollPads() {
  const pad = readPads();
  for (const a of pad) {
    input.held.add(a);
    if (padHeld.has(a)) continue;
    unlockAudio();
    if (game.phase === 'entry' && (a === 'ok' || a === 'start' || a === 'back')) {
      input.typed.push(a === 'back' ? 'Backspace' : 'Enter');
      continue;
    }
    input.pressed.add(a);
  }
  padHeld = pad;
}

function refreshHeld() {
  input.held.clear();
  for (const key of heldKeys.values()) {
    const a = actionFor(key);
    if (a) input.held.add(a);
  }
  for (const b of touchHeld) input.held.add(b.a);
  pollPads();
}

// Fixed 60 Hz simulation.
const STEP = 1000 / 60;
let acc = 0;
let last = performance.now();
let frame = 0;
/** Dev: the live loop is frozen while tests drive the game with sim(). */
let frozen = false;

function stepOnce() {
  refreshHeld();
  // An analog stick walks at the speed it is pushed, unless a finger is on the screen.
  const finger = { ...input.stick };
  if (!finger.x && !finger.y && (padStick.x || padStick.y)) input.stick = { ...padStick };
  game.step(input);
  input.stick = finger;
  input.pressed.clear();
  input.typed.length = 0;
  input.tap = null;
  frame++;
}

function loop(now: number) {
  if (frozen) {
    last = now;
    return void requestAnimationFrame(loop);
  }
  acc += Math.min(250, now - last);
  last = now;
  while (acc >= STEP) {
    stepOnce();
    acc -= STEP;
  }
  render(ctx, game, frame);
  touchPanel?.update(music.enabled);
  requestAnimationFrame(loop);
}

loadSprites();
requestAnimationFrame(loop);

if (import.meta.env.DEV) {
  Object.assign(window, {
    game,
    music,
    /** Runs n frames with these actions held (and pressed on the first), then draws. */
    sim: (n: number, held: Action[] = [], pressed: Action[] = []) => {
      frozen = true;
      for (let i = 0; i < n; i++) {
        game.step({ held: new Set(held), pressed: new Set(i === 0 ? pressed : []), typed: [], stick: { x: 0, y: 0 }, tap: null });
        frame++;
      }
      render(ctx, game, frame);
    },
    live: () => (frozen = false),
  });
}
