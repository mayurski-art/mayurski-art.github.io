// Troll Man phase 2 test: the chasers.
//  A. play 40 game-seconds with a dot-eating autopilot: every chaser leaves the
//     pen, never stands in a wall, never sits still outside the pen for 2s
//  B. stand still: the chasers take all three lives and the game ends
//  C. Pump.fun pill: chasers turn blue, eating two scores 200 then 400, and the
//     eaten one's eyes get home and it comes back out
//   node tools/troll-man-p2-test.mjs [--shots]
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5199;
const SHOTS = process.argv.includes("--shots");
const OUT = path.join(ROOT, ".claude/run");
const fails = [];
const check = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) fails.push(msg); };

const server = spawn(process.execPath, [path.join(ROOT, "tools/static-serve.mjs"), String(PORT)], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 700));
const browser = await chromium.launch();
const errors = [];

async function open() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/troll-man.html?debug`);
  await page.waitForFunction(() => window.__tm);
  await page.waitForTimeout(400);
  return page;
}
const snap = page => page.evaluate(() => {
  const t = window.__tm;
  return {
    state: t.state, lives: t.lives, score: t.score, frightT: t.frightT, mode: t.mode,
    p: { x: t.player.x, y: t.player.y },
    g: t.CHASERS.map(g => ({ name: g.name, x: g.x, y: g.y, mode: g.mode, fright: g.fright })),
  };
});

try {
  // ---- A: chasers move sanely --------------------------------------------------
  {
    const page = await open();
    await page.keyboard.press("Enter");
    await page.evaluate(() => window.__tm.setTimeScale(4));
    const left = new Set(), bad = [];
    const lastMove = {};
    const t0 = Date.now();
    let shot = false;
    while (Date.now() - t0 < 10000) {                   // ~40 game seconds
      const s = await snap(page);
      if (s.state === "over") break;
      for (const g of s.g) {
        if (g.mode === "out") {
          left.add(g.name);
          const ok = await page.evaluate(({ x, y }) => window.__tm.walkable(((Math.round(x) % 28) + 28) % 28, Math.round(y)) || Math.round(y) === 13, g);
          if (!ok) bad.push(`${g.name} in a wall at ${g.x.toFixed(2)},${g.y.toFixed(2)}`);
          const k = `${g.x.toFixed(3)},${g.y.toFixed(3)}`;
          const lm = lastMove[g.name];
          if (!lm || lm.k !== k) lastMove[g.name] = { k, t: Date.now() };
          else if (s.state === "play" && Date.now() - lm.t > 500) bad.push(`${g.name} stuck at ${k}`);
        } else delete lastMove[g.name];
      }
      if (SHOTS && !shot && s.g.filter(g => g.mode === "out").length >= 3) { shot = true; await page.screenshot({ path: path.join(OUT, "tm-p2-chase.png") }); }
      // autopilot: head for the nearest dot
      if (s.state === "play") {
        const key = await page.evaluate(() => {
          const t = window.__tm, COLS = t.COLS, wrap = c => ((c % COLS) + COLS) % COLS;
          const sc = wrap(Math.round(t.player.x)), sr = Math.round(t.player.y);
          const prev = new Map([[`${sc},${sr}`, null]]), q = [[sc, sr]];
          while (q.length) {
            const [c, r] = q.shift();
            if (t.dots[r * COLS + c] && !(c === sc && r === sr)) {
              let k = `${c},${r}`, first = k;
              while (prev.get(k)) { first = k; k = prev.get(k); }
              const [fc, fr] = first.split(",").map(Number);
              let dx = fc - sc; const dy = fr - sr;
              if (Math.abs(dx) > 1) dx = -Math.sign(dx);
              return { "-1,0": "ArrowLeft", "1,0": "ArrowRight", "0,-1": "ArrowUp", "0,1": "ArrowDown" }[`${dx},${dy}`];
            }
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              if (!t.walkable(c + dx, r + dy)) continue;
              const k = `${wrap(c + dx)},${r + dy}`;
              if (prev.has(k)) continue;
              prev.set(k, `${c},${r}`); q.push([wrap(c + dx), r + dy]);
            }
          }
          return null;
        });
        if (key) await page.keyboard.press(key);
      }
      await page.waitForTimeout(20);
    }
    check(left.size === 4, `all four chasers left the pen (${[...left].join(", ")})`);
    check(bad.length === 0, `no chaser in a wall or stuck${bad.length ? ": " + [...new Set(bad)].slice(0, 5).join("; ") : ""}`);
    await page.close();
  }

  // ---- B: standing still costs all three lives --------------------------------
  {
    const page = await open();
    await page.keyboard.press("Enter");
    await page.evaluate(() => window.__tm.setTimeScale(4));
    const seen = new Set();
    let shotDying = false;
    const t0 = Date.now();
    let s;
    while (Date.now() - t0 < 30000) {
      s = await snap(page);
      seen.add(s.lives);
      if (SHOTS && !shotDying && s.state === "dying") { shotDying = true; await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, "tm-p2-dying.png") }); }
      if (s.state === "over") break;
      await page.waitForTimeout(30);
    }
    check(s.state === "over", `standing still ends the game (state ${s.state})`);
    check(seen.has(3) && seen.has(2) && seen.has(1), `lives went 3, 2, 1 (${[...seen].join(",")})`);
    await page.close();
  }

  // ---- C: Pump.fun pill, eating chasers, eyes go home -------------------------
  {
    const page = await open();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__tm.state === "play", null, { timeout: 5000 });
    // put the trollface under the top-left pill (1,3), coming up from (1,4)
    await page.evaluate(() => {
      const t = window.__tm;
      Object.assign(t.player, { x: 1, y: 4.4, dir: { x: 0, y: -1 }, next: { x: 0, y: -1 } });
    });
    await page.waitForFunction(() => window.__tm.frightT > 0, null, { timeout: 3000 });
    let s = await snap(page);
    check(s.frightT > 0, `pill starts frightened mode (${s.frightT.toFixed(2)}s)`);
    if (SHOTS) await page.screenshot({ path: path.join(OUT, "tm-p2-fright.png") });
    // walk two blue chasers into the trollface
    const eat = async () => page.evaluate(() => {
      const t = window.__tm, p = t.player;
      Object.assign(p, { dir: { x: 0, y: 0 }, next: null });   // hold still so no dots add to the score
      const g = t.CHASERS.find(g => g.fright && g.mode === "out") || t.CHASERS.find(g => g.fright);
      if (!g) return null;
      Object.assign(g, { mode: "out", x: p.x, y: p.y });
      return g.name;
    });
    await page.evaluate(() => Object.assign(window.__tm.player, { dir: { x: 0, y: 0 }, next: null }));
    await page.waitForTimeout(100);
    const before = (await snap(page)).score;
    const first = await eat();
    await page.waitForTimeout(150);
    const s1 = await snap(page);
    check(first && s1.score - before === 200, `first chaser worth 200 (got ${s1.score - before})`);
    await page.waitForTimeout(1000);
    const second = await eat();
    await page.waitForTimeout(150);
    const s2 = await snap(page);
    check(second && s2.score - s1.score === 400, `second chaser worth 400 (got ${s2.score - s1.score})`);
    // the first one's eyes reach the pen and it comes back out
    const back = await page.waitForFunction(name => {
      const g = window.__tm.CHASERS.find(g => g.name === name);
      return g.mode === "leaving" || (g.mode === "out" && !g.fright);
    }, first, { timeout: 8000 }).then(() => true, () => false);
    check(back, `${first}'s eyes got home and it came back out`);
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.log("page errors:\n" + errors.join("\n")); fails.push("page errors"); }
console.log(fails.length ? "FAIL" : "PASS");
process.exit(fails.length ? 1 : 0);
