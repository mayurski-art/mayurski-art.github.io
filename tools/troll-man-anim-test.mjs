// Troll Man animation test. Reads the per-frame log the game keeps in ?debug
// builds and checks every animation, then writes a contact sheet of zoomed
// frames to .claude/run/tm-anim-sheet.png for a visual check.
//   trollface: chomps f1/f3 at the right rate while moving, never while still;
//              blinks (f2) briefly while standing; faces each of 4 directions
//   chasers:   each blinks on its own beat; faces the middle while in the pen;
//              grins (f3) when closing in during chase, without flicker
//   frightened: blue, then flashing white before it wears off; eaten = eyes,
//              trollface hidden during the eat freeze
//   death:     spin-out shrinks to nothing; level clear: maze flashes
//   node tools/troll-man-anim-test.mjs
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5200;
const OUT = path.join(ROOT, ".claude/run/tm-anim-sheet.png");
const fails = [];
const check = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) fails.push(msg); };

const server = spawn(process.execPath, [path.join(ROOT, "tools/static-serve.mjs"), String(PORT)], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 700));
const browser = await chromium.launch();
const errors = [];
const shots = [];               // { label, url } zoomed crops for the sheet

async function open(chasersOff) {
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
// frames logged since `since` (performance.now() in the page)
const framesSince = (page, since) => page.evaluate(s => window.__tm.frames.filter(f => f.t >= s), since);
const now = page => page.evaluate(() => performance.now());
// zoomed crop of the canvas around tile (x, y), straight from the canvas pixels
async function crop(page, label, x, y, size = 56) {
  const url = await page.evaluate(({ x, y, size }) => {
    const cv = document.getElementById("tm-canvas");
    const c = document.createElement("canvas"); c.width = size * 3; c.height = size * 3;
    const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
    const cx = x * 16 + 8, cy = (y + 3) * 16 + 8;
    g.drawImage(cv, cx - size / 2, cy - size / 2, size, size, 0, 0, size * 3, size * 3);
    return c.toDataURL();
  }, { x, y, size });
  shots.push({ label, url });
}
const runs = (frames, pick) => {           // consecutive runs of one value: [[value, count], ...]
  const out = [];
  for (const f of frames) {
    const v = pick(f);
    if (out.length && out[out.length - 1][0] === v) out[out.length - 1][1]++; else out.push([v, 1]);
  }
  return out;
};

try {
  // ---- trollface ---------------------------------------------------------------
  {
    const page = await open(true);
    const put = (x, y, d) => page.evaluate(({ x, y, d }) => Object.assign(window.__tm.player, { x, y, dir: d, next: d, face: d }), { x, y, d });
    // chomping along the long top corridor (row 5)
    await put(3, 5, { x: 1, y: 0 });
    let t = await now(page);
    await page.waitForTimeout(900);
    let fr = (await framesSince(page, t)).filter(f => f.state === "play");
    const looks = new Set(fr.map(f => f.player));
    const swaps = runs(fr, f => f.player).length - 1;
    const secs = (fr[fr.length - 1].t - fr[0].t) / 1000;
    check(looks.has("f1") && looks.has("f3") && !looks.has("f2"), `moving: chomps f1/f3, no blink (${[...looks]})`);
    check(swaps / secs > 8 && swaps / secs < 16, `chomp rate ${(swaps / secs).toFixed(1)} swaps/s (frame every 0.08s = 12.5)`);
    const p = await page.evaluate(() => ({ x: window.__tm.player.x, y: window.__tm.player.y }));
    await crop(page, "moving right", p.x, p.y);
    for (const [name, x, y, d] of [["moving left", 22, 5, { x: -1, y: 0 }], ["moving up", 6, 17, { x: 0, y: -1 }], ["moving down", 6, 9, { x: 0, y: 1 }]]) {
      await put(x, y, d);
      await page.waitForTimeout(120);
      const q = await page.evaluate(() => ({ x: window.__tm.player.x, y: window.__tm.player.y, f: window.__tm.player.face }));
      check(q.f.x === d.x && q.f.y === d.y, `${name}: facing ${JSON.stringify(q.f)}`);
      await crop(page, name, q.x, q.y);
    }
    // standing still: blinks, briefly
    await page.evaluate(() => Object.assign(window.__tm.player, { dir: { x: 0, y: 0 }, next: null }));
    t = await now(page);
    await page.waitForTimeout(5200);
    fr = (await framesSince(page, t)).filter(f => f.state === "play");
    const blinks = runs(fr, f => f.player).filter(([v]) => v === "f2");
    check(!fr.some(f => f.player === "f3"), "standing: no chomp frames");
    check(blinks.length >= 1 && blinks.length <= 3, `standing: ${blinks.length} blink(s) in 5.2s`);
    check(blinks.every(([, n]) => n >= 4 && n <= 14), `blinks last ~0.14s (${blinks.map(b => b[1]).join(",")} frames)`);
    // grab a blink frame for the sheet
    const s = await page.evaluate(() => ({ x: window.__tm.player.x, y: window.__tm.player.y }));
    await page.waitForFunction(() => { const f = window.__tm.frames; return f[f.length - 1].player === "f2"; }, null, { timeout: 6000, polling: "raf" }).catch(() => {});
    await crop(page, "blink", s.x, s.y);
    await page.close();
  }

  // ---- chasers ----------------------------------------------------------------
  {
    const page = await open(false);
    // hold the trollface far away (bottom-left corner) so nobody catches him
    const park = () => page.evaluate(() => Object.assign(window.__tm.player, { x: 1, y: 27, dir: { x: 0, y: 0 }, next: null }));
    await park();
    const t = await now(page);
    await page.waitForTimeout(400);
    const pen = await page.evaluate(() => window.__tm.CHASERS.filter(g => g.mode === "pen").map(g => ({ n: g.name, x: g.x, y: g.y })));
    for (const g of pen) await crop(page, `${g.n} in pen`, g.x, g.y);
    await page.waitForTimeout(6000);
    const fr = (await framesSince(page, t)).filter(f => f.state === "play");
    for (const name of ["gigachad", "pepe", "pudgy", "doge"]) {
      const r = runs(fr, f => f.chasers[name]);
      const blinks = r.filter(([v]) => v === "f2");
      check(blinks.length >= 1, `${name} blinks (${blinks.length} in 6.4s)`);
    }
    // grin when closing in: chase mode, Giga Chad 4 tiles away
    await page.evaluate(() => {
      const t = window.__tm, g = t.CHASERS.find(c => c.name === "gigachad");
      t.setPhase(1);
      Object.assign(t.player, { x: 3, y: 5, dir: { x: 0, y: 0 }, next: null });
      Object.assign(g, { mode: "out", x: 7, y: 5, dir: { x: -1, y: 0 } });
    });
    const t2 = await now(page);
    await page.waitForTimeout(220);
    const fr2 = await framesSince(page, t2);
    const chadLooks = runs(fr2.filter(f => f.state === "play"), f => f.chasers.gigachad);
    check(chadLooks.some(([v]) => v === "f3"), `Giga Chad grins when close (${chadLooks.map(r => r[0]).join(" ")})`);
    const g = await page.evaluate(() => { const g = window.__tm.CHASERS.find(c => c.name === "gigachad"); return { x: g.x, y: g.y }; });
    await crop(page, "chad closing in", g.x, g.y);
    await page.close();
  }

  // ---- frightened, eyes, eat freeze ----------------------------------------------
  {
    const page = await open(false);
    await page.evaluate(() => Object.assign(window.__tm.player, { x: 1, y: 27, dir: { x: 0, y: 0 }, next: null }));
    await page.waitForTimeout(1500);                       // let a couple out of the pen
    const t = await now(page);
    await page.evaluate(() => window.__tm.startFright());
    await page.waitForTimeout(300);
    let g = await page.evaluate(() => { const g = window.__tm.CHASERS.find(c => c.mode === "out"); return { n: g.name, x: g.x, y: g.y }; });
    await crop(page, `${g.n} frightened`, g.x, g.y);
    await page.waitForTimeout(4700);                       // into the last 2s: flashing
    g = await page.evaluate(() => { const g = window.__tm.CHASERS.find(c => c.mode === "out" && c.fright); return g && { n: g.name, x: g.x, y: g.y }; });
    await page.waitForFunction(() => { const f = window.__tm.frames; return Object.values(f[f.length - 1].chasers).includes("white"); }, null, { timeout: 3000, polling: "raf" }).catch(() => {});
    if (g) {
      const gg = await page.evaluate(n => { const g = window.__tm.CHASERS.find(c => c.name === n); return { x: g.x, y: g.y }; }, g.n);
      await crop(page, `${g.n} flashing`, gg.x, gg.y);
    }
    await page.waitForTimeout(1500);
    const fr = (await framesSince(page, t)).filter(f => f.state === "play");
    const name = Object.keys(fr[0].chasers)[0];
    const seq = runs(fr, f => f.chasers.gigachad).map(r => r[0]);
    check(seq[0] === "blue" && seq.includes("white"), `frightened: blue, then white flashes (${seq.slice(0, 8).join(" ")}...)`);
    const flashes = runs(fr, f => f.chasers.gigachad).filter(([v]) => v === "white").length;
    check(flashes >= 3, `${flashes} white flashes before it wears off`);
    check(!["blue", "white"].includes(fr[fr.length - 1].chasers.gigachad), `back to normal after (${fr[fr.length - 1].chasers.gigachad})`);
    void name;

    // eat one: eyes + hidden trollface during the freeze
    await page.evaluate(() => window.__tm.startFright());
    await page.waitForTimeout(100);
    const t3 = await now(page);
    const eaten = await page.evaluate(() => {
      const t = window.__tm, p = t.player, g = t.CHASERS.find(c => c.mode === "out" && c.fright);
      Object.assign(g, { x: p.x, y: p.y });
      return g.name;
    });
    await page.waitForTimeout(250);
    await page.evaluate(() => {});
    const fr3 = await framesSince(page, t3);
    check(fr3.some(f => f.player === "hidden"), "trollface hidden during the eat freeze");
    await page.waitForTimeout(700);
    const e = await page.evaluate(n => { const g = window.__tm.CHASERS.find(c => c.name === n); return { x: g.x, y: g.y, m: g.mode }; }, eaten);
    await crop(page, `${eaten} eyes`, e.x, e.y);
    const fr4 = await framesSince(page, t3);
    check(fr4.some(f => f.chasers[eaten] === "eyes"), `${eaten} becomes eyes (${e.m})`);
    await page.close();
  }

  // ---- death spin, level clear flash -------------------------------------------
  {
    const page = await open(false);
    const t = await now(page);
    await page.evaluate(() => {
      const t = window.__tm, p = t.player, g = t.CHASERS.find(c => c.name === "gigachad");
      Object.assign(g, { mode: "out", x: p.x - 1, y: p.y, dir: { x: 1, y: 0 } });
    });
    await page.waitForFunction(() => window.__tm.state === "dying", null, { timeout: 3000 });
    await page.waitForTimeout(1500);
    const pp = await page.evaluate(() => ({ x: window.__tm.player.x, y: window.__tm.player.y }));
    await crop(page, "death spin", pp.x, pp.y);
    await page.waitForFunction(() => window.__tm.state === "ready", null, { timeout: 4000 });
    const fr = (await framesSince(page, t)).filter(f => f.state === "dying" && f.player.startsWith("spin"));
    const scales = fr.map(f => Number(f.player.split(":")[1]));
    const shrinking = scales.every((s, i) => i === 0 || s <= scales[i - 1] + 1e-9);
    check(scales.length > 20 && shrinking && scales[scales.length - 1] < 0.15, `death spin shrinks ${scales[0]} -> ${scales[scales.length - 1]} over ${scales.length} frames`);

    await page.waitForFunction(() => window.__tm.state === "play", null, { timeout: 4000 });
    const t2 = await now(page);
    await page.evaluate(() => {
      const t = window.__tm, p = t.player;
      t.setChasersOff(true);
      Object.assign(p, { x: 3, y: 5, dir: { x: 1, y: 0 }, next: { x: 1, y: 0 } });
      t.leaveOneDot(5, 5);
    });
    await page.waitForFunction(() => window.__tm.state === "clear", null, { timeout: 3000 });
    await page.waitForTimeout(2200);
    const fr2 = (await framesSince(page, t2)).filter(f => f.state === "clear");
    const mz = runs(fr2, f => f.maze).map(r => r[0]);
    check(mz[0] === "colour" && mz.filter(v => v === "flash").length >= 3, `level clear: holds, then the maze flashes (${mz.join(" ")})`);
    await page.close();
  }

  // ---- phase 3: the laugh, stunned chasers, the shield flicker ----------------------
  {
    const page = await open(false);
    await page.evaluate(() => {
      const t = window.__tm, g = t.CHASERS.find(c => c.name === "gigachad");
      Object.assign(t.player, { x: 3, y: 5, dir: { x: 0, y: 0 }, next: null });
      Object.assign(g, { mode: "out", x: 5, y: 5, dir: { x: -1, y: 0 }, frozen: 0, blinking: 0 });
    });
    const t = await now(page);
    await page.keyboard.press("Space");
    await page.waitForTimeout(120);
    await crop(page, "taunt", 3, 4.4, 72);
    await page.waitForTimeout(500);
    const fr = (await framesSince(page, t)).filter(f => f.state === "play");
    const laugh = runs(fr.slice(0, 30), f => f.player);
    check(laugh.length >= 4 && laugh.every(([v]) => v === "f1" || v === "f3"), `taunt: laughs f1/f3 (${laugh.map(r => r[0]).join(" ")})`);
    check(fr.slice(0, 40).every(f => f.chasers.gigachad === "f2"), "stunned chaser shuts its eyes (f2) while frozen");
    // Aster: block a hit, then flicker through the grace period
    await page.evaluate(() => window.__tm.powerUp("aster"));
    await page.waitForTimeout(150);
    await crop(page, "shield", 3, 5);
    const t2 = await now(page);
    await page.evaluate(() => {
      const t = window.__tm, p = t.player, g = t.CHASERS.find(c => c.name === "pepe");
      Object.assign(g, { mode: "out", fright: false, x: p.x, y: p.y, frozen: 0 });
    });
    await page.waitForTimeout(1100);
    const fr2 = (await framesSince(page, t2)).filter(f => f.state === "play");
    const flick = runs(fr2, f => f.player === "flicker").filter(([v]) => v).length;
    check(flick >= 4, `blocked hit: trollface flickers (${flick} blinks) through the grace period`);
    check(fr2[fr2.length - 1].player !== "flicker", "and stops flickering after");
    await page.close();
  }

  // ---- contact sheet ----------------------------------------------------------------
  const sheet = await browser.newPage({ viewport: { width: 940, height: 200 } });
  await sheet.setContent(`<body style="margin:0;background:#111;font:12px monospace;color:#ccc;display:flex;flex-wrap:wrap;gap:8px;padding:8px">${
    shots.map(s => `<figure style="margin:0;text-align:center"><img src="${s.url}" style="display:block;border:1px solid #333;image-rendering:pixelated"><figcaption>${s.label}</figcaption></figure>`).join("")}</body>`);
  await sheet.waitForTimeout(200);
  await sheet.screenshot({ path: OUT, fullPage: true });
  console.log(`sheet: ${OUT}`);
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.log("page errors:\n" + errors.join("\n")); fails.push("page errors"); }
console.log(fails.length ? "FAIL" : "PASS");
process.exit(fails.length ? 1 : 0);
