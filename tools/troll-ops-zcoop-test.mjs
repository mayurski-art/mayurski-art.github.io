// Troll Forces Zombies co-op check (Zombie Rush P4). Tabs in one headless
// browser share a PRIVATE room code over BroadcastChannel (Supabase is
// blocked; never a public room, never the hub's code):
//   1. A and B start Zombies on the same code, different maps: B plays the
//      host's (A's) map, A runs the horde and B sees it mirrored.
//   2. The wave is bigger for two; both see the same zombies where they are.
//   3. B's kill on a mirrored zombie kills it on the host and pays B, not A;
//      A's own kill pays A and drops it on B's screen.
//   4. B's turret stands on both screens, real on the host only, and its
//      kills pay B.
//   5. The break: B's vote alone doesn't skip it ("Votes 1/2"); both do.
//   6. B goes down: no last stand, "a teammate can pick you up"; A holds X
//      by B and B is back up.
//   7. A leaves: B takes the horde over and the wave carries on.
//   8. C joins mid-run and gets the horde; B and C both go down: the run is
//      lost on both.
// Text-overlap scans on B's HUD in the co-op states. Screenshots for a look.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-zcoop-test.mjs
//   SHOTS_DIR=<dir>; PHONE=1 for a landscape phone
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
import { textClash as scanText } from "./troll-ops-text-scan.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const TAG = process.env.PHONE ? "-phone" : "";
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
const ctx = await browser.newContext(process.env.PHONE
  ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
  : { viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// a private code, never QZHB (the hub's) and never blank (the public room)
const ROOM = "ZC" + String(Math.floor(Math.random() * 900 + 100));
const errors = [];

async function open(label) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED|supabase/i.test(m.text())) errors.push(`${label}: ${m.text()}`); });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  return page;
}
async function start(page, map, quiet) {
  await page.evaluate(async ({ room, map, quiet }) => {
    const T = window.__trollOps;
    if (quiet) T.composer.render = () => {};   // the host needn't draw
    T.setMode("zombies");
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    T.loadout.poolMapId = map;
    await T.startGame();
  }, { room: ROOM, map, quiet });
}
async function loaded(page, ms = 240000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms && await page.evaluate(() => window.__trollOps.loadState().open)) await sleep(250);
}
const until = async (page, fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
const R = (page, fn, arg) => page.evaluate(fn, arg);

const a = await open("A"), b = await open("B");
await Promise.all([start(a, "hollowgrin", true), sleep(400).then(() => start(b, "pentagrin", false))]);
await Promise.all([loaded(a), loaded(b)]);
// past the countdown: the host's clock, which B adopts
await R(a, () => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
await until(b, () => !window.__trollOps.isStaging(), null, 15000);
await R(b, () => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });

// ---- 1. the room
const mapA = await R(a, () => window.__trollOps.builtMap()?.map?.name);
const mapB = await R(b, () => window.__trollOps.builtMap()?.map?.name);
check(mapA === mapB, "B plays the host's map", `A ${mapA}, B ${mapB}`);
const roles = await Promise.all([a, b].map((p) => R(p, () => { const c = window.__trollOps.zrun().coop.coop; return { on: c.on, host: c.host }; })));
check(roles[0].on && roles[0].host, "A is the host", JSON.stringify(roles[0]));
check(roles[1].on && !roles[1].host, "B isn't", JSON.stringify(roles[1]));
check(await until(b, () => window.__trollOps.zdir().round >= 1), "the wave reaches B", String(await R(b, () => window.__trollOps.zdir().round)));
await until(b, () => document.querySelector("#to-zh .zh-wave")?.textContent === "Wave 1", null, 5000);
const waveB = await R(b, () => document.querySelector("#to-zh .zh-wave")?.textContent);
check(waveB === "Wave 1", "B's HUD reads Wave 1", waveB);

// ---- 2. the same horde
const total = await R(a, () => { const z = window.__trollOps.zdir(); return z.toSpawn + z.aliveCount; });
check(total >= 8, "a two-player wave 1 is bigger than solo's 6", String(total));
check(await until(a, () => window.__trollOps.zdir().zombies.filter((q) => q.alive && !q.dying && q.riseT <= 0).length >= 2, null, 60000), "the host has zombies up");
await sleep(1200);
// the host read before and after B: B's copy should be on the way between
// (a tenth of a second behind, eased), give or take a stride
const same = await (async () => {
  const hostAt = () => R(a, () => window.__trollOps.zdir().zombies.filter((q) => q.alive && !q.dying && q.riseT <= 0).map((q) => ({ nid: q.nid, type: q.type.id, x: q.mesh.position.x, z: q.mesh.position.z })));
  const a1 = await hostAt();
  const zb = await R(b, () => window.__trollOps.zdir().zombies.filter((q) => q.alive && !q.dying).map((q) => ({ nid: q.nid, proxy: q.proxy, snap: !!q.snap, rise: q.riseT, x: q.mesh.position.x, z: q.mesh.position.z })));
  const a2 = await hostAt();
  let far = 0, worst = "";
  for (const q of a1) {
    const q2 = a2.find((r) => r.nid === q.nid) || q;
    const m = zb.find((r) => r.nid === q.nid);
    if (!m) { far = Infinity; worst = `${q.nid} missing`; break; }
    const vx = q2.x - q.x, vz = q2.z - q.z, l2 = vx * vx + vz * vz || 1;
    const t = Math.max(0, Math.min(1, ((m.x - q.x) * vx + (m.z - q.z) * vz) / l2));
    const d = Math.hypot(m.x - (q.x + vx * t), m.z - (q.z + vz * t));
    if (d > far) { far = d; worst = `${q.type} ${q.nid}: host moved ${Math.hypot(vx, vz).toFixed(2)} m, snap ${m.snap}, rise ${m.rise.toFixed(2)}`; }
  }
  return { na: a1.length, nb: zb.length, proxies: zb.every((q) => q.proxy), far, worst };
})();
check(same.nb >= same.na - 1 && same.nb > 0, "B sees the host's zombies", `${same.na} / ${same.nb}`);
check(same.proxies, "B's are all mirrored");
check(same.far < 1.5, "where the host has them", `${same.far.toFixed(2)} m out at most (${same.worst})`);

// ---- 3. kills pay whoever made them
const cash = async () => Promise.all([a, b].map((p) => R(p, () => window.__trollOps.zrun().econ.cash)));
let [ca, cb] = await cash();
// (one of the host's up and out of the ground on B's screen to shoot)
await until(b, () => window.__trollOps.zdir().zombies.some((q) => q.alive && !q.dying && q.riseT <= 0), null, 30000);
const killed = await R(b, () => {
  const T = window.__trollOps;
  const z = T.zdir().zombies.find((q) => q.alive && !q.dying && q.riseT <= 0);
  const point = z.mesh.position.clone(); point.y += 1.2;
  T.onBulletActorHit(z, { damage: 1e7, isHead: false, point, dir: new T.THREE.Vector3(0, 0, -1) });
  return z.nid;
});
check(await until(a, (nid) => { const z = window.__trollOps.zdir().zombies.find((q) => q.nid === nid); return !z || z.dying; }, killed, 5000), "B's kill drops it on the host");
check(await until(b, (c) => window.__trollOps.zrun().econ.cash > c, cb, 5000), "...and pays B");
let [ca2, cb2] = await cash();
check(ca2 === ca, "...not A", `${ca} -> ${ca2}`);
console.log(`  B ${cb} -> ${cb2}`);
const killedA = await R(a, () => {
  const T = window.__trollOps;
  const z = T.zdir().zombies.find((q) => q.alive && !q.dying && q.riseT <= 0);
  if (!z) return null;
  const point = z.mesh.position.clone(); point.y += 1.2;
  T.onBulletActorHit(z, { damage: 1e7, isHead: true, point, dir: new T.THREE.Vector3(0, 0, -1) });
  return z.nid;
});
check(!!killedA && await until(b, (nid) => { const z = window.__trollOps.zdir().zombies.find((q) => q.nid === nid); return !z || z.dying; }, killedA, 5000), "A's kill drops on B's screen");
const [ca3, cb3] = await cash();
check(ca3 > ca2 && cb3 === cb2, "A's kill pays A only", `A ${ca2} -> ${ca3}, B ${cb2} -> ${cb3}`);

// ---- 4. B's turret
const did = await R(b, () => {
  const T = window.__trollOps;
  const p = T.move.pos;
  const e = T.zrun().spawn("turret", p.x + 1.5, p.y, p.z);
  return e.did;
});
check(await until(a, (did) => window.__trollOps.zrun().dep.list.some((e) => e.did === did), did, 5000), "B's turret stands on the host");
const tur = await R(a, (did) => { const R = window.__trollOps.zrun(); const e = R.dep.list.find((q) => q.did === did); return { owner: e.owner, mine: e.mine, cosmetic: R.dep.cosmetic }; }, did);
check(!tur.mine && !!tur.owner && !tur.cosmetic, "the host runs it for real, as B's", JSON.stringify(tur));
check(await R(b, () => window.__trollOps.zrun().dep.cosmetic), "on B it's for show");
// bring a zombie to it on the host: its kill pays B
[, cb] = await cash();
await R(a, (did) => {
  const T = window.__trollOps;
  const e = T.zrun().dep.list.find((q) => q.did === did);
  const z = T.zdir().zombies.find((q) => q.alive && !q.dying && q.riseT <= 0);
  if (z) { z.mesh.position.set(e.pos.x + 4, e.pos.y, e.pos.z); z.groundY = e.pos.y; z.hp = 30; }
}, did);
check(await until(b, (c) => window.__trollOps.zrun().econ.cash > c, cb, 15000), "the turret's kill pays B");
await page_shot(b, "zcoop-b");

// ---- 5. the break and the vote
await R(a, () => { const z = window.__trollOps.zdir(); z.toSpawn = 0; for (const q of z.zombies) if (q.alive && !q.dying) { q.hp = 1; } });
await R(a, () => {
  const T = window.__trollOps;
  for (const q of T.zdir().zombies) if (q.alive && !q.dying) T.onBulletActorHit(q, { damage: 1e7, isHead: false, point: q.mesh.position.clone(), dir: new T.THREE.Vector3(0, 0, -1) });
});
check(await until(b, () => window.__trollOps.zdir().state === "between", null, 15000), "wave 1 cleared on B too");
await R(b, () => window.__trollOps.zrun().skip());
await sleep(800);
const vote = await R(b, () => ({ text: document.querySelector("#to-zh .zh-skip")?.textContent || "", state: window.__trollOps.zdir().state }));
check(/Votes 1\/2/.test(vote.text) && vote.state === "between", "B's vote alone: Votes 1/2, still the break", vote.text);
await scanText(b, check, "the break, voted");
await page_shot(b, "zcoop-vote");
await R(a, () => window.__trollOps.zrun().skip());
check(await until(b, () => window.__trollOps.zdir().round >= 2, null, 8000), "both voted: wave 2 on B");

// ---- 6. down, and picked up
await R(b, () => { const T = window.__trollOps; T.player.spawnGuard = 0; T.damagePlayer(9999); });
await until(b, () => /teammate/.test(document.querySelector("#to-zh .zh-down-k")?.textContent || ""), null, 5000);
const down = await R(b, () => ({ downed: window.__trollOps.zrun().run.downed, k: document.querySelector("#to-zh .zh-down-k")?.textContent || "" }));
check(down.downed, "B is down");
check(/teammate/.test(down.k), "no last stand in co-op: wait for a teammate", down.k);
await scanText(b, check, "down in co-op");
await page_shot(b, "zcoop-down");
check(await until(a, () => [...window.__trollOps.net.peers.values()].some((p) => p.downed === 1), null, 5000), "A sees B down");
const bFeet = await R(b, () => { const p = window.__trollOps.move.pos; return { x: p.x, y: p.y, z: p.z }; });
await R(a, (f) => { const T = window.__trollOps; T.move.pos.set(f.x + 0.8, f.y, f.z); T.keys.add("KeyX"); }, bFeet);
check(await until(a, () => !!window.__trollOps.zrun().coop.coop.revive, null, 3000), "A gets the revive prompt");
check(await until(a, () => window.__trollOps.zrun().coop.rings().some((r) => r.visible && r.k > 0), null, 3000), "A sees the revive ring under B, filling", JSON.stringify(await R(a, () => window.__trollOps.zrun().coop.rings())));
check(await until(b, () => !window.__trollOps.zrun().run.downed, null, 9000), "A holds X: B is back up");
await R(a, () => window.__trollOps.keys.delete("KeyX"));
check(await until(a, () => !window.__trollOps.zrun().coop.rings().some((r) => r.visible), null, 3000), "B up: the ring goes");

// ---- 7. the host leaves
await sleep(1500);
const before = await R(b, () => window.__trollOps.zdir().round);
await a.close();
check(await until(b, () => window.__trollOps.zrun().coop.coop.host, null, 15000), "A gone: B is the host");
console.log("  B after A left", JSON.stringify(await R(b, () => { const T = window.__trollOps; return { conn: T.net.connected, kind: T.net.transport?.kind, room: T.net.room, on: T.zrun().coop.coop.on, state: T.state() }; })));
const took = await R(b, () => { const z = window.__trollOps.zdir(); return { proxies: z.zombies.filter((q) => q.proxy).length, round: z.round, state: z.state }; });
check(took.proxies === 0 && took.round === before, "B carries on the same wave with the horde its own", JSON.stringify(took));
check(await until(b, () => window.__trollOps.zdir().zombies.some((q) => q.alive && !q.dying && !q.proxy && q.nid?.startsWith(window.__trollOps.net.id.slice(0, 4))), null, 30000), "B spawns the rest");

// ---- 8. a late joiner, and the loss
const c = await open("C");
await start(c, "trollcity", true);
await loaded(c);
await R(c, () => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
const cRole = () => R(c, () => { const T = window.__trollOps, k = T.zrun().coop.coop, me = T.net; return { round: T.zdir().round, state: T.zdir().state, on: k.on, host: k.host, heard: k.heard, conn: me.connected, id: me.id, hostId: me.hostId(), since: me.since, map: T.builtMap()?.map?.name, peers: [...me.peers.values()].filter((p) => !p.isBot).map((p) => ({ id: p.id, since: p.since, live: performance.now() - (p.stateAt || 0), slow: p.slow })) }; });
const cJoined = await until(c, (r) => window.__trollOps.zdir().round === r, before, 15000);
const bView = await R(b, async () => { const T = window.__trollOps; const f0 = T.zdir().zombies.map((q) => q.mesh.position.x).join(); const r0 = await new Promise((r) => { let n = 0; const t = performance.now(); const tick = () => { n++; if (performance.now() - t < 1000) requestAnimationFrame(tick); else r(n); }; requestAnimationFrame(tick); }); return { vis: document.visibilityState, rafPerSec: r0, conn: T.net.connected, state: T.state(), peers: [...T.net.peers.values()].filter((p) => !p.isBot).map((p) => p.id), sinceA: T.net.since }; });
check(cJoined, "C joins on the run's wave", JSON.stringify(await cRole()) + " B: " + JSON.stringify(bView));
check(await until(c, () => window.__trollOps.zdir().zombies.some((q) => q.proxy), null, 15000), "C gets the horde");
console.log("  B with C in", JSON.stringify(await R(b, () => { const T = window.__trollOps; return { conn: T.net.connected, kind: T.net.transport?.kind, room: T.net.room, peers: [...T.net.peers.values()].filter((p) => !p.isBot).map((p) => p.id) }; })), "C room", await R(c, () => window.__trollOps.net.room));
await R(b, () => { const T = window.__trollOps; T.player.spawnGuard = 0; T.damagePlayer(9999); });
await R(c, () => { const T = window.__trollOps; T.player.spawnGuard = 0; T.damagePlayer(9999); });
check(await until(b, () => window.__trollOps.state() === "gameover", null, 10000), "both down: B's run is lost");
check(await until(c, () => window.__trollOps.state() === "gameover", null, 10000), "...and C's");

check(errors.length === 0, "no page errors", errors.slice(0, 4).join(" | "));
console.log(fails ? `${fails} FAILED` : `ALL PASS · shots in ${SHOTS}`);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);

async function page_shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}${TAG}.png`) }).catch(() => {});
}
