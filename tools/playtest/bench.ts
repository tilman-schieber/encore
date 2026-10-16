// Each instrument alone, at each level, against the crowd at a given minute: damage that landed in a minute.
// npm run playtest:bench -- [minute] [seeds]
import { World, autopilot } from '../../src/world';
import { makeRng } from 'arcade-kit/rng';
import { makeSong } from '../../src/song';
import { INSTRUMENTS, MAX_LEVEL } from '../../src/band';

const minute = Number(process.argv[2] ?? 4);
const seeds = Number(process.argv[3] ?? 4);
console.log(`damage a minute, alone, from minute ${minute} (${seeds} seeds)`);
for (const d of INSTRUMENTS) {
  const row: string[] = [];
  for (let lv = 1; lv <= MAX_LEVEL; lv++) {
    let sum = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const w = new World({ rng: makeRng(seed), song: makeSong(seed), mode: 'set', start: d.id });
      w.instruments[0].lv = lv;
      w.frames = minute * 3600;
      // Let the crowd gather, then count.
      for (let f = 0; f < 600 && w.state === 'play'; f++) w.update(autopilot(w));
      const from = w.dealt[d.id] ?? 0;
      w.hp = w.maxHp = 1e9;
      for (let f = 0; f < 3600; f++) w.update(autopilot(w));
      sum += (w.dealt[d.id] ?? 0) - from;
    }
    row.push(String(Math.round(sum / seeds)).padStart(7));
  }
  console.log(d.id.padEnd(6), row.join(''));
}
