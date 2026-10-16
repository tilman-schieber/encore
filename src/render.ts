import { Game, MENU, MUSIC_NAMES, NAME_LEN, STARTERS, INTRO_FRAMES } from './game';
import { World, Enemy, Shot, Card, SET_FRAMES, sharedSteps } from './world';
import { INST, GEARS, INSTRUMENTS, MAX_LEVEL, InstId, shots, bpm, editable, linkText } from './band';
import { STEPS } from './song';
import { MODES } from './modes';
import { MAX_SCORES } from './scores';
import { HELP_PAGES, wrapText } from './help';
import { SPR, Sprite } from './sprites';
import { drawText, drawTextCentered, drawTextScaled, drawTextShadow, textWidth } from 'arcade-kit/font';
import { Ctx, WHITE, RED, GREY, LIGHT, DARK, YELLOW, BLUE, GREEN, drawBox, pad, hash } from 'arcade-kit/draw';

export const W = 256;
export const H = 224;

// ---------- the street ----------

const TILE = 32;
let tiles: HTMLCanvasElement[] = [];

/** Cobblestones under a night sky: a few tiles, picked per cell by a hash. */
function makeTiles() {
  tiles = [0, 1, 2, 3].map((v) => {
    const c = document.createElement('canvas');
    c.width = c.height = TILE;
    const g = c.getContext('2d')!;
    g.fillStyle = '#141428';
    g.fillRect(0, 0, TILE, TILE);
    // Stones in staggered rows.
    for (let row = 0; row < 4; row++)
      for (let col = -1; col < 4; col++) {
        const x = col * 8 + (row % 2) * 4, y = row * 8;
        const h = hash(v * 97 + row * 13 + col * 7);
        g.fillStyle = ['#1e1e3a', '#202040', '#1c1c34', '#22223e'][h % 4];
        g.fillRect(x + 1, y + 1, 6, 6);
        g.fillStyle = '#2a2a4c';
        g.fillRect(x + 1, y + 1, 5, 1);
      }
    if (v === 3) {
      // A drain grate.
      g.fillStyle = '#0c0c18';
      g.fillRect(10, 12, 12, 8);
      g.fillStyle = '#383858';
      for (let k = 0; k < 4; k++) g.fillRect(11 + k * 3, 13, 1, 6);
    }
    return c;
  });
}

type Decor = 'lamp' | 'bench' | 'puddle' | 'flowers' | 'chalk' | 'hydrant';
const DECOR_CELL = 96;

function decorAt(cx: number, cy: number): [Decor, number, number] | null {
  const h = hash(cx * 7919 + cy * 104729 + 17);
  if (h % 100 > 55) return null;
  const kinds: Decor[] = ['lamp', 'lamp', 'bench', 'puddle', 'flowers', 'chalk', 'hydrant'];
  return [kinds[(h >> 8) % kinds.length], cx * DECOR_CELL + 16 + ((h >> 12) % 64), cy * DECOR_CELL + 16 + ((h >> 18) % 64)];
}

function drawDecor(ctx: Ctx, kind: Decor, x: number, y: number, frame: number) {
  switch (kind) {
    case 'lamp': {
      // A pool of light, then the post.
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#f8d838';
      for (const r of [26, 20, 14]) {
        ctx.beginPath();
        ctx.ellipse(x, y + 2, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#383858';
      ctx.fillRect(x - 1, y - 18, 2, 20);
      ctx.fillStyle = '#585878';
      ctx.fillRect(x - 3, y - 20, 6, 2);
      ctx.fillStyle = (frame >> 6) % 17 === 0 ? '#a89838' : '#fce4a0';
      ctx.fillRect(x - 2, y - 18, 4, 2);
      ctx.fillStyle = '#0c0c18';
      ctx.fillRect(x - 2, y + 2, 4, 1);
      break;
    }
    case 'bench':
      ctx.fillStyle = '#5c3818';
      ctx.fillRect(x - 10, y - 4, 20, 2);
      ctx.fillRect(x - 10, y - 1, 20, 2);
      ctx.fillStyle = '#2c2c40';
      ctx.fillRect(x - 9, y + 1, 2, 3);
      ctx.fillRect(x + 7, y + 1, 2, 3);
      break;
    case 'puddle':
      ctx.fillStyle = '#28305c';
      ctx.beginPath();
      ctx.ellipse(x, y, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4858a0';
      ctx.fillRect(x - 5 + ((frame >> 5) % 3), y - 1, 4, 1);
      break;
    case 'flowers':
      ctx.fillStyle = '#3c2c1c';
      ctx.fillRect(x - 8, y - 3, 16, 6);
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = ['#f83800', '#f8d838', '#f878f8', '#fcfcfc'][k];
        ctx.fillRect(x - 6 + k * 4, y - 4 + (k % 2), 2, 2);
      }
      break;
    case 'chalk': {
      // Somebody drew a star and a note on the stones.
      ctx.fillStyle = '#5858a0';
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k * Math.PI * 4) / 5;
        ctx.fillRect(Math.round(x + Math.cos(a) * 6), Math.round(y + Math.sin(a) * 6), 2, 2);
      }
      ctx.fillRect(x + 10, y - 4, 1, 6);
      ctx.fillRect(x + 8, y + 1, 3, 2);
      break;
    }
    case 'hydrant':
      ctx.fillStyle = '#a81000';
      ctx.fillRect(x - 2, y - 6, 5, 7);
      ctx.fillRect(x - 3, y - 4, 7, 2);
      ctx.fillStyle = '#f83800';
      ctx.fillRect(x - 1, y - 7, 3, 2);
      break;
  }
}

function drawGround(ctx: Ctx, cx: number, cy: number, frame: number) {
  if (!tiles.length) makeTiles();
  const x0 = Math.floor(cx / TILE), y0 = Math.floor(cy / TILE);
  for (let ty = y0; ty <= y0 + Math.ceil(H / TILE); ty++)
    for (let tx = x0; tx <= x0 + Math.ceil(W / TILE); tx++) {
      const h = hash(tx * 31337 + ty * 7331);
      ctx.drawImage(tiles[h % 23 === 0 ? 3 : h % 3], tx * TILE - cx, ty * TILE - cy);
    }
  const d0x = Math.floor((cx - 40) / DECOR_CELL), d0y = Math.floor((cy - 40) / DECOR_CELL);
  for (let dy = d0y; dy <= d0y + 3; dy++)
    for (let dx = d0x; dx <= d0x + 3; dx++) {
      const d = decorAt(dx, dy);
      if (d) drawDecor(ctx, d[0], d[1] - cx, d[2] - cy, frame);
    }
}

// ---------- things on the street ----------

function blit(ctx: Ctx, s: Sprite, x: number, y: number, flip = false, white = false) {
  ctx.drawImage(white ? s.white : flip ? s.flip : s.img, Math.round(x - s.w / 2), Math.round(y - s.h / 2));
}

function circle(ctx: Ctx, x: number, y: number, r: number, color: string, gap = 2, phase = 0) {
  ctx.fillStyle = color;
  const n = Math.max(8, Math.floor((Math.PI * 2 * r) / gap));
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + phase;
    ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1);
  }
}

function drawEnemy(ctx: Ctx, e: Enemy, x: number, y: number, frame: number) {
  const white = e.flash > 0;
  const anim = ((frame + e.id * 5) >> 4) % 2;
  switch (e.kind) {
    case 'shh':
      blit(ctx, SPR.shh[anim], x, y + (anim ? 0 : -1), e.flip, white);
      break;
    case 'static': {
      // A ball of TV snow with two eyes.
      for (let dy = -4; dy < 4; dy++)
        for (let dx = -4; dx < 4; dx++) {
          if (dx * dx + dy * dy > 15) continue;
          const v = hash(frame * 131 + e.id * 977 + dx * 31 + dy * 7) % 4;
          ctx.fillStyle = white ? WHITE : ['#585858', '#a0a0a0', '#d8d8d8', '#303030'][v];
          ctx.fillRect(Math.round(x) + dx, Math.round(y) + dy, 1, 1);
        }
      ctx.fillStyle = '#f83800';
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 1, 1, 1);
      ctx.fillRect(Math.round(x) + 1, Math.round(y) - 1, 1, 1);
      break;
    }
    case 'plug':
      blit(ctx, SPR.plug[anim], x, y, e.flip, white);
      break;
    case 'heckler':
      blit(ctx, SPR.heckler[e.t % 160 > 140 ? 1 : 0], x, y, e.flip, white);
      break;
    case 'mute': {
      blit(ctx, SPR.mute[anim], x, y, e.flip, white);
      if (e.mute) {
        // Its part above it, crossed out.
        const c = INST[e.mute].color;
        blit(ctx, SPR.note.white, x, y - 12);
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(x) - 3, Math.round(y) - 15, 6, 6);
        ctx.fillStyle = RED;
        for (let k = 0; k < 7; k++) ctx.fillRect(Math.round(x) - 4 + k, Math.round(y) - 16 + k, 1, 1);
      }
      break;
    }
    case 'feedback': {
      const screech = e.mode === 1 && (frame >> 1) % 2 === 0;
      blit(ctx, SPR.feedback[0], x + (e.mode === 1 ? (frame % 2) - 0.5 : 0), y, e.flip, white || screech);
      if (e.mode === 1) circle(ctx, x, y, 8 + (e.t % 10), '#f83800', 3, frame * 0.1);
      break;
    }
    case 'neighbor': {
      const lift = e.mode === 1 && e.t < 40 ? -Math.min(4, e.t / 6) : 0;
      blit(ctx, SPR.neighbor[0], x, y + lift, e.flip, white);
      break;
    }
    case 'silence': {
      // A hole in the night with one eye, and a ring of nothing round it.
      const r = e.r + Math.sin(frame / 12) * 1.5;
      ctx.fillStyle = white ? '#383838' : '#000000';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      circle(ctx, x, y, r + 1, WHITE, 2, frame / 30);
      circle(ctx, x, y, r + 5, '#585878', 4, -frame / 45);
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.ellipse(x, y - 2, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f83800';
      ctx.fillRect(Math.round(x + e.dx * 3) - 1, Math.round(y - 2 + e.dy * 1.5) - 1, 3, 3);
      break;
    }
  }
}

/** The colour of a note on the ground, by what it is worth. */
const gemSprite = (v: number) => (v >= 25 ? SPR.note.gold : v >= 5 ? SPR.note.green : SPR.note.white);

function drawShot(ctx: Ctx, s: Shot, cx: number, cy: number) {
  const x = s.x - cx, y = s.y - cy;
  if (s.echo) ctx.globalAlpha = 0.55;
  const sp = Math.hypot(s.vx, s.vy) || 1;
  const ux = s.vx / sp, uy = s.vy / sp;
  switch (s.kind) {
    case 'bolt':
      ctx.fillStyle = '#7c7c7c';
      for (let k = 2; k < 6; k++) ctx.fillRect(Math.round(x - ux * k), Math.round(y - uy * k), 1, 1);
      ctx.fillStyle = WHITE;
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      break;
    case 'needle':
      ctx.fillStyle = YELLOW;
      for (let k = 0; k < 4; k++) ctx.fillRect(Math.round(x - ux * k), Math.round(y - uy * k), 1, 1);
      break;
    case 'wave': {
      const a0 = Math.atan2(uy, ux);
      for (let k = -8; k <= 8; k++) {
        const a = a0 + k * 0.11;
        ctx.fillStyle = Math.abs(k) > 6 ? '#583898' : '#a858f8';
        ctx.fillRect(Math.round(x + Math.cos(a) * s.r - ux * s.r), Math.round(y + Math.sin(a) * s.r - uy * s.r), 2, 2);
        ctx.fillStyle = '#e0b8fc';
        if (Math.abs(k) < 5) ctx.fillRect(Math.round(x + Math.cos(a) * (s.r + 2) - ux * s.r), Math.round(y + Math.sin(a) * (s.r + 2) - uy * s.r), 1, 1);
      }
      break;
    }
    case 'note':
      blit(ctx, SPR.note.blue, x, y);
      break;
  }
  ctx.globalAlpha = 1;
}

/** Frames since the ARP last played, so its notes flash when they strike. */
let arpFlash = 0;
/** Which way the busker faces, kept while standing still. */
let faceLeft = false;

export function renderWorld(ctx: Ctx, w: World, frame: number) {
  ctx.save();
  if (w.shake > 0) ctx.translate((frame % 2 ? 1 : -1) * Math.min(3, w.shake >> 1), (frame % 3) - 1);
  const cx = w.camX, cy = w.camY;
  drawGround(ctx, cx, cy, frame);

  // The PAD's chord round the busker.
  const pr = w.padRadius;
  if (pr) {
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#f878f8';
    ctx.beginPath();
    ctx.arc(w.px - cx, w.py - cy, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    circle(ctx, w.px - cx, w.py - cy, pr, '#a848a8', 4, frame / 40);
  }

  for (const g of w.gems) blit(ctx, gemSprite(g.value), g.x - cx, g.y - cy + (g.pulled ? 0 : Math.sin((frame + g.x) / 10)));
  for (const p of w.pickups) {
    const s = p.kind === 'tea' ? SPR.tea : p.kind === 'mic' ? SPR.mic : SPR.record;
    blit(ctx, s, p.x - cx, p.y - cy + Math.sin(frame / 8) * 1.5);
  }

  // Enemies and the busker, back to front.
  const order: (Enemy | null)[] = [...w.enemies, null];
  order.sort((a, b) => (a ? a.y : w.py) - (b ? b.y : w.py));
  if (Math.abs(w.fx) > 0.2) faceLeft = w.fx < 0;
  for (const e of order) {
    if (e) {
      drawEnemy(ctx, e, e.x - cx, e.y - cy, frame);
      // STUN: stars round the head; WEIGHT: a heavy blue line underfoot.
      if (e.stun > 0) for (let k = 0; k < 3; k++) {
        const a = frame * 0.15 + (k * Math.PI * 2) / 3;
        ctx.fillStyle = YELLOW;
        ctx.fillRect(Math.round(e.x - cx + Math.cos(a) * 5), Math.round(e.y - cy - e.r - 3 + Math.sin(a) * 1.5), 1, 1);
      }
      if (e.slowT > 0) {
        ctx.fillStyle = '#a858f8';
        ctx.fillRect(Math.round(e.x - cx - e.r), Math.round(e.y - cy + e.r + 1), e.r * 2, 1);
      }
      continue;
    }
    if (w.state === 'dead') continue;
    const blink = w.iframes > 0 && (frame >> 2) % 2 === 0;
    if (!blink) blit(ctx, SPR.busker[w.moving ? (frame >> 3) % 2 : 0], w.px - cx, w.py - cy - 4, faceLeft);
    if (w.hp < w.maxHp) {
      const bx = Math.round(w.px - cx - 7), by = Math.round(w.py - cy + 6);
      ctx.fillStyle = '#000';
      ctx.fillRect(bx - 1, by - 1, 16, 4);
      ctx.fillStyle = '#a81000';
      ctx.fillRect(bx, by, 14, 2);
      ctx.fillStyle = w.hp / w.maxHp > 0.3 ? GREEN : RED;
      ctx.fillRect(bx, by, Math.ceil((14 * w.hp) / w.maxHp), 2);
    }
  }

  // The ARP's notes in orbit.
  if (w.notes.some((n) => n.inst === 'arp')) arpFlash = 4;
  else if (arpFlash > 0) arpFlash--;
  for (const [ox, oy] of w.orbiters()) blit(ctx, arpFlash > 0 ? SPR.note.lime : SPR.note.green, ox - cx, oy - cy, false, arpFlash > 2);

  for (const s of w.shots) drawShot(ctx, s, cx, cy);
  for (const b of w.bullets) {
    const x = b.x - cx, y = b.y - cy;
    if (b.kind === 'tomato') blit(ctx, SPR.tomato, x, y);
    else if (b.kind === 'rest') blit(ctx, SPR.rest, x, y);
    else {
      ctx.fillStyle = (frame >> 1) % 2 ? '#fca044' : WHITE;
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 3, 5);
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 1, 5, 3);
    }
  }
  for (const r of w.rings) {
    ctx.globalAlpha = Math.min(1, r.life / 8);
    circle(ctx, r.x - cx, r.y - cy, r.r, r.color, 2);
    ctx.globalAlpha = 1;
  }
  for (const p of w.particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), 1, 1);
  }
  for (const p of w.popups) {
    const tw = textWidth(p.text);
    drawTextShadow(ctx, p.text, Math.round(p.x - cx - tw / 2), Math.round(p.y - cy), (p.life >> 2) % 2 ? p.color : WHITE);
  }
  ctx.restore();
  if (w.flash > 0) {
    ctx.globalAlpha = Math.min(0.6, w.flash / 10);
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

// ---------- the HUD ----------

const clinkText = (sec: number) => `${pad(Math.floor(sec / 60), 2)}:${pad(Math.floor(sec % 60), 2)}`;

/** The band as a step sequencer: a row per instrument, the bar now playing, the step lit. */
function drawSequencer(ctx: Ctx, w: World, x: number, y: number, frame: number) {
  const rows = w.instruments.length;
  const bar0 = Math.max(0, w.step) - w.barStep;
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 2, y - 2, 74, rows * 4 + 3);
  ctx.globalAlpha = 1;
  const muted = w.muted();
  const pats = w.patterns();
  const links = [...Array(STEPS).keys()].map((k) => w.linksAt(k, pats, muted));
  w.instruments.forEach((s, r) => {
    const def = INST[s.id];
    const off = muted.has(s.id);
    const pat = pats.get(s.id);
    for (let k = 0; k < STEPS; k++) {
      const on = pat ? pat.has(k) : shots(s.id, s.lv, bar0 + k, w.song) > 0;
      const now = k === w.barStep;
      // A linked step blinks.
      const blink = links[k].has(s.id) && (frame >> 3) % 2 === 0;
      const lit = off ? '#383838' : blink ? (def.color === WHITE ? GREY : WHITE) : def.color;
      ctx.fillStyle = on ? (now && !off ? YELLOW : lit) : now ? '#585858' : '#202030';
      ctx.fillRect(x + 6 + k * 4 + (k >> 2), y + r * 4, 3, 3);
    }
    ctx.fillStyle = off ? RED : def.color;
    ctx.fillRect(x, y + r * 4, 3, 3);
  });
}

function drawHud(ctx: Ctx, w: World, frame: number) {
  // Notes to the next level.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, 4);
  ctx.fillStyle = BLUE;
  ctx.fillRect(1, 1, Math.floor(((W - 2) * w.xp) / w.xpNext), 2);
  drawTextShadow(ctx, `LV ${w.level}`, 3, 6, WHITE);
  const clock = w.mode === 'set' ? Math.max(0, SET_FRAMES / 60 - w.time) : w.time;
  const ct = clinkText(clock);
  drawTextShadow(ctx, ct, Math.round(W / 2 - textWidth(ct) / 2), 6, w.mode === 'set' && clock < 30 && (frame >> 4) % 2 ? RED : WHITE);
  const sc = pad(w.score, 7);
  drawTextShadow(ctx, sc, W - 3 - textWidth(sc), 6, LIGHT);

  if (w.boss) {
    const name = w.boss.kind === 'silence' ? 'THE SILENCE' : 'THE NEIGHBOR';
    drawTextShadow(ctx, name, Math.round(W / 2 - textWidth(name) / 2), 16, w.boss.kind === 'silence' ? WHITE : '#f878f8');
    ctx.fillStyle = '#000';
    ctx.fillRect(W / 2 - 61, 25, 122, 4);
    ctx.fillStyle = RED;
    ctx.fillRect(W / 2 - 60, 26, Math.ceil((120 * Math.max(0, w.boss.hp)) / w.boss.maxHp), 2);
  }

  if (w.warning && (w.warning[1] >> 3) % 2 === 0) {
    const [text] = w.warning;
    const tw = textWidth(text) * 2;
    ctx.fillStyle = '#000';
    ctx.fillRect(W / 2 - tw / 2 - 4, 58, tw + 8, 20);
    drawTextScaled(ctx, text, Math.round(W / 2 - tw / 2), 61, 2, RED);
  }

  drawSequencer(ctx, w, 4, H - 4 - w.instruments.length * 4, frame);
  // ENCORE hearts left, bottom right.
  for (let k = 0; k < w.revives; k++) drawTextShadow(ctx, '*', W - 10 - k * 8, H - 11, YELLOW);
}

// ---------- level up ----------

/** A sixteen-step pattern, drawn small, of an instrument at a level (the first bar). */
function drawPattern(ctx: Ctx, w: World, id: InstId, lv: number, x: number, y: number) {
  const pat = editable(id) ? w.pattern(id, lv) : null;
  for (let k = 0; k < STEPS; k++) {
    const on = pat ? pat.has(k) : shots(id, lv, k, w.song) > 0;
    ctx.fillStyle = on ? INST[id].color : '#303040';
    ctx.fillRect(x + k * 4 + (k >> 2), y, 3, 3);
  }
}

function cardText(c: Card, w: World): [string, string, string, string] {
  switch (c.kind) {
    case 'inst': {
      const d = INST[c.id];
      return [d.name, c.lv === 1 ? 'NEW!' : `LV ${c.lv}`, d.levels[c.lv - 1], d.color];
    }
    case 'gear': {
      const d = GEARS[c.id];
      return [d.name, c.lv === 1 ? 'NEW!' : `LV ${c.lv}`, d.levels[0], LIGHT];
    }
    case 'tea':
      return ['HOT TEA', '', 'HEALS 50', GREEN];
    case 'tips':
      return ['TIP JAR', '', '+1000 POINTS', YELLOW];
    case 'link':
      return ['LINK', `${INST[c.a].name} + ${INST[c.b].name}`, `${linkText(c.a, c.b)}. ON ${sharedSteps(w, c.a, c.b).length} STEPS A BAR`, WHITE];
  }
}

/** The two parts of a LINK card, one row each, the steps they play together joined by a white bar. */
function drawLink(ctx: Ctx, w: World, a: InstId, b: InstId, x: number, y: number) {
  const pa = w.pattern(a), pb = w.pattern(b);
  for (let k = 0; k < STEPS; k++) {
    const sx = x + k * 4 + (k >> 2);
    ctx.fillStyle = pa.has(k) ? INST[a].color : '#303040';
    ctx.fillRect(sx, y, 3, 3);
    ctx.fillStyle = pb.has(k) ? INST[b].color : '#303040';
    ctx.fillRect(sx, y + 6, 3, 3);
    if (pa.has(k) && pb.has(k)) {
      ctx.fillStyle = WHITE;
      ctx.fillRect(sx + 1, y + 3, 1, 3);
    }
  }
}

function renderLevelUp(ctx: Ctx, game: Game, frame: number) {
  const w = game.world!;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, W, H);
  drawBox(ctx, 64, 22, 128, 24);
  drawTextCentered(ctx, 'LEVEL UP!', W / 2, 30, (frame >> 3) % 2 ? YELLOW : WHITE);
  game.cards.forEach((c, i) => {
    const y = 52 + i * 46;
    const on = i === game.cardRow;
    drawBox(ctx, 12, y, 232, 42);
    if (on) {
      ctx.strokeStyle = YELLOW;
      ctx.lineWidth = 1;
      ctx.strokeRect(13.5, y + 1.5, 229, 39);
    }
    const [name, lv, desc, color] = cardText(c, w);
    ctx.fillStyle = color;
    ctx.fillRect(20, y + 8, 6, 6);
    drawText(ctx, name, 30, y + 8, on ? WHITE : LIGHT);
    drawText(ctx, lv, 30 + textWidth(name) + 6, y + 8, lv === 'NEW!' ? YELLOW : GREY);
    if (c.kind === 'inst') drawPattern(ctx, w, c.id, c.lv, 166, y + 10);
    if (c.kind === 'link') drawLink(ctx, w, c.a, c.b, 166, y + 7);
    wrapText([desc], 35).slice(0, 2).forEach((line, k) => drawText(ctx, line, 20, y + 19 + k * 9, on ? LIGHT : GREY));
  });
  drawBox(ctx, 12, 192, 232, 24);
  drawTextCentered(ctx, 'UP DOWN CHOOSE   ENTER TAKE', W / 2, 200, LIGHT);
}

// ---------- screens ----------

function dim(ctx: Ctx, k = 0.6) {
  ctx.fillStyle = `rgba(0,0,0,${k})`;
  ctx.fillRect(0, 0, W, H);
}

function backdrop(ctx: Ctx, game: Game, frame: number) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (game.attract) renderWorld(ctx, game.attract, frame);
  dim(ctx);
}

const LOGO_COLORS = INSTRUMENTS.map((d) => d.color);

function drawLogo(ctx: Ctx, frame: number, y: number) {
  const word = 'ENCORE';
  const scale = 4;
  const x0 = Math.round(W / 2 - (textWidth(word) * scale) / 2);
  // The letters jump to a beat, one after another.
  const beat = Math.floor(frame / 8);
  [...word].forEach((ch, i) => {
    const up = beat % 8 === i ? -2 : 0;
    drawTextScaled(ctx, ch, x0 + i * 6 * scale + 1, y + up + 1, scale, '#000');
    drawTextScaled(ctx, ch, x0 + i * 6 * scale, y + up, scale, LOGO_COLORS[(i + (beat >> 3)) % LOGO_COLORS.length]);
  });
}

function renderTitle(ctx: Ctx, game: Game, frame: number) {
  const s = game.settings;
  backdrop(ctx, game, frame);
  drawLogo(ctx, frame, 14);
  drawTextCentered(ctx, 'EVERY WEAPON IS AN INSTRUMENT', W / 2, 48, LIGHT);

  drawBox(ctx, 32, 62, 192, 74);
  const values: Record<(typeof MENU)[number], [string, string]> = {
    MODE: [MODES[s.mode].name, WHITE],
    START: [INST[STARTERS[s.start]].name, INST[STARTERS[s.start]].color],
    SEED: [s.daily ? 'DAILY' : 'RANDOM', WHITE],
    MUSIC: [MUSIC_NAMES[s.music], WHITE],
    HELP: ['HOW TO PLAY', WHITE],
  };
  MENU.forEach((row, i) => {
    const y = 72 + i * 12;
    const on = i === game.menuRow;
    if (on) drawText(ctx, '>', 42, y, YELLOW);
    drawText(ctx, row, 52, y, on ? YELLOW : WHITE);
    const [v, col] = values[row];
    drawText(ctx, v, 112, y, on ? col : col === WHITE ? LIGHT : col);
    if (on && row !== 'HELP') {
      drawText(ctx, '<', 104, y, GREY);
      drawText(ctx, '>', 114 + textWidth(v), y, GREY);
    }
  });

  drawBox(ctx, 16, 142, 224, 76);
  drawTextCentered(ctx, game.mode.blurb, W / 2, 150, YELLOW);
  const best = game.best();
  drawTextCentered(ctx, best ? `TOP ${pad(best.score, 7)} ${best.name}` : 'NO RECORD YET', W / 2, 162, RED);
  drawTextCentered(ctx, `START WITH THE ${INST[STARTERS[s.start]].name}`, W / 2, 174, GREY);
  if ((frame >> 5) % 2 === 0) drawTextCentered(ctx, 'ENTER START  H SCORES  M MUSIC', W / 2, 189, WHITE);
  drawTextCentered(ctx, 'ARROWS WALK. THE BAND PLAYS ITSELF.', W / 2, 202, GREY);
}

function renderIntro(ctx: Ctx, game: Game, frame: number) {
  const w = game.world!;
  renderWorld(ctx, w, frame);
  const k = Math.min(1, (INTRO_FRAMES - game.timer) / 20);
  ctx.globalAlpha = Math.max(0, k);
  drawBox(ctx, 40, 70, 176, 64);
  drawTextCentered(ctx, game.settings.daily ? "TODAY'S SONG" : 'TONIGHT YOU PLAY', W / 2, 80, GREY);
  drawTextScaled(ctx, w.song.key, Math.round(W / 2 - textWidth(w.song.key)), 92, 2, YELLOW);
  drawTextCentered(ctx, `${bpm(0)} BPM - ${INST[w.instruments[0].id].name} TO START`, W / 2, 115, LIGHT);
  ctx.globalAlpha = 1;
}

function renderPause(ctx: Ctx, game: Game) {
  const w = game.world!;
  dim(ctx, 0.7);
  drawBox(ctx, 28, 24, 200, 168);
  drawTextCentered(ctx, 'PAUSED', W / 2, 34, YELLOW);
  drawText(ctx, 'THE BAND', 40, 50, GREY);
  w.instruments.forEach((s, i) => {
    const d = INST[s.id];
    drawText(ctx, d.name, 40, 62 + i * 10, d.color);
    drawText(ctx, s.lv >= MAX_LEVEL ? 'MAX' : `LV ${s.lv}`, 84, 62 + i * 10, LIGHT);
  });
  drawText(ctx, 'GEAR', 136, 50, GREY);
  w.gear.forEach((s, i) => {
    drawText(ctx, GEARS[s.id].name, 136, 62 + i * 10, WHITE);
    drawText(ctx, `${s.lv}`, 196, 62 + i * 10, LIGHT);
  });
  drawText(ctx, `HUSH SILENCED ${w.kills}`, 40, 130, LIGHT);
  drawText(ctx, `SONG ${w.song.key}`, 40, 142, LIGHT);
  drawTextCentered(ctx, 'ENTER RESUME', W / 2, 164, WHITE);
  drawTextCentered(ctx, 'BACKSPACE QUIT', W / 2, 176, GREY);
}

function renderOver(ctx: Ctx, game: Game, frame: number) {
  const w = game.world!;
  renderWorld(ctx, w, frame);
  if (game.timer < 40) return;
  dim(ctx, 0.6);
  const won = w.state === 'won';
  drawBox(ctx, 24, 28, 208, 160);
  if (won) drawTextScaled(ctx, 'ENCORE!', Math.round(W / 2 - textWidth('ENCORE!')), 38, 2, (frame >> 3) % 2 ? YELLOW : WHITE);
  else drawTextCentered(ctx, 'THE CROWD WENT QUIET', W / 2, 42, RED);
  const rows: [string, string][] = [
    ['TIME', clinkText(w.time)],
    ['LEVEL', String(w.level)],
    ['HUSH SILENCED', String(w.kills)],
    ['SCORE', String(w.score)],
  ];
  rows.forEach(([k, v], i) => {
    drawText(ctx, k, 40, 64 + i * 12, LIGHT);
    drawText(ctx, v, 216 - textWidth(v), 64 + i * 12, WHITE);
  });
  drawText(ctx, 'YOUR BAND', 40, 118, GREY);
  w.instruments.forEach((s, i) => {
    const d = INST[s.id];
    const x = 40 + (i % 3) * 60, y = 130 + Math.floor(i / 3) * 12;
    drawText(ctx, `${d.name} ${s.lv}`, x, y, d.color);
  });
  if (game.timer > 90 && (frame >> 4) % 2 === 0) drawTextCentered(ctx, 'PRESS ENTER', W / 2, 170, WHITE);
}

function renderScores(ctx: Ctx, game: Game, frame: number) {
  const entering = game.phase === 'entry';
  const mode = MODES[game.scoresView];
  backdrop(ctx, game, frame);
  drawBox(ctx, 24, 8, 208, 176);
  const world = game.scoresGlobal && !entering && !!game.global;
  const title = entering ? 'NEW RECORD!' : world ? 'WORLD SCORES' : 'LOCAL SCORES';
  drawTextCentered(ctx, title, W / 2, 16, entering ? YELLOW : WHITE);
  drawTextCentered(ctx, entering ? mode.name : `< ${mode.name} >`, W / 2, 27, entering ? LIGHT : GREY);
  const cols: [string, number][] = [['NAME', 48], ['SCORE', 92], ['TIME', 148], ['LV', 190]];
  for (const [label, x] of cols) drawText(ctx, label, x, 40, GREY);
  ctx.fillStyle = '#585858';
  ctx.fillRect(34, 49, 188, 1);

  const blink = (frame >> 4) % 2 === 0;
  const list = world ? (game.global?.[mode.id] ?? []) : game.tables[mode.id];
  const myRow = game.scoresView === game.settings.mode ? (world ? game.globalRank : game.entryRank) : -1;
  for (let i = 0; i < MAX_SCORES; i++) {
    const y = 54 + i * 12;
    const e = list[i];
    const mine = i === myRow;
    const col = mine ? (entering || blink ? YELLOW : WHITE) : i < 3 ? WHITE : LIGHT;
    const n = String(i + 1);
    drawText(ctx, n, 43 - textWidth(n), y, mine ? col : GREY);
    if (!e) {
      drawText(ctx, '------', 48, y, DARK);
      continue;
    }
    if (mine && entering) {
      drawText(ctx, game.entryName.join(''), 48, y, col);
      if (blink) {
        ctx.fillStyle = WHITE;
        ctx.fillRect(48 + game.entryCursor * 6, y + 8, 5, 1);
      }
    } else drawText(ctx, e.name.slice(0, NAME_LEN), 48, y, col);
    drawText(ctx, pad(e.score, 8), 92, y, col);
    drawText(ctx, clinkText(e.time), 148, y, e.won ? YELLOW : col);
    drawText(ctx, String(e.level), 190, y, col);
  }
  drawBox(ctx, 24, 190, 208, 24);
  if (entering) drawTextCentered(ctx, 'TYPE NAME  THEN ENTER', W / 2, 198);
  else drawTextCentered(ctx, game.global ? `UP ${world ? 'LOCAL' : 'WORLD'}  < > MODE  ENTER BACK` : '< > MODE   ENTER BACK', W / 2, 198, blink ? WHITE : LIGHT);
}

function renderHelp(ctx: Ctx, game: Game, frame: number) {
  const page = HELP_PAGES[game.helpPage];
  backdrop(ctx, game, frame);
  drawBox(ctx, 4, 4, 248, 186);
  drawTextCentered(ctx, `< ${page.title} >`, W / 2, 12, YELLOW);
  ctx.fillStyle = '#585858';
  ctx.fillRect(14, 23, 228, 1);
  wrapText(page.text, 38).forEach((line, i) => drawText(ctx, line, 14, 30 + i * 10, line.includes('  ') ? LIGHT : WHITE));
  drawBox(ctx, 4, 194, 248, 24);
  const blink = (frame >> 4) % 2 === 0;
  drawTextCentered(ctx, `< > PAGE ${game.helpPage + 1}/${HELP_PAGES.length}   ENTER BACK`, W / 2, 202, blink ? WHITE : LIGHT);
}

export function render(ctx: Ctx, game: Game, frame: number) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  switch (game.phase) {
    case 'title':
      return renderTitle(ctx, game, frame);
    case 'intro':
      return renderIntro(ctx, game, frame);
    case 'play':
      renderWorld(ctx, game.world!, frame);
      drawHud(ctx, game.world!, frame);
      if (game.paused) renderPause(ctx, game);
      return;
    case 'levelup':
      renderWorld(ctx, game.world!, frame);
      drawHud(ctx, game.world!, frame);
      return renderLevelUp(ctx, game, frame);
    case 'over':
      return renderOver(ctx, game, frame);
    case 'entry':
    case 'scores':
      return renderScores(ctx, game, frame);
    case 'help':
      return renderHelp(ctx, game, frame);
  }
}

