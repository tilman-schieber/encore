// The two ways to play. Each keeps its own high score table.
export type ModeId = 'set' | 'endless';

export interface ModeDef {
  id: ModeId;
  name: string;
  blurb: string;
}

export const MODES: ModeDef[] = [
  { id: 'set', name: 'SET', blurb: 'TEN MINUTES, THEN THE SILENCE.' },
  { id: 'endless', name: 'ENDLESS', blurb: 'PLAY ON AS LONG AS YOU CAN.' },
];

export type TableId = ModeId;
export const TABLES: TableId[] = MODES.map((m) => m.id);
