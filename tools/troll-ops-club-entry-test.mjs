// Troll Forces Socialize: Trolling Loud's door (modes/club-entry.js,
// CLUB-ENTRY.md), phases 1-3, solo: the flow, the look (the rope, the
// bouncers, bands on wrists, security's hand up at VIP), and the kick-out.
//
// Five tabs, one at a time, Supabase blocked (never a live room):
//   1. Signed in: spawn in the line with 1-7 clubgoers ahead (a line of
//      6-7); the line moves up; at a lane your ID (the HAWAII licence, view/club-id-card.js) shows, then the
//      18+ question; "Yeah" puts a guest band on and walks you into the
//      lobby. Before the band the lobby is fenced off; after it the main
//      floor is open and VIP and back of house aren't.
//   2. Guest: no card, straight to the question; "No" plays the kick-out
//      (carried off, tossed on the curb) and leaves you sat there, locked
//      out; once it's up, X puts you back in the line.
//   3. troll_runner: in the lobby with the owner band; VIP and back open.
//   4. A pad (phase 5): A/B keycaps, B is No, a held A doesn't answer, a
//      fresh A does; the chips name X (BO2's use button).
//   5. A landscape phone (phase 5): big touch buttons nothing covers, the
//      context button reads Leave, a tap answers.
//   6. The bandana guy: off till he's due; his schedule is the same for
//      everyone and has him most slots; sent now, he comes up the alley in
//      a bandana, takes a lane, gets carried off and thrown on the curb, sits
//      there, walks off and is gone, and the lane's back to the line.
// Shots: scratch PNGs in tools/.club-shots (not committed).
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-club-entry-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".club-shots");
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
async function pump(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) await page.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });

/* A Socialize tab on Trolling Loud as `user` (null = a guest). `phone`: a
   landscape phone with touch; `pad`: a fake standard gamepad, its buttons
   set through window.__pad. */
async function open(user, { phone = false, pad = false } = {}) {
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 960, height: 600 } });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.addInitScript((user) => {
    const fake = { getCachedProfile: () => (user ? { username: user, tags: [] } : null) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
  }, user);
  if (pad) await page.addInitScript(() => {
    window.__pad = { id: "fake pad (STANDARD GAMEPAD)", index: 0, connected: true, mapping: "standard", timestamp: 0,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    navigator.getGamepads = () => [window.__pad, null, null, null];
  });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollClub, null, { timeout: 420000 });
  await page.evaluate(() => {
    window.__trollOps.setLoadWaitMax(8);
    // minAhead 3: with the waits this short, 1 ahead had you at a lane before the first look
    // bandanaEvery: the bandana guy never due on his own (case 6 sends him)
    Object.assign(window.__trollClub.T, { checkSecs: 0.5, idSecs: 0.8, bandSecs: 0.4, lockSecs: 3, minAhead: 3, bandanaEvery: 1e9 });
  });
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.setMode("social");
    T.loadout.mapId = "trollingloud";
    await T.startGame();
  });
  await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
  await page.evaluate(() => { window.__trollOps.els.pause.hidden = true; });
  await pump(page, 600);
  return page;
}
const S = (page) => page.evaluate(() => {
  const T = window.__trollOps, C = window.__trollClub, c = C.club, p = T.move.pos;
  const d = T.builtMap().map.rp.door;
  return {
    phase: c.phase, band: C.band(), ahead: c.queue.findIndex((e) => e.me), lineNpcs: c.queue.filter((e) => !e.me).length,
    want: c.want, lineish: c.npcs.filter((e) => ["line", "lane", "door", "arrive"].includes(e.state)).length, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), zone: d.zoneOf(p.x, p.y + 0.1, p.z),
    card: !!document.querySelector(".club-card:not([hidden]) .club-id"), cardText: document.querySelector(".club-card")?.textContent || "",
    ask: !!document.querySelector(".club-ask:not([hidden])"), chip: document.querySelector(".club-chip:not([hidden])")?.textContent || "",
    paused: !T.els.pause.hidden,
    rope: C.rope(), rigBand: T.localRig.band || 0, bandMesh: !!T.localRig.bandMesh?.parent,
    bouncers: c.lanes.filter((l) => l.b?.override).length, blocks: c.blocks.length,
    npcBands: c.npcs.filter((e) => e.n.rig.band === 1).length,
    kick: C.kick(), cine: document.body.classList.contains("club-cine-on"),
    cap: document.querySelector(".club-cine-cap")?.textContent || "", stamp: !!document.querySelector(".club-cine-stamp.is-on"),
    lie: +T.localRig.root.rotation.x.toFixed(2), sit: c.sit, eyeY: +T.camera.position.y.toFixed(2),
    held: c.lanes.filter((l) => l.b && Math.hypot(l.b.x - p.x, l.b.z - p.z) < 0.9).length,
  };
});
const until = async (page, pred, ms) => {
  const t0 = Date.now();
  let s = await S(page);
  while (Date.now() - t0 < ms && !pred(s)) { await pump(page, 250); s = await S(page); }
  return s;
};
/* The 18+ dialog's keycaps as shown ("" for a hidden one), e.g. "1|2". */
const caps = (page) => page.evaluate(() => [...document.querySelectorAll(".club-ask kbd")].map((k) => (k.hidden ? "" : k.textContent)).join("|"));
const setPad = (page, i, on) => page.evaluate(({ i, on }) => { const b = window.__pad.buttons[i]; b.pressed = b.touched = on; b.value = on ? 1 : 0; }, { i, on });
/* Try to walk into a spot: put us there for a frame and see where we end up. */
const poke = (page, x, y, z) => page.evaluate(({ x, y, z }) => { window.__trollOps.move.pos.set(x, y, z); }, { x, y, z });

// ── 1. Signed in ─────────────────────────────────────────────────────────
let A = await open("club_tester");
let s = await S(A);
check("signed in: you start in the line", s.phase === "queued" && s.zone === "street", JSON.stringify(s));const spawnAhead = await A.evaluate(() => window.__trollClub.club.spawnAhead);
check("with 1-7 clubgoers ahead of you (3+ here)", spawnAhead >= 3 && spawnAhead <= 7, `${spawnAhead} ahead at spawn`);
check("the velvet rope's up across the door, both bouncers working the lanes", s.rope.on && s.rope.k === 0 && s.bouncers === 2, JSON.stringify({ rope: s.rope, bouncers: s.bouncers }));
// (with the waits shortened the front ones may already be at a lane)
check("in a line of 6-7", (s.want === 6 || s.want === 7) && s.lineish >= s.want - 1, `want ${s.want}, ${s.lineish} in line or at a lane now`);
await A.screenshot({ path: path.join(SHOTS, "1-line.png") });
// pinned: the keys don't move you out of your place
const before = { x: s.x, z: s.z };
await A.keyboard.down("w"); await pump(A, 700); await A.keyboard.up("w");
s = await S(A);
check("the line holds you in your place (or walks you up it)", s.phase !== "queued" || (Math.abs(s.z - before.z) < 0.2 && s.x >= before.x - 0.05), JSON.stringify(s));
// the line moves up and a lane takes you
s = await until(A, (s) => s.phase === "id" || s.phase === "ask", 60000);
check("the line moves up to a lane, and your ID comes out", s.phase === "id" && s.card && /club_tester/.test(s.cardText), JSON.stringify({ ...s, cardText: s.cardText.slice(0, 40) }));
await A.screenshot({ path: path.join(SHOTS, "2-card.png") });
s = await until(A, (s) => s.phase === "ask", 5000);
check("then the 18+ question", s.ask && !s.card, JSON.stringify(s));
check("the question frees the mouse without pausing", !s.paused);
check("its keycaps read 1 / 2 on keys", (await caps(A)) === "1|2", await caps(A));
await A.screenshot({ path: path.join(SHOTS, "3-ask.png") });
// fenced off before the band
await A.keyboard.press("Digit1");
let ropeMax = 0;
s = await until(A, (s) => { ropeMax = Math.max(ropeMax, s.rope.k); return s.phase === "in"; }, 15000);
check("Big Lulz takes the rope off its hook to let you in", ropeMax > 0.85, `rope k max ${ropeMax.toFixed(2)}`);
check("the band's on your right wrist", s.rigBand === 1 && s.bandMesh, JSON.stringify({ rigBand: s.rigBand, bandMesh: s.bandMesh }));
check("clubgoers checked in ahead of you wear theirs", s.npcBands >= 1, `${s.npcBands} banded`);
check("'Yeah': a guest band, walked into the lobby", s.phase === "in" && s.band === 1 && s.zone === "main", JSON.stringify(s));
await A.screenshot({ path: path.join(SHOTS, "4-lobby.png") });
await poke(A, -22, 0.3, 3); await pump(A, 300); s = await S(A);
check("the guest band doesn't open VIP", s.zone !== "vip", JSON.stringify(s));
check("and security puts a hand up", s.blocks === 1, JSON.stringify({ blocks: s.blocks }));
await poke(A, 0, 0.3, -20); await pump(A, 300); s = await S(A);
check("or back of house", s.zone !== "back", JSON.stringify(s));
await poke(A, 0, 0, 27); await pump(A, 300); s = await S(A);
check("out on the street with it", s.zone === "street", JSON.stringify(s));
await poke(A, 24, 0.3, 17); await pump(A, 300); s = await S(A);
check("and back in by a side door, no line", s.zone === "main", JSON.stringify(s));
check("signed in: no page errors", A.errors.length === 0, A.errors.slice(0, 3).join(" | "));
await A.context().close();

// ── 2. Guest ─────────────────────────────────────────────────────────────
A = await open(null);
s = await S(A);
check("guest: in the line", s.phase === "queued", JSON.stringify(s));
// out of the line (X), then try the front door and a side door
await A.evaluate(() => window.__trollClub.leave());
await pump(A, 200);
await poke(A, 0, 0.3, 18); await pump(A, 300); s = await S(A);
check("no band: the lobby's fenced off", s.zone === "street" && s.phase === "none", JSON.stringify(s));
await poke(A, 24, 0.3, 17); await pump(A, 300); s = await S(A);
check("and so is every side door", s.zone === "street", JSON.stringify(s));
await A.evaluate(() => window.__trollClub.join());
s = await until(A, (s) => s.phase === "id" || s.phase === "ask", 60000);
check("guest: no card, straight to the question", s.phase === "ask" && !s.card, JSON.stringify(s));
await A.keyboard.press("Digit2");
// The kick-out plays in full (never shortened, not even here).
s = await until(A, (s) => s.kick > 0.5, 3000);
check("'No': the kick-out starts, letterboxed", s.phase === "kick" && s.cine && s.cap === "Nah.", JSON.stringify(s));
s = await until(A, (s) => s.kick > 3.0, 6000);
check("both bouncers carry you, off your feet", s.held === 2 && s.y > 0.25, JSON.stringify(s));
await A.screenshot({ path: path.join(SHOTS, "5a-carried.png") });
s = await until(A, (s) => s.kick > 5.1, 6000);
check("tossed on your back by the curb, caption and stamp up", s.lie > 1.3 && s.z > 27 && /18/.test(s.cap) && s.stamp, JSON.stringify(s));
await A.screenshot({ path: path.join(SHOTS, "5b-tossed.png") });
s = await until(A, (s) => s.phase !== "kick" && s.chip, 6000);   // (the chip is up the frame after)
check("'No': out on the curb, locked out", s.phase === "lockout" && s.band === 0 && s.zone === "street" && /Bounced/.test(s.chip) && !s.cine, JSON.stringify(s));
check("sat on the curb, eye low", s.sit > 0.5 && s.eyeY < 1.1 && s.lie === 0, JSON.stringify(s));
await A.screenshot({ path: path.join(SHOTS, "5-bounced.png") });
s = await until(A, (s) => /Hold X/.test(s.chip), 6000);
check("when the lockout's up, X gets you back in line", /Hold X/.test(s.chip), s.chip);
await A.evaluate(() => window.__trollClub.join());
s = await S(A);
check("back in the line", s.phase === "queued" && s.ahead >= 0, JSON.stringify(s));
check("guest: no page errors", A.errors.length === 0, A.errors.slice(0, 3).join(" | "));
await A.context().close();

// ── 3. The owner ─────────────────────────────────────────────────────────
A = await open("troll_runner");
s = await S(A);
check("troll_runner: in the lobby with the owner band", s.phase === "in" && s.band === 2 && s.zone === "main", JSON.stringify(s));
check("the black and gold owner band on his wrist", s.rigBand === 2 && s.bandMesh, JSON.stringify({ rigBand: s.rigBand, bandMesh: s.bandMesh }));
await poke(A, -22, 0.3, 3); await pump(A, 300); s = await S(A);
check("VIP's open to him", s.zone === "vip", JSON.stringify(s));
await poke(A, 0, 0.3, -20); await pump(A, 300); s = await S(A);
check("so is back of house", s.zone === "back", JSON.stringify(s));
check("owner: no page errors", A.errors.length === 0, A.errors.slice(0, 3).join(" | "));
await A.context().close();

// ── 4. A pad (phase 5) ───────────────────────────────────────────────────
A = await open(null, { pad: true });
s = await until(A, (s) => s.phase === "queued" || s.phase === "ask", 5000);
if (s.phase === "queued") check("pad: the chip names X for stepping out", /hold X/.test(s.chip), s.chip);
s = await until(A, (s) => s.phase === "ask", 60000);
check("pad: the keycaps read A / B", (await caps(A)) === "A|B", await caps(A));
await A.screenshot({ path: path.join(SHOTS, "6-pad-ask.png") });
await setPad(A, 1, true); await pump(A, 150); await setPad(A, 1, false);
s = await until(A, (s) => s.kick > 0.3, 3000);
check("pad: B is 'No'", s.phase === "kick", JSON.stringify({ phase: s.phase, kick: s.kick }));
s = await until(A, (s) => s.phase === "lockout" && /Hold X/.test(s.chip), 16000);
check("pad: once the lockout's up, the chip says hold X", /^Hold X to get back in line/.test(s.chip), s.chip);
await A.evaluate(() => window.__trollClub.join());
// A held from before the question isn't the answer...
await setPad(A, 0, true);
s = await until(A, (s) => s.phase === "ask", 60000);
await pump(A, 500); s = await S(A);
check("pad: an A already held when the question comes up doesn't answer it", s.phase === "ask" && s.ask, JSON.stringify({ phase: s.phase }));
await setPad(A, 0, false); await pump(A, 200);
await setPad(A, 0, true); await pump(A, 150); await setPad(A, 0, false);
s = await until(A, (s) => s.phase === "in", 15000);
check("pad: ...a fresh A is 'Yeah': banded and in", s.phase === "in" && s.band === 1, JSON.stringify({ phase: s.phase, band: s.band }));
check("pad: no page errors", A.errors.length === 0, A.errors.slice(0, 3).join(" | "));
await A.context().close();

// ── 5. A phone (phase 5) ─────────────────────────────────────────────────
A = await open(null, { phone: true });
s = await until(A, (s) => s.phase === "queued" || s.phase === "ask", 5000);
if (s.phase === "queued") {
  check("phone: the chip says hold Leave", /hold Leave to step out/.test(s.chip), s.chip);
  const ctxBtn = await A.evaluate(() => document.querySelector(".to-touch-swap")?.dataset.ctx || "");
  check("phone: the context button reads Leave", ctxBtn === "Leave", ctxBtn);
  await A.screenshot({ path: path.join(SHOTS, "7-phone-line.png") });
}
s = await until(A, (s) => s.phase === "ask", 60000);
const tb = await A.evaluate(() => {
  const d = document.querySelector(".club-ask");
  const bs = [...d.querySelectorAll("button")].map((b) => {
    const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return { h: Math.round(r.height), w: Math.round(r.width), inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
      onTop: document.elementFromPoint(cx, cy)?.closest("button") === b, cx, cy };
  });
  return { touch: d.classList.contains("is-touch"), bs };
});
check("phone: the touch dialog, keycaps hidden", tb.touch && (await caps(A)) === "|", JSON.stringify({ touch: tb.touch, caps: await caps(A) }));
check("phone: two big buttons, on screen, nothing over them", tb.bs.length === 2 && tb.bs.every((b) => b.h >= 56 && b.w >= 120 && b.inView && b.onTop), JSON.stringify(tb.bs));
await A.screenshot({ path: path.join(SHOTS, "8-phone-ask.png") });
await A.touchscreen.tap(tb.bs[0].cx, tb.bs[0].cy);
s = await until(A, (s) => s.phase === "in", 15000);
check("phone: tapping Yeah bands you and walks you in", s.phase === "in" && s.band === 1, JSON.stringify({ phase: s.phase, band: s.band }));
check("phone: no page errors", A.errors.length === 0, A.errors.slice(0, 3).join(" | "));
await A.context().close();

// ── 6. The bandana guy ───────────────────────────────────────────────────
A = await open(null);
const bs = () => A.evaluate(() => window.__trollClub.bandanaState());
async function untilB(pred, ms) {
  const t0 = Date.now();
  let b = await bs();
  while (Date.now() - t0 < ms && !pred(b)) { await pump(A, 250); b = await bs(); }
  return b;
}
let b = await bs();
check("bandana: he's in the cast, off till he's due", !!b && b.off && !b.on, JSON.stringify(b));
const sched = await A.evaluate(() => {
  const C = window.__trollClub, P = 150 * 1000;
  C.T.bandanaEvery = 150;
  const evs = [];
  for (let k = 0; k < 400; k++) evs.push(C.bandanaEvent(1.7e12 + k * P + 1234));
  const again = C.bandanaEvent(1.7e12 + 7 * P + 99);
  C.T.bandanaEvery = 1e9;
  const on = evs.filter(Boolean);
  return { share: on.length / evs.length, lanes: [0, 1].map((l) => on.filter((e) => e.lane === l).length),
    cols: new Set(on.map((e) => e.col)).size, same: JSON.stringify(again) === JSON.stringify(evs[7]),
    starts: on.every((e) => e.start === e.slot * P + 5000) };
});
check("bandana: the schedule has him most slots, both lanes, every colour, the same every time",
  sched.share > 0.55 && sched.share < 0.85 && sched.lanes.every((n) => n > 40) && sched.cols === 4 && sched.same && sched.starts, JSON.stringify(sched));
// Sent now, 12 s up the alley already (the walk's long), shorter look and curb.
await A.evaluate(() => { const C = window.__trollClub; Object.assign(C.T, { bandanaLook: 0.8, bandanaSit: 1.2 }); C.bandana(0, Date.now() - 12000); });
b = await untilB((b) => b.phase === "up" && b.visible, 5000);
check("bandana: he comes up the alley in a bandana", b.on && !b.off && b.visible && /:bandana-red$/.test(b.face) && b.z > 25, JSON.stringify({ phase: b.phase, face: b.face, x: b.x, z: b.z, vis: b.visible }));
b = await untilB((b) => b.phase === "look", 25000);
check("bandana: he takes lane 0 and the bouncer turns to him", b.phase === "look" && b.lanes[0].who === "bandana" && b.lanes[0].act === "face" && Math.abs(b.x + 3.3) < 0.3,
  JSON.stringify({ phase: b.phase, x: b.x, z: b.z, lanes: b.lanes }));
b = await untilB((b) => b.tc > 2.5, 15000);
check("bandana: the bouncers carry him off (the other one helps unless you're at his lane)",
  b.phase === "kick" && b.lanes[0].kick && (b.lanes[1].hold || b.lanes[1].who === "me") && b.y > 0.15, JSON.stringify({ phase: b.phase, tc: b.tc, y: b.y, lanes: b.lanes }));
b = await untilB((b) => b.tc > 5.3 || b.phase === "curb", 15000);
check("bandana: ...and toss him on his back by the curb", b.rz > 27 && b.lie > 1.3, JSON.stringify({ tc: b.tc, rz: b.rz, lie: b.lie, y: b.y }));
b = await untilB((b) => b.phase === "curb", 15000);
check("bandana: he sits on the curb; both lanes are free again",
  b.phase === "curb" && b.lanes.every((l) => !l.kick && !l.hold && !l.reserved && l.who !== "bandana"), JSON.stringify({ phase: b.phase, x: b.x, z: b.z, lanes: b.lanes }));
await A.screenshot({ path: path.join(SHOTS, "9-bandana-curb.png") });
b = await untilB((b) => b.phase === "off" && b.x < -1, 15000);
check("bandana: then walks off down the alley", b.phase === "off" && b.x < -1, JSON.stringify({ phase: b.phase, x: b.x, z: b.z }));
await A.evaluate(() => { const C = window.__trollClub; C.club.bandana.ev.start -= 60000; });   // skip the rest of the walk
b = await untilB((b) => !b.on, 5000);
check("bandana: gone, and the bandana's off", !b.on && b.off && b.face === "grin:og", JSON.stringify({ on: b.on, off: b.off, face: b.face }));
b = await untilB((b) => b.lanes[0].who === "npc" || b.lanes[0].who === "me", 20000);
check("bandana: the line uses his lane again", b.lanes[0].who === "npc" || b.lanes[0].who === "me", JSON.stringify(b.lanes));
check("bandana: no page errors", A.errors.length === 0, A.errors.slice(0, 3).join(" | "));
await A.context().close();

await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
