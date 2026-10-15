// Troll Man — the trollface eats the dots, the meme faces hunt him.
// Phase 1: maze, trollface, dots, score, level clear.
// Phase 2: the four chasers, the pen, frightened mode, lives, the Pump.fun pill.
// Phase 3: Stonks, FOMO and Aster power-ups, bonus pickups, the "Problem?" taunt.
// Plan: DESIGN.md next to this file.
(() => {
  "use strict";

  // ---- Board ----------------------------------------------------------------
  const TILE = 16, COLS = 28, ROWS = 29;
  const TOP = 3, BOTTOM = 2;                       // HUD rows above / below the maze, in tiles
  const W = COLS * TILE, H = (ROWS + TOP + BOTTOM) * TILE;
  const TUNNEL_ROW = 13;
  const PEN = { c0: 10, c1: 17, r0: 12, r1: 15 };  // the group chat: walls + door + inside
  const DOOR = { c0: 13, c1: 14, r: 12 };
  const PEN_EXIT = { x: 13.5, y: 11 };             // the tile pair just above the door
  const PEN_MID_Y = 13.5;
  const START = { x: 13.5, y: 21 };                // between the two centre tiles, like the original

  // Left half of the maze; the right half is its mirror.
  // # wall   . dot   o power-up (one of each logo)   - pen door   space = floor with no dot
  const HALF = [
    "##############",
    "#............#",
    "#.####.#####.#",
    "#o####.#####.#",
    "#.####.#####.#",
    "#.............",
    "#.####.##.####",
    "#.####.##.####",
    "#......##....#",
    "######.##### #",
    "######.##### #",
    "######.##     ",
    "######.## ###-",
    "      .   #   ",
    "######.## #   ",
    "######.## ####",
    "######.## ####",
    "######.## ####",
    "#............#",
    "#.####.#####.#",
    "#.####.#####.#",
    "#o..##........",
    "###.##.##.####",
    "###.##.##.####",
    "#......##....#",
    "#.##########.#",
    "#.##########.#",
    "#.............",
    "##############",
  ];
  const MAZE = HALF.map(row => row + [...row].reverse().join(""));

  const inPen = (c, r) => c >= PEN.c0 && c <= PEN.c1 && r >= PEN.r0 && r <= PEN.r1;
  const wrapC = c => ((c % COLS) + COLS) % COLS;

  // Floor the trollface (and the chasers outside the pen) may stand on.
  // Off the sides only the tunnel row is open.
  function walkable(c, r) {
    if (r < 0 || r >= ROWS) return false;
    if (c < 0 || c >= COLS) return r === TUNNEL_ROW;
    if (inPen(c, r)) return false;
    const ch = MAZE[r][c];
    return ch !== "#" && ch !== "-";
  }
  const inTunnel = (x, y) => Math.round(y) === TUNNEL_ROW && (x < 5.5 || x > COLS - 6.5);

  // Steps from every floor tile to the pen exit, for eaten chasers (eyes) heading home.
  const homeDist = (() => {
    const d = new Int16Array(ROWS * COLS).fill(-1);
    const q = [[13, PEN_EXIT.y], [14, PEN_EXIT.y]];
    q.forEach(([c, r]) => { d[r * COLS + c] = 0; });
    for (let i = 0; i < q.length; i++) {
      const [c, r] = q[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!walkable(c + dx, r + dy)) continue;
        const nc = wrapC(c + dx), nr = r + dy;
        if (d[nr * COLS + nc] >= 0) continue;
        d[nr * COLS + nc] = d[r * COLS + c] + 1;
        q.push([nc, nr]);
      }
    }
    return d;
  })();

  // ---- Tuning ---------------------------------------------------------------
  const CHOMP = 0.08;                // seconds per chomp frame while moving
  const BLINK_LEN = 0.14;            // seconds the eyes stay shut
  const TURN_WINDOW = 0.35;          // tiles: how early a turn can be buffered and still snap (cornering)
  const BASE_SPEED = 8;              // trollface tiles per second at level 1
  const DOT_PAUSE = 1 / 60;          // the original stalls a frame per dot: empty corridors are faster
  const PILL_PAUSE = 3 / 60;
  const READY_TIME = 2.0;
  const CLEAR_HOLD = 1.0, CLEAR_TIME = 3.0;      // freeze, then the maze flashes
  const DEATH_HOLD = 1.0, DEATH_TIME = 2.8;      // freeze, then the spin-out
  const EAT_FREEZE = 0.7;                        // the pause on eating a chaser
  const SCORE_DOT = 10, SCORE_PILL = 50;
  const EXTRA_LIFE_AT = 10000;
  // Power-ups (the four corner tiles, one of each per level)
  const STONKS_TIME = 8;                         // score x2
  const FOMO_TIME = 6, MAGNET_RADIUS = 2.5;      // dots this close fly to you
  const SHIELD_GRACE = 1.0;                      // after Aster blocks a hit, no catching for this long
  // Bonus pickups under the pen, twice a level
  const BONUS_AT = [70, 170];                    // dots eaten
  const BONUS_SPOT = { x: 13.5, y: 21 };
  const BONUS_TABLE = [["coin", 100], ["sticker", 300], ["rolex", 500], ["rolex", 500], ["keyboard", 700],
    ["keyboard", 700], ["coin", 1000], ["sticker", 2000], ["rolex", 3000], ["keyboard", 5000]];
  const bonusFor = lv => BONUS_TABLE[Math.min(lv, BONUS_TABLE.length) - 1];
  // "Problem?" taunt
  const TAUNT_TIME = 0.6, TAUNT_COOLDOWN = 10, TAUNT_RADIUS = 3, TAUNT_FREEZE = 1.2;
  const MAZE_COLORS = ["#2121de", "#de2121", "#21b04a", "#c021de", "#de8a21"];   // every 2nd level

  const levelSpeedUp = level => Math.min(1.25, 1 + (level - 1) * 0.04);
  const playerSpeed = () => BASE_SPEED * levelSpeedUp(level) * (frightT > 0 ? 1.06 : 1);
  const chaserSpeed = () => BASE_SPEED * 0.94 * Math.min(1.3, 1 + (level - 1) * 0.05);

  // Scatter / chase schedule in seconds (scatter first), like the original's per-level table.
  function schedule(lv) {
    if (lv === 1) return [7, 20, 7, 20, 5, 20, 5, Infinity];
    if (lv <= 4) return [7, 20, 7, 20, 5, 60, 1, Infinity];
    return [5, 20, 5, 20, 5, 60, 1, Infinity];
  }
  // Pump.fun pill: how long the chasers stay blue, per level (0 = they only turn around).
  const FRIGHT_TIME = [6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1, 0, 1, 0];
  const frightTimeFor = lv => FRIGHT_TIME[Math.min(lv, FRIGHT_TIME.length) - 1];

  // ---- Canvas ---------------------------------------------------------------
  const canvas = document.getElementById("tm-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  const FONT = "'Press Start 2P', monospace";
  const SPRITE_DIR = "assets/games/troll-man/sprites/";
  const sprites = {};
  for (const who of ["trollface", "pepe", "doge", "gigachad", "pudgy"]) {
    for (const f of [1, 2, 3]) {
      const img = new Image();
      img.src = `${SPRITE_DIR}${who}-f${f}-32.png?v=tm-p2`;
      sprites[`${who}-f${f}`] = img;
    }
  }
  const ready = img => img && img.complete && img.naturalWidth > 0;

  // Frightened looks are recolours of each face, made once the image has loaded:
  // a three-tone blue (the original's blue ghost) and a three-tone white for the flash.
  // Shading is kept, so a white face (Pudgy) or a dark one (Giga Chad's beard) still reads.
  const recolourCache = {};
  function recoloured(key, flash) {
    const id = key + (flash ? ":w" : ":b");
    if (recolourCache[id]) return recolourCache[id];
    const img = sprites[key];
    if (!ready(img)) return null;
    const c = document.createElement("canvas");
    c.width = 32; c.height = 32;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0, 32, 32);
    const d = x.getImageData(0, 0, 32, 32), p = d.data;
    const tones = flash
      ? { lite: [255, 255, 255], mid: [222, 222, 230], dark: [160, 160, 186] }
      : { lite: [150, 150, 255], mid: [33, 33, 222], dark: [18, 18, 120] };
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      const lum = (p[i] + p[i + 1] + p[i + 2]) / 3;
      if (lum < 40) continue;                         // keep the black outline
      const col = lum > 190 ? tones.lite : lum > 95 ? tones.mid : tones.dark;
      p[i] = col[0]; p[i + 1] = col[1]; p[i + 2] = col[2];
    }
    x.putImageData(d, 0, 0);
    return (recolourCache[id] = c);
  }

  // ---- Icons: power-up logos and bonus pickups, drawn in-house -----------------------
  // Each is painted with ordinary canvas shapes, then snapped to hard pixels: alpha to
  // on/off, every colour to the nearest of the icon's own palette. That keeps them in
  // the same flat pixel style as the faces.
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  function pixelIcon(size, palette, paint) {
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const x = c.getContext("2d");
    paint(x, size);
    const pal = palette.map(hex);
    const d = x.getImageData(0, 0, size, size), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] <= 110) { p[i + 3] = 0; continue; }
      p[i + 3] = 255;
      let best = pal[0], bd = Infinity;
      for (const q of pal) {
        const dd = (p[i] - q[0]) ** 2 + (p[i + 1] - q[1]) ** 2 + (p[i + 2] - q[2]) ** 2;
        if (dd < bd) { bd = dd; best = q; }
      }
      p[i] = best[0]; p[i + 1] = best[1]; p[i + 2] = best[2];
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.putImageData(d, 0, 0);
    return c;
  }
  const badge = (x, fill) => {                       // rounded-square app badge with a black rim
    x.fillStyle = "#000"; x.beginPath(); x.roundRect(0.5, 0.5, 21, 21, 6); x.fill();
    x.fillStyle = fill; x.beginPath(); x.roundRect(2, 2, 18, 18, 5); x.fill();
  };

  const PILL = 22;                                   // px, a bit over a tile so it reads as a power-up
  const ICONS = {
    // Pump.fun: a diagonal capsule, white top-left half, green bottom-right
    pump: pixelIcon(PILL, ["#000000", "#f4f4f4", "#55e05f", "#ffffff"], x => {
      x.translate(PILL / 2, PILL / 2); x.rotate(-Math.PI / 4);
      x.fillStyle = "#000"; x.beginPath(); x.roundRect(-11, -6, 22, 12, 6); x.fill();
      x.fillStyle = "#f4f4f4"; x.beginPath(); x.roundRect(-9.5, -4.5, 9, 9, [4.5, 0, 0, 4.5]); x.fill();
      x.fillStyle = "#55e05f"; x.beginPath(); x.roundRect(0.5, -4.5, 9, 9, [0, 4.5, 4.5, 0]); x.fill();
      x.fillStyle = "#fff"; x.fillRect(-7, -3, 3, 2);
    }),
    // Stonks: green badge, a white chart line zig-zagging up to an arrowhead
    stonks: pixelIcon(PILL, ["#000000", "#16b84a", "#ffffff"], x => {
      badge(x, "#16b84a");
      x.strokeStyle = "#fff"; x.lineWidth = 2.6; x.lineJoin = "miter"; x.lineCap = "square";
      x.beginPath(); x.moveTo(5, 16); x.lineTo(9, 11); x.lineTo(12, 13.5); x.lineTo(15.5, 8.5); x.stroke();
      x.fillStyle = "#fff"; x.beginPath(); x.moveTo(18, 4.5); x.lineTo(18, 11); x.lineTo(11.5, 4.5); x.closePath(); x.fill();
    }),
    // FOMO: purple badge with a white hourglass running out (gold sand)
    fomo: pixelIcon(PILL, ["#000000", "#8e3bff", "#ffffff", "#ffcc33"], x => {
      badge(x, "#8e3bff");
      x.fillStyle = "#fff";
      x.fillRect(6, 4, 10, 2); x.fillRect(6, 16, 10, 2);
      x.beginPath(); x.moveTo(7, 6); x.lineTo(15, 6); x.lineTo(11, 11); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(7, 16); x.lineTo(15, 16); x.lineTo(11, 11); x.closePath(); x.fill();
      x.fillStyle = "#ffcc33";
      x.beginPath(); x.moveTo(8.5, 15.5); x.lineTo(13.5, 15.5); x.lineTo(11, 12.5); x.closePath(); x.fill();
    }),
    // Aster: a gold six-armed asterisk with a black rim
    aster: pixelIcon(PILL, ["#000000", "#ffb020", "#ffe08a"], x => {
      x.translate(11, 11);
      for (const [w, col] of [[7.5, "#000"], [4.4, "#ffb020"]]) {
        x.strokeStyle = col; x.lineWidth = w; x.lineCap = "round";
        for (let k = 0; k < 3; k++) {
          const a = k * Math.PI / 3 + Math.PI / 2;
          x.beginPath(); x.moveTo(Math.cos(a) * 7.5, Math.sin(a) * 7.5); x.lineTo(-Math.cos(a) * 7.5, -Math.sin(a) * 7.5); x.stroke();
        }
      }
      x.fillStyle = "#ffe08a"; x.beginPath(); x.arc(0, 0, 2, 0, Math.PI * 2); x.fill();
    }),
    // $TROLL coin: gold coin, inner ring, a black T
    coin: pixelIcon(24, ["#000000", "#ffcc33", "#c98a00", "#fff3b0"], x => {
      x.fillStyle = "#000"; x.beginPath(); x.arc(12, 12, 11.5, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#c98a00"; x.beginPath(); x.arc(12, 12, 10, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#ffcc33"; x.beginPath(); x.arc(12, 12, 8, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#000"; x.fillRect(8, 7, 8, 3); x.fillRect(10.5, 7, 3, 10);
      x.fillStyle = "#fff3b0"; x.fillRect(6, 6, 2, 3);
    }),
    // Rolex: gold case and band, green dial, white hands
    rolex: pixelIcon(24, ["#000000", "#d9a520", "#8a6510", "#0a7a3a", "#ffffff"], x => {
      x.fillStyle = "#000"; x.fillRect(7, 0, 10, 24);
      x.fillStyle = "#8a6510"; x.fillRect(8, 0, 8, 24);
      x.fillStyle = "#d9a520"; for (let y = 1; y < 24; y += 4) x.fillRect(8, y, 8, 2);
      x.fillStyle = "#000"; x.beginPath(); x.arc(12, 12, 9, 0, Math.PI * 2); x.fill(); x.fillRect(20, 10.5, 3, 3);
      x.fillStyle = "#d9a520"; x.beginPath(); x.arc(12, 12, 7.8, 0, Math.PI * 2); x.fill(); x.fillRect(20, 11, 2, 2);
      x.fillStyle = "#0a7a3a"; x.beginPath(); x.arc(12, 12, 5.6, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#fff"; x.fillRect(11.5, 7.5, 1.5, 5); x.fillRect(11.5, 11.5, 4, 1.5);
    }),
    // Keyboard Warrior: a dark keyboard with light keys
    keyboard: pixelIcon(24, ["#000000", "#34343f", "#d8d8e4"], x => {
      x.fillStyle = "#000"; x.beginPath(); x.roundRect(0.5, 5, 23, 14, 2); x.fill();
      x.fillStyle = "#34343f"; x.fillRect(2, 6.5, 20, 11);
      x.fillStyle = "#d8d8e4";
      for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) x.fillRect(3 + k * 4 - (r === 1 ? 1 : 0), 7.5 + r * 3, 3, 2);
      x.fillRect(6, 15.5, 12, 1.5);
    }),
  };
  // The troll sticker uses the trollface sprite itself, so it's built once that has loaded.
  function stickerIcon() {
    if (ICONS.sticker) return ICONS.sticker;
    const face = sprites["trollface-f1"];
    if (!ready(face)) return null;
    const c = document.createElement("canvas");
    c.width = 24; c.height = 24;
    const x = c.getContext("2d");
    x.imageSmoothingEnabled = false;
    x.fillStyle = "#000"; x.fillRect(1, 1, 22, 22);
    x.fillStyle = "#fff"; x.fillRect(2, 2, 20, 20);
    x.drawImage(face, 4, 4, 16, 16);
    x.fillStyle = "#000"; x.fillRect(16, 16, 7, 7);               // peeled corner
    x.fillStyle = "#b8b8c8"; x.beginPath(); x.moveTo(17, 22); x.lineTo(22, 17); x.lineTo(17, 17); x.closePath(); x.fill();
    return (ICONS.sticker = c);
  }
  const iconFor = kind => (kind === "sticker" ? stickerIcon() : ICONS[kind]);
  // dots[] values 2-5 are the corner power-ups
  const POWER = { 2: "pump", 3: "stonks", 4: "fomo", 5: "aster" };

  // The maze is drawn once per colour: every floor tile grows by PAD into the walls,
  // the union is filled in the wall colour, then again PAD-LINE smaller in black.
  // What is left is a LINE-px outline sitting inside the wall tiles, rounded on outer corners.
  const PAD = 10, LINE = 2, RAD = 7;
  const mazeCache = {};
  function mazeImage(color) {
    if (mazeCache[color]) return mazeCache[color];
    const c = document.createElement("canvas");
    c.width = W; c.height = ROWS * TILE;
    const x = c.getContext("2d");
    const floor = [];
    for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) {
      if (MAZE[r][cc] !== "#" && !inPen(cc, r)) floor.push([cc, r]);
    }
    for (const cc of [-2, -1, COLS, COLS + 1]) floor.push([cc, TUNNEL_ROW]);   // tunnel runs off the edge
    const pass = (pad, rad, fill) => {
      x.fillStyle = fill;
      x.beginPath();
      for (const [cc, r] of floor) x.roundRect(cc * TILE - pad, r * TILE - pad, TILE + 2 * pad, TILE + 2 * pad, rad);
      x.fill();
    };
    pass(PAD, RAD, color);
    pass(PAD - LINE, RAD - LINE, "#000");
    // pen door: a pink bar across the top of the group chat
    const dy = DOOR.r * TILE + PAD - LINE - 1;
    x.fillStyle = "#000";
    x.fillRect(DOOR.c0 * TILE, dy - 2, (DOOR.c1 - DOOR.c0 + 1) * TILE, LINE + 4);
    x.fillStyle = "#ffb8de";
    x.fillRect(DOOR.c0 * TILE, dy, (DOOR.c1 - DOOR.c0 + 1) * TILE, LINE + 1);
    return (mazeCache[color] = c);
  }

  // ---- State ----------------------------------------------------------------
  const DIRS = {
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  };
  const STILL = { x: 0, y: 0 };
  // tie-break order when two turns are equally good (the original's up, left, down, right)
  const TURN_ORDER = [DIRS.up, DIRS.left, DIRS.down, DIRS.right];

  const dots = new Uint8Array(ROWS * COLS);          // 0 none, 1 dot, 2-5 power-up (see POWER)
  let dotsLeft = 0;
  // The four corner tiles get one of each power-up; which corner gets which turns
  // one step every level, so the Pump.fun pill isn't always in the same place.
  function resetDots() {
    dotsLeft = 0;
    let corner = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const ch = MAZE[r][c];
      const v = ch === "." ? 1 : ch === "o" ? 2 + ((corner++ + level - 1) % 4) : 0;
      dots[r * COLS + c] = v;
      if (v) dotsLeft++;
    }
  }

  const player = { x: START.x, y: START.y, dir: DIRS.left, next: null, face: DIRS.left, moving: false, pause: 0, anim: 0, blinkT: 2, blinking: 0 };

  // The cast. scatter = the corner each heads for in scatter mode (just outside the maze).
  const CHASERS = [
    { name: "gigachad", label: "GIGA CHAD", color: "#ff3b3b", scatter: { c: COLS - 3, r: -3 }, home: { x: 13.5, y: PEN_EXIT.y }, outside: true },
    { name: "pepe",     label: "PEPE",      color: "#4dff73", scatter: { c: 2, r: -3 },        home: { x: 13.5, y: PEN_MID_Y } },
    { name: "pudgy",    label: "PUDGY",     color: "#6fa8ff", scatter: { c: COLS - 1, r: ROWS + 1 }, home: { x: 11.5, y: PEN_MID_Y } },
    { name: "doge",     label: "DOGE",      color: "#ffb84d", scatter: { c: 0, r: ROWS + 1 },  home: { x: 15.5, y: PEN_MID_Y } },
  ].map(g => Object.assign(g, { x: 0, y: 0, dir: DIRS.left, mode: "pen", fright: false, reverse: false, blinkT: 1 + Math.random() * 3, blinking: 0, close: false }));
  const byName = Object.fromEntries(CHASERS.map(g => [g.name, g]));

  let state = "title";        // title | ready | play | dying | clear | over
  let paused = false;
  let stateTime = 0;
  let score = 0, level = 1, lives = 3, extraGiven = false;
  let high = 0;
  try { high = Number(localStorage.getItem("trollman.high")) || 0; } catch (_) { /* storage blocked */ }

  let phaseIdx = 0, phaseT = 0;          // scatter/chase schedule position
  let frightT = 0, frightLen = 0, frightChain = 0;
  let freezeT = 0;                        // short stop after eating a chaser
  let sinceDot = 0;                       // seconds since the last dot: a stalled player lets the next chaser out
  let dotsEatenLevel = 0, lostLifeThisLevel = false, sinceLifeLost = 0;
  const popups = [];                      // floating score numbers and power-up names
  let hidden = null;                      // the chaser being eaten (hidden during the freeze)
  let chasersOff = false;                 // test hook only
  // power-ups
  let stonksT = 0, fomoT = 0, shield = false, shieldGrace = 0;
  const flyers = [];                      // dots on their way to the trollface (FOMO)
  // bonus pickups
  let bonus = null;                       // { kind, pts, t } while one is out
  let bonusSpawned = 0;                   // how many this level
  const bonusHistory = [];                // the last few levels' bonus kinds, for the HUD
  // "Problem?" taunt
  let tauntT = 0, tauntCool = 0;

  function saveHigh() {
    if (score <= high) return;
    high = score;
    try { localStorage.setItem("trollman.high", String(high)); } catch (_) { /* storage blocked */ }
  }

  const chaseMode = () => (phaseIdx % 2 === 1 ? "chase" : "scatter");

  function placeActors() {
    Object.assign(player, { x: START.x, y: START.y, dir: DIRS.left, next: null, face: DIRS.left, moving: false, pause: 0, anim: 0, blinkT: 2, blinking: 0 });
    for (const g of CHASERS) {
      Object.assign(g, { x: g.home.x, y: g.home.y, fright: false, reverse: false });
      g.mode = g.outside ? "out" : "pen";
      g.dir = g.outside ? DIRS.left : (g.name === "pepe" ? DIRS.down : DIRS.up);
    }
    phaseIdx = 0; phaseT = 0;
    frightT = 0; frightChain = 0; freezeT = 0; sinceDot = 0; hidden = null;
    popups.length = 0; flyers.length = 0;
    // a new life or level starts clean: no running power-ups, taunt ready
    stonksT = 0; fomoT = 0; shield = false; shieldGrace = 0;
    tauntT = 0; tauntCool = 0;
    bonus = null;
    for (const g of CHASERS) g.frozen = 0;
  }

  function newLevel() {
    resetDots();
    dotsEatenLevel = 0; lostLifeThisLevel = false; bonusSpawned = 0;
    placeActors();
    const b = bonusFor(level)[0];
    if (bonusHistory[bonusHistory.length - 1] !== `${level}:${b}`) bonusHistory.push(`${level}:${b}`);
    if (bonusHistory.length > 5) bonusHistory.shift();
    setState("ready");
  }

  function newGame() {
    score = 0; level = 1; lives = 3; extraGiven = false; paused = false;
    bonusHistory.length = 0;
    newLevel();
  }

  function setState(s) { state = s; stateTime = 0; }

  // ---- Pen release -------------------------------------------------------------
  // Pepe leaves at once; Pudgy and Doge wait for a number of dots (fewer on later
  // levels). After a lost life they come out on a timer instead. Either way, a player
  // who stops eating for a few seconds gets the next one sent out.
  function releaseDue(g) {
    if (g.name === "pepe") return true;
    if (lostLifeThisLevel) return sinceLifeLost >= (g.name === "pudgy" ? 2.5 : 5);
    const need = g.name === "pudgy" ? (level === 1 ? 30 : 0) : (level === 1 ? 60 : level === 2 ? 50 : 0);
    return dotsEatenLevel >= need;
  }
  function updatePen() {
    const waiting = CHASERS.filter(g => g.mode === "pen");
    if (!waiting.length) return;
    const next = waiting[0];
    if (releaseDue(next) || sinceDot >= (level < 5 ? 4 : 3)) {
      next.mode = "leaving";
      sinceDot = 0;
    }
  }

  // ---- Player movement ---------------------------------------------------------
  const same = (a, b) => a.x === b.x && a.y === b.y;

  // A buffered turn is taken the moment it is legal: reversing any time, a
  // perpendicular turn within TURN_WINDOW of a tile centre (snapping onto it).
  function tryTurn(p) {
    const n = p.next;
    if (!n || same(n, p.dir)) return;
    if (n.x === -p.dir.x && n.y === -p.dir.y) { p.dir = n; return; }
    const cx = Math.round(p.x), cy = Math.round(p.y);
    if (Math.abs(p.x - cx) > TURN_WINDOW || Math.abs(p.y - cy) > TURN_WINDOW) return;
    if (!walkable(wrapC(cx + n.x), cy + n.y)) return;
    p.x = cx; p.y = cy; p.dir = n;
  }

  // Moves along dir by dist tiles, stopping on the last tile centre before a wall.
  function advance(p, dist) {
    const d = p.dir;
    if (!d.x && !d.y) { p.moving = false; return; }
    const horiz = d.x !== 0;
    const s = horiz ? d.x : d.y;
    const pos = horiz ? p.x : p.y;
    const centre = s > 0 ? Math.ceil(pos - 1e-9) : Math.floor(pos + 1e-9);
    const bc = horiz ? wrapC(centre + s) : Math.round(p.x);
    const br = horiz ? Math.round(p.y) : centre + s;
    let np = pos + s * dist;
    p.moving = true;
    if (!walkable(bc, br) && (s > 0 ? np >= centre : np <= centre)) {
      np = centre;
      p.moving = Math.abs(np - pos) > 1e-6;
    }
    if (horiz) {
      p.x = np;
      if (p.x < -0.5) p.x += COLS; else if (p.x >= COLS - 0.5) p.x -= COLS;
    } else p.y = np;
  }

  function eat(p) {
    const c = wrapC(Math.round(p.x)), r = Math.round(p.y);
    if (r < 0 || r >= ROWS) return;
    const i = r * COLS + c, v = dots[i];
    if (!v) return;
    takeDot(i);
    p.pause = v >= 2 ? PILL_PAUSE : DOT_PAUSE;
    if (v >= 2) powerUp(POWER[v]);
  }

  // A dot (or power-up tile) leaves the maze: by mouth, or by FOMO's magnet.
  function takeDot(i) {
    const v = dots[i];
    dots[i] = 0; dotsLeft--; dotsEatenLevel++;
    sinceDot = 0;
    addScore(v >= 2 ? SCORE_PILL : SCORE_DOT);
    if (bonusSpawned < BONUS_AT.length && dotsEatenLevel >= BONUS_AT[bonusSpawned]) {
      bonusSpawned++;
      const [kind, pts] = bonusFor(level);
      bonus = { kind, pts, t: 9 + Math.random() };
    }
    if (dotsLeft === 0) setState("clear");
  }

  const POWER_TEXT = { pump: ["PUMP!", "#55e05f"], stonks: ["STONKS x2", "#16b84a"], fomo: ["FOMO", "#c48bff"], aster: ["SHIELD", "#ffb020"] };
  function powerUp(kind) {
    if (kind === "pump") startFright();
    else if (kind === "stonks") stonksT = STONKS_TIME;
    else if (kind === "fomo") fomoT = FOMO_TIME;
    else if (kind === "aster") shield = true;
    const [label, color] = POWER_TEXT[kind];
    popups.push({ x: player.x, y: player.y - 1, text: label, color, t: 0 });
  }

  // Every point goes through here: Stonks doubles it. Returns what was actually scored.
  function addScore(n) {
    const pts = n * (stonksT > 0 ? 2 : 1);
    score += pts;
    if (!extraGiven && score >= EXTRA_LIFE_AT) { extraGiven = true; lives++; }
    saveHigh();
    return pts;
  }

  // FOMO: every dot within MAGNET_RADIUS is pulled in (power-ups stay put).
  function magnet() {
    const pc = Math.round(player.x), pr = Math.round(player.y), R = Math.ceil(MAGNET_RADIUS);
    for (let r = pr - R; r <= pr + R; r++) {
      if (r < 0 || r >= ROWS) continue;
      for (let cc = pc - R; cc <= pc + R; cc++) {
        const c = wrapC(cc), i = r * COLS + c;
        if (dots[i] !== 1) continue;
        if (Math.hypot(cc - player.x, r - player.y) > MAGNET_RADIUS) continue;
        flyers.push({ x: cc, y: r, t: 0 });
        takeDot(i);
        if (state !== "play") return;
      }
    }
  }

  // ---- Chasers -----------------------------------------------------------------
  function startFright() {
    frightLen = frightTimeFor(level);
    frightChain = 0;
    for (const g of CHASERS) {
      if (g.mode === "eyes" || g.mode === "entering") continue;
      if (g.mode === "out") g.reverse = true;
      g.fright = frightLen > 0;
    }
    frightT = frightLen;
  }

  // The tile each chaser is steering for right now.
  function targetFor(g) {
    if (chaseMode() === "scatter") return g.scatter;
    const pc = wrapC(Math.round(player.x)), pr = Math.round(player.y);
    const fd = player.face;
    switch (g.name) {
      case "gigachad": return { c: pc, r: pr };                                  // straight at you
      case "pepe": return { c: pc + 4 * fd.x, r: pr + 4 * fd.y };                // 4 tiles ahead: the ambush
      case "pudgy": {                                                             // flank off Giga Chad
        const vc = pc + 2 * fd.x, vr = pr + 2 * fd.y, chad = byName.gigachad;
        return { c: 2 * vc - Math.round(chad.x), r: 2 * vr - Math.round(chad.y) };
      }
      case "doge": {                                                              // chases, then loses interest
        const dx = g.x - player.x, dy = g.y - player.y;
        return dx * dx + dy * dy > 64 ? { c: pc, r: pr } : g.scatter;
      }
    }
    return { c: pc, r: pr };
  }

  // At a tile centre: pick the next direction. No reversing; ties go up, left, down, right.
  function decide(g) {
    const c = wrapC(Math.round(g.x)), r = Math.round(g.y);
    const back = { x: -g.dir.x, y: -g.dir.y };
    let opts = TURN_ORDER.filter(d => !same(d, back) && walkable(c + d.x, r + d.y));
    if (!opts.length) opts = [back];
    let pick = opts[0];
    if (g.mode === "eyes") {
      let best = Infinity;
      for (const d of opts) {
        const v = homeDist[(r + d.y) * COLS + wrapC(c + d.x)];
        if (v >= 0 && v < best) { best = v; pick = d; }
      }
    } else if (g.fright) {
      pick = opts[Math.floor(Math.random() * opts.length)];
    } else {
      const t = targetFor(g);
      let best = Infinity;
      for (const d of opts) {
        const dx = c + d.x - t.c, dy = r + d.y - t.r, v = dx * dx + dy * dy;
        if (v < best) { best = v; pick = d; }
      }
    }
    g.x = Math.round(g.x); g.y = r;
    g.dir = pick;
  }

  function speedOf(g) {
    if (g.mode === "eyes" || g.mode === "entering") return BASE_SPEED * 2;
    if (g.mode === "pen" || g.mode === "leaving") return BASE_SPEED * 0.45;
    let s = chaserSpeed();
    if (g.fright) s *= 0.55;
    else if (inTunnel(g.x, g.y)) s *= 0.5;
    else if (g.name === "gigachad") {
      // he speeds up when the maze is nearly empty (the original's "Cruise Elroy")
      if (dotsLeft <= 10) s *= 1.1; else if (dotsLeft <= 20) s *= 1.05;
    }
    return s;
  }

  // Corridor movement: run to the next tile centre, decide there, carry on.
  function moveOut(g, dist) {
    if (g.reverse) { g.reverse = false; g.dir = { x: -g.dir.x, y: -g.dir.y }; }
    let guard = 4;
    while (dist > 1e-9 && guard--) {
      const horiz = g.dir.x !== 0;
      const s = horiz ? g.dir.x : g.dir.y;
      const pos = horiz ? g.x : g.y;
      // the next centre strictly ahead (a chaser sitting on a centre has already decided there)
      const centre = s > 0 ? Math.floor(pos + 1e-9) + 1 : Math.ceil(pos - 1e-9) - 1;
      const gap = Math.abs(centre - pos);
      const stepLen = Math.min(gap, dist);
      if (horiz) g.x += s * stepLen; else g.y += s * stepLen;
      dist -= stepLen;
      if (g.x < -0.5) g.x += COLS; else if (g.x >= COLS - 0.5) g.x -= COLS;
      if (stepLen === gap) {
        if (g.mode === "eyes" && Math.round(g.y) === PEN_EXIT.y && (Math.round(g.x) === 13 || Math.round(g.x) === 14)) {
          g.mode = "entering";
          return;
        }
        decide(g);
      }
    }
  }

  // Scripted moves inside the pen: bob, slide to the door, go up and out / come home.
  function moveTowards(g, tx, ty, dist) {
    const dx = tx - g.x, dy = ty - g.y;
    if (Math.abs(dx) > 1e-6) {
      const m = Math.min(Math.abs(dx), dist);
      g.x += Math.sign(dx) * m; g.dir = dx > 0 ? DIRS.right : DIRS.left; dist -= m;
    }
    if (dist > 0 && Math.abs(dy) > 1e-6) {
      const m = Math.min(Math.abs(dy), dist);
      g.y += Math.sign(dy) * m; g.dir = dy > 0 ? DIRS.down : DIRS.up; dist -= m;
    }
    return Math.abs(tx - g.x) < 1e-6 && Math.abs(ty - g.y) < 1e-6;
  }

  function stepChaser(g, dt) {
    const dist = speedOf(g) * dt;
    if (g.mode === "pen") {
      const top = PEN_MID_Y - 0.5, bottom = PEN_MID_Y + 0.5;
      g.y += (g.dir.y || 1) * dist;
      if (g.y <= top) { g.y = top; g.dir = DIRS.down; }
      if (g.y >= bottom) { g.y = bottom; g.dir = DIRS.up; }
    } else if (g.mode === "leaving") {
      const atX = Math.abs(g.x - PEN_EXIT.x) < 1e-6;
      if (moveTowards(g, PEN_EXIT.x, atX ? PEN_EXIT.y : g.y, dist) && atX) {
        g.mode = "out"; g.dir = DIRS.left;
      }
    } else if (g.mode === "entering") {
      if (moveTowards(g, PEN_EXIT.x, PEN_MID_Y, dist)) {
        g.fright = false;
        g.mode = "leaving";                  // back to life, straight back out
      }
    } else {
      moveOut(g, dist);
    }
  }

  function wrapDist(a, b) {
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    return Math.hypot(Math.min(dx, COLS - dx), dy);
  }

  function checkCatch() {
    for (const g of CHASERS) {
      if (g.mode !== "out" || wrapDist(g, player) > 0.6) continue;
      if (g.fright) {
        frightChain++;
        const pts = addScore(200 * 2 ** Math.min(frightChain - 1, 3));
        popups.push({ x: g.x, y: g.y, text: String(pts), t: 0 });
        g.fright = false;
        g.mode = "eyes";
        hidden = g;
        freezeT = EAT_FREEZE;
        return;
      }
      if (shieldGrace > 0) continue;
      if (shield) {
        // Aster takes the hit: the chaser bounces off and is sent back to the pen
        shield = false;
        shieldGrace = SHIELD_GRACE;
        g.mode = "eyes"; g.frozen = 0;
        popups.push({ x: player.x, y: player.y - 1, text: "BLOCKED", color: "#ffb020", t: 0 });
        continue;
      }
      setState("dying");
      return;
    }
  }

  // "Problem?": the trollface stops to laugh; chasers within TAUNT_RADIUS freeze.
  function taunt() {
    if (state !== "play" || paused || freezeT > 0 || tauntT > 0 || tauntCool > 0) return false;
    tauntT = TAUNT_TIME;
    tauntCool = TAUNT_COOLDOWN;
    for (const g of CHASERS) {
      if (g.mode === "out" && wrapDist(g, player) <= TAUNT_RADIUS) g.frozen = TAUNT_FREEZE;
    }
    return true;
  }

  // Timers for everything phase 3 added; they all stop while the game is frozen.
  function stepExtras(dt) {
    if (stonksT > 0) stonksT = Math.max(0, stonksT - dt);
    if (fomoT > 0) { fomoT = Math.max(0, fomoT - dt); magnet(); }
    if (shieldGrace > 0) shieldGrace = Math.max(0, shieldGrace - dt);
    if (tauntCool > 0) tauntCool = Math.max(0, tauntCool - dt);
    for (const f of flyers) f.t += dt;
    while (flyers.length && flyers[0].t > 0.18) flyers.shift();
    if (bonus) {
      bonus.t -= dt;
      if (bonus.t <= 0) bonus = null;
      else if (wrapDist(BONUS_SPOT, player) < 0.6) {
        const pts = addScore(bonus.pts);
        popups.push({ x: BONUS_SPOT.x, y: BONUS_SPOT.y, text: String(pts), color: "#ffb8de", t: 0 });
        bonus = null;
      }
    }
  }

  function stepPlay(dt) {
    if (freezeT > 0) {
      freezeT -= dt;
      if (freezeT <= 0) hidden = null;
      // eyes keep heading home during the freeze, everything else holds still
      for (const g of CHASERS) if (g.mode === "eyes" && g !== hidden) stepChaser(g, dt);
      return;
    }
    // scatter/chase clock (stopped while the chasers are blue)
    if (frightT > 0) {
      frightT -= dt;
      if (frightT <= 0) { frightT = 0; for (const g of CHASERS) g.fright = false; }
    } else {
      phaseT += dt;
      const sched = schedule(level);
      if (phaseT >= sched[phaseIdx]) {
        phaseT = 0; phaseIdx = Math.min(phaseIdx + 1, sched.length - 1);
        for (const g of CHASERS) if (g.mode === "out") g.reverse = true;
      }
    }
    sinceDot += dt;
    if (lostLifeThisLevel) sinceLifeLost += dt;
    if (!chasersOff) updatePen();

    stepExtras(dt);
    if (state !== "play") return;

    const p = player;
    tryTurn(p);
    if (tauntT > 0) { tauntT = Math.max(0, tauntT - dt); p.moving = false; }   // standing there laughing
    else if (p.pause > 0) p.pause = Math.max(0, p.pause - dt);
    else {
      advance(p, playerSpeed() * dt);
      tryTurn(p);
      if (p.dir.x || p.dir.y) p.face = p.dir;
      eat(p);
      if (state !== "play") return;
    }
    if (!chasersOff) {
      checkCatch();
      if (state !== "play" || freezeT > 0) return;
      for (const g of CHASERS) {
        if (g.frozen > 0) { g.frozen = Math.max(0, g.frozen - dt); continue; }
        stepChaser(g, dt);
      }
      checkCatch();
    }
  }

  function loseLife() {
    lives--;
    if (lives <= 0) { saveHigh(); setState("over"); return; }
    lostLifeThisLevel = true; sinceLifeLost = 0;
    placeActors();
    setState("ready");
  }

  // ---- Animation clocks ---------------------------------------------------------
  // Eyes shut for BLINK_LEN every 2-4.5s, each actor on its own random beat.
  function tickBlink(a, dt) {
    if (a.blinking > 0) { a.blinking -= dt; return; }
    a.blinkT -= dt;
    if (a.blinkT <= 0) { a.blinking = BLINK_LEN; a.blinkT = 2 + Math.random() * 2.5; }
  }
  function animate(dt) {
    const p = player;
    // the chomp clock runs only while he's moving; standing still, he blinks instead
    if (state === "play" && p.moving && freezeT <= 0) { p.anim += dt; p.blinking = 0; }
    else tickBlink(p, dt);
    for (const g of CHASERS) {
      tickBlink(g, dt);
      // grins when closing in; the 5/7 tile gap stops it flickering at the edge
      const d = wrapDist(g, player);
      g.close = g.mode === "out" && !g.fright && chaseMode() === "chase" && (g.close ? d < 7 : d < 5);
    }
  }

  // ---- Loop -----------------------------------------------------------------
  let timeScale = 1;
  function update(dt) {
    stateTime += dt;
    for (const pp of popups) pp.t += dt;
    while (popups.length && popups[0].t > 1.2) popups.shift();
    if (paused) return;
    if (state !== "title" && state !== "over") animate(dt);
    if (state === "ready") { if (stateTime >= READY_TIME) setState("play"); }
    else if (state === "play") stepPlay(dt);
    else if (state === "dying" && stateTime >= DEATH_TIME) loseLife();
    else if (state === "clear" && stateTime >= CLEAR_TIME) { level++; newLevel(); }
    else if (state === "over" && stateTime >= 6) setState("title");
  }

  let last = 0;
  function frame(t) {
    const dt = Math.min(1 / 20, (t - (last || t)) / 1000) * timeScale;
    last = t;
    // fixed sub-steps keep turns and wall stops exact at any frame rate
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    for (let i = 0; i < steps; i++) update(dt / steps);
    draw();
    requestAnimationFrame(frame);
  }

  // ---- Drawing --------------------------------------------------------------
  const px = c => c * TILE + TILE / 2;               // tile centre -> canvas x
  const py = r => (r + TOP) * TILE + TILE / 2;       // tile centre -> canvas y

  function text(str, x, y, color, size = 8, align = "left") {
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  // Faces are drawn facing right; left is a mirror, up/down a quarter turn.
  function drawFace(img, cx, cy, dir, scale = 1, spin = 0) {
    if (!img || (img instanceof HTMLImageElement && !ready(img))) return;
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    if (spin) ctx.rotate(spin);
    if (dir.x < 0) ctx.scale(-1, 1);
    else if (dir.y < 0) ctx.rotate(-Math.PI / 2);
    else if (dir.y > 0) ctx.rotate(Math.PI / 2);
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.drawImage(img, -16, -16, 32, 32);
    ctx.restore();
  }

  // What each actor looks like this frame. Pure reads: all timers live in update().
  // Trollface: chomps (f1/f3) while moving, blinks (f2) now and then while standing.
  function playerLook() {
    const p = player;
    if (state === "play" && tauntT > 0) return Math.floor(tauntT / 0.06) % 2 ? "f3" : "f1";   // the laugh
    if (state === "play" && p.moving && freezeT <= 0) return Math.floor(p.anim / CHOMP) % 2 ? "f3" : "f1";
    return p.blinking > 0 ? "f2" : "f1";
  }

  // Chasers: f1 normally, f3 (grin / wow / beak open) when closing in, f2 to blink or
  // when stunned by the taunt, blue when frightened, white flashes as it wears off,
  // eyes when eaten.
  function chaserLook(g) {
    if (g.mode === "eyes" || g.mode === "entering") return "eyes";
    if (g.fright) return frightT < Math.min(2, frightLen / 2) && Math.floor(frightT / 0.2) % 2 === 0 ? "white" : "blue";
    if (g.frozen > 0 || g.blinking > 0) return "f2";
    return g.close ? "f3" : "f1";
  }
  function lookImage(name, look) {
    if (look === "blue" || look === "white") return recoloured(`${name}-f1`, look === "white");
    return sprites[`${name}-${look}`];
  }
  // In the pen they bob up and down but keep facing the middle; elsewhere they face their way.
  const chaserFacing = g => (g.mode === "pen" ? (g.home.x > PEN_EXIT.x ? DIRS.left : DIRS.right) : g.dir);

  // An eaten chaser is just its eyes, looking the way it's going.
  function drawEyes(g) {
    const cx = Math.round(px(g.x)), cy = Math.round(py(g.y));
    for (const ox of [-5, 5]) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(cx + ox - 3, cy - 4, 6, 8);
      ctx.fillRect(cx + ox - 4, cy - 3, 8, 6);
      ctx.fillStyle = "#2121de";
      ctx.fillRect(cx + ox - 1 + g.dir.x * 2, cy - 1 + g.dir.y * 2, 3, 3);
    }
  }

  function drawChasers() {
    for (const g of CHASERS) {
      if (g === hidden) continue;
      const look = chaserLook(g);
      if (frameLog) frameLog.chasers[g.name] = look;
      if (look === "eyes") { drawEyes(g); continue; }
      const shake = g.frozen > 0 ? (Math.floor(stateTime * 30) % 2 ? 1 : -1) : 0;   // stunned: a little shiver
      drawFace(lookImage(g.name, look), px(g.x) + shake, py(g.y), chaserFacing(g));
    }
  }

  function drawDots() {
    const blinkOn = state !== "play" || Math.floor(stateTime / 0.2) % 2 === 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const v = dots[r * COLS + c];
      if (!v) continue;
      if (v === 1) {
        ctx.fillStyle = "#ffb8ae";
        ctx.fillRect(px(c) - 2, py(r) - 2, 4, 4);
      } else if (blinkOn) {
        ctx.drawImage(ICONS[POWER[v]], px(c) - PILL / 2, py(r) - PILL / 2);
      }
    }
  }

  // Aster's shield: eight gold sparks circling the trollface.
  function drawShield() {
    const cx = Math.round(px(player.x)), cy = Math.round(py(player.y));
    const spin = stateTime * 3;
    for (let k = 0; k < 8; k++) {
      const a = spin + k * Math.PI / 4;
      const sx = Math.round(cx + Math.cos(a) * 19), sy = Math.round(cy + Math.sin(a) * 19);
      ctx.fillStyle = k % 2 ? "#ffe08a" : "#ffb020";
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
    }
  }

  // FOMO: dots sliding into the trollface.
  function drawFlyers() {
    ctx.fillStyle = "#ffb8ae";
    for (const f of flyers) {
      const k = Math.min(1, f.t / 0.18);
      ctx.fillRect(Math.round(px(f.x + (player.x - f.x) * k)) - 2, Math.round(py(f.y + (player.y - f.y) * k)) - 2, 4, 4);
    }
  }

  function drawTauntBubble() {
    const cx = Math.round(px(player.x)), y = Math.round(py(player.y)) - 34;
    const w = 76, x0 = Math.max(2, Math.min(W - w - 2, cx - w / 2));
    ctx.fillStyle = "#fff"; ctx.fillRect(x0, y, w, 16);
    ctx.fillStyle = "#000"; ctx.fillRect(x0 + 1, y + 1, w - 2, 14);
    ctx.fillStyle = "#fff"; ctx.fillRect(cx - 2, y + 16, 4, 3);
    text("PROBLEM?", x0 + w / 2, y + 4, "#fff", 8, "center");
  }

  function drawHud() {
    const pad = (n, w) => String(n).padStart(w, " ");
    if (state !== "play" || Math.floor(stateTime / 0.27) % 2 === 0) text("1UP", 3 * TILE, 8, "#fff");
    text("HIGH SCORE", W / 2, 8, "#fff", 8, "center");
    text(pad(score || "00", 7), 1 * TILE, 22, "#fff");
    text(pad(high || "00", 7), W / 2 + 2 * TILE, 22, "#fff", 8, "right");
    if (state === "title") return;

    // top right: the level, then whatever power-ups are running, each with a time bar
    text(`LV ${level}`, W - TILE, 8, "#ffcc00", 8, "right");
    const running = [];
    if (stonksT > 0) running.push(["stonks", stonksT / STONKS_TIME]);
    if (fomoT > 0) running.push(["fomo", fomoT / FOMO_TIME]);
    if (shield) running.push(["aster", 1]);
    running.forEach(([kind, left], i) => {
      const x0 = W - TILE - (i + 1) * 26 + 4;
      ctx.drawImage(ICONS[kind], x0, 19);
      ctx.fillStyle = "#333"; ctx.fillRect(x0, 43, 22, 2);
      ctx.fillStyle = "#fff"; ctx.fillRect(x0, 43, Math.round(22 * left), 2);
    });

    // bottom: lives on the left, the taunt in the middle, this run's bonus pickups on the right
    const by = (TOP + ROWS) * TILE + 2;
    const waiting = state === "over" ? 0 : Math.max(0, lives - 1);
    for (let i = 0; i < Math.min(waiting, 5); i++) drawFace(sprites["trollface-f1"], 2 * TILE + i * 34, by + 14, DIRS.left);
    const tauntReady = tauntCool <= 0;
    text("PROBLEM?", W / 2 + 8, by + 6, tauntReady ? "#ffcc00" : "#555", 8, "center");
    if (!tauntReady) {
      ctx.fillStyle = "#555"; ctx.fillRect(W / 2 + 8 - 32, by + 18, 64, 2);
      ctx.fillStyle = "#ffcc00"; ctx.fillRect(W / 2 + 8 - 32, by + 18, Math.round(64 * (1 - tauntCool / TAUNT_COOLDOWN)), 2);
    }
    bonusHistory.slice(-4).forEach((key, i, arr) => {
      const icon = iconFor(key.split(":")[1]);
      if (icon) ctx.drawImage(icon, W - TILE - (arr.length - i) * 26 + 2, by + 3);
    });
  }

  // Attract screen: the cast, like the original's character / nickname roll call.
  const NICKS = {
    gigachad: "\"HE JUST WALKS AT YOU\"", pepe: "\"FEELS BAD, MAN\"",
    pudgy: "\"WADDLES WITH THE PACK\"", doge: "\"SUCH PURSUIT\"",
  };
  function drawTitle() {
    text("CHARACTER / NICKNAME", W / 2, py(1), "#fff", 8, "center");
    CHASERS.forEach((g, i) => {
      const y = py(4 + i * 3);
      if (stateTime < 0.5 + i * 0.6) return;     // roll them in one by one
      drawFace(sprites[`${g.name}-f1`], 4 * TILE, y, DIRS.right);
      text(g.label, 7 * TILE, y - 10, g.color);
      text(NICKS[g.name], 7 * TILE, y + 4, g.color);
    });
    if (stateTime > 3.2) {
      drawFace(sprites["trollface-f1"], W / 2, py(16), DIRS.right);
      text("YOU ARE THE TROLL", W / 2, py(17) + 6, "#fff", 8, "center");
      ctx.fillStyle = "#ffb8ae"; ctx.fillRect(W / 2 - 42, py(19) + 2, 4, 4);
      text("10 PTS", W / 2 - 26, py(19), "#fff");
    }
    // the four power-ups, rolled in after the troll
    const POWERS = [["pump", "PUMP", "#55e05f"], ["stonks", "STONKS", "#16b84a"], ["fomo", "FOMO", "#c48bff"], ["aster", "ASTER", "#ffb020"]];
    POWERS.forEach(([kind, label, color], i) => {
      if (stateTime < 3.8 + i * 0.3) return;
      const cx = W / 2 + (i - 1.5) * 92;
      ctx.drawImage(ICONS[kind], cx - PILL / 2, py(21) - PILL / 2);
      text(label, cx, py(22) + 4, color, 8, "center");
    });
    if (Math.floor(stateTime / 0.5) % 2 === 0) text("PRESS START", W / 2, py(25), "#ffcc00", 8, "center");
    text("ENTER / TAP", W / 2, py(26) + 4, "#888", 8, "center");
    text("SPACE = PROBLEM?", W / 2, py(27) + 4, "#888", 8, "center");
  }

  // Debug builds keep the last few hundred frames' looks so the animation test can read them.
  let frameLog = null;
  const frameLogs = /[?&]debug\b/.test(location.search) ? [] : null;

  function draw() {
    frameLog = frameLogs ? { t: performance.now(), state, player: null, chasers: {}, maze: null } : null;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (state === "title") { drawHud(); drawTitle(); logFrame(); return; }

    const color = MAZE_COLORS[Math.floor((level - 1) / 2) % MAZE_COLORS.length];
    const flash = state === "clear" && stateTime > CLEAR_HOLD && Math.floor((stateTime - CLEAR_HOLD) / 0.2) % 2 === 0;
    ctx.drawImage(mazeImage(flash ? "#ffffff" : color), 0, TOP * TILE);
    if (frameLog) frameLog.maze = flash ? "flash" : "colour";
    drawDots();
    // the bonus pickup, blinking in its last two seconds
    if (bonus && state === "play" && (bonus.t > 2 || Math.floor(bonus.t / 0.15) % 2 === 0)) {
      const icon = iconFor(bonus.kind);
      if (icon) ctx.drawImage(icon, Math.round(px(BONUS_SPOT.x)) - 12, Math.round(py(BONUS_SPOT.y)) - 12);
    }
    drawFlyers();

    const showChasers = !chasersOff && (state === "ready" || state === "play" ||
      (state === "dying" && stateTime < DEATH_HOLD) || (state === "clear" && stateTime < CLEAR_HOLD));
    if (state === "dying" && stateTime >= DEATH_HOLD) {
      // the spin-out: the grin spins away and shrinks to nothing
      const k = Math.min(1, (stateTime - DEATH_HOLD) / (DEATH_TIME - DEATH_HOLD - 0.3));
      if (k < 1) drawFace(sprites["trollface-f3"], px(player.x), py(player.y), player.face, 1 - k, k * Math.PI * 6);
      if (frameLog) frameLog.player = k < 1 ? `spin:${(1 - k).toFixed(2)}` : "gone";
    } else if (!(freezeT > 0 && hidden)) {
      const look = playerLook();
      // after Aster blocks a hit he flickers through the grace period
      const flicker = shieldGrace > 0 && Math.floor(shieldGrace / 0.08) % 2 === 0;
      if (shield && state === "play") drawShield();
      if (!flicker) drawFace(sprites[`trollface-${look}`], px(player.x), py(player.y), player.face);
      if (frameLog) { frameLog.player = flicker ? "flicker" : look; frameLog.shield = shield; }
    } else if (frameLog) frameLog.player = "hidden";
    if (showChasers) drawChasers();
    if (state === "play" && tauntT > 0) drawTauntBubble();

    for (const pp of popups) text(pp.text, Math.round(px(pp.x)), Math.round(py(pp.y) - 4 - pp.t * 6), pp.color || "#4deeff", 8, "center");

    if (state === "ready") text("READY!", W / 2, py(16) - 4, "#ffcc00", 8, "center");
    if (state === "over") text("GAME  OVER", W / 2, py(16) - 4, "#ff3b3b", 8, "center");
    if (paused) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, TOP * TILE, W, ROWS * TILE);
      text("PAUSED", W / 2, py(16) - 4, "#fff", 8, "center");
    }
    drawHud();
    logFrame();
  }

  function logFrame() {
    if (!frameLog) return;
    frameLogs.push(frameLog);
    if (frameLogs.length > 900) frameLogs.splice(0, frameLogs.length - 900);
  }

  // ---- Input ----------------------------------------------------------------
  const KEYS = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
    a: "left", d: "right", w: "up", s: "down", A: "left", D: "right", W: "up", S: "down",
  };

  function steer(name) {
    if (state === "title" || state === "over") return;
    player.next = DIRS[name];
  }

  function togglePause() {
    if (state === "title" || state === "over") return;
    paused = !paused;
  }

  window.addEventListener("keydown", e => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (KEYS[e.key]) {
      e.preventDefault();
      if (state === "title") { newGame(); return; }
      steer(KEYS[e.key]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (state === "title" || state === "over") newGame();
      else if (e.key === " ") taunt();
    } else if (e.key === "t" || e.key === "T") {
      taunt();
    } else if (e.key === "p" || e.key === "P" || e.key === "Escape") {
      togglePause();
    }
  });

  // Swipe anywhere on the screen; a tap starts the game. (The joystick comes in phase 4.)
  let touch0 = null;
  canvas.addEventListener("touchstart", e => {
    const t = e.changedTouches[0];
    touch0 = { x: t.clientX, y: t.clientY };
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener("touchmove", e => {
    if (!touch0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch0.x, dy = t.clientY - touch0.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    touch0 = { x: t.clientX, y: t.clientY };
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener("touchend", e => {
    if (touch0 && (state === "title" || state === "over")) newGame();
    touch0 = null;
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener("click", () => {
    canvas.focus();
    if (state === "title" || state === "over") newGame();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "play") paused = true; });

  // ---- Test hook (only with ?debug in the URL) --------------------------------
  if (/[?&]debug\b/.test(location.search)) {
    window.__tm = {
      MAZE, ROWS, COLS, walkable, targetFor, CHASERS, player, dots, homeDist,
      get state() { return state; }, get level() { return level; }, get score() { return score; },
      get lives() { return lives; }, get dotsLeft() { return dotsLeft; },
      get frightT() { return frightT; }, get mode() { return chaseMode(); },
      setTimeScale(s) { timeScale = s; },
      setChasersOff(v) { chasersOff = v; },
      frames: frameLogs,
      startFright, setState, taunt, powerUp,
      get bonus() { return bonus; }, get shield() { return shield; }, get stonksT() { return stonksT; }, get fomoT() { return fomoT; },
      get tauntCool() { return tauntCool; },
      setDotsEaten(n) { dotsEatenLevel = n; },
      setPhase(i) { phaseIdx = i; phaseT = 0; },
      leaveOneDot(c, r) { dots.fill(0); dots[r * COLS + c] = 1; dotsLeft = 1; },
    };
  }

  // Draw the HUD in the arcade font once it's loaded; the loop starts either way.
  if (document.fonts && document.fonts.load) document.fonts.load(`8px ${FONT}`).catch(() => {});
  canvas.focus({ preventScroll: true });
  requestAnimationFrame(frame);
})();
