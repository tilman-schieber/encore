// Headless balance runs: the demo busker plays whole runs, and we print how they went.
// npm run playtest -- [runs] [mode]
import { World, autopilot, tune } from '../../src/world';
import { makeRng } from '../../src/rng';
import { makeSong } from '../../src/song';
import { STARTERS } from '../../src/game';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const runs = Number(args[0] ?? 8);
const mode = (args[1] ?? 'set') as 'set' | 'endless';
const cap = 60 * 60 * (mode === 'set' ? 11 : 20);
if (args[2]) tune(Number(args[2]), Number(args[3]));
const brief = process.argv.includes('--brief');
for (let seed = 1; seed <= runs; seed++) {
  const w = new World({ rng: makeRng(seed), song: makeSong(seed), mode, start: STARTERS[seed % STARTERS.length] });
  const t0 = performance.now();
  let peak = 0, slowest = 0;
  const minutes: string[] = [];
  while (w.state === 'play' && w.frames < cap) {
    while (w.pending > 0) w.choose(w.offer()[0]);
    const f0 = performance.now();
    w.update(autopilot(w));
    slowest = Math.max(slowest, performance.now() - f0);
    peak = Math.max(peak, w.enemies.length);
    if (w.frames % 3600 === 0) minutes.push(`${w.frames / 3600}m:lv${w.level}`);
  }
  const ms = (performance.now() - t0) / w.frames;
  console.log(
    `seed ${seed} ${w.instruments[0].id.padEnd(5)} ${w.state.padEnd(4)} t=${(w.time / 60).toFixed(2)}m lv=${w.level} kills=${w.kills} score=${w.score} peak=${peak} ${ms.toFixed(3)}ms/f max ${slowest.toFixed(1)}ms`,
  );
  if (brief) console.log('   ', minutes.join(' '));
  else console.log('   ', minutes.join(' '), '|', w.instruments.map((s) => s.id + s.lv).join(' '), '|', w.gear.map((s) => s.id + s.lv).join(' '));
}
