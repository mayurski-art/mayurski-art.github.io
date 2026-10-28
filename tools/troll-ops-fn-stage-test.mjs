// Troll Warfare's lobby, phase 2: the operator on the pad (char-inspector.js
// stage, lobby.js's names and invites, invites.js partyView).
// Supabase is blocked: the page never joins the live public room, and
// nothing here presses a go button.
//   1. The Play page: the operator view shows between the columns, your name
//      over you, an empty pad's "+" either side, the Emote button below.
//   2. Someone online: their invite bubble over an empty pad; Invite asks
//      invites.js (offline here, so it says why and stays unsent).
//   3. A member joins with a look (invites.js's test hook): their name over
//      the left pad, their operator drawn there, the "+" gone from it.
//   4. Away from Play (Locker) the stage goes; Cosmetics has the operator
//      without it; Play brings it back.
//   5. Nothing on the stage overlaps the left column, the mode card or the
//      party column (desktop and a landscape phone); no page errors.
// Screenshots: .claude/run/stage-*.png
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-fn-stage-test.mjs
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
const BASE = `http://localhost:${server.address().port}`;
// (ANGLE=swiftshader: on the CPU, beside a GPU job)
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

async function open(viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2?.fn && !!window.__toInvites, null, { timeout: 180000 });
  await sleep(1500);
  return { ctx, page };
}
const shown = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent && getComputedStyle(e).visibility !== "hidden").length, sel);
const rect = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }), sel);
const hit = (a, b) => a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;
// a box of the screen, as the page shows it (a WebGL canvas can't be read
// back once it's shown, so screenshots), and how far two of them differ
// (the share of pixels that changed by more than 40 of 255)
const grab = async (page, b) => (await page.screenshot({ clip: { x: Math.max(0, b.l), y: Math.max(0, b.t), width: b.w, height: b.h } })).toString("base64");
const differ = (page, a, b) => page.evaluate(async ({ a, b }) => {
  const load = async (s) => { const i = new Image(); i.src = `data:image/png;base64,${s}`; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
  const [x, y] = [await load(a), await load(b)];
  let n = 0;
  for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 120) n++;
  return n / (x.length / 4);
}, { a, b });
// the backdrop reel holds still while we compare (Animations off)
const holdReel = (page) => page.evaluate(() => document.body.classList.add("tf-anim-off"));
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function noOverlap(page, label) {
  const stage = await rect(page, ".to-stage > :not([hidden])");
  const panels = [...await rect(page, ".to-fn-left"), ...await rect(page, ".to-fn-play"), ...await rect(page, ".to-bo2-party"), ...await rect(page, ".to-fn-top")];
  const bad = [];
  for (const s of stage) for (const p of panels) if (hit(s, p)) bad.push(`${JSON.stringify(s)} x ${JSON.stringify(p)}`);
  check(stage.length > 0 && !bad.length, `${label}: nothing on the stage overlaps the panels`, bad.slice(0, 2).join(" | ") || `${stage.length} pieces`);
}

// ---- 1
let { ctx, page } = await open({ width: 1280, height: 720 });
await page.evaluate(() => window.__toBo2.menu.backTo("main"));
await sleep(800);
await settle(page);
const view = (await rect(page, "#to-char-view"))[0];
const left = (await rect(page, ".to-fn-left"))[0], play = (await rect(page, ".to-fn-play"))[0];
check(!!view && view.w > 300 && view.h > 300, "the operator view shows on the Play page", JSON.stringify(view));
check(!!view && !!left && !!play && view.l >= left.r - 1 && view.r <= play.l + 1, "between the left column and the mode card", `${left?.r | 0} <= ${view?.l | 0} .. ${view?.r | 0} <= ${play?.l | 0}`);
const me = await page.evaluate(() => document.querySelector('.to-stage-tag[data-slot="0"]:not([hidden]) b')?.textContent);
check(me === "Guest troll", "your name over your operator", me);
check(await shown(page, ".to-stage-add") === 2, "an empty pad's + either side", String(await shown(page, ".to-stage-add")));
check(await shown(page, "#to-char-emote") === 1, "the Emote button shows on the Play page");
await holdReel(page);
await sleep(300);
const tag0 = (await rect(page, '.to-stage-tag[data-slot="0"]'))[0];
const opBox = { l: tag0.l + tag0.w / 2 - 70, t: tag0.b + 10, w: 140, h: 220 };
const withOp = await grab(page, opBox);
await page.evaluate(() => { document.getElementById("to-char-canvas").style.visibility = "hidden"; });
await settle(page);
const without = await grab(page, opBox);
await page.evaluate(() => { document.getElementById("to-char-canvas").style.visibility = ""; });
const opDrawn = await differ(page, withOp, without);
check(opDrawn > 0.05, "your operator is drawn under your name", opDrawn.toFixed(3));
await page.screenshot({ path: path.join(SHOTS, "stage-desktop-empty.png") });

// ---- 2
await page.evaluate(() => dispatchEvent(new CustomEvent("trollforces:online", { detail: [{ viewerId: "v-grin", name: "grinlord", userId: null }, { viewerId: "v-lulz", name: "lulzbot", userId: null }] })));
await sleep(300);
const bubbles = await page.evaluate(() => [...document.querySelectorAll(".to-stage-bubble:not([hidden]) b")].map((b) => b.textContent));
check(bubbles.join() === "grinlord,lulzbot", "someone online: an invite bubble over each empty pad", bubbles.join());
await page.click('.to-stage-bubble[data-slot="1"] button');
await sleep(200);
const said = await page.evaluate(() => document.querySelector('.to-stage-bubble[data-slot="1"] button').title);
check(/connection|Invite/i.test(said), "Invite asks invites.js (offline here: it says why)", said);
await noOverlap(page, "desktop, two bubbles");
await page.screenshot({ path: path.join(SHOTS, "stage-desktop-online.png") });

// ---- 3
const slot1 = (await rect(page, '.to-stage-add[data-slot="1"]'))[0];
// under the + (and its bubble): where the member's legs stand
const padBox = { l: slot1.l - 10, t: slot1.b + 8, w: slot1.w + 20, h: 80 };
const before = await grab(page, padBox);
await page.evaluate(() => window.__toInvites.fakeMember("v-grin", "grinlord", { face: "sad:og", body: "" }));
await sleep(900);
await settle(page);
const after = await grab(page, padBox);
const t1 = await page.evaluate(() => document.querySelector('.to-stage-tag[data-slot="1"]:not([hidden]) b')?.textContent);
check(t1 === "grinlord", "a member's name over the left pad", t1);
const changed = await differ(page, before, after);
check(changed > 0.03, "their operator is drawn on it (legs under where the + was)", changed.toFixed(3));
check(await shown(page, ".to-stage-add") === 1, "the + is gone from their pad, still on the other");
const bub = await page.evaluate(() => [...document.querySelectorAll(".to-stage-bubble:not([hidden]) b")].map((b) => b.textContent));
check(bub.join() === "lulzbot", "the other pad's bubble offers someone not in the party", bub.join());
const lead = await page.evaluate(() => document.querySelector('.to-stage-tag[data-slot="0"] small')?.textContent);
check(lead === "Party leader", "you're the party leader", lead);
await noOverlap(page, "desktop, a member");
await page.screenshot({ path: path.join(SHOTS, "stage-desktop-party.png") });

// ---- 4
await page.click('.to-fn-tab[data-tab="locker"]');
await sleep(400);
check(!(await shown(page, "#to-char-view")) || !(await shown(page, ".to-stage")), "Locker: no stage");
await page.evaluate(() => window.__toBo2.menu.go("cosmetics"));
await sleep(500);
check(await shown(page, "#to-char-view") === 1 && !(await shown(page, ".to-stage")), "Cosmetics: the operator, no stage");
await page.click('.to-fn-tab[data-tab="play"]');
await sleep(600);
check(await shown(page, ".to-stage") === 1 && await shown(page, '.to-stage-tag[data-slot="1"]') === 1, "Play brings the stage and the party back");
await ctx.close();

// ---- 5
({ ctx, page } = await open({ width: 844, height: 390 }));
await page.evaluate(() => window.__toBo2.menu.backTo("main"));
await page.evaluate(() => dispatchEvent(new CustomEvent("trollforces:online", { detail: [{ viewerId: "v-grin", name: "grinlord", userId: null }] })));
await sleep(800);
await noOverlap(page, "landscape phone");
await page.screenshot({ path: path.join(SHOTS, "stage-phone-land.png") });
await ctx.close();
({ ctx, page } = await open({ width: 390, height: 844 }));
await page.evaluate(() => window.__toBo2.menu.backTo("main"));
await sleep(800);
check(!(await shown(page, ".to-stage > :not([hidden])")) && !(await shown(page, "#to-char-canvas")), "upright phone: no stage (the Play page is a stack of cards)");
await page.screenshot({ path: path.join(SHOTS, "stage-phone-up.png") });
await ctx.close();

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
