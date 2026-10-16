// High scores, one table per mode, in this browser and worldwide (a Val Town val:
// tilmanschieber/encore-scores). The tables themselves are arcade-kit's.
import { createScores } from 'arcade-kit/scores';
import { TABLES, TableId } from './modes';

export { load, save } from 'arcade-kit/storage';

export interface ScoreEntry {
  name: string;
  score: number;
  /** Seconds survived. */
  time: number;
  level: number;
  /** Beat THE SILENCE. */
  won: boolean;
}

export type Tables = Record<TableId, ScoreEntry[]>;

export const { MAX_SCORES, loadTables, saveTables, rankFor, fetchGlobal, submitGlobal, flushPending } = createScores<
  TableId,
  ScoreEntry
>({
  game: 'encore',
  tables: TABLES,
  url: 'https://tilmanschieber--a9d3b168c81611f1ab3c1607ee4eb77e.web.val.run',
  normalize: (e) => ({
    name: e.name,
    score: e.score,
    time: Number(e.time) || 0,
    level: Number(e.level) || 1,
    won: !!e.won,
  }),
});
