// Troll Man gamepad test, with a pretend controller (navigator.getGamepads is replaced).
//  poster      any button closes it
//  title       d-pad down/up picks 1 or 2 players, Start starts
//  play        d-pad and the left stick steer, A taunts, Start pauses / resumes
//  board       B closes it
//  demo        a button ends it
//   node tools/troll-man-pad-test.mjs
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5208;
const fails = [];
const check = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) fails.push(msg); };

const server = spawn(process.execPath, [path.join(ROOT, "tools/static-serve.mjs"), String(PORT)], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 900));
const browser = await chromium.launch();
const errors = [];

// A standard-mapping pad: 17 buttons, 4 axes. window.__pad.set({ buttons: [...], axes: [...] }).
const fakePad = () => {
  const pad = { id: "test pad", index: 0, connected: true, mapping: "standard", timestamp: 0,
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  window.__pad = {
    set({ buttons = [], axes = [0, 0, 0, 0] } = {}) {
      pad.buttons.forEach((b, i) => { b.pressed = buttons.includes(i); b.value = b.pressed ? 1 : 0; });
      pad.axes = axes.slice();
      pad.timestamp++;
    },
  };
  navigator.getGamepads = () => [pad, null, null, null];
};

async function open(query) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/supabase\.co/, r => r.abort());
  await ctx.addInitScript(fakePad);
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/troll-man${query}`);
  await page.waitForFunction(() => window.__tm);
  return { page, ctx };
}
// press and release, a few frames each, so the game sees one press
async function tap(page, spec) {
  await page.evaluate(s => window.__pad.set(s), spec);
  await page.waitForTimeout(120);
  await page.evaluate(() => window.__pad.set({}));
  await page.waitForTimeout(120);
}
const tm = (page, fn) => page.evaluate(fn);
const next = page => page.evaluate(() => { const n = window.__tm.player.next; return n ? `${n.x},${n.y}` : "none"; });

try {
  {
    const { page, ctx } = await open("?debug&splash");
    await page.waitForFunction(() => window.__tm.splashReady, null, { timeout: 8000 });
    await tap(page, { buttons: [0] });
    check(await tm(page, () => !window.__tm.splashOpen && window.__tm.state === "title"), "A closes the poster (and only that)");
    await tap(page, { buttons: [13] });
    check(await tm(page, () => window.__tm.menuSel) === 1, "d-pad down picks 2 PLAYERS");
    await tap(page, { buttons: [12] });
    check(await tm(page, () => window.__tm.menuSel) === 0, "d-pad up picks 1 PLAYER");
    await tap(page, { buttons: [9] });
    check(await tm(page, () => window.__tm.state) === "ready", "Start starts the game");
    await page.waitForFunction(() => window.__tm.state === "play", null, { timeout: 5000 });
    await tm(page, () => window.__tm.setChasersOff(true));
    for (const [b, want, name] of [[15, "1,0", "right"], [14, "-1,0", "left"], [13, "0,1", "down"], [12, "0,-1", "up"]]) {
      await tm(page, () => { window.__tm.player.next = null; });
      await page.evaluate(b => window.__pad.set({ buttons: [b] }), b);
      await page.waitForTimeout(80);
      const n = await next(page);
      await page.evaluate(() => window.__pad.set({}));
      // he may already have turned onto it; then "next" is spent and dir shows it
      const d = await tm(page, () => `${window.__tm.player.dir.x},${window.__tm.player.dir.y}`);
      check(n === want || d === want, `d-pad ${name} steers (${n} / heading ${d})`);
    }
    await tm(page, () => { window.__tm.player.next = null; });
    await page.evaluate(() => window.__pad.set({ axes: [-0.9, 0.1, 0, 0] }));
    await page.waitForTimeout(80);
    const sn = await next(page), sd = await tm(page, () => `${window.__tm.player.dir.x},${window.__tm.player.dir.y}`);
    await page.evaluate(() => window.__pad.set({}));
    check(sn === "-1,0" || sd === "-1,0", `left stick steers (${sn} / heading ${sd})`);
    await tm(page, () => { window.__tm.player.next = null; });
    await page.evaluate(() => window.__pad.set({ axes: [0.3, 0.2, 0, 0] }));
    await page.waitForTimeout(80);
    check(await next(page) === "none", "a small stick nudge does nothing");
    await page.evaluate(() => window.__pad.set({}));
    await tap(page, { buttons: [0] });
    check(await tm(page, () => window.__tm.tauntCool) > 9, "A taunts in a game");
    await tap(page, { buttons: [9] });
    check(await tm(page, () => window.__tm.paused), "Start pauses");
    await tap(page, { buttons: [9] });
    check(await tm(page, () => !window.__tm.paused), "Start again resumes");
    // the board: B closes it
    await page.click("#tm-board-btn");
    await tap(page, { buttons: [1] });
    check(await tm(page, () => !window.__tm.boardOpen), "B closes the board");
    await ctx.close();
  }
  {
    const { page, ctx } = await open("?debug");
    await tm(page, () => window.__tm.setTimeScale(6));
    await page.waitForFunction(() => window.__tm.demo, null, { timeout: 8000 });
    await tm(page, () => window.__tm.setTimeScale(1));
    await tap(page, { buttons: [14] });
    check(await tm(page, () => !window.__tm.demo && window.__tm.state === "title"), "a d-pad press ends the demo, back to the menu");
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.log("page errors:\n" + errors.join("\n")); fails.push("page errors"); }
console.log(fails.length ? "FAIL" : "PASS");
process.exit(fails.length ? 1 : 0);
