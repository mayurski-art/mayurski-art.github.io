# Troll Man — design doc (draft 1, 2026-10-14)

The third game on trollrunner.net, next to Troll Kombat and Troll Forces.
A Pac-Man game: the trollface runs a maze eating dots, four meme faces hunt
him, exchange logos are the power-ups. Nostalgic 1980 arcade look, playable
on every device, with a real joystick on phones.

Working name: **Troll Man** (Puck Man → Pac-Man → Troll Man; sits next to
Troll Kombat / Troll Forces). Other options at the end. The folder is
`assets/games/troll-man/`; renaming it is a one-line change.

---

## 1. What it is in one screen

- Four mazes, 28×29 tiles (the original is 28×31), our own layouts (no Namco
  maze), one per level round and round, each in its own colour. The pen, the
  tunnel, the start tile and the four power-up corners sit in the same place
  in all of them. `node tools/troll-man-maze-check.mjs` checks every one:
  every dot reachable, no dead ends, walls at least 2 tiles thick.
- Trollface eats dots. Four meme faces chase him. Clear the maze, next level.
- Four exchange logos are the power-ups, each doing something different.
- Bonus pickups ("the fruit") are $TROLL coins and troll stickers.
- Three lives, score, high score, weekly leaderboard, 1UP/2UP hot-seat.
- Nostalgic: pixel art, CRT glow, chunky arcade font, attract mode, a
  loading-screen poster drawn like the 1980 Puck Man flyer.

## 2. The cast

### The player: trollface
Only the trollface for now. He faces the way he moves, mouth chomping on
dots. Death = the grin melts into a "problem?" frown and he spins out, the
Pac-Man death beat but ours.

### The chasers (the ghosts)
Each chaser gets one of the four classic hunting styles, so they feel
different in play, not just in looks. Names are on-screen (the original
showed each ghost's name + nickname in attract mode — we do the same).

| Chaser | Hunting style (Pac-Man equivalent) | Nickname line |
| --- | --- | --- |
| **Giga Chad** | Direct chase, straight at you. Speeds up when few dots are left ("Cruise Elroy"). | "He just walks at you." |
| **Pepe** | Ambusher: aims 4 tiles ahead of you to cut you off. | "Feels bad, man." |
| **Pudgy** | Flanker: uses Giga Chad's position to pincer you from the other side. | "Waddles with the pack." |
| **Doge** | Wanderer: chases until he's close, then wanders off. "Much chase, very random." | "Such pursuit." |

Standard states: **chase**, **scatter** (each has a home corner), **frightened**
(when you eat the Pump.fun pill they turn blue and run; eating one sends
only the eyes back to the pen), and **the pen** in the middle of the maze —
on-screen label: "the group chat".

### Power-ups (the exchange logos)
Four logos, four different effects. One of each spawns per level at fixed
maze corners, like the four power pellets.

| Logo | Effect | Length |
| --- | --- | --- |
| **Pump.fun pill** | Classic power pellet. Chasers turn frightened, you eat them: 200 / 400 / 800 / 1600. | 9s, a second less every level or two, 1s by level 19 |
| **Stonks** | Score ×2 — every dot, chaser and coin counts double. | 14s |
| **FOMO** | Dot magnet: dots within 2.5 tiles get pulled into you. Clears the maze fast but drags you toward trouble. | 10s |
| **Aster** | Shield: one free hit. A chaser that catches you bounces off and is sent back to the pen. | until used |

Logos are the real marks, pixelated in-house (2026-10-15, the user's call):
the Pump.fun capsule, the stonk.fun S-mark (traced from the site's SVG) on
its dark tile, FOMO's white double loop on navy, Aster's sand-gold disc with
the four-point star cut in. Real brand marks are trademarks — a risk note,
not a blocker.

Difficulty climbs a step every level to level 21 instead of topping out
early: he speeds up (to 1.5×), the chasers close the gap to a hair under his
pace, scatter phases shrink, the pill wears off sooner, Giga Chad's
end-of-maze rush starts earlier and runs harder, the pen lets the next
chaser out sooner when you stop eating.

### Bonus pickups (the fruit)
Appear under the pen twice a level, for ~10s, worth more each level:
$TROLL coin → troll sticker → Rolex → Keyboard Warrior → … The pickup
sequence shows in the bottom-right like the original's fruit row, so it
doubles as a level counter.

## 3. Rules and feel

- Grid movement with **cornering**: you can press the next direction early
  and the trollface takes the turn the moment it's legal. This is the
  single thing that makes a Pac-Man clone feel right or wrong.
- Trollface slows slightly while eating dots (original rule) — makes
  empty corridors matter.
- Side tunnels wrap left/right; chasers crawl in them.
- Speeds, frightened time and scatter/chase timings scale by level the way
  the original did, so level 1 is kind and level 8 is mean.
- Extra life at 10,000.
- Level clear: maze flashes, short pause, next level. Every 2nd level the
  maze colour changes; every 4th there's an **intermission** (a 5-second
  gag: Giga Chad chases trollface across the screen, trollface comes back
  giant and chases him).
- **Attract mode**: leave the title screen alone for 10s and it plays the
  cast intro + a demo game, like a real cabinet.
- **1UP / 2UP**: two-player alternating turns on one device (the flyer's
  "1UP 2UP" is the look we want). Cheap to add, very nostalgic.

### The one twist: "Problem?"
Hold the taunt button and the trollface stops and laughs. Any chaser within
2 tiles freezes for 1 second, then the taunt is on a 10-second cooldown.
It costs you time standing still, so it's a get-out-of-jail card, not a
cheat. Fits the mascot, and nothing else in the game is a button press, so
the phone's second button has a job.

## 4. Look: nostalgic arcade

Direction: the 1980 Puck Man flyer (your reference) — bright arcade colours,
chunky outlines, no anti-aliasing. More references to come from you before
any code starts.

- **Maze**: dark navy board, bright blue walls (ours get a thin troll-white
  highlight), dots in cream, like the flyer's screen inset.
- **Sprites**: the pixel-art versions of the original meme faces that you
  supply (trollface, Pepe, Doge, Giga Chad; Pudgy pixelated from its
  source by the proof tool), scaled down to a 32 px box (the maze tile is
  16 px; sprites overlap tiles like the original's ghosts do). No stylised
  redraws. The player sprite is YOUR pixel trollface (refs/faces/
  trollface.png) — never the site's green-eyed logo-face art.
- **Facing**: every face turns with its movement — flipped for left/right,
  rotated 90° for up/down — so the trollface runs mouth-first into the
  dots and the chasers look where they're going.
- **Idle loop**: each face blinks (eyes-closed frame for 2 ticks every
  ~3 s, randomised per character so they don't blink together); the
  trollface also chomps while moving. Frightened = the blue recolour.
- **Font**: Press Start 2P (Google Fonts, allowed by the rules) for score,
  READY!, GAME OVER. DM Sans for the page around the cabinet.
- **Cabinet**: the game sits in a cabinet frame on desktop with the
  site's CRT scanline overlay (Troll Kombat already has one). On phones
  the cabinet frame goes away and the screen fills the width.
- **Sound**: synthesized with WebAudio in-page (the waka, the siren that
  rises as dots run out, frightened loop, death spin, coin chime). No audio
  files to host, and it matches the 1980 bleeps.

### Banner and the loading-screen poster
A custom poster in the flyer's layout, used three places: the loading
screen, the hub card art on the arcade page, and the OG/share image.

Composition (mirroring the Puck Man flyer): big title "TROLL MAN" top-left
in that chunky bubble lettering with a small "トロールマン"-style subline;
trollface mid-poster running with a dot trail; the four meme faces peeking
from the corners; the maze screen inset in the middle-bottom with 1UP /
HIGH SCORE / 2UP; a cabinet in the bottom-right; a border of $TROLL coins
and troll stickers instead of fruit and cherries; a "Problem?" tagline
where the Japanese copy sits.

How it gets made: the pieces (trollface, faces, maze shot, cabinet) are the
game's own pixel sprites blown up, laid out as one SVG/canvas comp, then
exported to PNG at 1200×1700 and a 1200×630 landscape crop for the banner.
Generated art only if a piece needs it, and you see every piece before it
ships ("graphics must actually look good" rule: screenshot and iterate).

## 5. Controls

**Desktop**: arrow keys or WASD to move, Space = taunt, Enter = start,
Esc/P = pause. Gamepad: d-pad/left stick, A taunt, Start = start.

**Phone, portrait** (the main case):

```
┌───────────────────┐
│  1UP   HIGH   2UP │
│                   │
│      [ maze ]     │   screen fills the width, maze is tall so
│                   │   portrait fits it well
│                   │
├───────────────────┤
│                   │
│       ( ● )       │   joystick, centred, 8-way with a dead zone,
│                   │   thumb-sized (~120 px)
│  [SELECT] [START] │   two small pill buttons like a cabinet
└───────────────────┘
```

- Joystick: drag anywhere on the pad, direction = angle from centre, snaps
  to 4 ways with the cornering buffer so a sloppy diagonal still turns.
- SELECT = taunt ("Problem?"). START = start / pause. Both labelled.
- Swipe on the maze works as a backup for people who hate joysticks.
- **Landscape phone**: maze centred, joystick bottom-left, buttons
  bottom-right. Tablets get the desktop cabinet.
- Vibration tick on eating a chaser and on death (if the device allows).

## 6. Where it lives on the site

- Page: `troll-man.html`, same head as `troll-kombat.html` (CSP, accounts,
  leaderboard engine, `← Arcade` back link).
- Code: `assets/games/troll-man/` — `game.js` (one file to start; split
  only if it grows past ~2k lines), `style.css`, `leaderboard.js`,
  `sprites/`, `ui/` (poster, banner), `refs/`.
- Hub: a third card on `games.html` with the poster as art, tag "Arcade",
  meta "1-2 players · hot seat".
- Leaderboard: the shared weekly engine (`assets/games/LEADERBOARD.md`),
  ranked by best score, then level reached. Logged-out plays stay local, as
  with the other games.
- No new backend, no new SQL, no dependencies. Canvas 2D, vanilla JS,
  fixed 60 Hz step.

## 7. Build phases

Each phase is playable on its own and checked in the browser before the
next starts. No gate; a targeted check per change, push on your word.

0. **Sprite proof — DONE 2026-10-14.** All five characters have three
   32 px frames (normal / blink / action) in `sprites/<name>-f1..f3-32.png`,
   sliced from the generated sheets in `refs/faces/sheet-*.webp` by
   `tools/troll-man-sprite-proof.mjs` (re-run it after replacing a sheet).
   The `-32-x8.png` copies are for viewing only. Frightened = the blue
   recolour applied at runtime; facings = flip / rotate at runtime.
1. **Maze + trollface + dots — DONE 2026-10-14** (`tools/troll-man-p1-test.mjs`
   clears a maze with key presses).
   **Maze + trollface + dots.** Grid, walls, cornering, tunnels, dot eating,
   score, level clear. Done when a full maze can be cleared with keys.
2. **The four chasers — DONE 2026-10-14** (`tools/troll-man-p2-test.mjs`).
   **The four chasers.** Chase/scatter/frightened/pen, the four hunting
   styles, death, lives, Pump.fun pill, level scaling. Done when level 1→5
   plays like Pac-Man.
3. **The other three logos + bonus pickups + taunt — DONE 2026-10-14**
   (`tools/troll-man-p3-test.mjs`). Built as: one of each logo on the four
   corner tiles, rotating a corner per level; taunt radius 3 tiles (2 was
   too tight to matter), freeze 1.2s, Space or T. Phones get the taunt on
   the SELECT button in phase 4.
   **The other three logos + bonus pickups + taunt.** Stonks, FOMO, Aster,
   coin pickups, "Problem?". Done when all four effects are visibly
   different.
4. **Phone — DONE 2026-10-14** (`tools/troll-man-p4-test.mjs`). Stick off-axis
   (24-66 degrees) means "turn": it takes the axis he is not moving along.
   SELECT = taunt, START = start / pause; both also start from the title.
   **Phone.** Portrait layout, joystick, SELECT/START, swipe backup,
   landscape. Done when it plays on your phone with a thumb.
5. **Look — DONE 2026-10-15** (`tools/troll-man-p5-test.mjs`). WebAudio
   sounds in `sound.js` (all synthesised, original tunes, M / button to
   mute), title menu 1 PLAYER / 2 PLAYERS, a silent attract demo after
   16s idle, cut-scenes after levels 2, 5, 9, 13, 17, 1UP/2UP hot seat with
   a maze per player.
   **Look.** Sprites, maze palette, Press Start 2P, CRT, sounds, title
   screen, attract mode, intermissions, 1UP/2UP. Done when a screenshot
   looks like a cabinet.
6. **Poster, banner, hub card, leaderboard, OG tags — DONE 2026-10-15**
   (`tools/troll-man-p6-test.mjs`). `tools/troll-man-poster.mjs` renders
   `ui/troll-man-poster.jpg` (1200x1700, the loading screen until the first
   key or tap) and `ui/troll-man-banner.jpg` (1200x630, OG image and hub card
   art) from the game's own sprites and icons. Weekly board from the trophy
   button, 1-player games only. Card on games.html, entry in the home Arcade
   menu.
   **Poster, banner, hub card, leaderboard, OG tags.** Done when it's on
   the arcade page and a score lands on the weekly board.

Phase 1-2 are the game. 3-6 can ship one at a time after that.

## 8. Reference images

Folder: `assets/games/troll-man/refs/`. Drop files there as you find them.

- `puck-man-flyer-1980.png` — the Namco flyer you pasted (please save the
  file into the folder; I can't write a chat image to disk).
- `pac-man-screen-poster.png` — the maze screen poster you pasted: the
  in-game layout to match. 1UP / HIGH SCORE / 2UP across the top, READY!
  under the pen, lives bottom-left, the fruit row bottom-right, the logo
  centred along the bottom. Same ask: save the file into the folder.
- Still wanted: the four meme faces as you want them, the exchange logos,
  any other cabinet art / CRT look you like, any joystick layout you like.

## 9. Decisions for you

1. **Name**: Troll Man (my pick), Troll Muncher, Grin Maze, Pac-Troll,
   Problem Man.
2. **Chaser mapping** (section 2): fine as is, or swap who hunts how?
3. **Power-up effects** (section 2): keep all four, or change any?
4. **Real logos vs parody redraws** for the power-ups.
5. **The "Problem?" taunt**: in or out for v1?
6. **1UP/2UP hot seat and intermissions**: v1 or later?
7. **Bonus pickup list**: $TROLL coin, sticker, Rolex, Keyboard Warrior —
   anything you'd rather see?
