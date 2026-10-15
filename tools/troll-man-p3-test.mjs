// Troll Man phase 3 test: the other power-ups, bonus pickups, the taunt.
//  corners   one of each power-up, rotating one corner per level
//  Stonks    a dot is worth 20 while it runs
//  FOMO      dots within 2.5 tiles fly in; power-ups stay put
//  Aster     the next catch is blocked, the chaser goes home, a later catch kills
//  bonus     appears at 70 dots under the pen, pays out, goes away on its own
//  taunt     freezes a chaser 2 tiles away, the trollface stands still, cooldown blocks a second
//   node tools/troll-man-p3-test.mjs [--shots]
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5201;
const SHOTS = process.argv.includes("--shots");
const OUT = path.join(ROOT, ".claude/run");
const fails = [];
const check = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) fails.push(msg); };

const server = spawn(process.execPath, [path.join(ROOT, "tools/static-serve.mjs"), String(PORT)], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 700));
const browser = await chromium.launch();
const errors = [];

async function open(chasersOff = true) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/troll-man.html?debug`);
  await page.waitForFunction(() => window.__tm);
  await page.evaluate(v => window.__tm.setChasersOff(v), chasersOff);
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__tm.state === "play", null, { timeout: 5000 });
  return page;
}
const hold = page => page.evaluate(() => Object.assign(window.__tm.player, { dir: { x: 0, y: 0 }, next: null }));
const put = (page, x, y, d) => page.evaluate(({ x, y, d }) => Object.assign(window.__tm.player, { x, y, dir: d, next: d, face: d }), { x, y, d });
const val = (page, expr) => page.evaluate(expr);
const corners = page => page.evaluate(() => { const t = window.__tm; return [[1, 3], [26, 3], [1, 21], [26, 21]].map(([c, r]) => t.dots[r * 28 + c]); });

try {
  // ---- corners --------------------------------------------------------------------
  {
    const page = await open();
    const l1 = await corners(page);
    check(JSON.stringify([...l1].sort()) === "[2,3,4,5]", `level 1 has one of each power-up (${l1})`);
    await page.evaluate(() => { window.__tm.leaveOneDot(5, 5); Object.assign(window.__tm.player, { x: 3, y: 5, dir: { x: 1, y: 0 }, next: { x: 1, y: 0 } }); });
    await page.waitForFunction(() => window.__tm.level === 2 && window.__tm.state !== "clear", null, { timeout: 6000 });
    const l2 = await corners(page);
    check(JSON.stringify(l2) === JSON.stringify([...l1.slice(1), l1[0]]), `level 2 rotates them one corner (${l2})`);
    await page.close();
  }

  // ---- Stonks + FOMO ------------------------------------------------------------------
  {
    const page = await open();
    const where = await corners(page);           // level 1: [pump, stonks, fomo, aster] in reading order
    const at = kind => [[1, 3], [26, 3], [1, 21], [26, 21]][where.indexOf(kind)];
    // Stonks: walk up into it, then one dot
    const [sc, sr] = at(3);
    await put(page, sc, sr + 1.4, { x: 0, y: -1 });
    await page.waitForFunction(() => window.__tm.stonksT > 0, null, { timeout: 2000 });
    await hold(page);
    await page.waitForTimeout(80);
    let before = await val(page, () => window.__tm.score);
    // drop a dot two tiles up and stand on it, still: exactly one dot gets eaten
    await page.evaluate(([c, r]) => { const t = window.__tm; t.dots[(r - 2) * 28 + c] = 1; Object.assign(t.player, { x: c, y: r - 2, dir: { x: 0, y: 0 }, next: null }); }, [sc, sr]);
    await page.waitForTimeout(150);
    let after = await val(page, () => window.__tm.score);
    check(after - before === 20, `Stonks: a dot is worth 20 (got ${after - before})`);
    if (SHOTS) await page.screenshot({ path: path.join(OUT, "tm-p3-stonks.png") });

    // FOMO: walk up into it; dots around it disappear
    const [fc, fr] = at(4);
    await put(page, fc, fr + 1.4, { x: 0, y: -1 });
    const nearBefore = await page.evaluate(([c, r]) => { const t = window.__tm; let n = 0; for (let y = r - 2; y <= r + 2; y++) for (let x = c - 2; x <= c + 2; x++) if (x >= 0 && x < 28 && Math.hypot(x - c, y - r) <= 2.5 && t.dots[y * 28 + x] === 1) n++; return n; }, [fc, fr]);
    await page.waitForFunction(() => window.__tm.fomoT > 0, null, { timeout: 2000 });
    await hold(page);
    await page.waitForTimeout(100);
    if (SHOTS) await page.screenshot({ path: path.join(OUT, "tm-p3-fomo.png") });
    const nearAfter = await page.evaluate(([c, r]) => { const t = window.__tm; let n = 0; for (let y = r - 2; y <= r + 2; y++) for (let x = c - 2; x <= c + 2; x++) if (x >= 0 && x < 28 && Math.hypot(x - c, y - r) <= 2.5 && t.dots[y * 28 + x] === 1) n++; return n; }, [fc, fr]);
    check(nearBefore >= 3 && nearAfter === 0, `FOMO pulls in nearby dots (${nearBefore} -> ${nearAfter})`);
    const farDot = await page.evaluate(([c, r]) => window.__tm.dots[r * 28 + c + 5], [fc, fr]);
    check(farDot === 1, "FOMO leaves dots 5 tiles away alone");
    await page.close();
  }

  // ---- Aster shield ---------------------------------------------------------------------
  {
    const page = await open(false);
    await page.evaluate(() => window.__tm.powerUp("aster"));
    check(await val(page, () => window.__tm.shield), "Aster gives a shield");
    if (SHOTS) { await page.waitForTimeout(100); await page.screenshot({ path: path.join(OUT, "tm-p3-shield.png") }); }
    const hit = () => page.evaluate(() => {
      const t = window.__tm, p = t.player, g = t.CHASERS.find(c => c.name === "gigachad");
      Object.assign(g, { mode: "out", fright: false, x: p.x, y: p.y, frozen: 0 });
    });
    await hold(page);
    await hit();
    await page.waitForTimeout(120);
    const s1 = await page.evaluate(() => ({ state: window.__tm.state, shield: window.__tm.shield, mode: window.__tm.CHASERS.find(c => c.name === "gigachad").mode }));
    check(s1.state === "play" && !s1.shield && s1.mode === "eyes", `shield blocks the hit, chaser sent home (${JSON.stringify(s1)})`);
    await page.waitForTimeout(1300);                        // past the grace period
    await hit();
    await page.waitForTimeout(120);
    check(await val(page, () => window.__tm.state) === "dying", "the next hit kills");
    await page.close();
  }

  // ---- bonus pickup -----------------------------------------------------------------------
  {
    const page = await open();
    await page.evaluate(() => window.__tm.setDotsEaten(69));
    await put(page, 3, 5, { x: 1, y: 0 });                   // eats the next dot on row 5
    await page.waitForFunction(() => window.__tm.bonus, null, { timeout: 2000 });
    const b = await val(page, () => window.__tm.bonus);
    check(b && b.kind === "coin" && b.pts === 100, `bonus at 70 dots: ${JSON.stringify(b)}`);
    await hold(page);
    if (SHOTS) await page.screenshot({ path: path.join(OUT, "tm-p3-bonus.png") });
    const before = await val(page, () => window.__tm.score);
    await put(page, 12.6, 21, { x: 1, y: 0 });
    await page.waitForFunction(() => !window.__tm.bonus, null, { timeout: 2000 });
    await hold(page);
    const after = await val(page, () => window.__tm.score);
    check(after - before >= 100 && after - before <= 120, `picking it up pays 100 (+${after - before}, a dot or two included)`);
    // the second one times out if left alone
    await page.evaluate(() => window.__tm.setDotsEaten(169));
    await put(page, 22, 5, { x: -1, y: 0 });
    await page.waitForFunction(() => window.__tm.bonus, null, { timeout: 2000 });
    await hold(page);
    await page.evaluate(() => window.__tm.setTimeScale(6));
    const gone = await page.waitForFunction(() => !window.__tm.bonus, null, { timeout: 4000 }).then(() => true, () => false);
    check(gone, "an uncollected bonus disappears on its own");
    await page.close();
  }

  // ---- taunt --------------------------------------------------------------------------------
  {
    const page = await open(false);
    await page.evaluate(() => {
      const t = window.__tm, g = t.CHASERS.find(c => c.name === "gigachad");
      Object.assign(t.player, { x: 3, y: 5, dir: { x: 0, y: 0 }, next: null });
      Object.assign(g, { mode: "out", x: 5, y: 5, dir: { x: -1, y: 0 }, frozen: 0 });
      const far = t.CHASERS.find(c => c.name === "pepe");
      Object.assign(far, { mode: "out", x: 20, y: 27, dir: { x: 1, y: 0 }, frozen: 0 });
    });
    await page.keyboard.press("Space");
    const s = await page.evaluate(() => { const t = window.__tm; return { cool: t.tauntCool, chad: t.CHASERS.find(c => c.name === "gigachad").frozen, pepe: t.CHASERS.find(c => c.name === "pepe").frozen }; });
    check(s.cool > 9 && s.chad > 1 && !s.pepe, `Space taunts: Giga Chad frozen ${s.chad.toFixed(2)}s, Pepe (far) not, cooldown ${s.cool.toFixed(1)}s`);
    if (SHOTS) { await page.waitForTimeout(150); await page.screenshot({ path: path.join(OUT, "tm-p3-taunt.png") }); }
    const chadX = await val(page, () => window.__tm.CHASERS.find(c => c.name === "gigachad").x);
    await page.waitForTimeout(500);
    const chadX2 = await val(page, () => window.__tm.CHASERS.find(c => c.name === "gigachad").x);
    check(Math.abs(chadX2 - chadX) < 1e-6, "frozen chaser stays put");
    const again = await page.evaluate(() => window.__tm.taunt());
    check(again === false, "a second taunt during the cooldown does nothing");
    // trollface doesn't move while laughing
    await page.evaluate(() => {
      const t = window.__tm; t.setChasersOff(true);
      Object.assign(t.player, { x: 10, y: 27, dir: { x: 1, y: 0 }, next: { x: 1, y: 0 } });
    });
    await page.evaluate(() => window.__tm.setTimeScale(8));
    await page.waitForFunction(() => window.__tm.tauntCool === 0, null, { timeout: 4000 });
    await page.evaluate(() => window.__tm.setTimeScale(1));
    const x0 = await val(page, () => { const t = window.__tm; Object.assign(t.player, { x: 10, y: 27, dir: { x: 1, y: 0 }, next: { x: 1, y: 0 } }); t.taunt(); return t.player.x; });
    await page.waitForTimeout(300);
    const x1 = await val(page, () => window.__tm.player.x);
    check(Math.abs(x1 - x0) < 1e-6, `trollface stands still while laughing (${x0.toFixed(2)} -> ${x1.toFixed(2)})`);
    await page.waitForTimeout(600);
    const x2 = await val(page, () => window.__tm.player.x);
    check(x2 > x1 + 0.5, "and carries on after");
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.log("page errors:\n" + errors.join("\n")); fails.push("page errors"); }
console.log(fails.length ? "FAIL" : "PASS");
process.exit(fails.length ? 1 : 0);
