// Troll Warfare's lobby on an upright phone: your troll stands on its pad
// between the level cards and the mode card (user, 2026-10-28: "a preview
// of the troll character portrait version for mobile devices"). Chromium
// is given an iPhone's safe-area insets; Supabase is blocked and nothing
// presses a go button.
//   1. 390x844 and 430x932 upright: the operator view shows, at least 190
//      px tall and the screen's width; your operator is drawn in it (the
//      canvas hidden changes the picture); your name over you.
//   2. Nothing on the stage (the view, your name, the "+" pads, a member's
//      name) overlaps the top bar, the season and level cards, the mode
//      card, PLAY, All modes or the bottom row, or leaves the safe area.
//   3. With a party member: their name and operator fit the same way.
//   4. Sideways and desktop: the view's box pinned (moved down 16 / 6 px
//      by the Fortnite top band, -fnu2: the tabs hang under it).
// Screenshots: .claude/run/portrait-*.png
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-fn-portrait-test.mjs
//   (ANGLE=swiftshader to draw on the CPU while a GPU job runs)
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, ".claude/run");
fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
// the lobby's controls on the Play page, each piece on its own
const CONTROLS = ".to-fn-top > *, .to-fn-season, .to-fn-pair > *, .to-fn-news, .to-fn-play, .to-fn-allmodes, .to-bo2-foot .to-bo2-online, .to-bo2-foot .to-bo2-chat, .to-radio-toggle";
const STAGE = "#to-char-view, .to-stage > :not([hidden])";
const boxes = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent && getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).display !== "none")
  .map((e) => { const r = e.getBoundingClientRect(); return { el: e.className.toString().split(" ").pop() || e.tagName, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; })
  .filter((r) => r.w > 0 && r.h > 0), sel);
const hit = (a, b) => a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;
const grab = async (page, b) => (await page.screenshot({ clip: { x: Math.max(0, b.l), y: Math.max(0, b.t), width: b.w, height: b.h } })).toString("base64");
const differ = (page, a, b) => page.evaluate(async ({ a, b }) => {
  const load = async (s) => { const i = new Image(); i.src = `data:image/png;base64,${s}`; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
  const [x, y] = [await load(a), await load(b)];
  let n = 0;
  for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 120) n++;
  return n / (x.length / 4);
}, { a, b });
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function open(c) {
  const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h }, hasTouch: !!c.insets });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${c.name}: ${e.message}`));
  if (c.insets) await (await ctx.newCDPSession(page)).send("Emulation.setSafeAreaInsetsOverride", { insets: c.insets });
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2?.fn && !!window.__toInvites, null, { timeout: 180000 });
  await page.evaluate(() => window.__toBo2.menu.backTo("main"));
  // the backdrop reel holds still while we compare (Animations off)
  await page.evaluate(() => document.body.classList.add("tf-anim-off"));
  await sleep(1500);
  await settle(page);
  return { ctx, page };
}
async function clear(page, c, label) {
  const stage = await boxes(page, STAGE), ctl = await boxes(page, CONTROLS);
  const bad = [];
  for (const s of stage) for (const k of ctl) if (hit(s, k)) bad.push(`${s.el} ${s.t | 0}..${s.b | 0} x ${k.el} ${k.t | 0}..${k.b | 0}`);
  check(stage.length >= 3 && !bad.length, `${label}: nothing on the stage overlaps a control`, bad.slice(0, 3).join(" | ") || `${stage.length} pieces, ${ctl.length} controls`);
  const ins = c.insets;
  const out = stage.filter((s) => s.t < ins.top - 0.5 || s.b > c.h - ins.bottom + 0.5 || s.l < -0.5 || s.r > c.w + 0.5);
  check(!out.length, `${label}: the stage inside the safe area`, JSON.stringify(out.slice(0, 2)));
}

for (const c of [
  { name: "390x844", w: 390, h: 844, insets: { top: 47, left: 0, right: 0, bottom: 34 } },
  { name: "430x932", w: 430, h: 932, insets: { top: 59, left: 0, right: 0, bottom: 34 } },
]) {
  const { ctx, page } = await open(c);
  // ---- 1
  const view = (await boxes(page, "#to-char-view"))[0];
  check(!!view && view.h >= 190 && view.w >= c.w - 1, `${c.name}: the operator view shows, a good size`, view ? `${view.w | 0}x${view.h | 0}` : "none");
  const me = await page.evaluate(() => document.querySelector('.to-stage-tag[data-slot="0"]:not([hidden]) b')?.textContent);
  check(me === "Guest troll", `${c.name}: your name over your operator`, me);
  const tag0 = (await boxes(page, '.to-stage-tag[data-slot="0"]'))[0];
  const opBox = { l: tag0.l + tag0.w / 2 - 50, t: tag0.b + 6, w: 100, h: Math.min(170, view.b - tag0.b - 10) };
  const withOp = await grab(page, opBox);
  await page.evaluate(() => { document.getElementById("to-char-canvas").style.visibility = "hidden"; });
  await settle(page);
  const without = await grab(page, opBox);
  await page.evaluate(() => { document.getElementById("to-char-canvas").style.visibility = ""; });
  const drawn = await differ(page, withOp, without);
  check(drawn > 0.05, `${c.name}: your operator is drawn under your name`, drawn.toFixed(3));
  // ---- 2
  await clear(page, c, `${c.name}, alone`);
  await page.screenshot({ path: path.join(SHOTS, `portrait-${c.name}.png`) });
  // ---- 3
  await page.evaluate(() => window.__toInvites.fakeMember("v-grin", "grinlord", { face: "sad:og", body: "" }));
  await sleep(900);
  await settle(page);
  const t1 = await page.evaluate(() => document.querySelector('.to-stage-tag[data-slot="1"]:not([hidden]) b')?.textContent);
  check(t1 === "grinlord", `${c.name}: a member's name over their pad`, t1);
  await clear(page, c, `${c.name}, a member`);
  await page.screenshot({ path: path.join(SHOTS, `portrait-${c.name}-party.png`) });
  await ctx.close();
}

// ---- 4 (the boxes the sideways and desktop layouts had before)
for (const c of [
  { name: "sideways", w: 844, h: 390, insets: { top: 0, left: 47, right: 47, bottom: 21 }, want: [273, 94, 258, 221] },
  { name: "desktop", w: 1280, h: 720, insets: null, want: [338, 108, 574, 534] },
]) {
  const { ctx, page } = await open(c);
  const v = (await boxes(page, "#to-char-view"))[0];
  const got = v ? [v.l, v.t, v.w, v.h].map(Math.round) : [];
  check(got.join() === c.want.join(), `${c.name}: the operator view's box as before`, got.join());
  await ctx.close();
}

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close(); server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
