// The Make it rain emote (characters/emotes.js, weapons/money-gun.js, doc
// MONEY-RAIN.md 3). Two tabs in one headless browser join the same private
// room on Kabukigrin over BroadcastChannel (Supabase blocked), like
// troll-ops-emote-test.mjs:
//
//   1. the emote is the wheel's last slice (older wire codes unchanged)
//   2. A plays it: first person, the gun in the streak-arm hand, bills out
//      of the club's pool
//   3. B gets the code on the wire, A's rig holds the gun and sprays on B's
//      screen too (nothing more on the wire)
//   4. a third tab wearing TROLLS #1718 plays it: the gun in the block fist
//   5. no page errors
//
// OUT=<dir> saves: money-gun-fp-stick.png, money-gun-fp-1718.png (the
// first-person hip shots), money-gun-tp.png (B watching A), money-gun-side.png
// (the gun side on, plain background) and money-gun-side-vs-ref.png (that
// beside the reference photo, rule 10).
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-money-gun-test.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT || null;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());   // never a live room
const ROOM = "MGN" + Math.floor(Math.random() * 90 + 10);
const errors = [];
let fails = 0;
const check = (name, ok, info = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`); if (!ok) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name) => OUT && page.screenshot({ path: path.join(OUT, name) });

async function open(label, body = null) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  if (body) await page.addInitScript((b) => localStorage.setItem("trollops:cosmetics", JSON.stringify({ face: "grin:og", body: b })), body);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async (room) => {
    const T = window.__trollOps;
    window.TrollrunnerAccounts = window.TrollrunnerAccounts || {};
    window.TrollrunnerAccounts.getCachedProfile = () => ({ username: "troll_runner" });
    window.dispatchEvent(new Event("trollrunner:auth-changed"));
    T.setMode("tdm"); T.loadout.mapId = "kabukigrin";
    if (T.els.noBots) T.els.noBots.checked = true;
    T.els.room.value = room; T.els.room.dispatchEvent(new Event("input"));
    await T.startGame();
  }, ROOM);
  return page;
}
async function place(page, x, z, yaw, pitch = 0) {
  await page.evaluate(({ x, z, yaw, pitch }) => {
    const T = window.__trollOps;
    T.move.pos.set(x, 0, z); T.player.pos.x = x; T.player.pos.z = z;
    if (T.move.velocity) T.move.velocity.set(0, 0, 0);
    T.player.spawnGuard = 999; T.player.hp = T.player.maxHp || 100;
    T.look.yaw = yaw; T.look.pitch = pitch;
  }, { x, z, yaw, pitch });
}
const money = (page) => page.evaluate(() => {
  const d = window.__trollOps.builtMap().map.debug().money;
  return d && { emitted: d.emitted, air: d.air, lying: d.lying.length };
});

const A = await open("A");
const B = await open("B");
await Promise.all([A, B].map((p) => p.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 60000 })));
await Promise.all([A, B].map((p) => p.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); })));
await wait(12000);
const mapId = await A.evaluate(() => window.__trollOps.loadedMapId());
check("both are in Kabukigrin's club", mapId === "kabukigrin", mapId);
const teamA = await A.evaluate(() => window.__trollOps.net.team);
await B.evaluate((t) => window.__trollOps.net.setTeam(t), teamA);
// on the dance floor: A at its south edge facing north, B 3 m north of A facing back
await place(A, -23, 10, Math.PI, 0.1);
await place(B, -23, 13, 0, -0.05);
await wait(1500);

// ---- 1. the wheel
const MG = await A.evaluate(() => window.__trollOps.emoteWheel.slices.findIndex((b) => b.textContent.includes("Make it rain")));
const last = await A.evaluate(() => window.__trollOps.emoteWheel.slices.length - 1);
check("Make it rain is on the wheel, last (older codes unchanged)", MG >= 23 && MG === last, `slice ${MG} of ${last}`);

// ---- 2. A plays it
const aId = await A.evaluate(() => window.__trollOps.net.id);
const mA0 = await money(A), mB0 = await money(B);
await A.evaluate((i) => window.__trollOps.setEmote(i), MG);
await wait(1600);
const fp = await A.evaluate(() => {
  const T = window.__trollOps, e = T.emote();
  const gun = T.streakArms.getObjectByName("money-gun");
  return { idx: e?.idx, t: e?.t, rigHidden: T.localRig.root.visible === false, gun: !!gun, visible: !!gun?.visible, pos: gun && gun.position.toArray().map((v) => +v.toFixed(2)) };
});
check("A stays in first person with the gun in the hand", fp.idx === MG && fp.rigHidden && fp.gun && fp.visible, JSON.stringify(fp));
const mA1 = await money(A);
check("A's gun sprays bills into the club's pool", mA1.emitted > mA0.emitted && mA1.air > 0, JSON.stringify({ emitted: mA1.emitted - mA0.emitted, air: mA1.air }));
await shot(A, "money-gun-fp-stick.png");
if (OUT) await A.screenshot({ path: path.join(OUT, "money-gun-fp-crop.png"), clip: { x: 640, y: 330, width: 420, height: 390 } });   // the hand and gun, close

// ---- 3. B sees it
const wire = await B.evaluate((id) => window.__trollOps.net.peers.get(id)?.emote, aId);
check("the emote goes out on the wire (index+1)", wire === MG + 1, `em ${wire}`);
const tp = await B.evaluate(() => {
  const T = window.__trollOps;
  let gun = null;
  T.scene.traverse((o) => { if (o.name === "money-gun" && o.visible) gun = o; });
  if (!gun) return { gun: false };
  const w = new T.THREE.Vector3(); gun.getWorldPosition(w);
  return { gun: true, parent: gun.parent?.name || gun.parent?.type, y: +w.y.toFixed(2) };
});
check("on B's screen A's rig holds the gun", tp.gun && tp.y > 1.0, JSON.stringify(tp));
const mB1 = await money(B);
check("and it sprays on B's screen too (nothing more on the wire)", mB1.emitted > mB0.emitted, JSON.stringify({ emitted: mB1.emitted - mB0.emitted, air: mB1.air }));
await shot(B, "money-gun-tp.png");
if (OUT) await B.screenshot({ path: path.join(OUT, "money-gun-tp-crop.png"), clip: { x: 520, y: 230, width: 260, height: 280 } });   // the figure, close
// (the headless clock runs behind the wall clock: wait for the emote to run out)
let after;
for (let t = 0; t < 40; t++) {
  await wait(500);
  after = await A.evaluate(() => ({ emote: window.__trollOps.emote(), gun: !!window.__trollOps.streakArms.getObjectByName("money-gun")?.visible }));
  if (!after.emote) { await wait(600); after = await A.evaluate(() => ({ emote: window.__trollOps.emote(), gun: !!window.__trollOps.streakArms.getObjectByName("money-gun")?.visible })); break; }
}
check("the emote ends and the gun goes away", !after.emote && !after.gun, JSON.stringify(after));

// ---- 4. the gun side on, beside the reference (rule 10), drawn in A off
// its own little scene
if (OUT) {
  const sheet = await A.evaluate(async () => {
    const THREE = window.__trollOps.THREE;
    const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes("/weapons/money-gun.js?v="));
    const { buildMoneyGun } = await import(url);
    const W = 900, H = 450;
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    r.setSize(W, H); r.setClearColor(0xe9e6df, 1);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 3, 1.5); scene.add(sun);
    const gun = buildMoneyGun(); scene.add(gun);
    const views = { side: [1, 0.075, -0.055], "34": [0.9, 0.5, -0.9], top: [0.001, 1.2, -0.055] };
    const out = {};
    for (const [k, p] of Object.entries(views)) {
      const cam = new THREE.OrthographicCamera(-0.15, 0.15, 0.075, -0.075, 0.01, 10);
      cam.position.set(p[0], p[1], p[2]); cam.lookAt(0, 0.065, -0.055);
      r.render(scene, cam);
      out[k] = r.domElement.toDataURL("image/png");
    }
    // the side render beside the reference photo, one sheet
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = "/assets/games/troll-ops/refs/arms/money-gun/cash-cannon-photo-1.jpg"; });
    const side = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = out.side; });
    const c = document.createElement("canvas"); c.width = W + img.width + 20; c.height = Math.max(H, img.height);
    const g = c.getContext("2d"); g.fillStyle = "#222"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0); g.drawImage(side, img.width + 20, 0);
    g.fillStyle = "#fff"; g.font = "16px sans-serif"; g.fillText("reference: Cash Cannon (Laughing Squid)", 10, c.height - 10); g.fillText("the game's build, side on", img.width + 30, c.height - 10);
    out.sheet = c.toDataURL("image/png");
    r.dispose();
    return out;
  });
  for (const [k, name] of [["side", "money-gun-side.png"], ["34", "money-gun-34.png"], ["top", "money-gun-top.png"], ["sheet", "money-gun-side-vs-ref.png"]]) {
    fs.writeFileSync(path.join(OUT, name), Buffer.from(sheet[k].split(",")[1], "base64"));
  }
  console.log("INFO  side, 3/4, top renders and the side-vs-reference sheet written");
}

// ---- 5. TROLLS #1718's block fist
const C = await open("C", "trolls-1718");
await C.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 180000 });
await C.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
await wait(8000);
await place(C, -21, 10, Math.PI, 0.1);
await wait(800);
await C.evaluate((i) => window.__trollOps.setEmote(i), MG);
await wait(1600);
const fp2 = await C.evaluate(() => {
  const T = window.__trollOps, gun = T.streakArms.getObjectByName("money-gun");
  return { idx: T.emote()?.idx, gun: !!gun?.visible, body: T.localRig.blocky?.token || 0 };
});
check("on a TROLLS body the gun's in the block fist", fp2.gun && fp2.body === 1718, JSON.stringify(fp2));
await shot(C, "money-gun-fp-1718.png");

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
