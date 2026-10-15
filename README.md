# ENCORE

A survivor roguelite where every weapon is an instrument, built in TypeScript with no runtime dependencies. Runs entirely in the browser. A sibling of [Snackman](https://github.com/tilman-schieber/snackman), [Scales](https://github.com/tilman-schieber/scales) and [VEKTOR](https://github.com/tilman-schieber/vektor): same screen, same font, same high score tables.

**Play:** https://gh.tschieber.de/encore/

A busker plays through the night, and the Hush come to silence them. You only walk: your band does the rest. Every weapon is a part on a 16-step sequencer and fires when it plays, so the KICK's shockwave goes off on the kick drum and the LEAD's homing notes fly on the notes of the tune. The Hush drop notes; gather them to level up, and pick a new instrument, a busier part for one you have, or gear. The song is made up for every run from its seed, and you only hear what your band plays: it starts as one drum and ends as a full arrangement.

## Modes

| Mode | Goal |
| --- | --- |
| SET | Ten minutes, then THE SILENCE comes. Beat it for an encore. |
| ENDLESS | Play on as long as you can. THE SILENCE comes back every ten minutes, and the Hush keep getting tougher. |

**Start:** pick the instrument you begin with: SNARE, KICK, BASS, LEAD or HATS.
**Seed:** *Daily* gives everyone the same song and the same cards for the day.

## The band

Six instruments at most, each up to level 5. A level more is a busier part: more steps lit, so more shots, and harder ones.

| Instrument | Plays |
| --- | --- |
| KICK | A shockwave all round you, on every kick |
| SNARE | Shots at the nearest of the Hush, on the backbeat |
| HATS | A stream of needles, eighths and then sixteenths |
| BASS | A slow wave that goes through everything, on the bass line |
| LEAD | Homing notes on the melody; harmonies and an octave at higher levels |
| ARP | Notes circling you that strike on each arpeggio note |
| PAD | A chord around you that hurts and slows on every beat |
| CRASH | Hits everything on screen, every few bars |

The sequencer at the bottom left shows the bar now playing: a row per instrument, a lit step for each shot.

## Gear

| Gear | Does |
| --- | --- |
| AMP | +15% damage a level |
| TEMPO | The whole song gets faster (112, 128, 150 BPM), so everything fires more often |
| SNEAKERS | Faster feet |
| FANS | Notes come to you from further away |
| REVERB | Bigger waves, rings and chords |
| ECHO | Every shot repeats a dotted eighth later, softer, like a delay pedal; you hear it too |
| HEART | More health, and heals |
| ENCORE | One more song: up again when you fall, and the crowd is thrown back |

On the street: tea heals, a mic pulls in every note on the ground, and the gold record THE NEIGHBOR drops is three level-ups.

## The Hush

| Who | Does |
| --- | --- |
| SHH | Comes straight for you |
| STATIC | Fast and fizzy, often in gangs |
| HECKLER | Keeps away and throws tomatoes |
| EARPLUG | Slow and hard to stop |
| FEEDBACK | Stops, screeches, then charges |
| THE NEIGHBOR | A noise complaint with a broom: slams rings of shockwaves |
| THE SILENCE | A hole in the night with one eye: rings and spirals of rests, and it calls the Hush to it. The band goes quiet as it comes |

## Controls

| Key | Action |
| --- | --- |
| Arrows / W A S D | Walk |
| Space / Z / X | Choose |
| Enter | Start / choose |
| Esc | Pause |
| Backspace | Quit to menu (while paused) |
| M | Music on/off |
| H | High scores (title screen) |

A gamepad works too: stick or d-pad to walk (the stick by how far you push it), A to choose, Start to pause and Select to quit from the pause screen. On the title screen Y shows the high scores; when typing a name, Up/Down pick a letter, A enters it and B rubs one out.

**D-pad not working on a Mac?** Cheap SNES-style USB pads (DragonRise, `0079:0011`, sold as "USB Gamepad") describe their d-pad in a way Chrome on macOS can't read: it sees the buttons but not the d-pad. Open the game with `?webhid` (https://gh.tschieber.de/encore/?webhid) and click CONNECT GAMEPAD at the top right to read the d-pad over WebHID instead, then press one of the pad's buttons so the browser reports the pad. Chrome remembers the pad after that. Chrome and Edge only, as other browsers have no WebHID. The code is in `src/hidpad.ts`.

On phones, put a finger down anywhere on the screen and drag to walk. Tap a card to take it.

## Music

There is no soundtrack: the song is the band. Each run gets a key, two four-bar chord progressions and a melody made from its seed (`src/song.ts`); the world fires each instrument on its steps and lists the notes it played, and the Web Audio synth in `src/audio.ts` plays them on a clock tied to the game's frames, so the shots and the sound stay together. A soft drone on the chord roots keeps the key until there is a bass.

High scores: the top 10 per mode, both worldwide and in your own browser (Up/Down switches between them on the score screen, Left/Right between the modes). World scores live in a small [Val Town](https://www.val.town/x/tilmanschieber/encore-scores) val with a SQLite table; your own scores and settings stay in the browser's local storage, so they still work offline. Games finished while the server can't be reached wait in local storage and are sent the next time the score screen opens.

All sprites are hand-placed pixels in `src/sprites.ts`.

## Development

```sh
npm install
npm run dev
npm run build
```

Add `?debug` to the URL for debug mode: in play, L levels up, T jumps a minute ahead, B skips to THE SILENCE and I heals. Games in debug mode don't go into the high scores.

`npm run playtest` has the title screen's demo busker play whole runs headless and prints how far each got; `npm run playtest:boss` sets a built-up busker against THE SILENCE.
