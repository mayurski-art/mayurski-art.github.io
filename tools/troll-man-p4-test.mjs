// Troll Man phase 4 test: phone controls and layouts.
//  portrait 390x844   screen, stick centred under it, SELECT/START under the stick,
//                     everything on screen, no scrolling
//  landscape 844x390  screen in the middle full height, stick left, buttons right
//  desktop 1280x900   no touch controls, help line instead
//  stick              picks 1/2 players on the title, each direction, 4-way gate (no diagonals), dead zone
//  buttons            START starts / pauses / resumes, SELECT taunts
//  swipe              still steers
//   node tools/troll-man-p4-test.mjs [--shots]
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5203;
const SHOTS = process.argv.includes("--shots");
const OUT = path.join(ROOT, ".claude/run");
const fails = [];
const check = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) fails.push(msg); };

const server = spawn(process.execPath, [path.join(ROOT, "tools/static-serve.mjs"), String(PORT)], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 900));
const browser = await chromium.launch();
const errors = [];

async function open(viewport, touch) {
  const ctx = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/troll-man.html?debug`);
  await page.waitForFunction(() => window.__tm);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return { page, ctx };
}
const box = (page, sel) => page.evaluate(s => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom, cx: r.left + r.width / 2, cy: r.top + r.height / 2, shown: cs.display !== "none" && r.width > 0 };
}, sel);
const fits = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, w: innerWidth, h: innerHeight }));
const inside = (b, f) => b.x >= -0.5 && b.y >= -0.5 && b.r <= f.w + 0.5 && b.b <= f.h + 0.5;

// press the stick at an offset from its centre (as a fraction of its radius), hold, release
async function push(page, fx, fy, holdMs = 60) {
  const s = await box(page, "#tm-stick");
  const x = s.cx + fx * s.w / 2, y = s.cy + fy * s.h / 2;
  await page.mouse.move(s.cx, s.cy);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 3 });
  await page.waitForTimeout(holdMs);
  const knob = await page.evaluate(() => document.querySelector(".tm-stick-knob").style.transform);
  await page.mouse.up();
  return knob;
}
const next = page => page.evaluate(() => { const n = window.__tm.player.next; return n ? `${n.x},${n.y}` : "none"; });

try {
  // ---- portrait phone ---------------------------------------------------------------
  {
    const { page, ctx } = await open({ width: 390, height: 844 }, true);
    const f = await fits(page), cv = await box(page, "#tm-canvas"), st = await box(page, "#tm-stick");
    const se = await box(page, "#tm-select"), sa = await box(page, "#tm-start"), help = await box(page, ".tm-help");
    check(f.sw <= f.w && f.sh <= f.h, `portrait: no scrolling (${f.sw}x${f.sh} in ${f.w}x${f.h})`);
    check(st.shown && se.shown && sa.shown && !help.shown, "portrait: stick and buttons shown, help line hidden");
    check([cv, st, se, sa].every(b => inside(b, f)), "portrait: screen, stick and buttons all on screen");
    check(Math.abs(st.cx - f.w / 2) < 2 && st.y > cv.b, `portrait: stick centred under the screen (centre ${st.cx.toFixed(0)} of ${f.w})`);
    check(se.y > st.b && sa.y > st.b && se.r < sa.x && Math.abs((se.x + sa.r) / 2 - f.w / 2) < 3, "portrait: SELECT and START side by side under the stick");
    check(cv.w >= f.w - 60, `portrait: screen uses the width (${cv.w.toFixed(0)}px of ${f.w})`);
    check(st.w >= 120 && se.h >= 28, `portrait: thumb-sized controls (stick ${st.w}px, buttons ${se.h}px tall)`);
    if (SHOTS) await page.screenshot({ path: path.join(OUT, "tm-p4-portrait-title.png") });

    // on the title the stick picks 1 or 2 players and START starts; then the four directions
    await page.evaluate(() => window.__tm.setChasersOff(true));
    await push(page, 0, 0.8);
    check(await page.evaluate(() => window.__tm.menuSel) === 1 && await page.evaluate(() => window.__tm.state) === "title", "stick down on the title picks 2 PLAYERS");
    await push(page, 0, -0.8);
    check(await page.evaluate(() => window.__tm.menuSel) === 0, "stick up picks 1 PLAYER");
    await page.tap("#tm-start");
    check(await page.evaluate(() => window.__tm.state) === "ready", "START starts the game");
    await page.waitForFunction(() => window.__tm.state === "play", null, { timeout: 4000 });
    for (const [fx, fy, want, name] of [[0.8, 0, "1,0", "right"], [-0.8, 0, "-1,0", "left"], [0, 0.8, "0,1", "down"], [0, -0.8, "0,-1", "up"]]) {
      const knob = await push(page, fx, fy);
      check(await next(page) === want && knob.includes("translate"), `stick ${name} -> next ${want} (knob ${knob})`);
    }
    const knobAfter = await page.evaluate(() => document.querySelector(".tm-stick-knob").style.transform);
    check(knobAfter === "", "knob springs back on release");
    // dead zone: a tiny nudge changes nothing
    await page.evaluate(() => { window.__tm.player.next = null; });
    await push(page, 0.12, 0.05);
    check(await next(page) === "none", "a nudge inside the dead zone does nothing");
    // 4-way gate: no diagonals. The knob only ever sits on one axis and the stronger axis wins.
    const onAxis = k => { const m = k.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/); return m && (+m[1] === 0) !== (+m[2] === 0); };
    await page.evaluate(() => Object.assign(window.__tm.player, { x: 3, y: 5, dir: { x: 1, y: 0 }, next: null, face: { x: 1, y: 0 } }));
    let k = await push(page, 0.6, -0.5);
    check(await next(page) === "1,0" && onAxis(k), `up-right, more right, stays right; knob gated (${k})`);
    await page.evaluate(() => Object.assign(window.__tm.player, { x: 3, y: 5, dir: { x: 1, y: 0 }, next: null }));
    k = await push(page, 0.5, -0.6);
    check(await next(page) === "0,-1" && onAxis(k), `up-right, more up, asks for up; knob gated (${k})`);
    await page.evaluate(() => Object.assign(window.__tm.player, { x: 3, y: 5, dir: { x: 1, y: 0 }, next: null }));
    k = await push(page, -0.55, 0.55);
    check(onAxis(k), `a dead-on diagonal still snaps the knob to one axis (${k})`);
    // ... and an up push actually turns him at the next gap (col 6 crosses row 5)
    await page.evaluate(() => Object.assign(window.__tm.player, { x: 3, y: 5, dir: { x: 1, y: 0 }, next: null, face: { x: 1, y: 0 } }));
    await push(page, 0.2, -0.8);
    await page.waitForTimeout(700);
    const p = await page.evaluate(() => ({ x: window.__tm.player.x, y: window.__tm.player.y, d: window.__tm.player.dir }));
    check(p.d.y === -1 && Math.round(p.x) === 6, `up turns him at the gap (now ${p.x.toFixed(1)},${p.y.toFixed(1)} heading ${JSON.stringify(p.d)})`);

    // buttons
    await page.tap("#tm-start");
    check(await page.evaluate(() => window.__tm.paused) === true, "START pauses");
    if (SHOTS) await page.screenshot({ path: path.join(OUT, "tm-p4-portrait-paused.png") });
    await page.tap("#tm-start");
    check(await page.evaluate(() => window.__tm.paused) === false, "START again resumes");
    await page.tap("#tm-select");
    check(await page.evaluate(() => window.__tm.tauntCool) > 9, "SELECT taunts");

    // swipe on the screen still steers
    await page.evaluate(() => { window.__tm.player.next = null; });
    const c = await box(page, "#tm-canvas");
    await page.evaluate(({ x, y }) => {
      const cv = document.getElementById("tm-canvas");
      const t = (cx, cy) => new Touch({ identifier: 1, target: cv, clientX: cx, clientY: cy });
      cv.dispatchEvent(new TouchEvent("touchstart", { changedTouches: [t(x, y)], touches: [t(x, y)], bubbles: true, cancelable: true }));
      cv.dispatchEvent(new TouchEvent("touchmove", { changedTouches: [t(x - 40, y + 3)], touches: [t(x - 40, y + 3)], bubbles: true, cancelable: true }));
      cv.dispatchEvent(new TouchEvent("touchend", { changedTouches: [t(x - 40, y + 3)], touches: [], bubbles: true, cancelable: true }));
    }, { x: c.cx, y: c.cy });
    check(await next(page) === "-1,0", "a swipe left on the screen still steers left");
    if (SHOTS) {
      await page.evaluate(() => window.__tm.setChasersOff(false));
      await page.mouse.move(0, 0);
      const s = await box(page, "#tm-stick");
      await page.mouse.move(s.cx, s.cy); await page.mouse.down(); await page.mouse.move(s.cx - 30, s.cy - 22, { steps: 2 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, "tm-p4-portrait-play.png") });
      await page.mouse.up();
    }
    await ctx.close();
  }

  // ---- landscape phone --------------------------------------------------------------
  {
    const { page, ctx } = await open({ width: 844, height: 390 }, true);
    const f = await fits(page), cv = await box(page, "#tm-canvas"), st = await box(page, "#tm-stick");
    const se = await box(page, "#tm-select"), sa = await box(page, "#tm-start"), logo = await box(page, ".tm-logo");
    check(f.sw <= f.w && f.sh <= f.h, `landscape: no scrolling (${f.sw}x${f.sh} in ${f.w}x${f.h})`);
    check([cv, st, se, sa].every(b => inside(b, f)), "landscape: screen, stick and buttons all on screen");
    check(!logo.shown, "landscape: logo hidden to make room");
    check(st.r < cv.x && se.x > cv.r && sa.x > cv.r, "landscape: stick left of the screen, buttons right of it");
    check(cv.h >= f.h - 40, `landscape: screen uses the height (${cv.h.toFixed(0)}px of ${f.h})`);
    if (SHOTS) {
      await page.evaluate(() => window.__tm.setChasersOff(false));
      await page.tap("#tm-start");
      await page.waitForTimeout(2600);
      await page.screenshot({ path: path.join(OUT, "tm-p4-landscape.png") });
    }
    await ctx.close();
  }

  // ---- desktop ------------------------------------------------------------------------
  {
    const { page, ctx } = await open({ width: 1280, height: 900 }, false);
    const st = await box(page, "#tm-stick"), bt = await box(page, ".tm-buttons"), help = await box(page, ".tm-help");
    check(!st.shown && !bt.shown && help.shown, "desktop: no touch controls, help line shown");
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.log("page errors:\n" + errors.join("\n")); fails.push("page errors"); }
console.log(fails.length ? "FAIL" : "PASS");
process.exit(fails.length ? 1 : 0);
