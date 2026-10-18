// Troll Royale drop cinematic, phase 1 (user, 2026-10-17): the opener
// card, then the photo or the iPod, then the mask, T-22 to T-8 on the drop
// clock. A PRIVATE room code (Supabase is blocked; never a public room),
// bots on, the lobby cut to 45 s:
//   - T-40..T-22: the card (photo or music; ← → pick, ↑ ↓ song);
//   - photo: T-22 the scene starts, seated (keys don't move you), facing
//     across the hold, the HUD out, the photo up, the thumb across it, the
//     jumpmaster cuts in at T-16, the mask on (visor dark, fog on the
//     breaths), T-8 on your feet, the green and the jump still work;
//   - music: the iPod up, the picked Troll Radio song plays, fades out when
//     he cuts in, the radio goes back to how it was;
//   - a late join (aboard after T-22) never gets it.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-drop-cine-test.mjs [outDir]
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const STATE = "/assets/games/troll-ops/core/state.js?v=st1";
// The tag the game imports it at (one module instance): read from royale.js.
const CINE = "/assets/games/troll-ops/modes/royale-cine.js?v=" + fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/modes/royale.js"), "utf8").match(/royale-cine\.js\?v=([a-z0-9-]+)/)[1];
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, name) }); };

async function open(lobbySeconds) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  await page.evaluate(async ({ s, room }) => {
    const T = window.__trollOps;
    T.DROP.lobbySeconds = s;
    T.setMode("royale");
    T.els.noBots.checked = false;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    await T.startGame();
  }, { s: lobbySeconds, room: "DC" + String(Math.floor(Math.random() * 900 + 100)) });
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 240000 });
  await page.waitForFunction(() => window.__trollOps.planes()?.hold?.plane, null, { timeout: 90000 });
  return page;
}
const st = (page) => page.evaluate(async ({ u, c }) => {
  const { game } = await import(u);
  const cine = await import(c);
  const T = window.__trollOps, r = T.royale();
  const sub = document.querySelector(".to-dropcine-sub");
  const visor = document.querySelector(".to-dropcine-visor");
  const card = document.querySelector(".to-dropcine-card");
  const m = game.music;
  return {
    t: r?.planeT ?? null, phase: r?.drop?.phase, me: r?.me, on: cine.dropCineOn(), k: cine.dropCineMaskK(),
    holding: game.player.holding, kind: game.streakDeviceKind, mask: !!cine.dropCineMask().visible,
    photo: !!cine.dropCinePhoto().visible, photoK: cine.dropCinePhotoK(), caress: cine.dropCineCaress(),
    ipod: !!cine.dropCineIpod().visible, ipodK: cine.dropCineIpodK(),
    song: cine.dropCineSong(), opener: cine.dropOpener(),
    music: m ? { playing: !!m.playing, index: m.order[m.pos], vol: m.el.volume, base: m.volume, paused: m.el.paused, at: m.el.currentTime, tracks: m.tracks.length } : null,
    x: game.move.pos.x, z: game.move.pos.z, yaw: game.look.yaw, pitch: game.look.pitch,
    seatYaw: r?.drop?.hold?.seats?.[r.seat]?.yaw ?? null,
    body: document.body.classList.contains("to-dropcine"),
    sub: sub?.classList.contains("is-on") ? sub.textContent : "",
    visor: visor ? +getComputedStyle(visor).opacity : 0,
    memory: document.querySelector(".to-dropcine-memory") ? +getComputedStyle(document.querySelector(".to-dropcine-memory")).opacity : 0,
    ui: !!document.querySelector(".to-dropcine-ui") && !document.querySelector(".to-dropcine-ui").hidden,
    card: !!card && !card.hidden,
    cardPick: card?.querySelector("[data-pick].is-on")?.dataset.pick || null,
    cardSong: card && !card.querySelector(".to-dropcine-card-song").hidden ? card.querySelector(".to-dropcine-card-track").textContent : "",
  };
}, { u: STATE, c: CINE });
const until = async (page, t, max = 70000) => {
  const t0 = Date.now();
  for (;;) {
    const s = await st(page);
    if (s.t != null && s.t >= t) return s;
    if (Date.now() - t0 > max) return s;
    await sleep(80);
  }
};
const setOpener = (page, pick, track) => page.evaluate(async ({ c, pick, track }) => (await import(c)).setDropOpener(pick, track), { c: CINE, pick, track });
const angOff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// ---- photo: the card, then the whole scene
const a = await open(45);
await setOpener(a, "photo", 0);
let s = await st(a);
check(s.t != null && s.t < -40.2, "boarded before the card", `t=${s.t?.toFixed(1)}`);
check(!s.on && !s.body && !s.card, "nothing before T-40");

s = await until(a, -39);
check(s.card && s.cardPick === "photo", "T-40: the card is up, photo picked", JSON.stringify({ card: s.card, pick: s.cardPick }));
check(!s.on && !s.body, "the scene hasn't started");
await shot(a, "card-photo.png");
await a.keyboard.press("ArrowRight");
await sleep(120);
s = await st(a);
check(s.cardPick === "music" && s.opener.pick === "music" && s.cardSong.length > 0, "→ picks music, the song row shows", JSON.stringify({ pick: s.cardPick, song: s.cardSong }));
const firstSong = s.cardSong;
await a.keyboard.press("ArrowDown");
await sleep(120);
s = await st(a);
check(s.opener.track === 1 && s.cardSong !== firstSong, "↓ steps to the next song", JSON.stringify({ track: s.opener.track, song: s.cardSong }));
await a.keyboard.press("ArrowUp");
await sleep(120);
s = await st(a);
check(s.opener.track === 0, "↑ back again", String(s.opener.track));
await shot(a, "card-music.png");
await a.keyboard.press("ArrowLeft");
await sleep(120);
s = await st(a);
check(s.cardPick === "photo" && s.opener.pick === "photo", "← back to photo", s.cardPick);
const saved = await a.evaluate(() => localStorage.getItem("to-drop-opener"));
check(/"pick":"photo"/.test(saved || ""), "the pick is remembered", saved);
// The card's arrow keys must not leak into the game while it's up (the pad
// pick and the weapon swap): you're still aboard and walking is untouched.
check(s.me === "aboard", "still aboard", s.me);

s = await until(a, -21.5);
const yawOff = s.seatYaw == null ? 0 : angOff(s.yaw, s.seatYaw);
check(!s.card, "T-22: the card goes", String(s.card));
check(s.on && s.body && s.ui, "T-22: the scene starts", JSON.stringify({ on: s.on, body: s.body, ui: s.ui, t: s.t }));
check(s.holding === "streak" && s.kind === "photo", "the photo is in the hands", JSON.stringify({ holding: s.holding, kind: s.kind }));
check(yawOff < 0.6, "facing across the hold", `off=${yawOff.toFixed(3)} rad`);
check(!s.sub, "no line yet", s.sub);
const x0 = s.x, z0 = s.z;
await a.evaluate(() => window.__trollOps.keys.add("KeyW"));
await sleep(900);
s = await st(a);
await a.evaluate(() => window.__trollOps.keys.delete("KeyW"));
check(Math.hypot(s.x - x0, s.z - z0) < 0.05, "seated: W doesn't walk you", `moved ${Math.hypot(s.x - x0, s.z - z0).toFixed(3)} m`);

s = await until(a, -19.8);
check(s.photo && s.photoK > 0.95, "the photo is up", `k=${s.photoK.toFixed(2)}`);
check(s.pitch < -0.25, "looking down at it", `pitch=${s.pitch.toFixed(2)}`);
check(s.memory > 0.5, "the edges go warm", `memory=${s.memory.toFixed(2)}`);
check(!s.song, "no song on the photo path");
await shot(a, "photo-look.png");
s = await until(a, -18.2);
check(s.caress > 0.2 && s.caress < 0.8, "the thumb across it", `caress=${s.caress.toFixed(2)}`);
await shot(a, "photo-caress.png");

s = await until(a, -15.7);
check(/Hey\. Mask on, troll/.test(s.sub), "T-16: he cuts in", s.sub);
check(s.pitch > -0.2, "the head comes up", `pitch=${s.pitch.toFixed(2)}`);
check(s.photoK < 0.8, "the photo's going away", `k=${s.photoK.toFixed(2)}`);
check(s.memory < 0.2, "the warm edges fade", `memory=${s.memory.toFixed(2)}`);
await shot(a, "photo-interrupt.png");

s = await until(a, -14.7);
check(s.kind === "mask" && !s.photo, "T-15: the hands go to the mask", JSON.stringify({ kind: s.kind, photo: s.photo }));
await shot(a, "cine-raise.png");

s = await until(a, -13);
check(s.k > 0.95 && s.mask, "the mask is on the face by T-13", `k=${s.k.toFixed(2)}`);
check(s.visor > 0.6, "the visor darkens", `opacity=${s.visor.toFixed(2)}`);
await shot(a, "cine-mask-on.png");

s = await until(a, -11.5);
check(/Deep breaths/.test(s.sub), "the second line", s.sub);
let fog = 0;
for (let i = 0; i < 14; i++) {
  fog = Math.max(fog, await a.evaluate(() => +getComputedStyle(document.querySelector(".to-dropcine-visor i")).opacity));
  await sleep(70);
}
check(fog > 0.2, "the visor fogs on a breath", `fog=${fog.toFixed(2)}`);

s = await until(a, -8.8);
check(/Okay, off/.test(s.sub), "the third line", s.sub);
check(s.k < 0.6, "the mask is coming off", `k=${s.k.toFixed(2)}`);

s = await until(a, -7.6);
check(!s.on && !s.body && !s.ui && !s.mask && !s.photo && !s.ipod, "T-8: the scene hands you back", JSON.stringify({ on: s.on, body: s.body, ui: s.ui, mask: s.mask }));
check(s.holding === "none", "nothing in the hands", s.holding);
const x1 = s.x, z1 = s.z;
await a.evaluate(() => window.__trollOps.keys.add("KeyW"));
await sleep(700);
s = await st(a);
await a.evaluate(() => window.__trollOps.keys.delete("KeyW"));
check(Math.hypot(s.x - x1, s.z - z1) > 0.2, "on your feet: W walks again", `moved ${Math.hypot(s.x - x1, s.z - z1).toFixed(2)} m`);

s = await until(a, 0.6, 30000);
check(s.phase === "run", "the green still comes", s.phase);
await a.evaluate(() => window.__trollOps.keys.add("Space"));
for (let i = 0; i < 80 && (await st(a)).me === "aboard"; i++) await sleep(100);
await a.evaluate(() => window.__trollOps.keys.delete("Space"));
s = await st(a);
check(s.me === "fall" || s.me === "glide", "and the jump still works", s.me);
await a.close();

// ---- music: the iPod and a Troll Radio song, the radio put back after
const b = await open(30);
s = await st(b);
const N = s.music?.tracks || 0;
check(N > 2, "Troll Radio has tracks", String(N));
await setOpener(b, "music", 2);
// The radio's off before (the default in a test tab): it stays off after.
const before = s.music;
s = await until(b, -21.5);
check(s.on && s.kind === "ipod", "T-22: the iPod is in the hands", JSON.stringify({ on: s.on, kind: s.kind }));
s = await until(b, -20);
check(s.ipod && s.ipodK > 0.9 && !s.photo, "the iPod is up, no photo", `k=${s.ipodK.toFixed(2)}`);
check(!s.song, "nothing playing before play's pressed");
await shot(b, "ipod-list.png");
s = await until(b, -18.4);
check(s.song && s.song.index === 2, "play: the picked song is on", JSON.stringify(s.song));
check(s.music.index === 2 && !s.music.paused, "Troll Radio is playing track 3", JSON.stringify(s.music));
await shot(b, "ipod-playing.png");
s = await until(b, -17);
check(s.music.at > 0.5, "and it keeps going", `at=${s.music.at.toFixed(2)} s`);
check(s.pitch > -0.2, "head up, listening", `pitch=${s.pitch.toFixed(2)}`);
check(s.memory < 0.05, "no warm edges on the music path", `memory=${s.memory.toFixed(2)}`);
await shot(b, "ipod-listen.png");
s = await until(b, -15.6);
check(/Hey\. Mask on, troll/.test(s.sub), "T-16: he cuts in", s.sub);
check(s.music.vol < s.music.base * 0.7, "the song fades", `vol=${s.music.vol.toFixed(2)} of ${s.music.base.toFixed(2)}`);
s = await until(b, -14.7);
check(!s.song && s.music.paused, "the song's stopped", JSON.stringify(s.music));
check(Math.abs(s.music.vol - s.music.base) < 0.01, "the radio's volume put back", `vol=${s.music.vol.toFixed(2)}`);
check(s.music.playing === before.playing && s.music.index === before.index, "the radio as it was before", JSON.stringify({ before, now: s.music }));
check(s.kind === "mask" && !s.ipod, "the hands go to the mask", JSON.stringify({ kind: s.kind, ipod: s.ipod }));
s = await until(b, -7.6);
check(!s.on && s.holding === "none" && !s.ipod, "T-8: handed back", JSON.stringify({ on: s.on, holding: s.holding }));
await b.close();

// ---- a late join skips it
const c = await open(18);
s = await until(c, -17);
check(!s.on && !s.body && !s.card, "a late join (aboard after T-22) never gets the card or the scene", JSON.stringify({ t: s.t, on: s.on, card: s.card }));
s = await until(c, -12);
check(!s.on && s.holding !== "streak", "still nothing at T-12", JSON.stringify({ on: s.on, holding: s.holding }));
await c.close();

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
