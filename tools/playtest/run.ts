// Headless balance runs: the demo busker plays whole runs, and we print how they went.
// npm run playtest -- [runs] [mode]
import { World, Card, autopilot, pickCard, tune } from '../../src/world';
import { makeRng } from '../../src/rng';
import { makeSong } from '../../src/song';
import { STARTERS } from '../../src/game';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const runs = Number(args[0] ?? 8);
const mode = (args[1] ?? 'set') as 'set' | 'endless';
const cap = 60 * 60 * (mode === 'set' ? 13 : 20);
if (args[2]) tune(Number(args[2]), Number(args[3]));
const brief = process.argv.includes('--brief');
// --first takes the first card, --random any card; by default the busker picks like a player.
const pick = (w: World, cards: Card[]) =>
  process.argv.includes('--first') ? cards[0] : process.argv.includes('--random') ? cards[Math.floor(w.rng() * cards.length)] : pickCard(w, cards);
const tally = { won: 0, dead: 0, play: 0 };
const lows: number[] = [];
const share: Record<string, number[]> = {};
for (let seed = 1; seed <= runs; seed++) {
  const w = new World({ rng: makeRng(seed), song: makeSong(seed), mode, start: STARTERS[seed % STARTERS.length] });
  const t0 = performance.now();
  let peak = 0, slowest = 0, low = 1, bossAt = 0;
  const minutes: string[] = [];
  while (w.state === 'play' && w.frames < cap) {
    while (w.pending > 0) w.choose(pick(w, w.offer()));
    const f0 = performance.now();
    w.update(autopilot(w));
    slowest = Math.max(slowest, performance.now() - f0);
    peak = Math.max(peak, w.enemies.length);
    low = Math.min(low, w.hp / w.maxHp);
    if (!bossAt && w.boss?.kind === 'silence') bossAt = w.frames;
    if (w.frames % 3600 === 0) minutes.push(`${w.frames / 3600}m:lv${w.level}:${Math.round((100 * w.hp) / w.maxHp)}%`);
  }
  const ms = (performance.now() - t0) / w.frames;
  console.log(
    `seed ${seed} ${w.instruments[0].id.padEnd(5)} ${w.state.padEnd(4)} t=${(w.time / 60).toFixed(2)}m lv=${w.level} kills=${w.kills} score=${w.score} low=${Math.round(low * 100)}% boss=${bossAt ? Math.round((w.frames - bossAt) / 60) + 's' : '-'} peak=${peak} ${ms.toFixed(3)}ms/f max ${slowest.toFixed(1)}ms`,
  );
  if (brief) console.log('   ', minutes.join(' '));
  else console.log('   ', minutes.join(' '), '|', w.instruments.map((s) => s.id + s.lv).join(' '), '|', w.gear.map((s) => s.id + s.lv).join(' '));
  tally[w.state as keyof typeof tally]++;
  lows.push(low);
  const boss = w.enemies.find((e) => e.kind === 'silence' && e.hp > 0);
  if (boss && mode === 'set') console.log(`    the silence still has ${Math.round((100 * boss.hp) / boss.maxHp)}%`);
  const total = Object.values(w.dealt).reduce((a, b) => a + b, 0) || 1;
  const parts = Object.entries(w.dealt).sort((a, b) => b[1] - a[1]);
  for (const [id, d] of parts) (share[id] ??= []).push(d / total);
  if (!brief) {
    console.log('    dealt', parts.map(([id, d]) => `${id} ${Math.round((100 * d) / total)}%`).join(' '));
    console.log('    taken', Object.entries(w.taken).sort((a, b) => b[1] - a[1]).map(([k, d]) => `${k} ${d}`).join(' '));
  }
}
console.log(`\n${mode}: won ${tally.won}, died ${tally.dead}, still playing ${tally.play} of ${runs}`);
lows.sort((a, b) => a - b);
console.log(`lowest health: median ${Math.round(lows[lows.length >> 1] * 100)}%`);
console.log('share of damage when held:', Object.entries(share).map(([id, v]) => `${id} ${Math.round((100 * v.reduce((a, b) => a + b, 0)) / v.length)}% (${v.length})`).join(' '));
