// Troll Forces zombies deployables check (Zombie Rush P2, the Rookie kit):
// the Deployables column's three cards and prices, picking one by key (a
// tap, and a hold for grid mode), the ghost, putting it down (cash, the
// next price up, a collider, a blocker), a barricade the horde has to chew
// through while its spikes bite, a turret that finds and kills a zombie, a
// barrel that goes up and sets off the one beside it, health bars, a
// deployable broken, and the run's end clearing the lot. Text-overlap scans
// in each state. Solo, no network.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-zdeploy-test.mjs [mapId]
//   PHONE=1 for a landscape phone; SHOTS_DIR=<dir> for the screenshots
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { textClash as scanText } from "./troll-ops-text-scan.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const PHONE = !!process.env.PHONE;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext(PHONE
  ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
  : { viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const map = process.argv[2] || "hollowgrin";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: path.join(SHOTS, `zdep-${name}${PHONE ? "-phone" : ""}.png`) });

const page = await ctx.newPage();
const textClash = (when) => scanText(page, check, when);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async (map) => {
  const T = window.__trollOps;
  T.setMode("zombies");
  T.loadout.poolMapId = map;
  await T.startGame();
  if (T.isStaging?.()) T.endStaging();
}, map);
await page.waitForFunction(() => !!window.__trollOps.zdir() && window.__trollOps.zdir().round >= 1, null, { timeout: 120000 });

// A quiet field: no horde unless we send one, a long break, deep pockets.
const baseColliders = await page.evaluate(() => {
  const T = window.__trollOps;
  const zd = T.zdir();
  for (const z of zd.zombies) if (z.alive && !z.dying) z.takeDamage(1e9, false);
  zd.toSpawn = 0;
  zd.state = "fighting";
  zd.breakLen = 9999;
  T.player.hp = 1e9;
  T.zrun().giveCash(20000);
  return T.colliders.filter((c) => !c.deploy).length;
});
await page.waitForFunction(() => window.__trollOps.zdir().state === "between", null, { timeout: 30000 });
await page.evaluate(() => { const zd = window.__trollOps.zdir(); zd.zombies.forEach((z) => z.dispose(zd.scene)); zd.zombies = []; });

/* One walker, standing where we say, tough enough to watch (hp). */
const zombieAt = (x, z, hp = null) => page.evaluate(async ({ x, z, hp }) => {
  const T = window.__trollOps;
  const zd = T.zdir();
  zd.forceType = "walker";
  zd.toSpawn = 1;
  zd.state = "fighting";
  zd.spawnCd = 0;
  const t0 = performance.now();
  while (!zd.zombies.some((q) => q.alive && !q.dying) && performance.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 50));
  const q = zd.zombies.find((q) => q.alive && !q.dying);
  if (!q) return null;
  q.riseT = 0;
  q.mesh.position.set(x, T.move.pos.y, z);
  q.groundY = T.move.pos.y;
  if (hp) { q.maxHp = hp; q.hp = hp; }
  return q.id;
}, { x, z, hp });
const zombie = (id) => page.evaluate((id) => {
  const q = window.__trollOps.zdir().zombies.find((q) => q.id === id);
  return q ? { hp: q.hp, max: q.maxHp, dying: q.dying || !q.alive, x: q.mesh.position.x, z: q.mesh.position.z } : { dying: true, gone: true };
}, id);
const clearZombies = () => page.evaluate(() => {
  const zd = window.__trollOps.zdir();
  zd.zombies.forEach((z) => z.dispose(zd.scene)); zd.zombies = []; zd.toSpawn = 0; zd.state = "between"; zd.breakT = 9999;
});

/* Face somewhere the ghost fits (an open bit of map in front). */
const faceOpen = () => page.evaluate(async () => {
  const T = window.__trollOps;
  for (let i = 0; i < 24; i++) {
    T.look.yaw = (i / 24) * Math.PI * 2;
    await new Promise((r) => setTimeout(r, 60));
    if (T.zrun().dep.placing?.ok) return T.look.yaw;
  }
  return null;
});

// ---- the column
const col = await page.evaluate(() => ({
  cards: [...document.querySelectorAll(".zh-card-dep")].map((c) => c.querySelector(".zh-title").textContent + " " + c.querySelector(".zh-price").textContent + " " + c.querySelector(".zh-sub").textContent),
  head: document.querySelector(".zh-dep .zh-col-h")?.textContent,
}));
check(col.cards.length === 3, "three deployable cards", col.cards.join(" | "));
check(/^Turret \$120 0 \/ 3/.test(col.cards[0] || "") && /^Barricade \$150/.test(col.cards[1] || "") && /^Barrel \$90/.test(col.cards[2] || ""), "turret $120, barricade $150, barrel $90");
check(col.head === "Deployables", "the column says Deployables");

// ---- picking: a tap of 7 picks the turret, held 8 picks the barricade in grid mode
await page.keyboard.press("Digit7");
await page.waitForFunction(() => !document.querySelector(".zh-chip").hidden, null, { timeout: 3000 }).catch(() => {});
const pick = await page.evaluate(() => {
  const p = window.__trollOps.zrun().dep.placing;
  return { id: p?.id, grid: p?.grid, ghost: !!p?.ghost.parent, chip: !document.querySelector(".zh-chip").hidden, chipText: document.querySelector(".zh-chip-t").textContent };
});
check(pick.id === "turret" && !pick.grid && pick.ghost, "7 picks the turret, a ghost in the world");
check(pick.chip && /Placing Auto Turret/.test(pick.chipText), "the placing chip says so", pick.chipText);
const yaw = await faceOpen();
check(yaw != null, "somewhere in front it fits (green)");
await shot("ghost");
await textClash("placing");
await page.evaluate(() => window.__trollOps.zrun().cancel());
await sleep(150);
check(await page.evaluate(() => !window.__trollOps.zrun().dep.placing && document.querySelector(".zh-chip").hidden), "cancel puts it away");

await page.keyboard.down("Digit8");
await sleep(450);
await page.keyboard.up("Digit8");
await sleep(100);
const gridPick = await page.evaluate(() => {
  const p = window.__trollOps.zrun().dep.placing;
  return p ? { id: p.id, grid: p.grid, x: p.spot?.x, z: p.spot?.z, yaw: p.spot?.yaw } : null;
});
check(gridPick?.id === "barricade" && gridPick.grid, "held 8 picks the barricade in grid mode");
check(gridPick && Number.isInteger(gridPick.x) && Number.isInteger(gridPick.z) && Math.abs(gridPick.yaw / (Math.PI / 2) - Math.round(gridPick.yaw / (Math.PI / 2))) < 1e-6, "grid mode snaps to whole metres and right angles", JSON.stringify(gridPick));

// ---- the barricade: down, paid for, and in the way
await faceOpen();
const placed = await page.evaluate(() => {
  const T = window.__trollOps; const R = T.zrun();
  const before = R.econ.cash;
  const ok = R.place();
  const e = R.dep.list.find((q) => q.id === "barricade");
  return { ok, paid: before - R.econ.cash, next: R.deployOffers()[1].price, colliders: T.colliders.filter((c) => c.deploy).length, blockers: T.zdir().blockers.length, pos: e && { x: e.pos.x, z: e.pos.z }, yaw: e?.yaw };
});
check(placed.ok && placed.paid === 150, "the barricade costs $150", String(placed.paid));
check(placed.next === 180, "the next one costs $180", String(placed.next));
check(placed.colliders >= 2 && placed.blockers === placed.colliders, "it stands as colliders and blockers", `${placed.colliders}/${placed.blockers}`);

// a tough zombie on the far side, walking at us through it
const far = await page.evaluate(({ x, z, yaw }) => ({ x: x - Math.sin(yaw) * 2.2, z: z - Math.cos(yaw) * 2.2 }), placed.pos ? { ...placed.pos, yaw: placed.yaw } : { x: 0, z: 0, yaw: 0 });
const bz = await zombieAt(far.x, far.z, 100000);
check(!!bz, "a zombie behind the barricade");
const chew = await page.waitForFunction(() => {
  const e = window.__trollOps.zrun().dep.list.find((q) => q.id === "barricade");
  return e && e.hp < e.maxHp;
}, null, { timeout: 15000 }).then(() => true).catch(() => false);
check(chew, "the zombie swings at the barricade");
await page.waitForFunction((id) => { const q = window.__trollOps.zdir().zombies.find((q) => q.id === id); return q && q.hp < q.maxHp; }, bz, { timeout: 4000 }).catch(() => {});
const bzs = await zombie(bz);
check(bzs.hp < bzs.max, "the spikes bite it", `${Math.round(bzs.hp)}/${bzs.max}`);
const through = await page.evaluate(({ x, z }) => {
  const T = window.__trollOps; const q = T.zdir().zombies.find((q) => q.alive);
  const yaw = T.zrun().dep.list.find((e) => e.id === "barricade").yaw;
  // how far past the wall's line (toward us) it got: negative = still behind it
  return q ? (q.mesh.position.x - x) * Math.sin(yaw) + (q.mesh.position.z - z) * Math.cos(yaw) : null;
}, placed.pos);
check(through != null && through < 0.9, "it hasn't got through", through?.toFixed(2));
await shot("barricade");
await textClash("a barricade under attack");
const bars = await page.evaluate(() => ({
  zombie: [...document.querySelectorAll(".zh-wbar.is-zombie")].filter((e) => e.style.display !== "none").length,
  deploy: [...document.querySelectorAll(".zh-wbar.is-deploy")].filter((e) => e.style.display !== "none").length,
}));
check(bars.zombie >= 1, "a hurt zombie shows a health bar");
check(bars.deploy >= 1, "the hurt barricade shows one too");
await page.evaluate(() => { const R = window.__trollOps.zrun(); R.dep.list.find((e) => e.id === "barricade").hit(1e6); });
const broke = await page.evaluate(() => ({ left: window.__trollOps.zrun().dep.list.length, colliders: window.__trollOps.colliders.filter((c) => c.deploy).length, blockers: window.__trollOps.zdir().blockers.length }));
check(broke.left === 0 && broke.colliders === 0 && broke.blockers === 0, "broken, it's gone: no collider, no blocker", JSON.stringify(broke));
await clearZombies();

// ---- the turret: finds a zombie in range and kills it, and pays
await page.keyboard.press("Digit7");
await sleep(120);
await faceOpen();
const tur = await page.evaluate(() => {
  const R = window.__trollOps.zrun();
  const ok = R.place();
  const e = R.dep.list.find((q) => q.id === "turret");
  return { ok, x: e?.pos.x, z: e?.pos.z, yaw: e?.yaw, next: R.deployOffers()[0].price };
});
check(tur.ok, "the turret goes down");
check(tur.next === 160, "the next turret costs $160", String(tur.next));
const cashBefore = await page.evaluate(() => window.__trollOps.zrun().econ.cash);
const tz = await zombieAt(tur.x - Math.sin(tur.yaw) * 8, tur.z - Math.cos(tur.yaw) * 8);
const killed = await page.waitForFunction((id) => !window.__trollOps.zdir().zombies.some((q) => q.id === id && q.alive && !q.dying), tz, { timeout: 15000 }).then(() => true).catch(() => false);
check(killed, "the turret kills a zombie 8 m out");
const paid = await page.evaluate((c) => window.__trollOps.zrun().econ.cash - c, cashBefore);
check(paid >= 15, "its kill pays", `+$${paid}`);
const tag = await page.evaluate(() => [...document.querySelectorAll(".zh-wtag")].filter((e) => e.offsetParent && e.textContent).map((e) => e.textContent));
check(tag.includes("Lvl. 1"), "the turret carries Lvl. 1", tag.join(","));
// a second, tough one: catch it mid-burst for the picture
await zombieAt(tur.x - Math.sin(tur.yaw) * 7, tur.z - Math.cos(tur.yaw) * 7, 100000);
await sleep(900);
await shot("turret");
await textClash("a turret firing");
await page.evaluate(() => window.__trollOps.zrun().dep.list.forEach((e) => e.remove()));
await clearZombies();

// ---- barrels: one goes up, the one beside it follows, the zombie between dies
const boom = await page.evaluate(async () => {
  const T = window.__trollOps; const R = T.zrun();
  const yaw = T.look.yaw, x = T.move.pos.x - Math.sin(yaw) * 5, z = T.move.pos.z - Math.cos(yaw) * 5;
  const y = T.move.pos.y;
  const a = R.spawn("barrel", x, y, z, yaw);
  const b = R.spawn("barrel", x + Math.cos(yaw) * 1.6, y, z - Math.sin(yaw) * 1.6, yaw);
  return { x, z, a: !!a, b: !!b };
});
const vz = await zombieAt(boom.x + Math.sin(boom.x) * 0, boom.z + 0.9);
const cashB = await page.evaluate(() => window.__trollOps.zrun().econ.cash);
await page.evaluate(() => window.__trollOps.zrun().dep.list[0].hit(100));
await sleep(600);
const after = await page.evaluate(({ c, id }) => {
  const T = window.__trollOps;
  return {
    barrels: T.zrun().dep.list.length,
    deployColliders: T.colliders.filter((x) => x.deploy).length,
    dead: !T.zdir().zombies.some((q) => q.id === id && q.alive && !q.dying),
    paid: T.zrun().econ.cash - c,
    hp: T.player.hp,
  };
}, { c: cashB, id: vz });
check(after.barrels === 0, "both barrels went up (the second one chained)", String(after.barrels));
check(after.deployColliders === 0, "and left no colliders");
check(after.dead && after.paid >= 15, "the zombie by them died and paid", `+$${after.paid}`);
check(after.hp === 1e9, "the blast spares you");
await clearZombies();

// ---- not enough cash: refused
const poor = await page.evaluate(() => { const R = window.__trollOps.zrun(); R.econ.cash = 10; return R.deploy("turret"); });
check(poor === false, "no cash, no turret");

// ---- the run ends: the lot goes
await page.evaluate(() => { const R = window.__trollOps.zrun(); R.econ.cash = 5000; R.spawn("turret", window.__trollOps.move.pos.x + 3, window.__trollOps.move.pos.y, window.__trollOps.move.pos.z, 0); });
await page.evaluate(() => { const T = window.__trollOps; T.damagePlayer(1e12, null, null, false, null); T.zrun().run.bleedT = 0.05; });
await page.waitForFunction(() => window.__trollOps.state() === "gameover", null, { timeout: 15000 }).catch(() => {});
const end = await page.evaluate(() => ({ list: window.__trollOps.zrun().dep.list.length, deploy: window.__trollOps.colliders.filter((c) => c.deploy).length, base: window.__trollOps.colliders.filter((c) => !c.deploy).length }));
check(end.list === 0 && end.deploy === 0, "game over clears the deployables");
check(end.base === baseColliders, "and leaves the map's colliders as they were", `${end.base}/${baseColliders}`);

check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
console.log(fails ? `${fails} FAILED` : "ALL PASS", "· shots in", SHOTS);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
