// Troll Forces Socialize, Troll City: how the Rusty Grin sounds
// (modes/social-saloon-sound.js; social-band.js, social-rp.js).
//
// Two tabs in the QSOC room over BroadcastChannel (Supabase blocked):
//   1. Nobody at the piano, no band song: Piano Pete plays on both tabs, the
//      same house tune at the same place (the room clock), and B's speakers
//      really carry it (an analyser on the master bus).
//   2. Pete's gain falls off: full inside, a lot less just out the door,
//      nothing down the street.
//   3. The room's murmur, clinks and laughs: inside only.
//   4. A player's guitar is heard by B the same way (inside loud, outside quiet).
//   5. A band song on: Pete's solo gives way to the band.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-saloon-sound-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".saloon-shots");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
async function pumpAll(pages, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) for (const p of pages) await p.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];

async function open(label, username, skewMs = 0) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.addInitScript(({ name, skewMs }) => {
    const fake = { getCachedProfile: () => ({ username: name, tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
    const real = Date.now.bind(Date);
    window.__realNow = real;
    if (skewMs) Date.now = () => real() + skewMs;   // this device's clock is off
  }, { name: username, skewMs });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollBand && !!window.__trollSaloon, null, { timeout: 420000 });
  await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
  return page;
}
async function join(page) {
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.setMode("social");
    T.loadout.mapId = "trollcity";
    await T.startGame();
  });
  await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
  await page.evaluate(() => { window.__trollOps.els.pause.hidden = true; window.__trollBand.audioOn(); });   // as a click would
}
const rp = (page) => page.evaluate(() => window.__trollOps.rp());
const B_ = (page) => page.evaluate(() => window.__trollBand.state());
async function holdRp(page, others, done, ms = 15000) {
  await page.keyboard.down("x");
  const t0 = Date.now();
  while (Date.now() - t0 < ms && !(await done())) await pumpAll([page, ...others], 250);
  await page.keyboard.up("x");
  await pumpAll([page, ...others], 150);
}
const putAt = (page, x, z, y, yaw = 0) => page.evaluate(({ x, z, y, yaw }) => {
  const T = window.__trollOps;
  T.move.reset(x, z, y); T.look.yaw = yaw;
}, { x, z, y, yaw });
const SS = (page) => page.evaluate(() => window.__trollSaloon.state());
/* RMS of what this tab's speakers play, over ~0.6 s (an analyser on master). */
const rms = (page) => page.evaluate(async () => {
  const a = window.__trollOps.audio;
  if (!a.__an) { a.__an = a.ctx.createAnalyser(); a.__an.fftSize = 2048; a.master.connect(a.__an); }
  const buf = new Float32Array(a.__an.fftSize);
  let sum = 0, n = 0;
  for (let k = 0; k < 6; k++) {
    await new Promise((r) => setTimeout(r, 100));
    a.__an.getFloatTimeDomainData(buf);
    for (const v of buf) { sum += v * v; n++; }
  }
  return Math.sqrt(sum / n);
});
/* Wait (on room time) until Pete's mid-tune with ≥ `need` s of it left. */
async function waitForTune(page, others, need = 12) {
  for (let i = 0; i < 60; i++) {
    const ok = await page.evaluate((need) => {
      const S = window.__trollSaloon, now = window.__trollConductor ? window.__trollConductor.roomNow() : Date.now();
      const p = S.peteAt(now), q = S.peteAt(now + need * 1000);
      return !!p && !!q && p.tune === q.tune && p.into > 1;
    }, need);
    if (ok) return;
    await pumpAll([page, ...others], 500);
  }
}

const A = await open("A", "guitar_a");
const B = await open("B", "listener_b");
await join(A);
await join(B);
await pumpAll([A, B], 4000);
const idA = await A.evaluate(() => window.__trollOps.net.id);
const R = await A.evaluate(() => { const m = window.__trollOps.builtMap().map.rp; return { band: m.band, zone: m.bar.zone, floor: m.bar.floorY }; });
const IN = { x: -10, z: -13.5 }, DOOR = { x: -14, z: R.zone.z1 + 3.5 }, FAR = { x: -14, z: 24 };
await putAt(A, -9, -14, R.floor, 0);
await putAt(B, IN.x, IN.z, R.floor, 0);
await waitForTune(B, [A]);
await pumpAll([A, B], 2500);

// ── 1. Pete on his own ──────────────────────────────────────────────────
let sa = await SS(A), sb = await SS(B);
const st = await B_(B);
check("nobody started anything: no band song, nobody's pianist", !st.song && !st.role && !(await rp(A)).role, JSON.stringify({ song: st.song, role: st.role }));
check("Pete plays on A", sa.pete.on && sa.pete.gain > 0.5 && sa.pete.playing, JSON.stringify(sa.pete));
check("...and on B, without anyone starting it", sb.pete.on && sb.pete.gain > 0.5 && sb.pete.playing, JSON.stringify(sb.pete));
check("the same house tune on both (the room clock)", sa.pete.tune === sb.pete.tune && sa.pete.tune != null, `${sa.pete.tune} / ${sb.pete.tune}`);
const place = await Promise.all([A, B].map((p) => p.evaluate(() => {
  const S = window.__trollSaloon, now = window.__trollConductor ? window.__trollConductor.roomNow() : Date.now();
  return S.peteAt(now);
})));
check("...at the same place in it", Math.abs(place[0].into - place[1].into) < 1.5, JSON.stringify(place));
const peteLevel = (page) => page.evaluate(() => window.__trollSaloon.peteLevel(1500));
const loudIn = await peteLevel(B), masterIn = await rms(B);
check("Pete's piano really sounds on B", loudIn > 0.003 && masterIn > 0.001, `voice ${loudIn.toFixed(4)}, master ${masterIn.toFixed(4)}`);

// ── 2. Falling off ──────────────────────────────────────────────────────
await putAt(B, DOOR.x, DOOR.z, R.floor, 0);
await pumpAll([A, B], 1500);
const gDoor = (await SS(B)).pete.gain, loudDoor = await peteLevel(B);
await putAt(B, FAR.x, FAR.z, R.floor, 0);
await pumpAll([A, B], 1500);
const gFar = (await SS(B)).pete.gain, loudFar = await peteLevel(B);
check("just out the door: a lot quieter", gDoor > 0.02 && gDoor < sb.pete.gain * 0.4, `in ${sb.pete.gain.toFixed(2)}, door ${gDoor.toFixed(3)}`);
check("down the street: gone", gFar === 0, gFar.toFixed(3));
check("and what he plays agrees", loudIn > loudDoor * 2 && loudDoor > loudFar, `${loudIn.toFixed(4)} > ${loudDoor.toFixed(4)} > ${loudFar.toFixed(4)}`);

// ── 3. The room ─────────────────────────────────────────────────────────
let rb = (await SS(B)).room;
check("outside: no murmur", !rb.on || rb.level === 0, JSON.stringify(rb));
await putAt(B, IN.x, IN.z, R.floor, 0);
await pumpAll([A, B], 9000);
rb = (await SS(B)).room;
check("inside: the murmur's on", rb.on && rb.level === 1 && rb.gain > 0.02, JSON.stringify(rb));
check("glasses clink in there", rb.clinks >= 1, JSON.stringify(rb));
check("the murmur sits under the music", rb.gain < sb.pete.gain * 0.15, `${rb.gain.toFixed(3)} vs ${sb.pete.gain.toFixed(2)}`);
await putAt(B, DOOR.x, DOOR.z, R.floor, 0);
await pumpAll([A, B], 2000);
rb = (await SS(B)).room;
check("out the door: it fades", rb.level === 0 && rb.gain < 0.01, JSON.stringify(rb));
await putAt(B, IN.x, IN.z, R.floor, 0);

// ── 4. A player's guitar, heard the same way ────────────────────────────
await putAt(A, R.band.guitar.x, R.band.guitar.z + 0.9, R.band.guitar.floor, 0);
await pumpAll([A], 500);
await holdRp(A, [B], async () => (await rp(A)).role === "guitarist");
await pumpAll([A, B], 800);
await A.keyboard.press("Digit1");
await pumpAll([A, B], 900);
const gGuitar = () => B.evaluate((id) => window.__trollBand.band.voices.get(`${id}:guitar`)?.out?.gain.value ?? null, idA);
const gIn = await gGuitar();
await putAt(B, DOOR.x, DOOR.z, R.floor, 0);
await pumpAll([A, B], 1500);
const gOut = await gGuitar();
check("A's guitar: loud for B inside, quiet out the door", gIn > 0.8 && gOut != null && gOut < 0.3, `${gIn} / ${gOut}`);
await putAt(B, IN.x, IN.z, R.floor, 0);

// ── 5. The band takes over ──────────────────────────────────────────────
const songIdx = await A.evaluate(() => window.__trollBand.SONGS.findIndex((x) => x.id === "oh-susanna"));
await A.evaluate((i) => window.__trollBand.startBand(i), songIdx);
await pumpAll([A, B], 4000);
sb = await SS(B);
const parts = (await B_(B)).song?.parts;
check("a band song on: Pete's solo stops, he plays the band's piano part", !sb.pete.on && parts?.piano.who === "npc", JSON.stringify({ pete: sb.pete, parts }));
await B.screenshot({ path: path.join(SHOTS, "saloon-in.png") });

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} failed` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
