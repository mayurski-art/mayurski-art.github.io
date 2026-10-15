// Troll Man phase 5 test: sound, the 1UP/2UP hot seat, intermissions, the attract demo.
// Sound is checked through TMSound.log (every effect and loop change is recorded,
// whether or not the browser actually plays it).
//   node tools/troll-man-p5-test.mjs [--shots]
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5205;
const SHOTS = process.argv.includes("--shots");
const OUT = path.join(ROOT, ".claude/run");
const fails = [];
const check = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) fails.push(msg); };

const server = spawn(process.execPath, [path.join(ROOT, "tools/static-serve.mjs"), String(PORT)], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 900));
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const errors = [];

async function open() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/troll-man.html?debug`);
  await page.waitForFunction(() => window.__tm && window.TMSound);
  await page.evaluate(() => { try { localStorage.removeItem("trollman.muted"); } catch (_) {} if (window.TMSound.muted) window.TMSound.setMuted(false); });
  await page.waitForTimeout(200);
  return page;
}
const tm = (page, fn, arg) => page.evaluate(fn, arg);
const logSince = (page, n) => page.evaluate(n => window.TMSound.log.slice(n), n);
const logLen = page => page.evaluate(() => window.TMSound.log.length);
// put Giga Chad on the trollface
const catchMe = page => page.evaluate(() => {
  const t = window.__tm, p = t.player, g = t.CHASERS.find(c => c.name === "gigachad");
  Object.assign(g, { mode: "out", fright: false, frozen: 0, x: p.x, y: p.y });
});
const waitState = (page, s, timeout = 8000) => page.waitForFunction(s => window.__tm.state === s, s, { timeout });

try {
  // ---- sound ----------------------------------------------------------------------------
  {
    const page = await open();
    check(!(await tm(page, () => window.TMSound.running)), "no audio before the first key or touch");
    const n0 = await logLen(page);
    await page.keyboard.press("Enter");
    check(await tm(page, () => window.TMSound.running), "the first key switches audio on");
    await waitState(page, "play");
    await page.waitForTimeout(500);
    await page.waitForFunction(() => window.__tm.CHASERS.some(c => c.mode === "out"), null, { timeout: 4000 });   // all start in the pen
    let log = await logSince(page, n0);
    check(log.includes("start"), "start jingle on a new game");
    check(log.includes("waka"), "waka while eating dots");
    check(log.includes("loop:siren"), "siren loop during play");
    let n = await logLen(page);
    await tm(page, () => window.__tm.powerUp("pump"));
    await page.waitForFunction(n => window.TMSound.log.slice(n).includes("loop:fright"), n, { timeout: 1500 }).catch(() => {});
    log = await logSince(page, n);
    check(log.includes("power") && log.includes("loop:fright"), `Pump.fun: power-up sound + fright loop (${log.join(" ")})`);
    n = await logLen(page);
    await tm(page, () => {
      const t = window.__tm, p = t.player, g = t.CHASERS.find(c => c.mode === "out" && c.fright);
      Object.assign(p, { dir: { x: 0, y: 0 }, next: null });
      Object.assign(g, { x: p.x, y: p.y });
    });
    await page.waitForTimeout(300);
    log = await logSince(page, n);
    check(log.includes("eat") && log.includes("loop:eyes"), `eating a chaser: eat sound + eyes loop (${log.join(" ")})`);
    await page.waitForFunction(() => !window.__tm.frames.length || window.__tm.frames[window.__tm.frames.length - 1].player !== "hidden", null, { timeout: 3000 });
    await page.waitForTimeout(200);                                 // past the eat freeze, when the taunt is allowed
    n = await logLen(page);
    await page.keyboard.press("Space");
    await page.waitForTimeout(100);
    check((await logSince(page, n)).includes("taunt"), "taunt laugh on Space");
    await page.waitForTimeout(1200);
    n = await logLen(page);
    await catchMe(page);
    await waitState(page, "dying", 3000);
    await page.waitForTimeout(1300);
    log = await logSince(page, n);
    check(log.includes("death") && log.includes("loop:null"), `getting caught: loop stops, death sound (${log.join(" ")})`);
    // mute
    await page.keyboard.press("m");
    const m1 = await tm(page, () => ({ muted: window.TMSound.muted, saved: localStorage.getItem("trollman.muted"), pressed: document.getElementById("tm-mute").getAttribute("aria-pressed") }));
    check(m1.muted && m1.saved === "1" && m1.pressed === "true", `M mutes, remembered, button shows it (${JSON.stringify(m1)})`);
    await page.click("#tm-mute");
    const m2 = await tm(page, () => ({ muted: window.TMSound.muted, saved: localStorage.getItem("trollman.muted") }));
    check(!m2.muted && m2.saved === "0", "the button turns it back on");
    await page.close();
  }

  // ---- 2 players --------------------------------------------------------------------------
  {
    const page = await open();
    await page.keyboard.press("ArrowDown");
    check(await tm(page, () => window.__tm.menuSel) === 1, "Down on the title picks 2 PLAYERS");
    if (SHOTS) { await page.waitForTimeout(400); await page.screenshot({ path: path.join(OUT, "tm-p5-menu.png") }); }
    await page.keyboard.press("Enter");
    let s = await tm(page, () => ({ n: window.__tm.numPlayers, cur: window.__tm.cur, state: window.__tm.state }));
    check(s.n === 2 && s.cur === 0 && s.state === "ready", `Enter starts a 2-player game with player one (${JSON.stringify(s)})`);
    if (SHOTS) { await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, "tm-p5-2p-ready.png") }); }
    await waitState(page, "play");
    await page.waitForTimeout(900);                                   // player one eats a few dots
    await tm(page, () => window.__tm.setChasersOff(false));
    const p1 = await tm(page, () => ({ score: window.__tm.score, left: window.__tm.dotsLeft }));
    await catchMe(page);
    await page.waitForFunction(() => window.__tm.state === "ready" && window.__tm.cur === 1, null, { timeout: 6000 });
    const p2 = await tm(page, () => ({ score: window.__tm.score, left: window.__tm.dotsLeft, lives: window.__tm.lives, p1: window.__tm.slots[0] }));
    check(p2.score === 0 && p2.left === 242 && p2.lives === 3, `player two starts fresh (${p2.score} pts, ${p2.left} dots)`);
    check(p2.p1.score === p1.score && p2.p1.lives === 2, `player one's score and lives wait in their slot (${p2.p1.score}, ${p2.p1.lives} lives)`);
    if (SHOTS) await page.screenshot({ path: path.join(OUT, "tm-p5-2p-turn.png") });
    await waitState(page, "play");
    await catchMe(page);
    await page.waitForFunction(() => window.__tm.state === "ready" && window.__tm.cur === 0, null, { timeout: 6000 });
    const back = await tm(page, () => ({ score: window.__tm.score, left: window.__tm.dotsLeft }));
    check(back.score === p1.score && Math.abs(back.left - p1.left) <= 2, `back to player one, maze as they left it (${back.left} dots left, was ${p1.left})`);
    // player one loses their last life: GAME OVER card, then player two carries on
    await waitState(page, "play");
    await tm(page, () => window.__tm.setLives(1));
    await catchMe(page);
    await waitState(page, "turnover", 6000);
    if (SHOTS) { await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, "tm-p5-turnover.png") }); }
    await page.waitForFunction(() => window.__tm.state === "ready" && window.__tm.cur === 1, null, { timeout: 5000 });
    check(true, "player one out: GAME OVER card, then player two's turn");
    await waitState(page, "play");
    await tm(page, () => window.__tm.setLives(1));
    await catchMe(page);
    await waitState(page, "over", 6000);
    check(true, "both out: GAME OVER");
    await page.close();
  }

  // ---- intermissions ------------------------------------------------------------------------
  {
    const page = await open();
    await page.keyboard.press("Enter");
    await waitState(page, "play");
    await tm(page, () => {
      const t = window.__tm;
      t.setChasersOff(true); t.setLevel(2);
      Object.assign(t.player, { x: 3, y: 5, dir: { x: 1, y: 0 }, next: { x: 1, y: 0 } });
      t.leaveOneDot(5, 5);
    });
    await waitState(page, "intermission", 6000);
    const n = await logLen(page);
    void n;
    await page.waitForTimeout(1500);
    if (SHOTS) await page.screenshot({ path: path.join(OUT, "tm-p5-inter-1.png") });
    await page.waitForTimeout(3600);
    if (SHOTS) await page.screenshot({ path: path.join(OUT, "tm-p5-inter-2.png") });
    const scenes = await tm(page, () => [...new Set(window.__tm.frames.filter(f => f.state === "intermission").map(f => f.scene))]);
    check(scenes.includes("act1") && scenes.includes("act2"), `intermission after level 2 plays both acts (${scenes})`);
    await page.waitForFunction(() => window.__tm.state === "ready" && window.__tm.level === 3, null, { timeout: 6000 });
    check(true, "then level 3 starts");
    // after level 3 there's none; Enter skips one
    await waitState(page, "play");
    await tm(page, () => { const t = window.__tm; t.setLevel(5); Object.assign(t.player, { x: 3, y: 5, dir: { x: 1, y: 0 }, next: { x: 1, y: 0 } }); t.leaveOneDot(5, 5); });
    await waitState(page, "intermission", 6000);
    await page.waitForTimeout(400);
    await page.keyboard.press("Enter");
    const sk = await tm(page, () => ({ state: window.__tm.state, level: window.__tm.level }));
    check(sk.state === "ready" && sk.level === 6, `Enter skips the cut-scene (${JSON.stringify(sk)})`);
    await page.close();
  }

  // ---- attract demo ---------------------------------------------------------------------------
  {
    const page = await open();
    const high0 = await tm(page, () => window.__tm.high);
    await tm(page, () => window.__tm.setTimeScale(4));
    await page.waitForFunction(() => window.__tm.demo, null, { timeout: 8000 });
    check(true, "left alone, the title starts the demo");
    const n = await logLen(page);
    await page.waitForTimeout(4000);                                  // ~16 game seconds
    const d = await tm(page, () => ({ score: window.__tm.score, state: window.__tm.state, demo: window.__tm.demo, high: window.__tm.high }));
    if (SHOTS) await page.screenshot({ path: path.join(OUT, "tm-p5-demo.png") });
    const sounds = (await logSince(page, n)).filter(x => !x.startsWith("loop:"));
    check(d.score >= 300, `the demo troll actually plays (${d.score} pts in ~16s)`);
    check(sounds.length === 0, `the demo is silent (${sounds.slice(0, 5).join(" ")})`);
    check(d.high === high0, "the demo never touches the high score");
    await page.keyboard.press("ArrowLeft");
    const t = await tm(page, () => ({ demo: window.__tm.demo, state: window.__tm.state, st: window.__tm.stateTime }));
    check(!t.demo && t.state === "title" && t.st >= 6, `a key ends the demo, straight to the menu (${JSON.stringify(t)})`);
    // and it ends by itself
    await page.waitForFunction(() => window.__tm.demo, null, { timeout: 8000 });
    await tm(page, () => window.__tm.setTimeScale(8));
    const ended = await page.waitForFunction(() => !window.__tm.demo && window.__tm.state === "title", null, { timeout: 8000 }).then(() => true, () => false);
    check(ended, "the demo ends on its own and goes back to the title");
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.log("page errors:\n" + errors.join("\n")); fails.push("page errors"); }
console.log(fails.length ? "FAIL" : "PASS");
process.exit(fails.length ? 1 : 0);
