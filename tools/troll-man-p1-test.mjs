// Troll Man phase 1 test: start a game and clear the whole maze using only
// arrow-key presses (a BFS autopilot picks the key), at 4x game speed.
// Passes when the level counter reaches 2 with at least the score every dot is worth.
//   node tools/troll-man-p1-test.mjs [--shots]
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5197;
const SHOTS = process.argv.includes("--shots");
const OUT = path.join(ROOT, ".claude/run");

const server = spawn(process.execPath, [path.join(ROOT, "tools/static-serve.mjs"), String(PORT)], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 700));
let ok = false;
try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/troll-man.html?debug`);
  await page.waitForFunction(() => window.__tm);
  await page.evaluate(() => window.__tm.setChasersOff(true));   // phase 1 checks the maze and steering only
  await page.waitForTimeout(800);
  if (SHOTS) await page.screenshot({ path: path.join(OUT, "tm-title.png") });

  await page.keyboard.press("Enter");
  const want = await page.evaluate(() => {
    let sum = 0; for (const v of window.__tm.dots) sum += v === 1 ? 10 : v >= 2 ? 50 : 0; return sum;
  });
  await page.evaluate(() => window.__tm.setTimeScale(4));

  const DIR_KEY = { "-1,0": "ArrowLeft", "1,0": "ArrowRight", "0,-1": "ArrowUp", "0,1": "ArrowDown" };
  const t0 = Date.now();
  let lastKey = "", shotMid = false;
  while (Date.now() - t0 < 120000) {
    const s = await page.evaluate(() => {
      const t = window.__tm, p = t.player;
      return { state: t.state, level: t.level, score: t.score, left: t.dotsLeft, x: p.x, y: p.y, dots: Array.from(t.dots) };
    });
    if (s.level >= 2) {
      // Stonks doubles points and bonus pickups add some, so the score is at least face value
      console.log(`cleared level 1 in ${((Date.now() - t0) / 1000).toFixed(1)}s, score ${s.score} (face value of the dots ${want})`);
      ok = s.score >= want;
      break;
    }
    if (SHOTS && !shotMid && s.left < 120) { shotMid = true; await page.screenshot({ path: path.join(OUT, "tm-play.png") }); }
    if (s.state !== "play") { await page.waitForTimeout(50); continue; }
    // BFS from the player's tile to the nearest dot, using the page's own walkable()
    const step = await page.evaluate(({ x, y }) => {
      const t = window.__tm, COLS = t.COLS;
      const wrap = c => ((c % COLS) + COLS) % COLS;
      const sc = wrap(Math.round(x)), sr = Math.round(y);
      const prev = new Map([[`${sc},${sr}`, null]]);
      const q = [[sc, sr]];
      while (q.length) {
        const [c, r] = q.shift();
        if (t.dots[r * COLS + c] && !(c === sc && r === sr)) {
          let k = `${c},${r}`, first = null;
          while (prev.get(k)) { first = k; k = prev.get(k); }
          const [fc, fr] = (first || `${c},${r}`).split(",").map(Number);
          let dx = fc - sc, dy = fr - sr;
          if (Math.abs(dx) > 1) dx = -Math.sign(dx);   // through the tunnel
          return `${dx},${dy}`;
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!t.walkable(c + dx, r + dy)) continue;
          const k = `${wrap(c + dx)},${r + dy}`;
          if (prev.has(k)) continue;
          prev.set(k, `${c},${r}`); q.push([wrap(c + dx), r + dy]);
        }
      }
      return null;
    }, s);
    const key = step && DIR_KEY[step];
    if (key && key !== lastKey) { await page.keyboard.press(key); lastKey = key; }
    else if (key) await page.keyboard.press(key);
    await page.waitForTimeout(15);
  }
  if (!ok) console.log("did not clear the maze with the right score");
  if (errors.length) { console.log("page errors:\n" + errors.join("\n")); ok = false; }
  await browser.close();
} finally { server.kill(); }
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
