// Hand-placed pixel sprites, one character a pixel, built into canvases once at start.
// Each comes facing right, with a mirrored copy and a white one for the flash of a hit.

export interface Sprite {
  img: HTMLCanvasElement;
  flip: HTMLCanvasElement;
  white: HTMLCanvasElement;
  w: number;
  h: number;
}

function build(rows: string[], pal: Record<string, string>): Sprite {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const make = (mirror: boolean, white: boolean) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const col = pal[ch];
        if (!col) return;
        g.fillStyle = white ? '#fcfcfc' : col;
        g.fillRect(mirror ? w - 1 - x : x, y, 1, 1);
      }),
    );
    return c;
  };
  return { img: make(false, false), flip: make(true, false), white: make(false, true), w, h };
}

const BUSKER_PAL = {
  K: '#503000', k: '#7c4800', S: '#fcbcb0', E: '#000000', R: '#f83800', r: '#a81000',
  G: '#e4a050', g: '#a86828', O: '#381800', N: '#7c4800', B: '#3c58c8', b: '#203080', D: '#383838',
};
const BUSKER_TOP = [
  '....KKKK....',
  '...KkkkKK...',
  '..KKKKKKKK..',
  '....SSSS....',
  '....SSES....',
  '....SSSS....',
  '...RRRRRR...',
  '..RRGGGRRr..',
  '..RGGOGGNNN.',
  '..SGGGGGr...',
  '...gGGGRr...',
  '...BBBBBB...',
];
const BUSKER_LEGS = [
  ['...BB..BB...', '...BB..BB...', '...bb..bb...', '...DD..DD...'],
  ['..BB....BB..', '..BB....Bb..', '.bb......bb.', '.DD......DD.'],
];

const SHH_PAL = { L: '#a8a8c8', l: '#7878a0', K: '#202038', W: '#fcfcfc' };
const SHH = [
  ['...LLLL...', '..LLLLLL..', '.LLLLLLLL.', '.LKLLLLKL.', '.LLLLLLLL.', '.LLLWLLLL.', '.LLKWKLLL.', '.LLLWLLLL.', '.LLLLLLLl.', '.LLLLLLll.', '.L.LL.LL.l'],
  ['...LLLL...', '..LLLLLL..', '.LLLLLLLL.', '.LKLLLLKL.', '.LLLLLLLL.', '.LLLWLLLL.', '.LLKWKLLL.', '.LLLWLLLL.', '.LLLLLLLl.', '.LLLLLLll.', '..L.LL.L.l'],
];

const PLUG_PAL = { O: '#fca044', o: '#e47000', K: '#381800', D: '#a84000' };
const PLUG = [
  ['...OOOO...', '..OOOOOO..', '.OOOOOOOo.', '.OOOOOOOo.', '.OKOOOOKo.', '.OOOOOOOo.', '.OOOKKOOo.', '.OOKOOKOo.', '.OOOOOOOo.', '.OOOOOOOo.', '.OOOOOOOo.', '..OOOOOo..', '...DDDD...'],
  ['..........', '...OOOO...', '..OOOOOOo.', '.OOOOOOOOo', '.OKOOOOOKo', '.OOOOOOOOo', '.OOOOKKOOo', '.OOOKOOKOo', '.OOOOOOOOo', '.OOOOOOOOo', '..OOOOOOo.', '..OOOOOOo.', '...DDDDD..'],
];

const HECKLER_PAL = { H: '#00a800', h: '#006800', S: '#fcbcb0', K: '#000000', T: '#f83800', t: '#58d854', J: '#383838' };
const HECKLER = [
  ['...HHHH.t.', '..HHHHHHTT', '..HSSSSHTT', '..HSKSKH..', '..HSSSSH..', '..HSKKSH..', '.HHHHHHHS.', 'HHHHHHHH..', '.HHHHHHh..', '..HHHHhh..', '..JJ..JJ..', '..JJ..JJ..', '..KK..KK..'],
  ['...HHHH...', '..HHHHHH..', '..HSSSSH..', '..HSKSKH..', '..HSSSSH..', '..HSKKSH.t', '.HHHHHHHTT', 'HHHHHHHHTT', '.HHHHHHh..', '..HHHHhh..', '..JJ..JJ..', '.JJ....JJ.', '.KK....KK.'],
];

const FEEDBACK_PAL = { A: '#383838', a: '#585858', R: '#f83800', M: '#7c7c7c', C: '#202020', L: '#bcbcbc' };
const FEEDBACK = [
  ['.AAAAAAAAA.', 'AaaaaaaaaaA', 'AaRaaaaaRaA', 'AAAAAAAAAAA', 'AAMMMMMMMAA', 'AAMCMCMCMAA', 'AAMMCCCMMAA', 'AAMCMCMCMAA', 'AAMMMMMMMAA', 'AAAAAAAAAAA', '.L.......L.'],
];

const NEIGHBOR_PAL = { C: '#3cbcfc', S: '#fcbcb0', K: '#000000', P: '#f878f8', p: '#c84898', W: '#fcfcfc', B: '#7c4800', Y: '#f8d838', y: '#c89800', F: '#a858f8' };
const NEIGHBOR = [
  '......CCCCC.........',
  '.....CSSSSSC........',
  '.....SSSSSSS........',
  '.....SKKSKKS........',
  '.....SSSSSSS........',
  '.....SSKKKSS........',
  '......SSSSS.........',
  '...PPPPPPPPPPP......',
  '..PPPPPPPPPPPPP.....',
  '..PPPWPPPPPWPPP..B..',
  '..PPPWPPPPPWPPP.B...',
  '..SSPWPPPPPWPSSB....',
  '..PPPWPPPPPWPPB.....',
  '..PPPWWWWWWWPB......',
  '..PPPPPPPPPPBp......',
  '..PPPPPPPPPBPp......',
  '..PPPPPPPPBPPp......',
  '..pPPPPPPBPPpp......',
  '...pppppYyY.........',
  '.....SS.YYyY........',
  '.....SS.YyYYY.......',
  '....FFF.YYyYY.......',
  '....FFF..YYY........',
];

// A MUTE: a grey hood, a pale face, a finger to its lips.
const MUTE_PAL = { H: '#585878', h: '#383850', S: '#e4c8c0', K: '#000000', F: '#fcbcb0', D: '#202030' };
const MUTE = [
  ['...HHHH...', '..HHHHHH..', '.HHSSSSHH.', '.HSKSSKSH.', '.HSSFSSSH.', '.HSSFSSSH.', '.HHSFSSHH.', 'HHHHFHHHHh', 'HHHHHHHHhh', '.HHHHHHHh.', '.HHHHHHhh.', '..hhhhhh..', '..DD..DD..'],
  ['...HHHH...', '..HHHHHH..', '.HHSSSSHH.', '.HSKSSKSH.', '.HSSFSSSH.', '.HSSFSSSH.', '.HHSFSSHH.', 'HHHHFHHHHh', 'HHHHHHHHhh', '.HHHHHHHh.', '.HHHHHHhh.', '..hhhhhh..', '.DD....DD.'],
];

const NOTE = ['..XXX', '..X.X', '..X..', '..X..', '.XX..', 'XXX..', '.X...'];
const TEA = ['.S.S...', '..S.S..', 'WWWWW..', 'WGGGWWW', 'WWWWW.W', '.WWW...'];
const MIC = ['.GgG.', 'GgGgG', 'GGgGG', '.GGG.', '..K..', '..K..', '..K..', '.KKK.'];
const RECORD = ['..YYYYY..', '.YyYYYYY.', 'YYYyyYYYY', 'YYyRRRyYY', 'YYYRKRYYY', 'YYyRRRyYY', 'YYYYyyYYY', '.YYYYYYy.', '..YYYYY..'];
const TOMATO = ['..t..', '.TTT.', 'TTTTT', 'TTTTT', '.TTT.'];
const REST = ['.X..', '..X.', '.X..', 'X...', '.X..', '..X.', '.XX.', 'X...'];

export const SPR = {} as {
  busker: Sprite[];
  shh: Sprite[];
  plug: Sprite[];
  heckler: Sprite[];
  feedback: Sprite[];
  mute: Sprite[];
  neighbor: Sprite[];
  note: Record<'white' | 'green' | 'gold' | 'blue' | 'lime', Sprite>;
  tea: Sprite;
  mic: Sprite;
  record: Sprite;
  tomato: Sprite;
  rest: Sprite;
};

export function loadSprites() {
  SPR.busker = BUSKER_LEGS.map((legs) => build([...BUSKER_TOP, ...legs], BUSKER_PAL));
  SPR.shh = SHH.map((r) => build(r, SHH_PAL));
  SPR.plug = PLUG.map((r) => build(r, PLUG_PAL));
  SPR.heckler = HECKLER.map((r) => build(r, HECKLER_PAL));
  SPR.feedback = FEEDBACK.map((r) => build(r, FEEDBACK_PAL));
  SPR.mute = MUTE.map((r) => build(r, MUTE_PAL));
  SPR.neighbor = [build(NEIGHBOR, NEIGHBOR_PAL)];
  SPR.note = {
    white: build(NOTE, { X: '#bcd8fc' }),
    green: build(NOTE, { X: '#58d854' }),
    gold: build(NOTE, { X: '#f8d838' }),
    blue: build(NOTE, { X: '#3cbcfc' }),
    lime: build(NOTE, { X: '#b8f818' }),
  };
  SPR.tea = build(TEA, { S: '#7c7c7c', W: '#fcfcfc', G: '#58d854' });
  SPR.mic = build(MIC, { G: '#bcbcbc', g: '#7c7c7c', K: '#383838' });
  SPR.record = build(RECORD, { Y: '#f8d838', y: '#c89800', R: '#f83800', K: '#000000' });
  SPR.tomato = build(TOMATO, { T: '#f83800', t: '#58d854' });
  SPR.rest = build(REST, { X: '#fcfcfc' });
}
