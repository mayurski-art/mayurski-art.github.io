// The Play tab's backdrop reel (menu/lobby-fn.js mountReel).
// Supabase is blocked: the page must never join the live public room, and
// nothing here presses a go button.
//   1. Every file the reel names is in the repo (each map's map-vote still
//      and two reel stills, the club clip in webm and mp4 at both sizes).
//   2. With no map picked (Public Match's vote) it loops both islands':
//      Trollface Island's still, then Hollowgrin's. Socialize on Kabukigrin
//      switches it to Kabukigrin's: its still, then the club clip fades in
//      and plays (its time moves); after the clip, its next still.
//   3. Animations off holds the picture (nothing changes in 9 s), and on
//      again it moves on.
//   4. A hidden menu (a match on) pauses the clip.
//   5. Halloween (?season=halloween; 1-4 run with ?season=off): every
//      Halloween still is there; the islands' Halloween stills take turns,
//      no clip; Kabukigrin picked, its Halloween street.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-lobby-reel-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const type = TYPES[path.extname(p)] || "application/octet-stream", size = fs.statSync(p).size;
  // byte ranges, as Pages serves them: a video only streams with them
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (m) {
    const a = m[1] ? +m[1] : 0, b = m[2] ? Math.min(+m[2], size - 1) : size - 1;
    res.writeHead(206, { "content-type": type, "content-range": `bytes ${a}-${b}/${size}`, "accept-ranges": "bytes", "content-length": b - a + 1 });
    return fs.createReadStream(p, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "content-length": size });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 1: the files (read off the module, so the test follows the list)
const src = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/menu/lobby-fn.js"), "utf8");
const maps = JSON.parse(src.match(/const REEL_MAPS = (\[[^\]]*\])/)[1]);
const UI = path.join(ROOT, "assets/games/troll-ops/ui");
const missing = [];
const clips = JSON.parse(src.match(/const REEL_CLIPS = (\[[^\]]*\])/)[1]);
for (const id of maps) for (const w of [1280, 1920]) {
  const shots = id === "kabukigrin" ? [`maps/${id}-${w}.webp`, `lobby/${id}-1-${w}.webp`, `lobby/${id}-2-${w}.webp`] : [1, 2, 3].map((n) => `lobby/${id}-${n}-${w}.webp`);
  for (const f of shots) if (!fs.existsSync(path.join(UI, f))) missing.push(f);
}
for (const c of clips) for (const w of [1280, 1920]) for (const x of ["webm", "mp4"]) if (!fs.existsSync(path.join(UI, `lobby/kabukigrin-${c}-${w}.${x}`))) missing.push(`lobby/kabukigrin-${c}-${w}.${x}`);
check(!missing.length, `every reel file is there (${maps.length} maps x 3 stills, ${clips.length} clips)`, missing.join(", "));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1&season=off`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2?.fn, null, { timeout: 180000 });
const front = () => page.evaluate(() => {
  const e = document.querySelector(".to-fn-bg.is-on .to-fn-shot");
  return e ? { tag: e.tagName, src: e.currentSrc || e.src, t: e.currentTime ?? null, paused: e.paused ?? null } : null;
});

// ---- 2
await page.waitForSelector(".to-fn-bg.is-on .to-fn-shot", { timeout: 15000 }).catch(() => {});
const first = await front();
check(first?.tag === "IMG" && /maps\/trollface-/.test(first.src), "no map picked: opens on Trollface Island", first?.src);
await page.waitForFunction(() => /maps\/hollowgrin-/.test(document.querySelector(".to-fn-bg.is-on .to-fn-shot")?.src || ""), null, { timeout: 15000 }).catch(() => {});
check(/maps\/hollowgrin-/.test((await front())?.src || ""), "then Hollowgrin's (the islands take turns)", (await front())?.src);
const pickKabukigrin = () => page.evaluate(() => {
  window.__toBo2.fn.setPlaylist("social");
  document.querySelector('#to-lo-maps [data-map="kabukigrin"]')?.click();
});
await pickKabukigrin();
await page.waitForFunction(() => /maps\/kabukigrin-/.test(document.querySelector(".to-fn-bg.is-on .to-fn-shot")?.src || ""), null, { timeout: 15000 }).catch(() => {});
check(/maps\/kabukigrin-/.test((await front())?.src || ""), "Socialize on Kabukigrin: its still comes in", (await front())?.src);
await page.waitForFunction(() => document.querySelector(".to-fn-bg.is-on video"), null, { timeout: 20000 }).catch(() => {});
const a = await front();
await sleep(1500);
const b = await front();
check(a?.tag === "VIDEO" && /kabukigrin-club-1280\.webm/.test(a.src) && b.t > a.t, "then the club clip fades in and plays", `${a?.src} ${a?.t} -> ${b?.t}`);

// ---- 4 (while the clip is up)
await page.evaluate(() => { document.getElementById("to-title").hidden = true; });
await sleep(300);
const hid = await front();
check(hid?.paused === true, "a hidden menu pauses the clip", JSON.stringify(hid));
await page.evaluate(() => { document.getElementById("to-title").hidden = false; });
await sleep(300);
check((await front())?.paused === false, "and it plays again when the menu is back");

const dur = await page.evaluate(() => document.querySelector(".to-fn-bg.is-on video")?.duration || 0);
await page.waitForFunction(() => document.querySelector(".to-fn-bg.is-on .to-fn-shot")?.tagName === "IMG", null, { timeout: (dur + 6) * 1000 }).catch(() => {});
const after = await front();
check(after?.tag === "IMG" && /lobby\/kabukigrin-1-/.test(after.src), "after the clip, Kabukigrin's next still comes in", after?.src);

// ---- 3
await page.evaluate(() => document.body.classList.add("tf-anim-off"));
const held = (await front())?.src;
await sleep(9000);
check((await front())?.src === held, "Animations off holds the picture");
await page.evaluate(() => document.body.classList.remove("tf-anim-off"));
await sleep(3500);
check((await front())?.src !== held, "Animations on again moves on", (await front())?.src);

// ---- 5
const spooky = JSON.parse(src.match(/const HALLOWEEN = (\[[^\]]*\])/)[1]);
const gone = spooky.flatMap((n) => [1280, 1920].map((w) => `lobby/halloween/${n}-${w}.webp`)).filter((f) => !fs.existsSync(path.join(UI, f)));
check(spooky.length >= 5 && !gone.length, `every Halloween still is there (${spooky.length} x 2 sizes)`, gone.join(", "));
await page.goto(`${BASE}/troll-ops.html?tohooks=1&season=halloween`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2?.fn, null, { timeout: 180000 });
await page.waitForSelector(".to-fn-bg.is-on .to-fn-shot", { timeout: 15000 }).catch(() => {});
const h1 = await front();
check(h1?.tag === "IMG" && h1.src.includes("lobby/halloween/trollface-1-"), "Halloween: opens on the island's Halloween still", h1?.src);
await sleep(9000);
const h2 = await front();
check(h2?.tag === "IMG" && h2.src.includes("lobby/halloween/hollowgrin-1-") && !(await page.$(".to-fn-bg video")), "Halloween: then Hollowgrin's, no clip", h2?.src);
await pickKabukigrin();
await page.waitForFunction(() => /halloween\/kabukigrin-0-/.test(document.querySelector(".to-fn-bg.is-on .to-fn-shot")?.src || ""), null, { timeout: 15000 }).catch(() => {});
check(/halloween\/kabukigrin-0-/.test((await front())?.src || ""), "Halloween, Kabukigrin picked: its Halloween street", (await front())?.src);

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
