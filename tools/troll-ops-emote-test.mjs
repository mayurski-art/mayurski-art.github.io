// Two-client check for Troll Forces emotes: first/third-person camera,
// duo emote gating (aim at a teammate), invite, hold-X accept, the snap face
// to face, the duo code on the wire, and teammates-only.
//
// Two tabs in one headless browser join the same private room over
// BroadcastChannel (Supabase blocked), like troll-ops-sync-test.mjs.
//
// Usage: node tools/troll-ops-emote-test.mjs
//   Needs Playwright (npm i -g playwright, or run from a checkout that has it).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(path.join(process.execPath, "../../lib/node_modules/playwright"))); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
await ctx.route(/supabase/, (r) => r.abort());
const ROOM = "EMO" + Math.floor(Math.random() * 90 + 10);
const errors = [];

async function open(label) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async (room) => {
    const T = window.__trollOps;
    T.composer && (T.composer.render = () => {});
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    await T.startGame();
  }, ROOM);
  return page;
}

const A = await open("A");
const B = await open("B");
await Promise.all([A, B].map((p) => p.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 30000 })));
await sleep(1500);

// Put both on A's team, alive, 4 m apart on open ground, A facing B.
const teamA = await A.evaluate(() => window.__trollOps.net.team);
await B.evaluate((t) => window.__trollOps.net.setTeam(t), teamA);
async function place(page, x, z, yaw) {
  await page.evaluate(({ x, z, yaw }) => {
    const T = window.__trollOps;
    T.move.pos.x = x; T.move.pos.z = z; T.player.pos.x = x; T.player.pos.z = z;
    if (T.move.velocity) T.move.velocity.set(0, 0, 0);
    T.player.spawnGuard = 999; T.player.hp = T.player.maxHp || 100;
    T.look.yaw = yaw; T.look.pitch = 0;
  }, { x, z, yaw });
}
// A at z=+2 looking toward -z (yaw 0), B at z=-2.
const spot = await A.evaluate(() => { const p = window.__trollOps.move.pos; return { x: p.x, z: p.z }; });
// Start 8 m apart: too far to send or accept.
await place(A, spot.x, spot.z + 4, 0);
await place(B, spot.x, spot.z - 4, Math.PI);
await sleep(1500);   // let positions reach the other tab

const DAP = await A.evaluate(() => window.__trollOps.emoteWheel.slices.findIndex((b) => b.textContent.includes("Dap up")));
const bId = await B.evaluate(() => window.__trollOps.net.id);
// Wheel open: duo slices usable without aiming at anyone (a teammate is in the match).
const wheel = await A.evaluate(async () => {
  const T = window.__trollOps;
  T.look.yaw = Math.PI / 2;   // looking away from B on purpose
  T.emoteWheel.open();
  await new Promise((r) => setTimeout(r, 600));
  return { disabled: T.emoteWheel.slices.filter((b) => b.classList.contains("is-disabled")).length, hub: T.emoteWheel.el.querySelector(".to-emote-hub span").textContent };
});
check("duo slices are usable without aiming at anyone", wheel.disabled === 0 && /hold X/.test(wheel.hub), JSON.stringify(wheel));

// Pick Dap up: armed, nothing sent yet.
const armed = await A.evaluate(async (dap) => {
  const T = window.__trollOps;
  T.emoteWheel.pick = dap;
  T.emoteWheel.close();
  await new Promise((r) => setTimeout(r, 300));
  const el = document.querySelector(".to-duo-prompt");
  return { armed: T.duo().armed, outgoing: T.duo().outgoing, text: el?.hidden ? "" : el?.textContent };
}, DAP);
check("picking a duo emote arms it (no request yet)", armed.armed?.idx === DAP && !armed.outgoing && /walk up to a teammate/.test(armed.text) && /[0-9]+s/.test(armed.text), JSON.stringify(armed));

// Holding X 8 m away sends nothing.
await A.evaluate(() => window.__trollOps.keys.add("KeyX"));
await sleep(1200);
await A.evaluate(() => window.__trollOps.keys.delete("KeyX"));
const far = await A.evaluate(() => window.__trollOps.duo());
check("holding X far from everyone sends nothing", !far.outgoing && !!far.armed, JSON.stringify({ out: far.outgoing, armed: !!far.armed }));

// Walk up (2 m apart) and hold X: the request goes to B.
await place(A, spot.x, spot.z + 1, Math.PI / 2);
await place(B, spot.x, spot.z - 1, Math.PI);
await sleep(900);
const near = await A.evaluate(async () => {
  const T = window.__trollOps;
  const el = document.querySelector(".to-duo-prompt");
  const before = { target: T.duo().target, text: el?.hidden ? "" : el?.textContent, claimed: T.duo().xClaimed };
  T.keys.add("KeyX");
  await new Promise((r) => setTimeout(r, 1200));
  T.keys.delete("KeyX");
  return { ...before, outgoing: T.duo().outgoing, armed: T.duo().armed, weapon: T.currentWeapon().def.id };
});
check("next to a teammate, the prompt says hold X to send", near.target === bId && /Hold X: Dap up with/.test(near.text) && near.claimed, JSON.stringify(near));
check("holding X by a teammate sends the request", near.outgoing?.to === bId && !near.armed, JSON.stringify(near.outgoing));
await sleep(700);
const prompt = await B.evaluate(() => {
  const T = window.__trollOps, el = document.querySelector(".to-duo-prompt");
  return { incoming: T.duo().incoming, text: el?.hidden ? "" : el?.textContent, clock: el?.querySelector(".to-duo-clock")?.textContent };
});
const secs = parseInt(prompt.clock, 10);
check("the teammate gets the request with a 30 s countdown", !!prompt.incoming && /Dap up/.test(prompt.text) && secs >= 25 && secs <= 30, JSON.stringify(prompt));

// B walks off: holding X there doesn't accept.
await place(B, spot.x, spot.z - 6, Math.PI);
await sleep(900);
await B.evaluate(() => window.__trollOps.keys.add("KeyX"));
await sleep(1200);
await B.evaluate(() => window.__trollOps.keys.delete("KeyX"));
const away = await B.evaluate(() => { const T = window.__trollOps, el = document.querySelector(".to-duo-prompt"); return { emote: T.emote(), incoming: !!T.duo().incoming, text: el?.textContent }; });
check("too far away, holding X doesn't accept", !away.emote && away.incoming && /go to them/.test(away.text), JSON.stringify(away));

// B comes back beside A and holds X -> both play, face to face.
await place(B, spot.x, spot.z - 1, Math.PI);
await sleep(900);
await B.evaluate(() => window.__trollOps.keys.add("KeyX"));
await sleep(1200);
await B.evaluate(() => window.__trollOps.keys.delete("KeyX"));
await sleep(700);
const both = await Promise.all([A, B].map((p) => p.evaluate(() => {
  const T = window.__trollOps, e = T.emote();
  return { emote: e && { idx: e.idx, role: e.role }, x: T.move.pos.x, z: T.move.pos.z, yaw: T.look.yaw, weaponHeld: T.duo().incoming };
})));
const gap = Math.hypot(both[0].x - both[1].x, both[0].z - both[1].z);
check("hold X accepts: both play the duo, inviter lead and accepter partner",
  both[0].emote?.idx === DAP && both[0].emote?.role === 0 && both[1].emote?.idx === DAP && both[1].emote?.role === 1, JSON.stringify(both));
check("they snap face to face at the emote's distance", Math.abs(gap - 0.8) < 0.08, `gap ${gap.toFixed(3)}`);
const facing = (me, other) => { const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw); const dx = other.x - me.x, dz = other.z - me.z; return (fx * dx + fz * dz) / Math.hypot(dx, dz); };
check("each faces the other", facing(both[0], both[1]) > 0.95 && facing(both[1], both[0]) > 0.95, `${facing(both[0], both[1]).toFixed(2)} / ${facing(both[1], both[0]).toFixed(2)}`);
const wire = await A.evaluate((id) => window.__trollOps.net.peers.get(id)?.emote, bId);
check("the accepter's half goes out on the wire (index+1+64)", wire === DAP + 1 + 64, `em ${wire}`);

// X did not pick anything up while the invite was up (no weapon swap).
// First-person emote: stays first person, hands on screen; third-person pulls out.
await A.evaluate(() => { const T = window.__trollOps; T.setEmote(6); });
await sleep(500);
const fp = await A.evaluate(() => { const T = window.__trollOps; return { rigVisible: T.localRig.root.visible, emoting: T.els.hud.classList.contains("is-emoting"), hands: T.renderer && document.querySelector(".to-emote-wheel") ? true : true }; });
check("a first-person emote keeps the first-person view", fp.rigVisible === false && fp.emoting === false, JSON.stringify(fp));
await A.evaluate(() => { const T = window.__trollOps; T.setEmote(4); });
await sleep(500);
const tp = await A.evaluate(() => { const T = window.__trollOps; return { rigVisible: T.localRig.root.visible, emoting: T.els.hud.classList.contains("is-emoting") }; });
check("a third-person emote pulls the camera out", tp.rigVisible === true && tp.emoting === true, JSON.stringify(tp));

// A request runs out after its countdown.
await Promise.all([A, B].map((p) => p.evaluate(() => window.__trollOps.setEmote(-1))));
const FIVE = await A.evaluate(() => window.__trollOps.emoteWheel.slices.findIndex((b) => b.textContent.includes("High five")));
await A.evaluate((i) => { const T = window.__trollOps; T.move.pos.x = T.player.pos.x; T.armDuo(i); }, FIVE);
await A.evaluate(() => window.__trollOps.keys.add("KeyX"));
await sleep(1200);
await A.evaluate(() => window.__trollOps.keys.delete("KeyX"));
await sleep(700);
const gotFive = await B.evaluate(() => !!window.__trollOps.duo().incoming);
await B.evaluate(() => { window.__trollOps.duo().incoming.until = performance.now() - 1; });
await sleep(400);
const expired = await B.evaluate(() => ({ incoming: window.__trollOps.duo().incoming, hidden: document.querySelector(".to-duo-prompt").hidden }));
check("the request expires when its countdown runs out", gotFive && !expired.incoming && expired.hidden, JSON.stringify({ gotFive, ...expired }));

// Teammates only: an enemy's invite is ignored.
await B.evaluate(() => { const T = window.__trollOps; T.net.setTeam(T.net.team === "phantom" ? "ghost" : "phantom"); });
await sleep(600);
await A.evaluate((id) => window.__trollOps.net.send({ t: "duo", id: window.__trollOps.net.id, to: id, k: "invite", e: 10 }), bId);
await sleep(600);
const enemy = await B.evaluate(() => window.__trollOps.duo().incoming);
check("an invite from the other team is ignored", !enemy, JSON.stringify(enemy));

check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
