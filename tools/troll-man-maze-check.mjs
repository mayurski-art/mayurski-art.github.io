// Checks every Troll Man maze in assets/games/troll-man/game.js (HALVES):
// size, every dot reachable from the start, no dead ends, no 1-tile-thick
// walls between corridors (the outline renderer needs 2 tiles to draw both sides),
// the fixed tiles (pen exit, start, tunnel mouth, four power-up corners) in place.
//   node tools/troll-man-maze-check.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(ROOT, "assets/games/troll-man/game.js"), "utf8");
const HALVES = Function(`return ${src.match(/const HALVES = (\[\[[\s\S]*?\]\]);/)[1]}`)();
const COLS = 28, TUNNEL_ROW = 13;
const GAME_ROWS = Number(src.match(/COLS = 28, ROWS = (\d+)/)[1]);
const PEN = { c0: 10, c1: 17, r0: 12, r1: 15 };
const inPen = (c, r) => c >= PEN.c0 && c <= PEN.c1 && r >= PEN.r0 && r <= PEN.r1;
const wrap = c => ((c % COLS) + COLS) % COLS;
let failed = false;

HALVES.forEach((HALF, mi) => {
  const MAZE = HALF.map(r => r + [...r].reverse().join(""));
  const ROWS = MAZE.length;
  const walk = (c, r) => {
    if (r < 0 || r >= ROWS) return false;
    if (c < 0 || c >= COLS) return r === TUNNEL_ROW;
    return !inPen(c, r) && MAZE[r][c] !== "#" && MAZE[r][c] !== "-";
  };
  const errs = [];
  if (MAZE.length !== GAME_ROWS) errs.push(`maze has ${MAZE.length} rows, game.js ROWS = ${GAME_ROWS}`);
  HALF.forEach((r, i) => { if (r.length !== 14) errs.push(`row ${i} half is ${r.length} wide`); });
  // the tiles the game relies on, whatever the maze
  for (const [c, r, what] of [[13, 11, "pen exit"], [13, 21, "start"], [0, 13, "tunnel mouth"]]) {
    if (!walk(c, r)) errs.push(`${what} ${c},${r} is not floor`);
  }
  if (MAZE[12][13] !== "-" || MAZE[12][14] !== "-") errs.push("pen door missing at 13-14,12");
  const corners = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (MAZE[r][c] === "o") corners.push(`${c},${r}`);
  if (corners.join(" ") !== "1,3 26,3 1,21 26,21") errs.push(`power-up corners at ${corners.join(" ")}`);

  // reachability from the start tiles (13,21) / (14,21)
  const seen = new Set(), q = [[13, 21], [14, 21]];
  q.forEach(([c, r]) => seen.add(`${c},${r}`));
  while (q.length) {
    const [c, r] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = wrap(c + dx), nr = r + dy;
      if (!walk(c + dx, nr) || seen.has(`${nc},${nr}`)) continue;
      seen.add(`${nc},${nr}`); q.push([nc, nr]);
    }
  }
  let dots = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const ch = MAZE[r][c];
    if (ch === "." || ch === "o") { dots++; if (!seen.has(`${c},${r}`)) errs.push(`dot ${c},${r} unreachable`); }
    if (!walk(c, r)) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => walk(c + dx, r + dy)).length;
    if (n < 2) errs.push(`dead end at ${c},${r}`);
    if (!seen.has(`${c},${r}`)) errs.push(`floor ${c},${r} unreachable`);
  }
  // thin walls: a wall tile (outside the pen) with floor on both opposite sides
  for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
    if (MAZE[r][c] !== "#" || inPen(c, r)) continue;
    const fl = (cc, rr) => MAZE[rr][cc] !== "#" && !inPen(cc, rr);
    if ((fl(c - 1, r) && fl(c + 1, r)) || (fl(c, r - 1) && fl(c, r + 1))) errs.push(`1-thick wall at ${c},${r}`);
  }

  console.log(`maze ${mi + 1}`);
  console.log(MAZE.map((r, i) => String(i).padStart(2) + " " + r).join("\n"));
  console.log(`dots: ${dots}`);
  if (errs.length) { console.log("FAIL\n" + errs.join("\n")); failed = true; } else console.log("PASS");
  console.log();
});
if (failed) process.exit(1);
