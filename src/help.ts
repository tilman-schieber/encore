// In-game help pages. Text uses only characters the pixel font has.

export interface HelpPage {
  title: string;
  /** Paragraphs, word-wrapped when drawn; '' adds a blank line. */
  text: string[];
}

export const HELP_PAGES: HelpPage[] = [
  {
    title: 'ENCORE',
    text: [
      'A BUSKER PLAYS ON THROUGH THE NIGHT, AND THE HUSH COME TO SILENCE THEM.',
      '',
      'YOU ONLY WALK. YOUR BAND DOES THE REST: EVERY WEAPON IS AN INSTRUMENT, AND IT FIRES WHEN IT PLAYS.',
      '',
      'THE HUSH DROP NOTES. GATHER THEM TO LEVEL UP, AND CHOOSE A NEW INSTRUMENT, A BETTER PART FOR ONE YOU HAVE, OR GEAR.',
      '',
      'THE SONG IS MADE FOR EACH RUN, AND YOU ONLY HEAR WHAT YOUR BAND PLAYS.',
    ],
  },
  {
    title: 'THE SEQUENCER',
    text: [
      'BOTTOM LEFT IS YOUR SEQUENCER: SIXTEEN STEPS A BAR, A ROW FOR EACH INSTRUMENT. A LIT STEP IS A SHOT.',
      '',
      'A LEVEL MORE FOR AN INSTRUMENT IS A BUSIER PART: MORE STEPS, SO MORE SHOTS, AND HARDER ONES.',
      '',
      'TEMPO SPEEDS THE WHOLE SONG UP. ECHO REPEATS EVERY SHOT A BEAT LATER, SOFTER, LIKE A DELAY PEDAL.',
      '',
      'SIX INSTRUMENTS AND SIX PIECES OF GEAR AT MOST.',
    ],
  },
  {
    title: 'THE BAND',
    text: [
      'KICK   A SHOCKWAVE ALL ROUND YOU',
      'SNARE  SHOTS AT THE NEAREST',
      'HATS   A STREAM OF NEEDLES',
      'BASS   A SLOW WAVE THROUGH ALL',
      'LEAD   HOMING NOTES ON THE TUNE',
      'ARP    NOTES THAT CIRCLE YOU',
      'PAD    A CHORD THAT HURTS AND SLOWS',
      'CRASH  HITS ALL ON SCREEN',
      '',
      'WITH NOBODY NEAR, SHOTS GO WHERE YOU LAST WALKED.',
    ],
  },
  {
    title: 'GEAR',
    text: [
      'AMP       MORE DAMAGE',
      'TEMPO     A FASTER SONG',
      'SNEAKERS  FASTER FEET',
      'FANS      NOTES FROM FURTHER AWAY',
      'REVERB    BIGGER WAVES AND CHORDS',
      'ECHO      EVERY SHOT TWICE',
      'HEART     MORE HEALTH',
      'ENCORE    UP AGAIN WHEN YOU FALL',
      '',
      'ON THE STREET: TEA HEALS, A MIC PULLS IN EVERY NOTE, AND A GOLD RECORD IS THREE LEVEL-UPS.',
    ],
  },
  {
    title: 'THE HUSH',
    text: [
      'SHH       COMES STRAIGHT FOR YOU',
      'STATIC    FAST AND FIZZY, IN GANGS',
      'HECKLER   KEEPS AWAY, THROWS TOMATOES',
      'EARPLUG   SLOW AND HARD TO STOP',
      'FEEDBACK  SCREECHES, THEN CHARGES',
      '',
      'THE NEIGHBOR COMES WITH A NOISE COMPLAINT AND A BROOM, AND DROPS A GOLD RECORD.',
      '',
      'AT TEN MINUTES THE SILENCE COMES. BEAT IT AND THE CROWD WANTS AN ENCORE.',
    ],
  },
  {
    title: 'CONTROLS',
    text: [
      'ARROWS OR W A S D: WALK',
      'ENTER OR SPACE: CHOOSE',
      'ESC: PAUSE',
      'BACKSPACE: QUIT WHEN PAUSED',
      'M: MUSIC ON OR OFF',
      'H: HIGH SCORES - TITLE SCREEN',
      '',
      'GAMEPAD: STICK OR PAD WALK, A CHOOSES, START PAUSE, SELECT QUIT.',
      'ON PHONES DRAG ANYWHERE TO WALK, AND TAP A CARD TO TAKE IT.',
    ],
  },
];

/** Splits paragraphs into lines of at most `width` characters. */
export function wrapText(paragraphs: string[], width: number) {
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (!para) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of para.split(' ')) {
      if (line && line.length + 1 + word.length > width) {
        lines.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
  }
  return lines;
}
