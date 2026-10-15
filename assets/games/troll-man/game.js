// Troll Man — the trollface eats the dots, the meme faces hunt him.
// Phase 1: maze, trollface, dots, score, level clear. Plan: DESIGN.md next to this file.
(() => {
  "use strict";

  // ---- Board ----------------------------------------------------------------
  const TILE = 16, COLS = 28, ROWS = 29;
  const TOP = 3, BOTTOM = 2;                       // HUD rows above / below the maze, in tiles
  const W = COLS * TILE, H = (ROWS + TOP + BOTTOM) * TILE;
  const TUNNEL_ROW = 13;
  const PEN = { c0: 10, c1: 17, r0: 12, r1: 15 };  // the group chat: walls + door + inside
  const DOOR = { c0: 13, c1: 14, r: 12 };
  const START = { x: 13.5, y: 21 };                // between the two centre tiles, like the original

  // Left half of the maze; the right half is its mirror.
  // # wall   . dot   o big dot   - pen door   space = floor with no dot
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

  // Floor the trollface may stand on. Off the sides only the tunnel row is open.
  function walkable(c, r) {
    if (r < 0 || r >= ROWS) return false;
    if (c < 0 || c >= COLS) return r === TUNNEL_ROW;
    if (inPen(c, r)) return false;
    const ch = MAZE[r][c];
    return ch !== "#" && ch !== "-";
  }

  // ---- Tuning ---------------------------------------------------------------
  const TURN_WINDOW = 0.35;          // tiles: how early a turn can be buffered and still snap (cornering)
  const BASE_SPEED = 8;              // tiles per second at level 1
  const DOT_PAUSE = 1 / 60;          // the original stalls a frame per dot: empty corridors are faster
  const BIG_PAUSE = 3 / 60;
  const READY_TIME = 2.0, CLEAR_TIME = 2.2;
  const SCORE_DOT = 10, SCORE_BIG = 50;
  // maze wall colour, changes every 2nd level
  const MAZE_COLORS = ["#2121de", "#de2121", "#21b04a", "#c021de", "#de8a21"];

  const speedFor = level => BASE_SPEED * Math.min(1.25, 1 + (level - 1) * 0.04);

  // ---- Canvas ---------------------------------------------------------------
  const canvas = document.getElementById("tm-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  const FONT = "'Press Start 2P', monospace";
  const SPRITE_DIR = "assets/games/troll-man/sprites/";
  const sprites = {};
  function loadSprite(name) {
    const img = new Image();
    img.src = `${SPRITE_DIR}${name}-32.png?v=tm-p1`;
    sprites[name] = img;
  }
  ["trollface-f1", "trollface-f2", "trollface-f3", "pepe-f1", "doge-f1", "gigachad-f1", "pudgy-f1"].forEach(loadSprite);

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

  const dots = new Uint8Array(ROWS * COLS);          // 0 none, 1 dot, 2 big dot
  let dotsLeft = 0;
  function resetDots() {
    dotsLeft = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const ch = MAZE[r][c];
      const v = ch === "." ? 1 : ch === "o" ? 2 : 0;
      dots[r * COLS + c] = v;
      if (v) dotsLeft++;
    }
  }

  const player = { x: START.x, y: START.y, dir: DIRS.left, next: null, face: DIRS.left, moving: false, pause: 0, anim: 0, blinkAt: 2 };

  let state = "title";        // title | ready | play | clear | over
  let paused = false;
  let stateTime = 0;
  let score = 0, level = 1, lives = 3;
  let high = 0;
  try { high = Number(localStorage.getItem("trollman.high")) || 0; } catch (_) { /* storage blocked */ }

  function saveHigh() {
    if (score <= high) return;
    high = score;
    try { localStorage.setItem("trollman.high", String(high)); } catch (_) { /* storage blocked */ }
  }

  function placePlayer() {
    Object.assign(player, { x: START.x, y: START.y, dir: DIRS.left, next: null, face: DIRS.left, moving: false, pause: 0, anim: 0 });
  }

  function newGame() {
    score = 0; level = 1; lives = 3;
    resetDots();
    placePlayer();
    setState("ready");
  }

  function setState(s) { state = s; stateTime = 0; }

  // ---- Movement -------------------------------------------------------------
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
    dots[i] = 0; dotsLeft--;
    score += v === 2 ? SCORE_BIG : SCORE_DOT;
    p.pause = v === 2 ? BIG_PAUSE : DOT_PAUSE;
    saveHigh();
    if (dotsLeft === 0) setState("clear");
  }

  function stepPlay(dt) {
    const p = player;
    tryTurn(p);
    if (p.pause > 0) { p.pause = Math.max(0, p.pause - dt); return; }
    advance(p, speedFor(level) * dt);
    tryTurn(p);
    if (p.dir.x || p.dir.y) p.face = p.dir;
    eat(p);
  }

  // ---- Loop -----------------------------------------------------------------
  let timeScale = 1;
  function update(dt) {
    stateTime += dt;
    player.anim += dt;
    if (paused) return;
    if (state === "ready" && stateTime >= READY_TIME) setState("play");
    else if (state === "play") stepPlay(dt);
    else if (state === "clear" && stateTime >= CLEAR_TIME) {
      level++;
      resetDots();
      placePlayer();
      setState("ready");
    }
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
  function drawFace(img, cx, cy, dir) {
    if (!img || !img.complete || !img.naturalWidth) return;
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    if (dir.x < 0) ctx.scale(-1, 1);
    else if (dir.y < 0) ctx.rotate(-Math.PI / 2);
    else if (dir.y > 0) ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -16, -16, 32, 32);
    ctx.restore();
  }

  function playerFrame() {
    const p = player;
    if (state === "play" && p.moving) return Math.floor(p.anim / 0.09) % 2 ? "trollface-f3" : "trollface-f1";
    // blink now and then while standing
    if (p.anim > p.blinkAt) {
      if (p.anim > p.blinkAt + 0.14) p.blinkAt = p.anim + 2 + Math.random() * 2.5;
      return "trollface-f2";
    }
    return "trollface-f1";
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
        ctx.fillStyle = "#ffb8ae";
        ctx.beginPath(); ctx.arc(px(c), py(r), 6, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawHud() {
    const pad = (n, w) => String(n).padStart(w, " ");
    if (state === "title" || Math.floor(stateTime / 0.27) % 2 === 0 || state !== "play") text("1UP", 3 * TILE, 8, "#fff");
    text("HIGH SCORE", W / 2, 8, "#fff", 8, "center");
    text(pad(score || "00", 7), 1 * TILE, 22, "#fff");
    text(pad(high || "00", 7), W / 2 + 2 * TILE, 22, "#fff", 8, "right");
    // lives (the ones still waiting) and level
    const by = (TOP + ROWS) * TILE + 2;
    const waiting = state === "title" || state === "over" ? 0 : lives - 1;
    for (let i = 0; i < waiting; i++) drawFace(sprites["trollface-f1"], 2 * TILE + i * 34, by + 14, DIRS.left);
    if (state !== "title") text(`LV ${level}`, W - 2 * TILE, by + 10, "#ffcc00", 8, "right");
  }

  // Attract screen: the cast, like the original's character / nickname roll call.
  const CAST = [
    { key: "gigachad-f1", name: "GIGA CHAD", nick: "\"HE JUST WALKS AT YOU\"", color: "#ff3b3b" },
    { key: "pepe-f1", name: "PEPE", nick: "\"FEELS BAD, MAN\"", color: "#4dff73" },
    { key: "pudgy-f1", name: "PUDGY", nick: "\"WADDLES WITH THE PACK\"", color: "#6fa8ff" },
    { key: "doge-f1", name: "DOGE", nick: "\"SUCH PURSUIT\"", color: "#ffb84d" },
  ];
  function drawTitle() {
    text("CHARACTER / NICKNAME", W / 2, py(2), "#fff", 8, "center");
    CAST.forEach((c, i) => {
      const y = py(5 + i * 3);
      if (stateTime < 0.5 + i * 0.6) return;     // roll them in one by one
      drawFace(sprites[c.key], 4 * TILE, y, DIRS.right);
      text(c.name, 7 * TILE, y - 10, c.color);
      text(c.nick, 7 * TILE, y + 4, c.color);
    });
    if (stateTime > 3.2) {
      drawFace(sprites["trollface-f1"], W / 2, py(19), DIRS.right);
      text("YOU ARE THE TROLL", W / 2, py(21), "#fff", 8, "center");
      ctx.fillStyle = "#ffb8ae"; ctx.fillRect(W / 2 - 66, py(23) - 2, 4, 4);
      text("10 PTS", W / 2 - 50, py(23) - 4, "#fff");
      ctx.beginPath(); ctx.arc(W / 2 - 64, py(25), 6, 0, Math.PI * 2); ctx.fill();
      text("50 PTS", W / 2 - 50, py(25) - 4, "#fff");
    }
    if (Math.floor(stateTime / 0.5) % 2 === 0) text("PRESS START", W / 2, py(28), "#ffcc00", 8, "center");
    text("ENTER / TAP", W / 2, py(29) + 4, "#888", 8, "center");
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (state === "title") { drawHud(); drawTitle(); return; }

    const color = MAZE_COLORS[Math.floor((level - 1) / 2) % MAZE_COLORS.length];
    const flash = state === "clear" && stateTime > 0.4 && Math.floor(stateTime / 0.2) % 2 === 0;
    ctx.drawImage(mazeImage(flash ? "#ffffff" : color), 0, TOP * TILE);

    drawDots();
    if (state !== "clear" || stateTime < 0.4) drawFace(sprites[playerFrame()], px(player.x), py(player.y), player.face);
    else drawFace(sprites["trollface-f1"], px(player.x), py(player.y), player.face);

    if (state === "ready") text("READY!", W / 2, py(16) - 4, "#ffcc00", 8, "center");
    if (state === "over") text("GAME  OVER", W / 2, py(16) - 4, "#ff3b3b", 8, "center");
    if (paused) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, TOP * TILE, W, ROWS * TILE);
      text("PAUSED", W / 2, py(16) - 4, "#fff", 8, "center");
    }
    drawHud();
  }

  // ---- Input ----------------------------------------------------------------
  const KEYS = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
    a: "left", d: "right", w: "up", s: "down", A: "left", D: "right", W: "up", S: "down",
  };

  function steer(name) {
    if (state === "title") return;
    player.next = DIRS[name];
  }

  function start() {
    if (state === "title" || state === "over") newGame();
    else togglePause();
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
      MAZE, ROWS, COLS, walkable,
      get state() { return state; }, get level() { return level; }, get score() { return score; },
      get dotsLeft() { return dotsLeft; }, player, dots,
      setTimeScale(s) { timeScale = s; },
    };
  }

  // Draw the HUD in the arcade font once it's loaded; the loop starts either way.
  if (document.fonts && document.fonts.load) document.fonts.load(`8px ${FONT}`).catch(() => {});
  canvas.focus({ preventScroll: true });
  requestAnimationFrame(frame);
})();
