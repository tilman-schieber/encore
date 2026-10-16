// Boss fights alone: a busker with a given number of level-ups at 9:55, against THE SILENCE.
// node boss.mjs [runs] [level-ups]
import { World, autopilot, pickCard } from '../../src/world';
import { makeRng } from 'arcade-kit/rng';
import { makeSong } from '../../src/song';
import { STARTERS } from '../../src/game';

const runs = Number(process.argv[2] ?? 6);
const ups = Number(process.argv[3] ?? 40);
for (let seed = 1; seed <= runs; seed++) {
  const w = new World({ rng: makeRng(seed), song: makeSong(seed), mode: 'set', start: STARTERS[seed % STARTERS.length] });
  for (let k = 0; k < ups; k++) w.choose(pickCard(w, w.offer()));
  w.frames = 10 * 3600 - 300;
  let met = -1;
  while (w.state === 'play' && w.frames < 14 * 3600) {
    while (w.pending > 0) w.choose(pickCard(w, w.offer()));
    w.update(autopilot(w));
    if (met < 0 && w.boss?.kind === 'silence') met = w.frames;
  }
  const b = w.enemies.find((e) => e.kind === 'silence');
  console.log(`seed ${seed} ${w.state} after ${((w.frames - met) / 60).toFixed(0)}s, boss hp left ${b ? Math.round((100 * b.hp) / b.maxHp) : 0}% | ${w.instruments.map((s) => s.id + s.lv).join(' ')}`);
}
