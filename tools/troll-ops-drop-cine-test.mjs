// Troll Royale drop cinematic, phase 1 (user, 2026-10-17): the opener
// card, then the photo or the iPod, then the mask, T-22 to T-8 on the drop
// clock. A PRIVATE room code (Supabase is blocked; never a public room),
// bots on, the lobby cut to 45 s:
//   - T-36: walked to your seat from across the hold (round the pallet),
//     sat down; the card only once you're seated (photo or music;
//     ← → pick, ↑ ↓ song); in third person your body walks and sits, the
//     camera finds room in the hold, the scene itself is first person;
//   - the green: the jumpmaster shoves you out, no key needed;
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
const CREW = "/assets/games/troll-ops/modes/royale-crew.js?v=" + fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/modes/royale-cine.js"), "utf8").match(/royale-crew\.js\?v=([a-z0-9-]+)/)[1];
const FALL = "/assets/games/troll-ops/modes/royale-fall.js?v=" + fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/modes/royale.js"), "utf8").match(/royale-fall\.js\?v=([a-z0-9-]+)/)[1];
// The fall's opening show (phase 3), sampled in the page each frame from
// the first fall frame until its clock reaches `to`.
const fallSamples = (page, to, max = 20000) => page.evaluate(async ({ u, fl, to, max }) => {
  const { game } = await import(u);
  const fall = await import(fl);
  const THREE = await import("three");
  const T = window.__trollOps;
  const v = new THREE.Vector3(), q = new THREE.Quaternion();
  const out = [];
  return await new Promise((done) => {
    const t0 = performance.now();
    const tick = () => {
      const fs = fall.fallShowState();
      if (fs) {
        const cam = game.camera, rig = game.localRig.root;
        cam.updateMatrixWorld(); rig.updateMatrixWorld();
        const up = v.set(0, 1, 0).applyQuaternion(cam.getWorldQuaternion(q)).y;
        const face = v.set(0, 0, -1).applyQuaternion(rig.getWorldQuaternion(q)).y;
        const body = new THREE.Vector3(game.move.pos.x, game.move.pos.y + 1, game.move.pos.z);
        const sq = T.royale().drop.squadron, m = sq.planeM[sq.ridden];
        const plane = m ? new THREE.Vector3().setFromMatrixPosition(m) : null;
        out.push({ t: fs.t, back: fs.back, shot: fs.shot, view: fs.view, me: T.royale().me, rigVis: rig.visible, camUp: up, face,
          camDist: cam.position.distanceTo(body), camDy: cam.position.y - body.y, camPlane: plane ? cam.position.distanceTo(plane) : null,
          yaw: game.look.yaw, height: T.royale().flight?.height ?? null,
          sub: !!document.querySelector(".to-dropcine-sub.is-on"), bars: !!document.querySelector(".to-dropcine-ui.is-on"),
          hv: Math.hypot(T.royale().flight?.vel.x ?? 0, T.royale().flight?.vel.z ?? 0),
          ...(() => { const p = fall.fallFaceOnScreen(cam); return { faceX: p.x, faceY: p.y, faceZ: p.z }; })() });
      }
      if ((fs && fs.t >= to) || performance.now() - t0 > max) done(out);
      else requestAnimationFrame(tick);
    };
    tick();
  });
}, { u: STATE, fl: FALL, to, max });
const fallAt = async (page, t) => (await fallSamples(page, t)).at(-1);
const SFX = "/assets/games/troll-ops/sound/sfx-files.js?v=" + fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/modes/royale.js"), "utf8").match(/sfx-files\.js\?v=([a-z0-9-]+)/)[1];
const sfxState = (page) => page.evaluate(async (u) => { const m = await import(u); return { loaded: m.SFX_NAMES.filter((n) => m.sfxLoaded(n)), all: m.SFX_NAMES.length, played: [...m.sfxPlayed] }; }, SFX);
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
// One state snapshot, taken in the page on the first frame the drop clock
// reaches `target` (waiting out there and polling landed samples late
// whenever the machine was busy).
const snap = (page, target = -Infinity, max = 70000) => page.evaluate(async ({ u, c, w, target, max }) => {
  const crewMod = await import(w);
  const { game } = await import(u);
  const cine = await import(c);
  const T = window.__trollOps;
  const take = () => {
  const r = T.royale();
  const sub = document.querySelector(".to-dropcine-sub");
  const visor = document.querySelector(".to-dropcine-visor");
  const card = document.querySelector(".to-dropcine-card");
  const m = game.music;
  return {
    crew: crewMod.crewState(), eye: cine.dropCineEye(), sitK: cine.dropCineSitK(), lz: game.move.pos.z - (r?.drop?.origin?.z ?? 0),
    light: T.planes()?.hold?.light, ramp: +(T.planes()?.hold?.rampK ?? 0).toFixed(2),
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
  };
  return await new Promise((done) => {
    const t0 = performance.now();
    const tick = () => {
      const t = T.royale()?.planeT;
      if ((t != null && t >= target) || performance.now() - t0 > max) done(take());
      else requestAnimationFrame(tick);
    };
    tick();
  });
}, { u: STATE, c: CINE, w: CREW, target, max });
// The crew's measures on every frame the drop clock spends in [from, to].
const CREW_LEAN0 = -22;   // royale-crew.js CREW.lean[0]
const crewOver = (page, from, to) => page.evaluate(async ({ w, from, to }) => {
  const crewMod = await import(w);
  const T = window.__trollOps;
  const out = [];
  return await new Promise((done) => {
    const t0 = performance.now();
    const tick = () => {
      const t = T.royale()?.planeT;
      if (t != null && t >= from && t <= to) out.push({ t, ...crewMod.crewState() });
      if ((t != null && t > to) || performance.now() - t0 > 70000) done(out);
      else requestAnimationFrame(tick);
    };
    tick();
  });
}, { w: CREW, from, to });
const st = (page) => snap(page);
// Every frame from now to drop clock `to`: where you are in the hold.
const holdPath = (page, to) => page.evaluate(async (to) => {
  const T = window.__trollOps, out = [];
  return await new Promise((done) => {
    const t0 = performance.now();
    const tick = () => {
      const r = T.royale(), o = r.drop.origin;
      const card = document.querySelector(".to-dropcine-card");
      out.push({ t: r.planeT, x: T.move.pos.x - o.x, z: T.move.pos.z - o.z, card: !!card && !card.hidden });
      if (r.planeT >= to || performance.now() - t0 > 60000) done(out);
      else requestAnimationFrame(tick);
    };
    tick();
  });
}, to);
// Third person: how far the camera is from your head, and where your head
// is on screen.
const tpView = (page) => page.evaluate(async (u) => {
  const { game } = await import(u);
  const head = game.localRig.parts.head;
  head.updateWorldMatrix(true, false);
  const h = head.getWorldPosition(game.camera.position.clone());
  const dist = h.distanceTo(game.camera.position);
  game.camera.updateMatrixWorld();
  const p = h.clone().project(game.camera);
  return { dist, x: p.x, y: p.y, z: p.z, vis: game.localRig.root.visible };
}, STATE);
const until = (page, t, max = 70000) => snap(page, t, max);
const setOpener = (page, pick, track) => page.evaluate(async ({ c, pick, track }) => (await import(c)).setDropOpener(pick, track), { c: CINE, pick, track });
const angOff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// ---- photo: the card, then the whole scene
const a = await open(45);
// The lean beat, every frame (measured below): started now, before it.
const leanWatch = crewOver(a, -22.5, -21.2);
await setOpener(a, "photo", 0);
let s = await st(a);
check(s.t != null && s.t < -42.2, "boarded before the walk to the seat", "t=" + s.t?.toFixed(1));
check(!s.on && !s.body && !s.card, "nothing before T-42");
// Stand across the hold from your seat, beside the pallet: the walk has to
// go round behind it.
const seatSide = await a.evaluate(() => { const T = window.__trollOps, r = T.royale(), o = r.drop.origin, l = r.drop.hold.seats?.[r.seat]?.local; const side = (l?.x ?? 1) < 0 ? -1 : 1; T.move.reset(o.x - side * 0.8, o.z - 3.3, o.y); return side; });
s = await until(a, -42.5);
await a.evaluate(() => window.__trollOps.keys.add("KeyA"));   // keys mustn't move you off it
const walked = await holdPath(a, -36.2);
await a.evaluate(() => window.__trollOps.keys.delete("KeyA"));
const during = walked.filter((q) => q.t > -41.8);
const inPallet = during.filter((q) => Math.abs(q.x) < 0.43 && q.z > -4.65 && q.z < -2.1);
check(during.length > 10 && !inPallet.length, "walked to the seat round the pallet, not through it", inPallet.length + " frames in it");
check(during.every((q) => Math.abs(q.x) < 1.45), "...and inside the hold's walls");
check(Math.sign(walked.at(-1).x) === seatSide && Math.abs(walked.at(-1).x) > 0.9, "...to your own seat", JSON.stringify(walked.at(-1)));
const early = walked.filter((q) => q.card && q.t < -35.7);
check(!early.length, "no card while you're still getting to your seat", early.length ? "up at t=" + early[0].t.toFixed(2) : "");
s = await until(a, -35.3);
check(s.sitK > 0.95 && s.eye < -0.35, "sat down", JSON.stringify({ sitK: s.sitK, eye: s.eye }));
const x1 = s.x, z1 = s.z;
await a.evaluate(() => window.__trollOps.keys.add("KeyW"));
await sleep(500);
await a.evaluate(() => window.__trollOps.keys.delete("KeyW"));
s = await st(a);
check(Math.hypot(s.x - x1, s.z - z1) < 0.05, "seated: W doesn't move you", (Math.hypot(s.x - x1, s.z - z1)).toFixed(3));
check(s.card && s.cardPick === "photo", "sat down: the card is up, photo picked", JSON.stringify({ card: s.card, pick: s.cardPick }));
check(!s.on && !s.body, "the scene hasn't started");
await shot(a, "card-photo.png");
check(await a.evaluate(() => [...document.querySelectorAll(".to-dropcine-card-key")].map((k) => k.textContent).join("") === "XY" && document.querySelector(".to-dropcine-card").dataset.device === "keys"), "the card shows X and Y keycaps");
await a.keyboard.press("y");
await sleep(120);
s = await st(a);
check(s.cardPick === "music" && s.opener.pick === "music" && s.cardSong.length > 0, "Y picks music, the song row shows", JSON.stringify({ pick: s.cardPick, song: s.cardSong }));
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
await a.keyboard.press("x");
await sleep(120);
s = await st(a);
check(s.cardPick === "photo" && s.opener.pick === "photo", "X back to photo", s.cardPick);
const saved = await a.evaluate(() => localStorage.getItem("to-drop-opener"));
check(/"pick":"photo"/.test(saved || ""), "the pick is remembered", saved);
// The card's arrow keys must not leak into the game while it's up (the pad
// pick and the weapon swap): you're still aboard and walking is untouched.
check(s.me === "aboard", "still aboard", s.me);

s = await until(a, -27.5);
const yawOff = s.seatYaw == null ? 0 : angOff(s.yaw, s.seatYaw);
check(!s.card, "T-28: the card goes", String(s.card));
check(s.on && s.body && s.ui, "T-28: the scene starts", JSON.stringify({ on: s.on, body: s.body, ui: s.ui, t: s.t }));
check(s.holding === "streak" && s.kind === "photo", "the photo is in the hands", JSON.stringify({ holding: s.holding, kind: s.kind }));
check(yawOff < 0.6, "facing across the hold", `off=${yawOff.toFixed(3)} rad`);
check(!s.sub, "no line yet", s.sub);
const x0 = s.x, z0 = s.z;
await a.evaluate(() => window.__trollOps.keys.add("KeyW"));
await sleep(900);
s = await st(a);
await a.evaluate(() => window.__trollOps.keys.delete("KeyW"));
check(Math.hypot(s.x - x0, s.z - z0) < 0.05, "seated: W doesn't walk you", `moved ${Math.hypot(s.x - x0, s.z - z0).toFixed(3)} m`);

s = await until(a, -25.8);
check(s.photo && s.photoK > 0.95, "the photo is up", `k=${s.photoK.toFixed(2)}`);
check(s.pitch < -0.25, "looking down at it", `pitch=${s.pitch.toFixed(2)}`);
check(s.memory > 0.5, "the edges go warm", `memory=${s.memory.toFixed(2)}`);
check(!s.song, "no song on the photo path");
await shot(a, "photo-look.png");
// The stroke runs T-19.3..T-17.2: watch it go across (a single sample can land late).
// Sampled in the page every frame, so a slow poll can't miss it.
const strokes = await a.evaluate(async (c) => {
  const cine = await import(c), T = window.__trollOps, out = [];
  await new Promise((done) => {
    const tick = () => {
      const t = T.royale().planeT;
      if (t > -25.3 && t < -23.2) out.push(+cine.dropCineCaress().toFixed(2));
      if (t >= -23.2) done(); else requestAnimationFrame(tick);
    };
    tick();
  });
  return out.filter((_, i) => i % 6 === 0);
}, CINE);
s = await st(a);
check(strokes.some((c) => c > 0.2 && c < 0.8), "the thumb across it", strokes.join(" "));
await shot(a, "photo-caress.png");

// He's by you, standing still, from T-16.4; the lean and the tap run
// T-16..T-14.8. Every frame over it is measured (single samples land late
// on a busy machine): leanWatch, from the top.
s = await until(a, -21.7);
check(/Hey\. Mask on, troll/.test(s.sub), "T-16: he cuts in", s.sub);
check(s.pitch > -0.2, "the head comes up", `pitch=${s.pitch.toFixed(2)}`);
const leanF = await leanWatch;
const uprightF = leanF.filter((q) => q.t < CREW_LEAN0);
const leaning = leanF.filter((q) => q.t > CREW_LEAN0 + 0.4);
const upright = Math.min(...uprightF.map((q) => q.jmLean));
const leanMax = Math.max(...leaning.map((q) => q.jmLean));
const handMin = Math.min(...leaning.map((q) => q.jmHandToMouth));
// The bodies (user: "make sure the body and arm movements are logically
// correct"): he leans in toward you, his hand goes to his own mouth.
check(uprightF.length && leaning.length && leanMax > upright + 0.04, "the jumpmaster leans in (forward, toward you)", `head ahead of hips ${upright.toFixed(2)} -> ${leanMax.toFixed(2)} m (${uprightF.length}/${leaning.length} frames)`);
check(handMin < 0.14, "his hand taps his own mouth", `hand ${handMin.toFixed(2)} m from it`);
check(s.photoK < 0.95, "the photo's going away", `k=${s.photoK.toFixed(2)}`);
check(s.memory < 0.2, "the warm edges fade", `memory=${s.memory.toFixed(2)}`);
await shot(a, "photo-interrupt.png");

s = await until(a, -20.7);
check(s.kind === "mask" && !s.photo, "T-15: the hands go to the mask", JSON.stringify({ kind: s.kind, photo: s.photo }));
await shot(a, "cine-raise.png");

s = await until(a, -19);
check(s.k > 0.95 && s.mask, "the mask is on the face by T-13", `k=${s.k.toFixed(2)}`);
check(s.visor > 0.6, "the visor darkens", `opacity=${s.visor.toFixed(2)}`);
check(s.crew?.mask && (s.crew?.mateHandsToMask ?? 9) < 0.16, "the squad mate holds his mask on with both hands", `mask ${s.crew?.mask}, hands ${(s.crew?.mateHandsToMask ?? 9).toFixed(2)} m from it`);
await shot(a, "cine-mask-on.png");

s = await until(a, -17.5);
check(/Deep breaths/.test(s.sub), "the second line", s.sub);
let fog = 0;
for (let i = 0; i < 14; i++) {
  fog = Math.max(fog, await a.evaluate(() => +getComputedStyle(document.querySelector(".to-dropcine-visor i")).opacity));
  await sleep(70);
}
check(fog > 0.2, "the visor fogs on a breath", `fog=${fog.toFixed(2)}`);

s = await until(a, -14.8);
check(/Okay, off/.test(s.sub), "the third line", s.sub);
check(s.k < 0.6, "the mask is coming off", `k=${s.k.toFixed(2)}`);
check(s.crew?.mate.shown && s.crew?.jm.shown, "the jumpmaster and the squad mate are there", JSON.stringify(s.crew));

// ---- phase 2: up, down the aisle, the ramp, the turn
s = await until(a, -13.5);
check(s.on && s.body, "T-14: still the scene's", JSON.stringify({ on: s.on, body: s.body }));
check(s.holding === "none" && !s.mask, "the hands are empty", JSON.stringify({ holding: s.holding, mask: s.mask }));
check(s.eye > -0.05, "on your feet", `eye=${s.eye.toFixed(2)}`);
const lz0 = s.lz;
s = await until(a, -11.6);
check(/Get to the ramp/.test(s.sub), "the walk line", s.sub);
check(s.lz > lz0 + 0.5, "walking aft down the aisle", `z ${lz0.toFixed(2)} -> ${s.lz.toFixed(2)}`);
await shot(a, "walk.png");
s = await until(a, -8.6);
check(Math.abs(s.lz - 5.7) < 0.3, "at the ramp's hinge by T-8.6", `z=${s.lz.toFixed(2)}`);
check(s.light === "red" && s.ramp > 0.1, "red light on, the ramp coming down", JSON.stringify({ light: s.light, ramp: s.ramp }));
check(Math.cos(s.yaw) < -0.8, "looking aft at the ramp", `yaw=${s.yaw.toFixed(2)}`);
await shot(a, "ramp.png");
s = await until(a, -5.2);
check(s.pitch < -0.5 && s.ramp >= 0.99, "T-5.2: looking down past the edge, the ramp slid in", JSON.stringify({ pitch: s.pitch, ramp: s.ramp }));
await shot(a, "look-down.png");
s = await until(a, -2.4);
check(s.pitch < -0.5, "T-2.4: still looking down (a long look)", JSON.stringify({ pitch: s.pitch }));
s = await until(a, -0.4);
check(/Back to the door/.test(s.sub), "the turn line", s.sub);
check(Math.cos(s.yaw) > 0.8, "turned round to face into the hold", `yaw=${s.yaw.toFixed(2)}`);
check(s.crew?.jm.shown && s.crew?.mate.shown, "the crew in the hold with you", JSON.stringify(s.crew));
await shot(a, "turned.png");

// The shove: his hands land on your chest as the light goes green.
s = await until(a, -0.5, 30000);
check(s.crew?.jm.shown && s.crew.jmHands, "he's stepped in front of you", JSON.stringify(s.crew?.jm));
const tumbleWatch = fallSamples(a, 1.5, 30000);   // the tumble is over in 1.5 s
s = await until(a, 0.5, 30000);
// The game's own measure (royale-crew.js): sampled from out here, a busy
// machine skips the few frames the hands are on you.
check((s.crew?.jmReach ?? 9) < 0.3, "the green: his hands land on your chest", (s.crew?.jmReach ?? 9).toFixed(2) + " m");
await shot(a, "shove.png");
check(s.phase === "run", "the green still comes", s.phase);
check(/GO! GO! GO!/.test(s.sub), "GO GO GO", s.sub);
for (let i = 0; i < 40 && (await st(a)).me === "aboard"; i++) await sleep(100);
s = await st(a);
check(s.me === "fall" || s.me === "glide", "shoved out, no key pressed", s.me);

// ---- the fall's opening show (phase 3)
let fsm = await tumbleWatch;
const tumble = fsm.filter((x) => x.shot === "tumble");
check(fsm[0]?.back === true, "out backwards (facing into the hold)", JSON.stringify(fsm[0]));
check(tumble.length > 3 && tumble.every((x) => !x.rigVis), "the tumble: first person, your body hidden", `${tumble.length} frames`);
check(Math.min(...tumble.map((x) => x.camUp)) < -0.5, "the tumble goes over backwards (the view upside down)", `min up ${Math.min(...tumble.map((x) => x.camUp)).toFixed(2)}`);
await shot(a, "fall-tumble.png");
let x = await fallAt(a, 2.2);
check(x.shot === "ramp" && x.rigVis, "cut: the wide from the ramp", JSON.stringify(x));
check(x.camDy > 5 && x.camDist > 15, "left above where you went out, you falling away", `${x.camDist.toFixed(1)} m off, ${x.camDy.toFixed(1)} m up`);
check(x.face > 0.7, "you on your back, face up", `face y ${x.face.toFixed(2)}`);
await shot(a, "fall-ramp.png");
check(Math.abs(x.faceX) < 0.45 && Math.abs(x.faceY) < 0.5 && x.faceZ < 1, "your face in the middle of it", JSON.stringify({ x: x.faceX, y: x.faceY }));
x = await fallAt(a, 3.8);
check(x.shot === "face" && x.camDy > 1.2 && x.camDist < 3.5, "cut: just over you, into your face", JSON.stringify(x));
check(Math.abs(x.faceX) < 0.45 && Math.abs(x.faceY) < 0.6 && x.faceZ < 1, "...your face in frame", JSON.stringify({ x: x.faceX, y: x.faceY }));
check(!x.sub && !x.bars, "out of the plane: the subtitle and the bars are gone", JSON.stringify({ sub: x.sub, bars: x.bars }));
await shot(a, "fall-face.png");
x = await fallAt(a, 5.9);
check(x.shot === "low" && x.camDy < -1.2 && x.camDist < 3.2, "cut: close below as you roll over", JSON.stringify(x));
check(Math.abs(x.faceX) < 0.5 && Math.abs(x.faceY) < 0.6 && x.faceZ < 1, "...your face in frame", JSON.stringify({ x: x.faceX, y: x.faceY }));
check(x.face < -0.5, "...belly down by the end of it", "face y " + x.face.toFixed(2));
await shot(a, "fall-low.png");
await a.evaluate(() => window.__trollOps.keys.add("KeyW"));
fsm = await fallSamples(a, 6.3);
await a.evaluate(() => window.__trollOps.keys.delete("KeyW"));
const show = fsm.filter((q) => q.t < 6);
check(Math.max(...show.filter((q) => q.t > 5.2).map((q) => q.hv)) < 2.5, "no steering in the show (W held)", `${Math.max(...show.filter((q) => q.t > 5.2).map((q) => q.hv)).toFixed(1)} m/s`);
x = fsm.at(-1);
check(x.shot === "behind" && x.face < -0.7, "then behind you, belly down", JSON.stringify(x));
check(Math.abs(x.camDist - 7) < 1.2, "the usual drop camera", `${x.camDist.toFixed(1)} m`);
await shot(a, "fall-behind.png");
// Hold-to-view: crouch held cycles the angles, two seconds each.
await a.evaluate(() => window.__trollOps.keys.add("KeyC"));
fsm = await fallSamples(a, x.t + 2.6);
const views = [...new Set(fsm.map((q) => q.view))];
const high = fsm.filter((q) => q.height > 80);
check(views.includes(0) && (views.includes(1) || high.length < fsm.length), "C held: the angles cycle (side, then front)", JSON.stringify({ views, from: fsm[0]?.height?.toFixed(0), to: fsm.at(-1)?.height?.toFixed(0) }));
check(fsm.every((q) => q.height > 80 || q.view === -1), "never under 80 m", "");
await shot(a, "fall-view.png");
await a.evaluate(() => window.__trollOps.keys.delete("KeyC"));
x = (await fallSamples(a, fsm.at(-1).t + 0.3)).at(-1) ?? fsm.at(-1);
check(x.view === -1 && Math.abs(x.camDist - 7) < 1.2, "let go: back behind you", JSON.stringify(x));
// Phase 4: the real clips (sound/sfx-files.js), all in and each on its cue.
const snd = await sfxState(a);
check(snd.loaded.length === snd.all, "every sound clip loaded", `${snd.loaded.length}/${snd.all}`);
for (const n of ["mask-hiss", "breathing", "strap-snap", "belt", "steps", "latch", "wind-in", "gust", "wind-rush", "whoosh"]) check(snd.played.includes(n), `the ${n} clip plays`, snd.played.join(" "));
await a.close();

// ---- music: the iPod and a Troll Radio song, the radio put back after
const b = await open(45);
await setOpener(b, "music", 2);   // picked before the scene, as the music checks below expect
await b.evaluate(() => { window.__trollOps.settings.thirdPerson = true; });
s = await until(b, -39);
let tv = await tpView(b);
check(tv.vis && tv.dist > 0.9 && Math.abs(tv.x) < 0.9 && Math.abs(tv.y) < 0.9 && tv.z < 1, "third person, walking to the seat: you're in frame", JSON.stringify(tv));
await shot(b, "tp-walk.png");
s = await until(b, -33);
tv = await tpView(b);
check(s.sitK > 0.95 && tv.vis && tv.dist > 0.9 && Math.abs(tv.x) < 0.9 && Math.abs(tv.y) < 0.9 && tv.z < 1, "third person, seated: you're in frame", JSON.stringify({ sitK: s.sitK, ...tv }));
await shot(b, "tp-seated.png");
s = await until(b, -27);
tv = await tpView(b);
check(!tv.vis, "the scene itself is first person", JSON.stringify(tv));
await b.evaluate(() => { window.__trollOps.settings.thirdPerson = false; });
s = await st(b);
const N = s.music?.tracks || 0;
check(N > 2, "Troll Radio has tracks", String(N));
await setOpener(b, "music", 2);
// The radio's off before (the default in a test tab): it stays off after.
const before = s.music;
s = await until(b, -27.5);
check(s.on && s.kind === "ipod", "T-28: the iPod is in the hands", JSON.stringify({ on: s.on, kind: s.kind }));
// (Sampled late on a busy machine the song may be on already: then it
// mustn't have started before the press, T-19.4, by its own clock.)
check(!s.song || s.music.at <= s.t + 19.4 + 0.3, "nothing playing before play's pressed", "t=" + s.t?.toFixed(2) + " song at " + s.music?.at?.toFixed(2));
s = await until(b, -26.4);
check(s.ipod && s.ipodK > 0.9 && !s.photo, "the iPod is up, no photo", `k=${s.ipodK.toFixed(2)}`);
await shot(b, "ipod-list.png");
s = await until(b, -24.4);
check(s.song && s.song.index === 2, "play: the picked song is on", JSON.stringify(s.song));
check(s.music.index === 2 && !s.music.paused, "Troll Radio is playing track 3", JSON.stringify(s.music));
await shot(b, "ipod-playing.png");
s = await until(b, -23);
check(s.music.at > 0.5, "and it keeps going", `at=${s.music.at.toFixed(2)} s`);
check(s.pitch > -0.2, "head up, listening", `pitch=${s.pitch.toFixed(2)}`);
check(s.memory < 0.05, "no warm edges on the music path", `memory=${s.memory.toFixed(2)}`);
await shot(b, "ipod-listen.png");
// The fade runs T-16..T-15.3: watch it (a single sample can land after it).
let faded = 1, line = "";
for (s = await until(b, -22.05); s.t < -21.3; s = await st(b)) { if (s.song) faded = Math.min(faded, s.music.vol / s.music.base); if (s.sub) line = s.sub; }
check(/Hey\. Mask on, troll/.test(line), "T-16: he cuts in", line);
check(faded < 0.8, "the song fades", `down to ${(faded * 100).toFixed(0)}%`);
s = await until(b, -20.7);
check(!s.song && s.music.paused, "the song's stopped", JSON.stringify(s.music));
check(Math.abs(s.music.vol - s.music.base) < 0.01, "the radio's volume put back", `vol=${s.music.vol.toFixed(2)}`);
check(s.music.playing === before.playing && s.music.index === before.index, "the radio as it was before", JSON.stringify({ before, now: s.music }));
check(s.kind === "mask" && !s.ipod, "the hands go to the mask", JSON.stringify({ kind: s.kind, ipod: s.ipod }));
s = await until(b, -13.6);
check(s.on && s.holding === "none" && !s.ipod, "T-14: up, hands empty", JSON.stringify({ on: s.on, holding: s.holding }));
s = await until(b, 0.4, 30000);
check(!s.on && s.holding === "none", "the green: handed back", JSON.stringify({ on: s.on, holding: s.holding }));
await b.close();

// ---- a late join skips it
const c = await open(18);
s = await until(c, -17);
check(!s.on && !s.body && !s.card, "a late join (aboard after T-28) never gets the card or the scene", JSON.stringify({ t: s.t, on: s.on, card: s.card }));
s = await until(c, -12);
check(!s.on && s.holding !== "streak", "still nothing at T-12", JSON.stringify({ on: s.on, holding: s.holding }));
await c.close();

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
