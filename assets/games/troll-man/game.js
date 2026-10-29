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

  // Four mazes, one per level, round and round. Each is the left half; the right
  // half is its mirror. The pen, the tunnel row, the start tile and the four
  // power-up corners sit in the same place in every one.
  // # wall   . dot   o power-up (one of each logo)   - pen door   space = floor with no dot
  const HALVES = [[
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
  ], [
    "##############",
    "#............#",
    "#.##.####.##.#",
    "#o##.####.##.#",
    "#.##.####.##.#",
    "#.............",
    "#.##.####.##.#",
    "#.##.####.##.#",
    "#......##....#",
    "######.## ####",
    "######.## ####",
    "######.##     ",
    "######.## ###-",
    "      .   #   ",
    "######.## #   ",
    "######.## ####",
    "######.## ####",
    "######.## ####",
    "#............#",
    "#.##.####.##.#",
    "#.##.####.##.#",
    "#o............",
    "###.##.##.####",
    "###.##.##.####",
    "#......##.....",
    "#.##########.#",
    "#.##########.#",
    "#.............",
    "##############",
  ], [
    "##############",
    "#.............",
    "#.####.####.##",
    "#o####.####.##",
    "#.####.####.##",
    "#......##.....",
    "#.####.##.##.#",
    "#.####.##.##.#",
    "#......##....#",
    "####.#### ####",
    "####.#### ####",
    "####.####     ",
    "####.#### ###-",
    "    .     #   ",
    "####.#### #   ",
    "####.#### ####",
    "####.#### ####",
    "####.#### ####",
    "#...........##",
    "#.####.####.##",
    "#.####.####.##",
    "#o............",
    "####.#### ####",
    "####.#### ####",
    "#.............",
    "#.####.#####.#",
    "#.####.#####.#",
    "#.............",
    "##############",
  ], [
    "##############",
    "#............#",
    "#.##.##.####.#",
    "#o##.##.####.#",
    "#.##.##.####.#",
    "#.............",
    "#.####.#####.#",
    "#.####.#####.#",
    "#......##....#",
    "#.####### ####",
    "#.####### ####",
    "#.#######     ",
    "#.####### ###-",
    "      .   #   ",
    "#.####### #   ",
    "#.####### ####",
    "#.####### ####",
    "#.####### ####",
    "#...........##",
    "#.##.######.##",
    "#.##.######.##",
    "#o............",
    "###.#####.####",
    "###.#####.####",
    "#......##.....",
    "#.####.#####.#",
    "#.####.#####.#",
    "#.............",
    "##############",
  ]];
  const MAZES = HALVES.map(half => half.map(row => row + [...row].reverse().join("")));
  const mazeFor = lv => (lv - 1) % MAZES.length;
  let mazeIdx = 0, MAZE = MAZES[0];

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

  // Steps from every floor tile to the pen exit, for eaten chasers (eyes) heading
  // home. One table per maze, built the first time that maze comes up.
  const homeDists = [];
  let homeDist = null;
  function buildHomeDist() {
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
  }
  // Swap in the maze this level plays on.
  function applyMaze(lv) {
    mazeIdx = mazeFor(lv);
    MAZE = MAZES[mazeIdx];
    homeDist = homeDists[mazeIdx] || (homeDists[mazeIdx] = buildHomeDist());
  }
  applyMaze(1);

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
  const STONKS_TIME = 14;                        // score x2
  const FOMO_TIME = 10, MAGNET_RADIUS = 2.5;     // dots this close fly to you
  const SHIELD_GRACE = 1.0;                      // after Aster blocks a hit, no catching for this long
  // Bonus pickups under the pen, twice a level
  const BONUS_AT = [70, 170];                    // dots eaten
  const BONUS_SPOT = { x: 13.5, y: 21 };
  const BONUS_TABLE = [["coin", 100], ["sticker", 300], ["rolex", 500], ["rolex", 500], ["keyboard", 700],
    ["keyboard", 700], ["coin", 1000], ["sticker", 2000], ["rolex", 3000], ["keyboard", 5000]];
  const bonusFor = lv => BONUS_TABLE[Math.min(lv, BONUS_TABLE.length) - 1];
  // "Problem?" taunt
  const TAUNT_TIME = 0.6, TAUNT_COOLDOWN = 10, TAUNT_RADIUS = 3, TAUNT_FREEZE = 1.2;
  const MAZE_COLORS = ["#2121de", "#de2121", "#21b04a", "#c021de", "#de8a21"];   // one per level, with the maze

  // Difficulty climbs a step every level, all the way to level 21, instead of
  // topping out early: he gets quicker, the chasers close the gap, scatter gets
  // shorter, the pill wears off sooner, Giga Chad's end-of-maze rush starts earlier.
  const levelSpeedUp = level => Math.min(1.5, 1 + (level - 1) * 0.025);
  const playerSpeed = () => BASE_SPEED * levelSpeedUp(level) * (frightT > 0 ? 1.06 : 1);
  // the chasers start a step slower and gain on him every level, up to a hair under his pace
  const chaserSpeed = () => BASE_SPEED * Math.min(0.985 * levelSpeedUp(level), 0.86 + (level - 1) * 0.045);

  // Scatter / chase schedule in seconds (scatter first), like the original's per-level table.
  function schedule(lv) {
    if (lv === 1) return [7, 20, 7, 20, 5, 20, 5, Infinity];
    if (lv <= 4) return [7, 20, 7, 20, 5, 60, 1, Infinity];
    if (lv <= 8) return [5, 20, 5, 20, 5, 60, 1, Infinity];
    if (lv <= 12) return [4, 20, 4, 20, 3, 60, 1, Infinity];
    return [3, 20, 3, 20, 2, 60, 1, Infinity];
  }
  // Pump.fun pill: how long the chasers stay blue, per level. Long early, a second by the end.
  const FRIGHT_TIME = [9, 8, 7, 7, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 1];
  const frightTimeFor = lv => FRIGHT_TIME[Math.min(lv, FRIGHT_TIME.length) - 1];

  // ---- Canvas ---------------------------------------------------------------
  const canvas = document.getElementById("tm-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  const FONT = "'Press Start 2P', monospace";
  const TOUCH = window.matchMedia && matchMedia("(pointer: coarse)").matches;
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
    // Stonks (stonk.fun): the app icon, a near-black tile with the two-tone blue
    // S-mark, traced from the site's stonk-mark.svg (295x289 box) and shrunk to fit
    stonks: pixelIcon(PILL, ["#000000", "#0a1419", "#a4c5cf", "#69aac1"], x => {
      badge(x, "#0a1419");
      x.translate(2.5, 2.7); x.scale(17 / 295.81, 17 / 295.81);
      x.fillStyle = "#a4c5cf";
      x.fill(new Path2D("M294.17,44.74l-52.35,72.78c-2.98,4.18-8.9,4.81-12.8,1.44-13.65-11.86-32.92-16.66-51.46-10.98l-58.76,18c-16.66,5.1-34.26-4.26-39.36-20.9l-1-3.27c-5.1-16.63,4.28-34.29,20.89-39.38l58.76-18c13.82-4.23,25.18-13.62,31.98-26.38,1.97-3.71,3.5-7.61,4.55-11.58,1.3-4.95,6.57-7.7,11.4-5.93l84.09,30.95c5.4,1.99,7.41,8.58,4.06,13.25Z"));
      x.fillStyle = "#69aac1";
      x.fill(new Path2D("M5.7,257.7l84.14,30.96c4.81,1.79,10.07-1,11.41-5.98,4.67-17.47,17.93-32.24,36.47-37.92l58.76-18c16.66-5.1,25.99-22.72,20.9-39.36l-1-3.27c-5.1-16.63-22.75-26.01-39.36-20.92l-58.76,18c-13.82,4.23-28.49,2.83-41.27-3.94-3.71-1.97-7.16-4.34-10.26-7.04-3.85-3.37-9.76-2.7-12.77,1.47L1.64,244.44c-3.35,4.68-1.34,11.26,4.06,13.25Z"));
    }),
    // FOMO (fomo.family): the app icon, a navy tile with the white double-loop
    // wordmark: two linked rounded loops, each with a slanted bar cutting its hole
    fomo: pixelIcon(PILL, ["#000000", "#0b0a1f", "#ffffff"], x => {
      badge(x, "#0b0a1f");
      // one white mass of two overlapping loops, then a slanted hole cut out of each
      x.fillStyle = "#fff";
      for (const cx of [7.8, 14.2]) { x.beginPath(); x.ellipse(cx, 11, 5.4, 4.3, 0, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = "#0b0a1f";
      for (const cx of [7.3, 14.7]) {
        x.beginPath(); x.moveTo(cx - 2.4, 13.2); x.lineTo(cx + 1.2, 13.2); x.lineTo(cx + 2.4, 8.8); x.lineTo(cx - 1.2, 8.8); x.closePath(); x.fill();
      }
    }),
    // Aster (asterdex.com): the sand-gold disc with the four-point star cut into it
    aster: pixelIcon(PILL, ["#000000", "#e9cda4", "#cfa66e"], x => {
      x.fillStyle = "#000"; x.beginPath(); x.arc(11, 11, 10.8, 0, Math.PI * 2); x.fill();
      const g = x.createLinearGradient(2, 2, 20, 20);
      g.addColorStop(0, "#e9cda4"); g.addColorStop(1, "#cfa66e");
      x.fillStyle = g; x.beginPath(); x.arc(11, 11, 9.3, 0, Math.PI * 2); x.fill();
      // four cuts from the rim to the centre, each bowing a little clockwise
      x.strokeStyle = "#000"; x.lineWidth = 1.8; x.lineCap = "butt";
      x.translate(11, 11);
      for (let k = 0; k < 4; k++) {
        x.beginPath(); x.moveTo(0, -10.5); x.quadraticCurveTo(2.6, -5.2, 0, 0); x.stroke();
        x.rotate(Math.PI / 2);
      }
      // the star in the middle: where the cuts meet, the gaps widen
      x.fillStyle = "#000"; x.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 - Math.PI / 2, r = k % 2 ? 1.4 : 4.2;
        x[k ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r);
      }
      x.closePath(); x.fill();
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
    const key = `${mazeIdx}:${color}`;
    if (mazeCache[key]) return mazeCache[key];
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
    return (mazeCache[key] = c);
  }

  // ---- State ----------------------------------------------------------------
  const DIRS = {
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  };
  const STILL = { x: 0, y: 0 };
  // tie-break order when two turns are equally good (the original's up, left, down, right)
  const TURN_ORDER = [DIRS.up, DIRS.left, DIRS.down, DIRS.right];

  const dots = new Uint8Array(ROWS * COLS);          // 0 none, 1 dot, 2-5 power-up (see POWER)
  let dotsLeft = 0, dotsTotal = 0;
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
    dotsTotal = dotsLeft;
  }

  const player = { x: START.x, y: START.y, dir: DIRS.left, next: null, face: DIRS.left, moving: false, pause: 0, anim: 0, blinkT: 2, blinking: 0 };

  // The cast. scatter = the corner each heads for in scatter mode (just outside the maze).
  // All four start in the group chat, a little overlapped so they fit.
  const CHASERS = [
    { name: "gigachad", label: "GIGA CHAD", color: "#ff3b3b", scatter: { c: COLS - 3, r: -3 }, home: { x: 12.75, y: PEN_MID_Y } },
    { name: "pepe",     label: "PEPE",      color: "#4dff73", scatter: { c: 2, r: -3 },        home: { x: 14.25, y: PEN_MID_Y } },
    { name: "pudgy",    label: "PUDGY",     color: "#6fa8ff", scatter: { c: COLS - 1, r: ROWS + 1 }, home: { x: 11.25, y: PEN_MID_Y } },
    { name: "doge",     label: "DOGE",      color: "#ffb84d", scatter: { c: 0, r: ROWS + 1 },  home: { x: 15.75, y: PEN_MID_Y } },
  ].map(g => Object.assign(g, { x: 0, y: 0, dir: DIRS.left, mode: "pen", fright: false, reverse: false, blinkT: 1 + Math.random() * 3, blinking: 0, close: false }));
  const byName = Object.fromEntries(CHASERS.map(g => [g.name, g]));

  // title | ready | play | dying | clear | intermission | turnover | over
  // (the attract demo runs the normal states with demo = true)
  let state = "title";
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
    if (demo || score <= high) return;
    high = score;
    try { localStorage.setItem("trollman.high", String(high)); } catch (_) { /* storage blocked */ }
  }

  const chaseMode = () => (phaseIdx % 2 === 1 ? "chase" : "scatter");

  function placeActors() {
    Object.assign(player, { x: START.x, y: START.y, dir: DIRS.left, next: null, face: DIRS.left, moving: false, pause: 0, anim: 0, blinkT: 2, blinking: 0 });
    for (const g of CHASERS) {
      Object.assign(g, { x: g.home.x, y: g.home.y, fright: false, reverse: false });
      g.mode = "pen";
      g.dir = g.name === "pepe" || g.name === "pudgy" ? DIRS.down : DIRS.up;   // out of step, so the overlap shifts
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

  // A fresh maze for the current player's level.
  function levelData() {
    applyMaze(level);
    resetDots();
    dotsEatenLevel = 0; lostLifeThisLevel = false; bonusSpawned = 0;
    const b = bonusFor(level)[0];
    if (bonusHistory[bonusHistory.length - 1] !== `${level}:${b}`) bonusHistory.push(`${level}:${b}`);
    if (bonusHistory.length > 5) bonusHistory.shift();
  }

  function newLevel() {
    levelData();
    placeActors();
    setState("ready");
  }

  // ---- Players: one, or two taking turns (hot seat) --------------------------------
  // The player whose turn it is lives in the globals above (score, level, lives, dots...);
  // the other one waits in their slot and swaps in when the turn changes, maze and all.
  let numPlayers = 1, cur = 0;
  let slots = [null, null];
  let menuSel = 0;                        // title menu: 0 = 1 player, 1 = 2 players
  let turnoverFrom = 0;                   // whose game just ended, for the "GAME OVER" card

  const freshSlot = () => ({ score: 0, level: 1, lives: 3, extraGiven: false, dots: null, dotsLeft: 0,
    dotsEatenLevel: 0, bonusSpawned: 0, bonusHistory: [], lostLifeThisLevel: false });
  function saveSlot() {
    slots[cur] = { score, level, lives, extraGiven, dots: dots.slice(), dotsLeft, dotsEatenLevel,
      bonusSpawned, bonusHistory: bonusHistory.slice(), lostLifeThisLevel };
  }
  function loadSlot(i) {
    const s = slots[i];
    cur = i;
    ({ score, level, lives, extraGiven, dotsLeft, dotsEatenLevel, bonusSpawned, lostLifeThisLevel } = s);
    bonusHistory.length = 0;
    bonusHistory.push(...s.bonusHistory);
    if (s.dots) { applyMaze(level); dots.set(s.dots); }
    else levelData();                     // their first turn: a fresh maze
    sinceLifeLost = 0;
  }
  function switchTo(i) {
    loadSlot(i);
    placeActors();
    setState("ready");
  }

  function newGame(n = menuSel + 1) {
    if (demo) endDemo(false);
    numPlayers = n;
    slots = [freshSlot(), n === 2 ? freshSlot() : null];
    paused = false;
    switchTo(0);
    sfx("start");
  }

  // The score shown for player i, whether or not it's their turn.
  const scoreOf = i => (i === cur ? score : slots[i] ? slots[i].score : 0);

  // ---- Attract demo ------------------------------------------------------------------
  // Left alone on the title, the game plays itself for a while (no sound, no high score).
  const TITLE_IDLE = 16, DEMO_TIME = 22, TITLE_MENU_AT = 6;
  let demo = false;
  let demoSaved = null;                   // the real players' slots, put back afterwards
  let demoT = 0;                          // seconds of demo play so far
  function startDemo() {
    demoSaved = { slots, numPlayers };
    demo = true;
    demoT = 0;
    numPlayers = 1;
    slots = [freshSlot(), null];
    switchTo(0);
  }
  // toMenu: someone touched a control, so skip the roll call and show the menu
  function endDemo(toMenu) {
    demo = false;
    ({ slots, numPlayers } = demoSaved || { slots: [null, null], numPlayers: 1 });
    demoSaved = null;
    cur = 0;
    score = slots[0] ? slots[0].score : 0;
    paused = false;
    setState("title");
    if (toMenu) stateTime = TITLE_MENU_AT;
  }

  let deathSounded = false;
  function setState(s) {
    state = s; stateTime = 0;
    if (s === "dying") deathSounded = false;
    if (s === "title") loadHiScores();   // fresh for the attract loop's HIGH SCORES page
  }

  // ---- Pen release -------------------------------------------------------------
  // Everyone starts in the group chat and the hunt builds up level by level: level 1
  // lets two out, level 2 three, level 3 on all four; the rest sit in the box. Giga
  // Chad leaves first; the others wait for a number of dots (fewer on later levels).
  // After a lost life they come out on a timer instead. Either way, a player who stops
  // eating for a few seconds gets the next one sent out (if this level lets it out).
  const RELEASE_DOTS = [            // dots before Pepe, Pudgy, Doge leave, per level
    [20, Infinity, Infinity],
    [10, 50, Infinity],
    [0, 30, 70],
    [0, 20, 50],
    [0, 0, 30],
    [0, 0, 0],
  ];
  function releaseNeed(g) {
    const i = CHASERS.indexOf(g);
    return i === 0 ? 0 : RELEASE_DOTS[Math.min(level, RELEASE_DOTS.length) - 1][i - 1];
  }
  function releaseDue(g) {
    const need = releaseNeed(g);
    if (need === Infinity) return false;
    if (lostLifeThisLevel) return sinceLifeLost >= 1 + CHASERS.indexOf(g) * 2.5;
    return dotsEatenLevel >= need;
  }
  function updatePen() {
    const waiting = CHASERS.filter(g => g.mode === "pen");
    if (!waiting.length) return;
    const next = waiting[0];
    if (releaseNeed(next) === Infinity) return;
    if (releaseDue(next) || sinceDot >= Math.max(2, 4 - (level - 1) * 0.25)) {
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
    else sfx("waka");
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
    sfx("power", kind);
  }

  // Every point goes through here: Stonks doubles it. Returns what was actually scored.
  function addScore(n) {
    const pts = n * (stonksT > 0 ? 2 : 1);
    score += pts;
    if (!extraGiven && score >= EXTRA_LIFE_AT) { extraGiven = true; lives++; sfx("extra"); }
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
        sfx("magnet");
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
      // he speeds up when the maze is nearly empty (the original's "Cruise Elroy");
      // the rush starts earlier and runs harder on later levels
      const at = Math.min(40, 10 + (level - 1) * 2), boost = Math.min(0.2, 0.1 + (level - 1) * 0.01);
      if (dotsLeft <= at) s *= 1 + boost; else if (dotsLeft <= at * 2) s *= 1 + boost / 2;
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
        buzz(25);
        sfx("eat");
        freezeT = EAT_FREEZE;
        return;
      }
      if (shieldGrace > 0) continue;
      if (shield) {
        // Aster takes the hit: the chaser bounces off and is sent back to the pen
        shield = false;
        shieldGrace = SHIELD_GRACE;
        buzz(60);
        sfx("block");
        g.mode = "eyes"; g.frozen = 0;
        popups.push({ x: player.x, y: player.y - 1, text: "BLOCKED", color: "#ffb020", t: 0 });
        continue;
      }
      setState("dying");
      buzz(150);
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
    sfx("taunt");
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
        sfx("bonus");
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
    if (demo) demoSteer();
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

  // The demo's autopilot, run near each tile centre: head for the nearest blue chaser
  // (if one is close) or the nearest dot, treating tiles near a dangerous chaser as
  // walls. Boxed in, it runs from the nearest chaser instead. Good enough to look alive.
  let demoPlanAt = -1;
  function demoSteer() {
    const p = player;
    const pc = wrapC(Math.round(p.x)), pr = Math.round(p.y);
    if (Math.abs(p.x - Math.round(p.x)) > 0.3 || Math.abs(p.y - pr) > 0.3) return;
    const here = pr * COLS + pc;
    if (here === demoPlanAt && p.next) return;           // already planned from this tile
    demoPlanAt = here;
    const danger = new Uint8Array(ROWS * COLS);
    for (const g of CHASERS) {
      if (g.mode !== "out" || g.fright) continue;
      const gc = wrapC(Math.round(g.x)), gr = Math.round(g.y);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > 2) continue;
        const r = gr + dy;
        if (r >= 0 && r < ROWS) danger[r * COLS + wrapC(gc + dx)] = 1;
      }
    }
    const blue = new Set(CHASERS.filter(g => g.mode === "out" && g.fright && frightT > 1)
      .map(g => Math.round(g.y) * COLS + wrapC(Math.round(g.x))));
    // BFS outward from the trollface, remembering the first step taken
    const first = new Int8Array(ROWS * COLS).fill(-1);
    const dist = new Int16Array(ROWS * COLS).fill(-1);
    const q = [here]; dist[here] = 0;
    let dotGoal = -1, blueGoal = -1;
    for (let qi = 0; qi < q.length && blueGoal < 0; qi++) {
      const i = q[qi], c = i % COLS, r = (i / COLS) | 0;
      if (dotGoal >= 0 && dist[i] > 10) break;            // no blue chaser within reach: the dot it is
      for (let k = 0; k < 4; k++) {
        const d = TURN_ORDER[k];
        if (!walkable(c + d.x, r + d.y)) continue;
        const j = (r + d.y) * COLS + wrapC(c + d.x);
        if (dist[j] >= 0 || danger[j]) continue;
        dist[j] = dist[i] + 1;
        first[j] = i === here ? k : first[i];
        if (blue.has(j) && dist[j] <= 10) { blueGoal = j; break; }
        if (dotGoal < 0 && dots[j]) dotGoal = j;
        q.push(j);
      }
    }
    const goal = blueGoal >= 0 ? blueGoal : dotGoal;
    if (goal >= 0) { p.next = TURN_ORDER[first[goal]]; return; }
    // nowhere safe to go: pick the open neighbour farthest from the nearest chaser
    let best = null, bestD = -1;
    for (const d of TURN_ORDER) {
      if (!walkable(pc + d.x, pr + d.y)) continue;
      const spot = { x: pc + d.x, y: pr + d.y };
      const near = Math.min(...CHASERS.filter(g => g.mode === "out" && !g.fright).map(g => wrapDist(g, spot)), 99);
      if (near > bestD) { bestD = near; best = d; }
    }
    if (best) p.next = best;
  }

  // After the spin-out. Two players: the turn passes to the other one if they still
  // have lives (their maze exactly as they left it); a player who's out gets a
  // GAME OVER card first.
  function loseLife() {
    if (demo) { endDemo(false); return; }
    lives--;
    lostLifeThisLevel = true; sinceLifeLost = 0;
    if (numPlayers === 2) {
      saveSlot();
      const other = 1 - cur;
      if (slots[other].lives > 0) {
        if (lives <= 0) { turnoverFrom = cur; setState("turnover"); }
        else switchTo(other);
        return;
      }
    }
    if (lives <= 0) { saveHigh(); reportScore(); setState("over"); return; }
    placeActors();
    setState("ready");
  }

  // The all-time board (assets/games/troll-man/leaderboard.js) takes 1-player games
  // only: a hot-seat game is two people on one account.
  function reportScore() {
    if (demo || numPlayers !== 1 || !window.TrollLeaderboard) return;
    try { window.TrollLeaderboard.record("troll-man", { score, level }); } catch (_) { /* never break the game */ }
    loadHiScores();
  }

  // The all-time top ten (the shared engine's board, TrollLeaderboard.board),
  // drawn the cabinet's way: the attract loop's HIGH SCORES page and the
  // trophy panel (user, 2026-10-25: "create the leaderboard using UI
  // relevant to this game"). null until it first arrives.
  let hiScores = null;
  async function loadHiScores() {
    const LB = window.TrollLeaderboard;
    if (!LB || !LB.board) return;
    try { hiScores = await LB.board("troll-man"); } catch (_) { /* keep the last one */ }
    renderBoardPanel();
  }
  // logging in from the panel puts you on the board straight away
  window.addEventListener("trollrunner:auth-changed", () => loadHiScores());
  const RANK_NAMES = ["1ST", "2ND", "3RD", "4TH", "5TH", "6TH", "7TH", "8TH", "9TH", "10TH"];
  const ordinal = n => {
    const t = n % 100, s = t >= 11 && t <= 13 ? "TH" : ["TH", "ST", "ND", "RD"][n % 10] || "TH";
    return `${n}${s}`;
  };
  // each rank in a chaser's colour, round and round, the way the cabinet lists its scores
  const rankColor = i => CHASERS[i % CHASERS.length].color;
  // 10 letters fit the canvas page; the panel shows up to 20 and ellipsises the rest
  const hiName = (e, max = 10) => String(e.name || "???").toUpperCase().replace(/[^A-Z0-9 _.-]/g, "").slice(0, max) || "???";

  // Intermissions play after clearing these levels, like the original's cut-scenes.
  const INTERMISSION_AFTER = [2, 5, 9, 13, 17];
  const INTERMISSION_TIME = 7.6, TURNOVER_TIME = 2.6;
  function afterClear() {
    if (!demo && INTERMISSION_AFTER.includes(level)) { setState("intermission"); sfx("intermission"); return; }
    level++;
    newLevel();
  }
  function endIntermission() {
    level++;
    newLevel();
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
    if (state !== "title" && state !== "over" && state !== "intermission" && state !== "turnover") animate(dt);
    if (state === "title") { if (splashOpen || boardOpen()) stateTime = 0; else if (stateTime >= TITLE_IDLE) startDemo(); }
    else if (state === "ready") { if (stateTime >= READY_TIME) setState("play"); }
    else if (state === "play") {
      stepPlay(dt);
      if (demo && state === "play" && (demoT += dt) >= DEMO_TIME) endDemo(false);
    }
    else if (state === "dying") {
      if (!deathSounded && stateTime >= DEATH_HOLD) { deathSounded = true; sfx("death"); }
      if (stateTime >= DEATH_TIME) loseLife();
    }
    else if (state === "clear" && stateTime >= CLEAR_TIME) afterClear();
    else if (state === "intermission" && stateTime >= INTERMISSION_TIME) endIntermission();
    else if (state === "turnover" && stateTime >= TURNOVER_TIME) switchTo(1 - turnoverFrom);
    else if (state === "over" && stateTime >= 6) setState("title");
  }

  // The background loop follows the game: eyes heading home > blue chasers > the siren,
  // which climbs as the maze empties. Quiet everywhere else, and in the demo.
  function updateSoundLoop() {
    if (!window.TMSound) return;
    let want = null, lvl = 0;
    if (!demo && !paused && state === "play" && !chasersOff) {
      if (CHASERS.some(g => g.mode === "eyes" || g.mode === "entering")) want = "eyes";
      else if (frightT > 0 && CHASERS.some(g => g.fright)) want = "fright";
      else { want = "siren"; lvl = 1 - dotsLeft / Math.max(1, dotsTotal); }
    }
    window.TMSound.setLoop(want, lvl);
  }
  function sfx(name, arg) {
    if (demo || !window.TMSound) return;
    window.TMSound.play(name, arg);
  }

  let last = 0;
  function frame(t) {
    const dt = Math.min(1 / 20, (t - (last || t)) / 1000) * timeScale;
    last = t;
    pollPad();
    if (menuBtn) menuBtn.hidden = state === "title" && !demo;   // nothing to go back from on the title
    // fixed sub-steps keep turns and wall stops exact at any frame rate
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    for (let i = 0; i < steps; i++) update(dt / steps);
    updateSoundLoop();
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
    // the label of whoever is playing blinks, like the cabinet's
    const blinkOff = state === "play" && Math.floor(stateTime / 0.27) % 2 === 1;
    const twoUp = numPlayers === 2 || (state === "title" && slots[1]);
    if (!(blinkOff && cur === 0)) text("1UP", 3 * TILE, 8, "#fff");
    text("HIGH SCORE", W / 2, 8, "#fff", 8, "center");
    text(pad(scoreOf(0) || "00", 7), 1 * TILE, 22, "#fff");
    text(pad(high || "00", 7), W / 2 + 2 * TILE, 22, "#fff", 8, "right");
    if (twoUp) {
      if (!(blinkOff && cur === 1)) text("2UP", W - 4 * TILE, 8, "#fff");
      text(pad(scoreOf(1) || "00", 7), W - TILE, 22, "#fff", 8, "right");
    }
    if (state === "title") return;

    // top right: the level (unless 2UP needs the spot), then the running power-ups,
    // each with a time bar, tucked between HIGH SCORE and the right edge
    if (!twoUp) text(`LV ${level}`, W - TILE, 8, "#ffcc00", 8, "right");
    const running = [];
    if (stonksT > 0) running.push(["stonks", stonksT / STONKS_TIME]);
    if (fomoT > 0) running.push(["fomo", fomoT / FOMO_TIME]);
    if (shield) running.push(["aster", 1]);
    running.forEach(([kind, left], i) => {
      const x0 = W / 2 + 46 + i * 26;
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

  // Attract screen: the cast, like the original's roll call, in big type so it
  // reads from across the room (and on a laptop).
  // The attract loop's second page, over the menu: the all-time top ten.
  const HI_FROM = 8;                       // seconds into the title (the roll call is done by 5)
  function drawHiScores() {
    text("HIGH SCORES", W / 2, 46, "#ffcc00", 16, "center");
    text(hiScores?.players ? `ALL TIME  ${hiScores.players} TROLL${hiScores.players === 1 ? "" : "S"}` : "ALL TIME", W / 2, 70, "#999", 8, "center");
    const rows = hiScores?.entries || [];
    if (!rows.length) {
      text(hiScores ? "NO SCORES YET" : "LOADING...", W / 2, 180, "#fff", 12, "center");
      if (hiScores) text("BE THE FIRST TROLL", W / 2, 204, "#ffb8ae", 12, "center");
    }
    text("RANK", 40, 96, "#777", 8);
    text("SCORE", 210, 96, "#777", 8, "right");
    text("NAME", 236, 96, "#777", 8);
    rows.forEach((e, i) => {
      const y = 114 + i * 24;
      if (stateTime < HI_FROM + 0.3 + i * 0.15) return;          // one line at a time
      const blink = e.you && Math.floor(stateTime / 0.3) % 2 === 0;
      const c = e.you ? (blink ? "#fff" : "#ffcc00") : rankColor(i);
      text(RANK_NAMES[i] || `${i + 1}TH`, 40, y, c, 12);
      text(String(e.score || 0), 210, y, c, 12, "right");
      text(hiName(e), 236, y, c, 12);
    });
    const you = hiScores?.you;
    if (you && you.rank > rows.length) text(`YOU  ${ordinal(you.rank)}  ${you.score || 0}`, W / 2, 362, "#ffcc00", 8, "center");
    if (hiScores?.source === "live" && !hiScores.loggedIn) text("LOG IN TO GET ON THE BOARD", W / 2, 378, "#ffb8ae", 8, "center");
  }

  function drawTitle() {
    if (stateTime >= HI_FROM) { drawHiScores(); drawTitleMenu(); return; }
    text("CHARACTER", W / 2, 50, "#fff", 16, "center");
    CHASERS.forEach((g, i) => {
      const y = 100 + i * 42;
      if (stateTime < 0.5 + i * 0.6) return;     // roll them in one by one
      drawFace(sprites[`${g.name}-f1`], 136, y, DIRS.right);
      text(g.label, 168, y - 8, g.color, 16);
    });
    if (stateTime > 3.2) {
      drawFace(sprites["trollface-f1"], W / 2, 278, DIRS.right);
      text("YOU ARE THE TROLL", W / 2, 300, "#fff", 12, "center");
      ctx.fillStyle = "#ffb8ae"; ctx.fillRect(W / 2 - 52, 324, 6, 6);
      text("10 PTS", W / 2 - 34, 321, "#fff", 12);
    }
    // the four power-ups, rolled in after the troll
    const POWERS = [["pump", "PUMP", "#55e05f"], ["stonks", "STONKS", "#16b84a"], ["fomo", "FOMO", "#c48bff"], ["aster", "ASTER", "#ffb020"]];
    POWERS.forEach(([kind, label, color], i) => {
      if (stateTime < 3.8 + i * 0.3) return;
      const cx = W / 2 + (i - 1.5) * 100;
      ctx.drawImage(ICONS[kind], cx - PILL / 2, 362 - PILL / 2);
      text(label, cx, 380, color, 12, "center");
    });
    drawTitleMenu();
  }
  function drawTitleMenu() {
    // the menu: 1 or 2 players, a little trollface pointing at the choice
    ["1 PLAYER", "2 PLAYERS"].forEach((label, i) => {
      const y = 414 + i * 28;
      const on = menuSel === i;
      text(label, W / 2 - 64, y, on ? "#ffcc00" : "#777", 16);
      if (on && Math.floor(stateTime / 0.4) % 2 === 0) drawFace(sprites["trollface-f1"], W / 2 - 88, y + 8, DIRS.right, 0.75);
    });
    // the hints match whatever the player is holding
    text(TOUCH ? "STICK TO CHOOSE, START TO PLAY" : "UP / DOWN, ENTER TO PLAY", W / 2, 488, "#999", 12, "center");
    text(TOUCH ? "SELECT = PROBLEM?" : "SPACE = PROBLEM?  M = SOUND", W / 2, 510, "#999", 12, "center");
  }

  // The cut-scene between some levels: Giga Chad chases the trollface off screen,
  // then he comes back giant and the chase runs the other way.
  function drawIntermission() {
    const t = stateTime, y = py(14);
    const chomp = Math.floor(t / CHOMP) % 2 ? "trollface-f3" : "trollface-f1";
    if (t < 3.6) {
      const x = W + 40 - t * 160;
      drawFace(sprites[chomp], x, y, DIRS.left);
      drawFace(sprites[Math.floor(t / 0.25) % 2 ? "gigachad-f3" : "gigachad-f1"], x + 56 - t * 4, y, DIRS.left);
      if (frameLog) frameLog.scene = "act1";
    } else {
      const u = t - 3.6;
      const cx = -30 + u * 160;
      const flashing = u > 2.4 && Math.floor(u / 0.2) % 2 === 0;
      drawFace(recoloured("gigachad-f1", flashing) || sprites["gigachad-f1"], cx, y, DIRS.right);
      const gx = cx - 110;
      drawFace(sprites[chomp], gx, y - 32, DIRS.right, 3);               // three times the size, feet level
      if (u > 0.6) text("PROBLEM?", gx, y - 98, "#fff", 8, "center");
      if (frameLog) frameLog.scene = "act2";
    }
  }

  const PLAYER_NAME = ["PLAYER ONE", "PLAYER TWO"];

  // Debug builds keep the last few hundred frames' looks so the animation test can read them.
  let frameLog = null;
  const frameLogs = /[?&]debug\b/.test(location.search) ? [] : null;

  function draw() {
    frameLog = frameLogs ? { t: performance.now(), state, player: null, chasers: {}, maze: null } : null;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (state === "title") { drawHud(); drawTitle(); logFrame(); return; }
    if (state === "intermission") { drawHud(); drawIntermission(); logFrame(); return; }

    const color = MAZE_COLORS[(level - 1) % MAZE_COLORS.length];
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

    // two players: "PLAYER ONE/TWO" shows first on an empty maze, then the faces come in
    const card = !demo && numPlayers === 2 && state === "ready" && stateTime < READY_TIME / 2;
    const showChasers = !chasersOff && !card && (state === "ready" || state === "play" ||
      (state === "dying" && stateTime < DEATH_HOLD) || (state === "clear" && stateTime < CLEAR_HOLD));
    if (state === "turnover" || card) {
      if (frameLog) frameLog.player = "none";              // between turns: an empty maze and the card
    } else if (state === "dying" && stateTime >= DEATH_HOLD) {
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

    if (demo) {
      if (Math.floor(stateTime / 0.5) % 2 === 0) text("PRESS START", W / 2, py(16) - 4, "#ffcc00", 8, "center");
    } else {
      // two players: whose turn it is, above the pen
      if (card) text(PLAYER_NAME[cur], W / 2, py(11) - 4, "#4deeff", 8, "center");
      if (state === "ready") text("READY!", W / 2, py(16) - 4, "#ffcc00", 8, "center");
      if (state === "turnover") {
        text(PLAYER_NAME[turnoverFrom], W / 2, py(11) - 4, "#4deeff", 8, "center");
        text("GAME  OVER", W / 2, py(16) - 4, "#ff3b3b", 8, "center");
      }
      if (state === "over") text("GAME  OVER", W / 2, py(16) - 4, "#ff3b3b", 8, "center");
    }
    if (quitArmed()) {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, TOP * TILE, W, ROWS * TILE);
      const bx = 40, by = py(11), bw = W - 80, bh = 84;
      ctx.fillStyle = "#000"; ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
      text("QUIT TO MENU?", W / 2, by + 20, "#ffcc00", 16, "center");
      text(TOUCH ? "TAP MENU AGAIN TO QUIT" : "PRESS MENU OR Q AGAIN", W / 2, by + 52, "#fff", 12, "center");
    } else if (paused) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, TOP * TILE, W, ROWS * TILE);
      text("PAUSED", W / 2, py(16) - 4, "#fff", 8, "center");
      text(TOUCH ? "MENU = QUIT" : "Q = QUIT TO MENU", W / 2, py(17) + 4, "#999", 8, "center");
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
    if (demo || state === "title" || state === "over" || state === "intermission") return;
    player.next = DIRS[name];
  }

  function togglePause() {
    if (demo || state === "title" || state === "over" || state === "intermission") return;
    paused = !paused;
    quitArmedUntil = 0;
  }

  // Back to the main menu (the title). Mid-game the first press pauses and asks;
  // a second press within a few seconds ends the run (it counts, like a game over).
  const QUIT_WINDOW = 3000;
  let quitArmedUntil = 0;
  const quitArmed = () => performance.now() < quitArmedUntil;
  function toMenu() {
    poke();
    if (state === "title") return;
    if (demo) { endDemo(true); return; }
    if (state !== "over" && !quitArmed()) {
      quitArmedUntil = performance.now() + QUIT_WINDOW;
      if (state !== "intermission" && state !== "turnover") paused = true;
      return;
    }
    quitArmedUntil = 0;
    if (state !== "over") {
      if (numPlayers === 2) saveSlot();
      saveHigh();
      reportScore();
    }
    paused = false;
    setState("title");
    stateTime = TITLE_MENU_AT;                           // straight to the menu, no roll call
  }

  function menuMove(i) {
    if (menuSel === i) return;
    menuSel = i;
    sfx("menu");
  }

  // One place decides what "start" means wherever the game is: the title starts the
  // chosen game, the demo stops (straight into a game), a cut-scene skips, game over
  // goes again with the same number of players; mid-game it pauses.
  function pressStart() {
    if (state === "title") newGame();
    else if (demo) newGame();
    else if (state === "intermission") endIntermission();
    else if (state === "over") newGame(numPlayers);
    else togglePause();
  }

  // Any control on the title keeps the demo from starting.
  const poke = () => { if (state === "title") stateTime = Math.min(stateTime, TITLE_IDLE - 6); };

  function toggleMute() {
    if (!window.TMSound) return;
    window.TMSound.setMuted(!window.TMSound.muted);
    syncMuteButton();
  }
  const muteBtn = document.getElementById("tm-mute");
  function syncMuteButton() {
    if (!muteBtn || !window.TMSound) return;
    const m = window.TMSound.muted;
    muteBtn.setAttribute("aria-pressed", String(m));
    muteBtn.setAttribute("aria-label", m ? "Sound off. Turn sound on" : "Sound on. Mute");
    muteBtn.classList.toggle("is-muted", m);
  }
  const menuBtn = document.getElementById("tm-menu-btn");
  if (menuBtn) menuBtn.addEventListener("click", () => { toMenu(); menuBtn.blur(); canvas.focus({ preventScroll: true }); });
  if (muteBtn) {
    muteBtn.addEventListener("click", () => { toggleMute(); muteBtn.blur(); });
    syncMuteButton();
  }

  // ---- The weekly board: a panel over the game, from the trophy button -------------
  // Opening it mid-game pauses; Esc, the x or a click outside closes it.
  const boardBtn = document.getElementById("tm-board-btn");
  const board = document.getElementById("tm-board");
  const boardOpen = () => !!board && !board.hidden;
  function setBoard(open) {
    if (!board || open === boardOpen()) return;
    board.hidden = !open;
    boardBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      if (state === "play" && !demo) paused = true;
      renderBoardPanel();
      loadHiScores();
      board.querySelector(".tm-board-close").focus({ preventScroll: true });
    } else {
      canvas.focus({ preventScroll: true });
    }
  }
  // The panel: the top three on a podium (the trollface sprite on each step,
  // 1st in the middle and tallest), 4th-10th below as cabinet rows with a
  // trail of dots from name to score, then your own best and rank.
  function renderBoardPanel() {
    const root = document.getElementById("lb-root");
    if (!root) return;
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const num = n => Number(n || 0).toLocaleString("en-US");
    const b = hiScores;
    if (!b) { root.innerHTML = `<p class="tm-hi-note">LOADING...</p>`; return; }
    const entries = b.entries || [];
    const youTag = e => (e.you && hiName(e) !== "YOU" ? ` <i>YOU</i>` : "");
    const sprite = `<img class="tm-pod-face" src="${SPRITE_DIR}trollface-f1-32.png?v=tm-p2" alt="" width="32" height="32">`;
    const podium = [0, 1, 2].map(i => {
      const e = entries[i];
      if (!e) return `<li class="tm-pod tm-pod-${i + 1} is-empty" aria-hidden="true"><span class="tm-pod-name">???</span><span class="tm-pod-step"><b>${RANK_NAMES[i]}</b></span></li>`;
      return `<li class="tm-pod tm-pod-${i + 1}${e.you ? " is-you" : ""}">${sprite}`
        + `<span class="tm-pod-name" title="${esc(hiName(e, 20))}">${esc(hiName(e, 20))}${youTag(e)}</span>`
        + `<span class="tm-pod-score">${num(e.score)}</span>`
        + `<span class="tm-pod-step"><b>${RANK_NAMES[i]}</b><small>LEVEL ${esc(e.level || 0)}</small></span></li>`;
    }).join("");
    const rest = entries.slice(3).map((e, j) => {
      const i = j + 3;
      return `<li class="tm-hi-row${e.you ? " is-you" : ""}" style="--c:${rankColor(i)}">`
        + `<span class="tm-hi-rank">${RANK_NAMES[i] || ordinal(i + 1)}</span>`
        + `<span class="tm-hi-name">${esc(hiName(e, 20))}${youTag(e)}</span><span class="tm-hi-dots" aria-hidden="true"></span>`
        + `<span class="tm-hi-score">${num(e.score)}</span><span class="tm-hi-lv">L${esc(e.level || 0)}</span></li>`;
    }).join("");
    const me = b.you;
    const login = b.source === "live" && !b.loggedIn && window.TrollrunnerAccounts?.openLogin;
    const youBox = me
      ? `<p class="tm-you"><span>YOUR BEST</span><strong>${num(me.score)}</strong><span>${ordinal(me.rank)} OF ${b.players}</span></p>`
      : "";
    const stats = b.players ? `${b.players} TROLL${b.players === 1 ? "" : "S"} · ${num(b.plays)} GAME${b.plays === 1 ? "" : "S"}` : "";
    root.innerHTML = `<p class="tm-hi-meta"><span>ALL TIME</span><span>${stats}</span></p>`
      + (entries.length
        ? `<ol class="tm-podium" aria-label="Top three">${podium}</ol>`
          + (rest ? `<ol class="tm-hi" start="4" aria-label="Fourth to tenth">${rest}</ol>` : "")
        : `<p class="tm-hi-empty">NO SCORES YET.<br>BE THE FIRST TROLL.</p>`)
      + youBox
      + (login ? `<button type="button" class="tm-login">LOG IN TO GET ON THE BOARD</button>` : "")
      + `<p class="tm-hi-note">Best 1-player score, all time. Never resets.</p>`;
    root.querySelector(".tm-login")?.addEventListener("click", () => window.TrollrunnerAccounts.openLogin("login"));
  }
  if (board && boardBtn) {
    boardBtn.addEventListener("click", () => setBoard(!boardOpen()));
    board.querySelector(".tm-board-close").addEventListener("click", () => setBoard(false));
    board.addEventListener("click", e => { if (e.target === board) setBoard(false); });
  }

  // ---- Loading screen: the poster, until the first key or tap ---------------------
  // It reads LOADING until the sprites and font are in, then PRESS START / TAP TO PLAY.
  // The back link and the mute button stay usable above it. ?debug skips it
  // (add &splash to see it in a test).
  const splash = document.getElementById("tm-splash");
  let splashOpen = !!splash && !(/[?&]debug\b/.test(location.search) && !/[?&]splash\b/.test(location.search));
  let splashReady = false;
  function splashLoaded() {
    if (splashReady || !splash) return;
    splashReady = true;
    splash.classList.add("is-ready");
  }
  function closeSplash() {
    if (!splashOpen || !splashReady) return;
    splashOpen = false;
    if (state === "title") stateTime = 0;
    splash.classList.add("is-leaving");
    setTimeout(() => { splash.hidden = true; }, 240);
    canvas.focus({ preventScroll: true });
  }
  if (splash) {
    if (!splashOpen) splash.hidden = true;
    else {
      if (document.readyState === "complete") splashLoaded();
      else window.addEventListener("load", splashLoaded);
      setTimeout(splashLoaded, 5000);                       // a slow font never keeps you out
      splash.addEventListener("click", closeSplash);
      splash.focus({ preventScroll: true });
    }
  }

  // Browsers only allow sound after a gesture: the first key or touch switches it on.
  const unlockSound = () => { if (window.TMSound) window.TMSound.unlock(); };
  window.addEventListener("pointerdown", unlockSound, true);
  window.addEventListener("touchstart", unlockSound, { capture: true, passive: true });

  window.addEventListener("keydown", e => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key;
    if (boardOpen()) {                                     // the board keeps the keys while it's up
      if (k === "Escape") { e.preventDefault(); setBoard(false); }
      return;
    }
    const onChrome = e.target && (e.target.tagName === "A" || e.target === muteBtn || e.target === boardBtn);
    if (splashOpen && !onChrome) {                         // the poster takes the first key
      if (k === "Tab") return;
      e.preventDefault();
      unlockSound();
      closeSplash();
      return;
    }
    // a focused button handles its own Enter / Space
    if (e.target && e.target.tagName === "BUTTON" && (k === "Enter" || k === " ")) return;
    unlockSound();
    poke();
    if (k === "m" || k === "M") { toggleMute(); return; }
    if (demo) {                                           // any key ends the demo
      e.preventDefault();
      if (k === "Enter" || k === " ") newGame(); else endDemo(true);
      return;
    }
    if (state === "title") {
      if (k === "ArrowUp" || k === "w" || k === "W") menuMove(0);
      else if (k === "ArrowDown" || k === "s" || k === "S") menuMove(1);
      else if (k === "1" || k === "2") newGame(Number(k));
      else if (k === "Enter" || k === " ") newGame();
      if (KEYS[k] || k === "Enter" || k === " ") e.preventDefault();
      return;
    }
    if (KEYS[k]) {
      e.preventDefault();
      steer(KEYS[k]);
    } else if (k === "Enter" || k === " ") {
      e.preventDefault();
      if (state === "intermission" || state === "over") pressStart();
      else if (k === " ") taunt();
    } else if (k === "t" || k === "T") {
      taunt();
    } else if (k === "p" || k === "P" || k === "Escape") {
      togglePause();
    } else if (k === "q" || k === "Q") {
      toMenu();
    }
  });

  // A tap on the screen: start / skip / end the demo; in a game it does nothing (swipes steer).
  function tapScreen() {
    poke();
    if (demo) endDemo(true);
    else if (state === "title" || state === "over" || state === "intermission") pressStart();
  }

  // Swipe anywhere on the screen as a backup to the joystick.
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
    if (touch0) tapScreen();
    touch0 = null;
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener("click", () => {
    canvas.focus();
    tapScreen();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "play") paused = true; });

  // ---- Touch controls: joystick + SELECT / START ---------------------------------
  // A 4-way gated stick, like the arcade cabinet: no diagonals. The thumb's
  // stronger axis wins, and the axis the stick is already on holds until the
  // other one beats it by a margin, so a thumb near 45 degrees doesn't flicker.
  let stickAxis = null;                                                // "x" | "y" | null
  function stickDir(dx, dy) {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    const keep = 1.25;
    if (stickAxis === "x" && ax * keep >= ay) stickAxis = "x";
    else if (stickAxis === "y" && ay * keep >= ax) stickAxis = "y";
    else stickAxis = ax >= ay ? "x" : "y";
    return stickAxis === "x" ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
  }
  function steerVector(dx, dy) { steer(stickDir(dx, dy)); }

  const stick = document.getElementById("tm-stick");
  const knob = stick && stick.querySelector(".tm-stick-knob");
  if (stick && knob) {
    let pointer = null;
    const track = e => {
      const r = stick.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy), reach = r.width * 0.3;          // how far the ball can travel
      if (len < r.width * 0.12) { knob.style.transform = ""; stickAxis = null; return; }   // dead zone in the middle
      const dir = stickDir(dx, dy);
      const along = Math.min(stickAxis === "x" ? Math.abs(dx) : Math.abs(dy), reach);
      const tx = dir === "left" ? -along : dir === "right" ? along : 0;
      const ty = dir === "up" ? -along : dir === "down" ? along : 0;
      knob.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;   // the ball rides the gate
      if (state === "title") { if (stickAxis === "y") menuMove(dir === "down" ? 1 : 0); }   // choose 1 or 2 players
      else steer(dir);
    };
    stick.addEventListener("pointerdown", e => {
      e.preventDefault();
      pointer = e.pointerId;
      try { stick.setPointerCapture(e.pointerId); } catch (_) { /* already gone */ }
      poke();
      if (demo) endDemo(true);
      track(e);
    });
    stick.addEventListener("pointermove", e => { if (e.pointerId === pointer) track(e); });
    const release = e => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      stickAxis = null;
      knob.style.transform = "";                                       // springs back; the last direction holds
    };
    stick.addEventListener("pointerup", release);
    stick.addEventListener("pointercancel", release);
  }

  // Buttons act on pointerdown so the taunt lands the instant the thumb does;
  // a keyboard "click" (detail 0) still works for anyone tabbing to them.
  function pressButton(el, action) {
    if (!el) return;
    el.addEventListener("pointerdown", e => {
      e.preventDefault();
      el.classList.add("is-down");
      action();
    });
    const up = () => el.classList.remove("is-down");
    el.addEventListener("pointerup", up);
    el.addEventListener("pointerleave", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("click", e => { if (e.detail === 0) action(); });
  }
  pressButton(document.getElementById("tm-start"), () => { poke(); pressStart(); });
  // SELECT: on the title it flips between 1 and 2 players (like a cartridge menu);
  // in a game it's the taunt; elsewhere it does what START does
  function pressSelect() {
    poke();
    if (demo) endDemo(true);
    else if (state === "title") menuMove(1 - menuSel);
    else if (state === "intermission") endIntermission();
    else taunt();
  }
  pressButton(document.getElementById("tm-select"), pressSelect);

  // ---- Gamepad ---------------------------------------------------------------------
  // Standard mapping: d-pad (12-15) or the left stick moves, Start (9) is START,
  // Back / Select (8) is SELECT, A (0) taunts in a game and starts everywhere else,
  // B (1) closes the board. Polled once a frame; a press acts once.
  const PAD_DEAD = 0.5;
  let padPrev = [], padDir = null;
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (!pad) { padPrev = []; padDir = null; return; }
    const held = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
    const pressed = i => held(i) && !padPrev[i];
    let dir = held(12) ? "up" : held(13) ? "down" : held(14) ? "left" : held(15) ? "right" : null;
    if (!dir) {
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (Math.max(Math.abs(ax), Math.abs(ay)) > PAD_DEAD) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? "right" : "left") : (ay > 0 ? "down" : "up");
    }
    const newDir = dir && dir !== padDir;
    const anyPress = [0, 1, 8, 9].some(pressed) || newDir;
    if (anyPress) unlockSound();
    if (splashOpen) {
      if (anyPress) closeSplash();
    } else if (boardOpen()) {
      if (pressed(1) || pressed(9)) setBoard(false);
    } else {
      if (anyPress) poke();
      if (pressed(9)) pressStart();
      if (pressed(8)) pressSelect();
      if (pressed(0)) {
        if (demo || state === "title" || state === "over" || state === "intermission") pressStart();
        else taunt();
      }
      if (newDir) {
        if (demo) endDemo(true);
        else if (state === "title" && (dir === "up" || dir === "down")) menuMove(dir === "up" ? 0 : 1);
      }
      if (dir) steer(dir);                                // held, it keeps asking, like a held key
    }
    padDir = dir;
    padPrev = pad.buttons.map(b => b.pressed);
  }

  // A short buzz on phones that allow it: eating a chaser, a blocked hit, getting caught.
  function buzz(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) { /* not allowed */ }
  }

  // ---- Test hook (only with ?debug in the URL) --------------------------------
  if (/[?&]debug\b/.test(location.search)) {
    window.__tm = {
      get MAZE() { return MAZE; }, get mazeIdx() { return mazeIdx; }, get homeDist() { return homeDist; }, MAZES, ICONS,
      ROWS, COLS, walkable, targetFor, CHASERS, player, dots,
      get state() { return state; }, get level() { return level; }, get score() { return score; },
      get lives() { return lives; }, get dotsLeft() { return dotsLeft; },
      get frightT() { return frightT; }, get mode() { return chaseMode(); },
      setTimeScale(s) { timeScale = s; },
      setChasersOff(v) { chasersOff = v; },
      frames: frameLogs,
      startFright, setState, taunt, powerUp, steerVector, newGame, startDemo,
      get demo() { return demo; }, get cur() { return cur; }, get numPlayers() { return numPlayers; },
      get slots() { return slots; }, get menuSel() { return menuSel; }, toMenu, get quitArmed() { return quitArmed(); }, get high() { return high; },
      get stateTime() { return stateTime; }, get hiScores() { return hiScores; },
      setLevel(n) { level = n; }, newLevel,
      setLives(n) { lives = n; },
      get paused() { return paused; },
      get bonus() { return bonus; }, get shield() { return shield; }, get stonksT() { return stonksT; }, get fomoT() { return fomoT; },
      get tauntCool() { return tauntCool; },
      setDotsEaten(n) { dotsEatenLevel = n; },
      setPhase(i) { phaseIdx = i; phaseT = 0; },
      leaveOneDot(c, r) { dots.fill(0); dots[r * COLS + c] = 1; dotsLeft = 1; },
      iconFor, canvas,                                       // the poster tool borrows these
      get splashOpen() { return splashOpen; }, get splashReady() { return splashReady; }, get boardOpen() { return boardOpen(); },
    };
  }

  // Draw the HUD in the arcade font once it's loaded; the loop starts either way.
  if (document.fonts && document.fonts.load) document.fonts.load(`8px ${FONT}`).catch(() => {});
  if (!splashOpen) canvas.focus({ preventScroll: true });
  requestAnimationFrame(frame);
})();
