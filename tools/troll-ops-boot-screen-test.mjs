// Trollnite: the boot screen (menu/boot-screen.js; user, 2026-10-31). On a
// desktop at 1366 and 1920 wide and a phone upright and sideways: the key
// art shows (wide or tall by orientation), no "Loading arena", the radio and
// the menu's links are hidden until the player is in; the wordmark and the
// prompt sit inside the screen and apart (measured in px); the prompt names
// the device in hand and follows it (keys, an Xbox pad, a PlayStation pad,
// touch); Space, the pad's bottom button and a tap each enter the menu, and
// none of them reaches the menu under the screen (no match starts, the
// radio's M stays shut). SHOTS_DIR=<dir> keeps the shots.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-boot-screen-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR ? path.resolve(process.env.SHOTS_DIR) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });

const fails = [];
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) fails.push(what); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* A page at the boot screen, ready for the prompt. A fake pad the test
   drives sits on navigator.getGamepads (window.__pad). */
async function open(name, opts) {
  const ctx = await browser.newContext(opts);
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.__pad = null;
    navigator.getGamepads = () => [window.__pad];
  });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1&boot=1&season=halloween`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__tfBoot?.state.ready, null, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector(".to-boot-art img")?.complete, null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready);
  await sleep(300);
  check(!errors.length, `${name}: no page errors${errors.length ? ": " + errors[0] : ""}`);
  return { ctx, page, name };
}

/* The screen's layout in px: everything on screen, nothing over anything. */
async function layout({ page, name }) {
  const m = await page.evaluate(() => {
    const r = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
    const top = document.querySelector(".to-boot-top"), word = document.querySelector(".to-boot-word");
    return {
      vw: innerWidth, vh: innerHeight, word: r(".to-boot-word"), chapter: r(".to-boot-chapter"), prompt: r(".to-boot-prompt"),
      wordFits: word.scrollWidth <= top.clientWidth,
      art: (() => { const i = document.querySelector(".to-boot-art img"); return { src: i.currentSrc.split("/").pop().split("?")[0], loaded: i.complete && i.naturalWidth > 0, w: i.naturalWidth, h: i.naturalHeight }; })(),
      text: document.getElementById("to-loading").textContent,
      spinner: !!document.querySelector(".to-loading-spinner"),
      radio: getComputedStyle(document.getElementById("to-radio")).display,
      xlink: getComputedStyle(document.querySelector(".to-x-link")).display,
      booting: document.body.classList.contains("tf-booting"),
      loadingShown: !document.getElementById("to-loading").hidden,
    };
  });
  const inside = (b, pad = 8) => b.l >= pad && b.t >= pad && b.r <= m.vw - pad && b.b <= m.vh - pad;
  const apart = (a, b) => a.b <= b.t || b.b <= a.t || a.r <= b.l || b.r <= a.l;
  const px = (b) => `${Math.round(b.l)},${Math.round(b.t)}-${Math.round(b.r)},${Math.round(b.b)}`;
  check(m.loadingShown && m.art.loaded, `${name}: boot screen up with the art (${m.art.src} ${m.art.w}x${m.art.h})`);
  check(!/loading arena/i.test(m.text) && !m.spinner, `${name}: no "Loading arena", no spinner`);
  check(m.radio === "none" && m.xlink === "none" && m.booting, `${name}: radio and X link hidden while booting`);
  check(inside(m.word) && m.wordFits, `${name}: wordmark on screen ${px(m.word)} of ${m.vw}x${m.vh}`);
  check(inside(m.prompt), `${name}: prompt on screen ${px(m.prompt)}`);
  check(apart(m.word, m.prompt) && apart(m.chapter, m.prompt) && apart(m.word, m.chapter), `${name}: wordmark, chapter and prompt apart`);
  check(m.word.t < m.vh * 0.3 && m.prompt.b > m.vh * 0.8, `${name}: wordmark in the top third, prompt in the bottom fifth`);
  // nothing of the menu shows through: the corners, the edges' middles and
  // the centre all land on the boot screen itself
  const through = await page.evaluate(() => {
    const boot = document.getElementById("to-loading"), W = innerWidth, H = innerHeight, out = [];
    for (const [x, y] of [[6, 6], [W - 6, 6], [6, H - 6], [W - 6, H - 6], [W / 2, 6], [W / 2, H - 6], [6, H / 2], [W - 6, H / 2], [W / 2, H / 2], [W / 2, 40], [W - 30, 30]]) {
      const el = document.elementFromPoint(x, y);
      // the lost-GPU notice (view/context-guard.js, role=status) may sit on
      // top on purpose: swiftshader drops its context here now and then
      if (el?.closest?.('[role="status"]')) continue;
      if (el && !boot.contains(el)) out.push(`${Math.round(x)},${Math.round(y)}: ${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""}`);
    }
    return out;
  });
  check(!through.length, `${name}: nothing shows through the boot screen${through.length ? " (" + through.join("; ") + ")" : ""}`);
  return m;
}

const promptText = (page) => page.evaluate(() => document.querySelector(".to-boot-prompt").textContent.replace(/\s+/g, " ").trim());
const mode = (page) => page.evaluate(() => window.__tfBoot.state.mode);
const pad = (page, id, buttons = {}) => page.evaluate(({ id, buttons }) => {
  window.__pad = id ? { connected: true, id, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: !!buttons[i], value: buttons[i] ? 1 : 0 })) } : null;
}, { id, buttons });
async function entered(page, name, how) {
  await sleep(700);
  const s = await page.evaluate(() => ({
    hidden: document.getElementById("to-loading").hidden, booting: document.body.classList.contains("tf-booting"),
    by: window.__tfBoot.state.enteredBy, title: !document.getElementById("to-title").hidden,
    radio: getComputedStyle(document.getElementById("to-radio")).display, panel: document.getElementById("to-radio-panel").hidden,
    picker: !document.querySelector(".to-fn-picker") || document.querySelector(".to-fn-picker").hidden,
  }));
  check(s.hidden && !s.booting && s.by === how, `${name}: ${how} enters the menu (by ${s.by})`);
  check(s.title && s.picker && s.panel, `${name}: the menu is up untouched after entering (no match, no picker, radio shut)`);
  check(s.radio !== "none", `${name}: radio back once in`);
}
const shot = (page, file) => SHOTS ? page.screenshot({ path: path.join(SHOTS, file) }) : null;

// --- desktop 1366: keys, then the pads, then Space
{
  const d = await open("desktop-1366", { viewport: { width: 1366, height: 768 } });
  const { page } = d;
  await layout(d);
  check(await mode(page) === "key" && /Press Space to enter/.test(await promptText(page)), `desktop-1366: keyboard prompt "${await promptText(page)}"`);
  await shot(page, "boot-1366.png");
  // M is the radio's key: swallowed while booting
  await page.keyboard.press("m");
  await sleep(150);
  check(await page.evaluate(() => document.getElementById("to-radio-panel").hidden), "desktop-1366: M under the boot screen doesn't open the radio");
  // a pad shows up and is pressed: the prompt names its button
  await pad(page, "Xbox Wireless Controller", { 1: 1 });
  await sleep(120);
  check(await mode(page) === "pad" && /Press A to enter/.test(await promptText(page)), `desktop-1366: Xbox pad prompt "${await promptText(page)}"`);
  await pad(page, "Xbox Wireless Controller");
  await pad(page, "Wireless Controller (DualSense)", { 2: 1 });
  await sleep(120);
  check(/Press ✕ to enter/.test(await promptText(page)), `desktop-1366: PlayStation pad prompt "${await promptText(page)}"`);
  await pad(page, "Wireless Controller (DualSense)");
  // back to the keys: the prompt follows
  await page.keyboard.press("ArrowDown");
  await sleep(120);
  check(await mode(page) === "key", "desktop-1366: a key press takes the prompt back to the keyboard");
  await page.keyboard.press("Space");
  await entered(page, "desktop-1366", "key");
  await d.ctx.close();
}

// --- desktop 1920: the pad enters, and its press is not the menu's
{
  const d = await open("desktop-1920", { viewport: { width: 1920, height: 1080 } });
  const { page } = d;
  await layout(d);
  await shot(page, "boot-1920.png");
  await pad(page, "Xbox Wireless Controller", { 0: 1 });   // held before the screen looked: no press
  await sleep(150);
  check(await page.evaluate(() => !window.__tfBoot.state.done), "desktop-1920: a button held from before isn't a press");
  await pad(page, "Xbox Wireless Controller");
  await sleep(80);
  await pad(page, "Xbox Wireless Controller", { 0: 1 });
  await entered(page, "desktop-1920", "pad");
  await pad(page, "Xbox Wireless Controller");
  await d.ctx.close();
}

// --- phone upright: the tall art, Tap to enter, a tap enters
{
  const d = await open("phone-portrait", { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } });
  const { page } = d;
  const m = await layout(d);
  check(m.art.src === "key-art-tall.webp", `phone-portrait: the tall art (${m.art.src})`);
  check(await mode(page) === "touch" && /Tap to enter/.test(await promptText(page)), `phone-portrait: touch prompt "${await promptText(page)}"`);
  await shot(page, "boot-phone-portrait.png");
  await page.touchscreen.tap(195, 420);
  await entered(page, "phone-portrait", "touch");
  await d.ctx.close();
}

// --- phone sideways: the wide art
{
  const d = await open("phone-landscape", { ...devices["iPhone 13 landscape"], viewport: { width: 844, height: 390 } });
  const { page } = d;
  const m = await layout(d);
  check(m.art.src === "key-art-wide.webp", `phone-landscape: the wide art (${m.art.src})`);
  await shot(page, "boot-phone-landscape.png");
  await page.touchscreen.tap(420, 195);
  await entered(page, "phone-landscape", "touch");
  await d.ctx.close();
}

// --- headless harnesses without ?boot=1: the screen is gone at ready
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__tfBoot?.state.ready, null, { timeout: 120000 });
  check(await page.evaluate(() => document.getElementById("to-loading").hidden && !document.body.classList.contains("tf-booting")), "harness: without ?boot=1 the screen hides itself at ready");
  await ctx.close();
}

await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nall passed");
process.exit(fails.length ? 1 : 0);
