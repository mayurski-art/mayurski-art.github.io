// Troll Forces Socialize, Troll City: the saloon band (BAND.md;
// modes/social-band.js, instruments.js, instrument-voices.js,
// menu/instrument-panel.js).
//
// Tabs share the QSOC room over BroadcastChannel (Supabase blocked). B's
// device clock runs 1.5 s fast:
//   1. The stage: Six-String Cisco and Trumpet Tex hold their instruments.
//   2. A takes the guitar off Cisco: A's the guitarist, Cisco steps off on
//      both tabs, B sees the guitar in A's hands.
//   3. A strums: B hears it. B takes the trumpet and holds a note: A hears
//      it start and stop.
//   4. The band: A opens Oh! Susanna and hits Band. Both tabs start it at
//      the same room time and keep the same beat (B's clock off 1.5 s);
//      Piano Pete plays the piano part on both; B puts the trumpet on Auto
//      and A's tab plays B's part from where B stands.
//   5. A late tab C joins mid-song: same start, same beat, all parts.
//   6. A plays along: on-time chords count, a wrong chord doesn't move on.
//   7. "Hear it" stays on A's tab.
//   8. A hands the guitar back: Cisco has it again, his part goes back to him.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-band-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".band-shots");
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
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollBand && !!window.__trollConductor, null, { timeout: 420000 });
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
/* The song's beat from room time alone (no listener lag), on this tab. */
const rawBeat = (page) => page.evaluate(() => {
  const S = window.__trollBand.band.song;
  return S ? ((window.__trollConductor.roomNow() - S.at) / 1000) / S.spb : null;
});
const npcVisible = (page, name) => page.evaluate((name) => window.__trollOps.townNpcs().list.find((n) => n.c.name === name)?.rig.root.visible, name);

const A = await open("A", "guitar_a");
const B = await open("B", "trumpet_b", 1500);
const C = await open("C", "listener_c");   // loaded now, into the room later
await join(A);
await join(B);
await pumpAll([A, B], 5000);
const [idA, idB] = await Promise.all([A, B].map((p) => p.evaluate(() => window.__trollOps.net.id)));

// ── 1. The stage ─────────────────────────────────────────────────────────
const held = await A.evaluate(() => {
  const L = window.__trollOps.townNpcs().list;
  const of = (name) => L.find((n) => n.c.name === name)?.rig.instrument?.userData.kind || null;
  return { cisco: of("Six-String Cisco"), tex: of("Trumpet Tex") };
});
check("Cisco holds a guitar, Tex a trumpet", held.cisco === "guitar" && held.tex === "trumpet", JSON.stringify(held));
const S = await A.evaluate(() => window.__trollOps.builtMap().map.rp.band);

// ── 2. A takes the guitar ────────────────────────────────────────────────
await putAt(A, S.guitar.x, S.guitar.z + 0.9, S.guitar.floor, 0);
await pumpAll([A], 500);
let s = await rp(A);
check("by Cisco: take the guitar", /take the guitar/i.test(s.prompt || ""), s.prompt);
await holdRp(A, [B], async () => (await rp(A)).role === "guitarist");
await pumpAll([A, B], 1200);
let a = await B_(A);
check("A's the guitarist, guitar in hand", a.role === "guitarist" && a.holding === "guitar", JSON.stringify(a));
check("its panel opens", await A.evaluate(() => window.__trollBand.panel("guitar").isOpen));
const cisco = [await npcVisible(A, "Six-String Cisco"), await npcVisible(B, "Six-String Cisco")];
check("Cisco steps off, on both tabs", cisco[0] === false && cisco[1] === false, JSON.stringify(cisco));
const seen = await B.evaluate((id) => {
  const T = window.__trollOps;
  return { role: T.net.peers.get(id)?.role, inst: T.remotes.byId.get(id)?.rig.instrument?.userData.kind || null };
}, idA);
check("B sees the guitar in A's hands", seen.role === "guitarist" && seen.inst === "guitar", JSON.stringify(seen));

// ── 3. Live notes ────────────────────────────────────────────────────────
let b0 = (await B_(B)).heard;
await A.keyboard.press("Digit1");   // strum the first pad
await pumpAll([A, B], 900);
let b = await B_(B);
check("A strums: B hears it", b.heard.strum === b0.strum + 1, JSON.stringify(b.heard));
check("the strum doesn't move A", (await A.evaluate(() => window.__trollBand.panel("guitar").state().hits)) === 1);
await putAt(B, S.trumpet.x, S.trumpet.z + 0.9, S.trumpet.floor, 0);
await pumpAll([B], 500);
s = await rp(B);
check("by Tex: take the trumpet", /take the trumpet/i.test(s.prompt || ""), s.prompt);
await holdRp(B, [A], async () => (await rp(B)).role === "trumpeter");
await pumpAll([A, B], 1000);
check("B's the trumpeter, Tex steps off", (await B_(B)).role === "trumpeter" && (await npcVisible(A, "Trumpet Tex")) === false);
let a0 = (await B_(A)).heard;
await B.keyboard.down("KeyQ");
await pumpAll([B, A], 700);
const sounding = await A.evaluate((id) => window.__trollBand.band.voices.get(`${id}:trumpet`)?.sounding ?? null, idB);
await B.keyboard.up("KeyQ");
await pumpAll([B, A], 700);
a = await B_(A);
check("B holds C4: A hears it sounding", a.heard.note === a0.note + 1 && sounding === 60, JSON.stringify({ heard: a.heard, sounding, audio: await A.evaluate(() => ({ st: window.__trollBand.audioOn(), en: window.__trollOps.audio?.enabled })) }));
check("B lets go: it stops on A's tab", a.heard.off === a0.off + 1 && (await A.evaluate((id) => window.__trollBand.band.voices.get(`${id}:trumpet`)?.sounding ?? null, idB)) == null);

// ── 4. The band ──────────────────────────────────────────────────────────
const songIdx = await A.evaluate(() => window.__trollBand.SONGS.findIndex((x) => x.id === "oh-susanna"));
await A.evaluate((i) => window.__trollBand.panel("guitar").pick(i), songIdx);
await pumpAll([A], 300);
check("Oh! Susanna on A's guitar: a staff and chord pads", await A.evaluate(() => {
  const st = window.__trollBand.panel("guitar").state();
  return st.sheet === "Oh! Susanna" && st.mode === "strum" && document.querySelectorAll(".to-piano.is-guitar .to-score svg .nt").length === st.length && st.pads[0] === "C";
}));
await A.evaluate(() => [...document.querySelectorAll(".to-piano.is-guitar [data-a=band]")][0]?.click());
await pumpAll([A, B], 900);
a = await B_(A); b = await B_(B);
check("Band: both tabs have the song, same start", a.song?.s === songIdx && b.song?.s === songIdx && a.song.at === b.song.at && b.song.leader === idA, JSON.stringify({ a: a.song, b: b.song }));
await pumpAll([A, B], 3200);   // past the count-in
const [ra, rb] = [await rawBeat(A), await rawBeat(B)];
check("after the count-in both tabs are on the same beat (B's clock 1.5 s off)", ra > 0 && Math.abs(ra - rb) < 0.25, `${ra?.toFixed(2)} vs ${rb?.toFixed(2)}`);
a = await B_(A); b = await B_(B);
check("Piano Pete plays the piano part on both tabs", a.song.parts.piano.who === "npc" && b.song.parts.piano.who === "npc", JSON.stringify([a.song.parts, b.song.parts]));
check("the guitar and trumpet parts are the players' (live)", a.song.parts.guitar.who === "live" && a.song.parts.trumpet.who === "live", JSON.stringify({ parts: a.song.parts, bRoleOnA: await A.evaluate((id) => window.__trollOps.net.peers.get(id)?.role, idB), bRole: (await B_(B)).role }));
check("A's state packet carries the song", (await B.evaluate((id) => window.__trollOps.net.peers.get(id)?.bandSong, idA)) === songIdx + 1);
await B.evaluate(() => window.__trollBand.panel("trumpet").state());   // (made)
await B.evaluate(() => { window.__trollOps.net.bandAuto = 1; });
await pumpAll([A, B], 900);
a = await B_(A);
check("B puts the trumpet on Auto: A's tab plays it from B", a.song.parts.trumpet.who === idB && a.song.parts.trumpet.next > 0, JSON.stringify(a.song.parts.trumpet));

// ── 5. A late joiner ─────────────────────────────────────────────────────
// C comes into the room; A starts a longer song (Ode to Joy, ~34 s); then
// C drops it, as a tab that missed the start would: it must pick it up off
// A's state packet (bs / ba)
await A.evaluate(() => window.__trollBand.stopBand());
await join(C);
await pumpAll([A, B, C], 1500);
const ode = await A.evaluate(() => window.__trollBand.SONGS.findIndex((x) => x.id === "ode-to-joy"));
await A.evaluate((i) => window.__trollBand.panel("guitar").pick(i), ode);
await A.evaluate(() => [...document.querySelectorAll(".to-piano.is-guitar [data-a=band]")][0]?.click());
await pumpAll([A, B, C], 3500);
await C.evaluate(() => { window.__trollBand.band.song = null; });
await pumpAll([A, B, C], 1500);
const c = await B_(C);
a = await B_(A);
const [ra2, rc2] = [await rawBeat(A), await rawBeat(C)];
check("C, who missed the start, picks it up off A's packet: same song, same start", c.song?.s === ode && c.song.at === a.song.at, JSON.stringify(c.song));
check("C's on A's beat", rc2 != null && Math.abs(ra2 - rc2) < 0.3, `${ra2?.toFixed(2)} vs ${rc2?.toFixed(2)}`);
check("C hears every part: Pete's piano, B's trumpet (auto); A's guitar is live", c.song.parts.piano.who === "npc" && c.song.parts.trumpet.who === idB && c.song.parts.guitar.who === "live", JSON.stringify(c.song.parts));
check("C listens a little behind (live notes land on the beat)", Math.abs(((await C.evaluate(() => window.__trollBand.beatNow())) - (await rawBeat(C))) + 0.4 / (60 / 112)) < 0.15);
await A.screenshot({ path: path.join(SHOTS, "band-guitar-panel.png") });
await A.evaluate(() => window.__trollBand.stopBand());
await pumpAll([A, B, C], 900);
check("A stops the band: off on every tab", !(await B_(A)).song && !(await B_(B)).song && !(await B_(C)).song);

// ── 6. Playing along ─────────────────────────────────────────────────────
// A starts it again and the page strums each chord on its beat (8 of them),
// then one wrong chord.
await A.evaluate((i) => window.__trollBand.panel("guitar").pick(i), songIdx);
await A.evaluate(() => [...document.querySelectorAll(".to-piano.is-guitar [data-a=band]")][0]?.click());
await pumpAll([A, B, C], 300);
await A.evaluate(() => new Promise((done) => {
  const P = window.__trollBand.panel("guitar"), Bd = window.__trollBand;
  let k = 0;
  const step = () => {
    const st = P.state(), beat = Bd.beatNow();
    if (k >= 8) { done(); return; }
    const want = P.notes[k];
    if (beat != null && want && beat >= want.at - 0.02) { P.strum(P.pads.indexOf(want.chord.name)); k++; }
    requestAnimationFrame(step);
  };
  step();
}));
await pumpAll([A], 300);
let al = await A.evaluate(() => window.__trollBand.panel("guitar").state().along);
check("eight chords on the beat: all counted", al && al.on + al.close >= 7 && al.next >= 8, JSON.stringify(al));
const before = al.next;
await A.evaluate(() => { const P = window.__trollBand.panel("guitar"); const want = P.notes[P.along.next]; P.strum(P.pads.findIndex((c) => c !== want.chord.name)); });
al = await A.evaluate(() => window.__trollBand.panel("guitar").state().along);
check("a wrong chord doesn't count", al.next === before && al.on + al.close <= 8, JSON.stringify(al));
await A.evaluate(() => window.__trollBand.stopBand());
await pumpAll([A, B, C], 600);

// ── 7. Hear it is ours ───────────────────────────────────────────────────
b0 = (await B_(B)).heard;
await A.evaluate(() => [...document.querySelectorAll(".to-piano.is-guitar [data-a=hear]")][0]?.click());
await pumpAll([A, B], 2000);
await A.evaluate(() => window.__trollBand.panel("guitar").stopDemo());
b = await B_(B);
check("Hear it on A: B hears nothing of it", b.heard.strum === b0.strum && b.heard.note === b0.note, JSON.stringify({ b0, b: b.heard }));

// ── 8. Handing it back ───────────────────────────────────────────────────
await A.keyboard.press("Escape");
await putAt(A, S.guitar.x, S.guitar.z + 0.9, S.guitar.floor, 0);
await pumpAll([A], 500);
s = await rp(A);
check("by Cisco's spot: hand it back", /hand the guitar back/i.test(s.prompt || ""), s.prompt);
await holdRp(A, [B], async () => (await rp(A)).role !== "guitarist");
await pumpAll([A, B], 1200);
check("Cisco has it again on both tabs", (await npcVisible(A, "Six-String Cisco")) === true && (await npcVisible(B, "Six-String Cisco")) === true && !(await B_(A)).holding);
await B.evaluate((i) => window.__trollBand.startBand(i), songIdx);   // B is still a musician: a start counts from one
await pumpAll([A, B], 3500);
check("with a song on, Cisco plays the guitar part again", (await B_(B)).song?.parts.guitar.who === "npc", JSON.stringify((await B_(B)).song?.parts));
await B.screenshot({ path: path.join(SHOTS, "band-stage.png") });

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} failed` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
