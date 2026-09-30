// The 2026-09-30 second fix list + two BO2 streaks: menu operator square to
// the camera, room-wide bot skill + veteran XP boost, controller layout card,
// melee reach, killcam melee, dead body instead of guns, Dragonfire and SAM
// Turret. Saves screenshots to SHOT_DIR if set.
//
// Usage: NODE_PATH=<global node_modules> node tools/troll-ops-fx3-test.mjs
// ANGLE=swiftshader in a headless Linux container (default d3d11).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail)})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOT = process.env.SHOT_DIR;

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: +(process.env.VW || 1280), height: +(process.env.VH || 720) } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await sleep(1500);

// --- menu operator
const op = await page.evaluate(() => {
  const ci = window.__trollOps.charInspector;
  return { yaw: ci.yaw, body: ci.humanoid.root.rotation.y, noGlance: !!ci.humanoid.noIdleGlance, spin: ci.autoSpin };
});
check("menu operator faces the camera square on", Math.abs(op.yaw) < 1e-6 && Math.abs(op.body - Math.PI) < 0.02 && !op.spin, op);
check("menu operator's face stays centred (no idle glances)", op.noGlance);
if (SHOT) await page.screenshot({ path: `${SHOT}/fx3-menu.png` });

// --- controller layout card
const pad = await page.evaluate(() => {
  const hosts = [...document.querySelectorAll("[data-pad-layout]")];
  const lobby = hosts[0];
  lobby.querySelector('.to-pad-picker [data-family="ps"]').click();
  const ps = lobby.querySelector(".to-pad-svg").textContent;
  lobby.querySelector('.to-pad-picker [data-family="xbox"]').click();
  const xb = lobby.querySelector(".to-pad-svg").textContent;
  return { hosts: hosts.length, svgs: document.querySelectorAll(".to-pad-svg").length, ps: ps.includes("✕") && ps.includes("R2"), xbox: xb.includes("RT") && xb.includes("LB"),
    emote: xb.includes("Emote wheel") && xb.includes("LS + RS") && xb.includes("swivel left") };
});
check("controller layout drawn in lobby Settings and the Esc menu", pad.hosts === 2 && pad.svgs === 2, pad);
check("button names follow the pad family (PlayStation / Xbox)", pad.ps && pad.xbox, pad);
check("controller: both sticks = emotes, one stick = swivel", pad.emote);
await page.evaluate(() => window.__trollOps.showLobbyPanel("controls"));
await sleep(400);
if (SHOT) await page.screenshot({ path: `${SHOT}/fx3-controls.png` });
await page.evaluate(() => window.__trollOps.showLobbyPanel("deploy"));

// --- cosmetics: face expression + tint on the menu operator, saved
const cos = await page.evaluate(async () => {
  const T = window.__trollOps;
  T.showLobbyPanel("cosmetics");
  await new Promise((r) => setTimeout(r, 300));
  document.querySelector('.to-cos-face[data-expr="sad"]').click();
  document.querySelector('.to-cos-tint[data-tint="pink"]').click();
  await new Promise((r) => setTimeout(r, 1200));
  const head = T.charInspector.humanoid.parts.head;
  return { face: T.charInspector.humanoid.face, local: T.localRig.face, color: head.material.color.getHexString(),
    sadMap: !!head.material.map?.image?.getContext, saved: localStorage.getItem("trollops:cosmetics"),
    live: !document.getElementById("to-char-view").style.display };
});
check("Cosmetics: sad face + pink tint on the menu operator and your body, saved", cos.face === "sad:pink" && cos.local === "sad:pink" && cos.color === "ff9fd4" && cos.sadMap && /sad:pink/.test(cos.saved) && cos.live, cos);
if (SHOT) await page.screenshot({ path: `${SHOT}/fx3-cosmetics.png` });
await page.evaluate(() => { document.querySelector('.to-cos-face[data-expr="grin"]').click(); document.querySelector('.to-cos-tint[data-tint="og"]').click(); window.__trollOps.showLobbyPanel("deploy"); });

// --- Sad trollface emote swaps the face, then gives it back
const sad = await page.evaluate(async () => {
  const T = window.__trollOps;
  const idx = T.emoteWheel.slices.length - 1;   // the newest emote, last in the list
  T.charInspector.playEmote(idx);
  for (let i = 0; i < 200 && !(T.charInspector.emote?.t > 0.3); i++) await new Promise((r) => setTimeout(r, 100));
  const during = T.charInspector.humanoid.parts.head.material.map?.image?.getContext ? "sad" : "grin";
  T.charInspector.emote = null;
  // The menu canvas may have no size at a small viewport (it never ticks
  // then), so put the rig back through its ordinary pose directly.
  const C = await import("/assets/games/troll-ops/character.js?v=to-fx3");
  C.poseHumanoid(T.charInspector.humanoid, { moving: false, pitch: 0, dt: 0.016, hold: "none" });
  const after = T.charInspector.humanoid.parts.head.material.map?.image?.getContext ? "sad" : "grin";
  return { during, after, name: T.emoteWheel.slices[idx]?.textContent };
});
check("Sad trollface emote wears the sad face, then the grin comes back", sad.during === "sad" && sad.after === "grin" && /Sad trollface/.test(sad.name || ""), sad);

// --- melee reach
const reach = await page.evaluate(() => ({ kb: window.__trollOps.MELEE_DEFS.keyboard.range, saber: window.__trollOps.MELEE_DEFS.trollsaber.range }));
check("keyboard + saber reach is arm + blade (2.0 / 2.2 m)", reach.kb === 2.0 && reach.saber === 2.2, reach);

// --- start a match with veteran bots
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.settings.botSkill = "veteran";
  document.getElementById("to-set-botskill").value = "veteran";
  document.getElementById("to-set-botskill").dispatchEvent(new Event("change", { bubbles: true }));
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = false;
  await T.startGame();
  if (T.isStaging()) T.endStaging();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && window.__trollOps.bots.bots.length > 0, null, { timeout: 60000 });
await sleep(2500);
const vet = await page.evaluate(() => {
  const T = window.__trollOps;
  return { skill: T.roomBotSkill(), bots: T.bots.bots.map((b) => b.skill), boost: T.veteranBoostOn(), xp: T.boostedXp(100),
    note: document.getElementById("to-set-botskill-note")?.textContent };
});
check("room bot skill is the host's (veteran), every bot built with it", vet.skill === "veteran" && vet.bots.every((s) => s === "veteran"), vet);
check("veteran bots pay +10% XP", vet.boost && vet.xp === 110, vet);

// --- killcam carries melee state
const kc = await page.evaluate(() => {
  const K = window.__trollOps.killcam;
  K.record(1000, "kc-test", { x: 0, y: 0, z: 0, yaw: 0, mid: "trollsaber", sw: 0.2, si: 1, bk: 0 });
  K.record(1000.05, "kc-test", { x: 0, y: 0, z: 0, yaw: 0, mid: "trollsaber", sw: 0.4, si: 1, bk: 0 });
  const s = K.sampleAt("kc-test", 1000.025, {});
  return { mid: s.mid, sw: s.sw, si: s.si };
});
check("killcam replays the swing (melee id + swing fraction interpolated)", kc.mid === "trollsaber" && Math.abs(kc.sw - 0.3) < 0.02 && kc.si === 1, kc);

// --- Swivel: running forward, a spin to the side that ends ~0.9 m over
const sw = await page.evaluate(async () => {
  const T = window.__trollOps;
  T.player.spawnGuard = 0;
  const yaw = T.look.yaw;
  T.move.velocity.set(-Math.sin(yaw) * 4.5, 0, -Math.cos(yaw) * 4.5);
  const p0 = T.move.pos.clone();
  const ok = T.trySwivel(-1);
  for (let i = 0; i < 300 && T.swivel.dir; i++) await new Promise((r) => setTimeout(r, 50));
  const d = T.move.pos.clone().sub(p0);
  const side = d.x * Math.cos(yaw) - d.z * Math.sin(yaw);   // + right, - left
  return { ok, side: +side.toFixed(2), done: !T.swivel.dir, seq: T.swivel.seq };
});
check("Swivel left: a spin that comes out ~0.9 m to the left", sw.ok && sw.done && sw.side < -0.6, sw);
const sw2 = await page.evaluate(() => { const T = window.__trollOps; T.move.velocity.set(0, 0, 0); return T.trySwivel(1); });
check("no swivel standing still (needs a forward run)", sw2 === false);

// --- Tablet dive into Lightning Strike's map
const dive = await page.evaluate(async () => {
  const T = window.__trollOps;
  T.streaks.grant("airstrike");
  T.callStreak("airstrike");
  const started = !!T.tabletDive();
  let maxDip = 0;
  for (let i = 0; i < 400 && !T.strikeTablet()?.isOpen; i++) { maxDip = Math.max(maxDip, T.tabletDiveDip()); await new Promise((r) => setTimeout(r, 50)); }
  const open = !!T.strikeTablet()?.isOpen;
  const flash = !!document.querySelector(".to-tablet-dive.is-on");
  T.cancelMark();
  return { started, open, flash, maxDip: +maxDip.toFixed(2) };
});
check("Lightning Strike: the view dives into the tablet, then the map opens", dive.started && dive.open && dive.flash && dive.maxDip > 0.2, dive);

// --- Dragonfire
await page.evaluate(() => {
  const T = window.__trollOps;
  T.player.spawnGuard = 0;
  T.streaks.grant("dragonfire");
  T.fireStreak("dragonfire");
  // Game time, not frames: a software-GL container draws a few fps.
  for (let i = 0; i < 30; i++) T.updateStreakEntities(0.05);
});
const dfOn = await page.waitForFunction(() => window.__trollOps.dragonfireView(), null, { timeout: 15000 }).then(() => true).catch(() => false);
if (!dfOn) console.log("DF state", await page.evaluate(() => { const T = window.__trollOps; const d = T.dragonfire(); return { d: !!d, age: d?.age, hp: d?.hp, alive: T.player.alive, errs: 0, ents: [...T.streakEntities.keys()] }; }), errors);
const df0 = await page.evaluate(() => { const d = window.__trollOps.dragonfire(); return { x: d.pos.x, y: d.pos.y, z: d.pos.z }; });
// Stick forward for 1.5 s of game time (dfIz is what updatePlayer hands the drone).
await page.evaluate(() => window.__trollOps.keys.add("KeyW"));
await page.waitForFunction(() => { const T = window.__trollOps; const d = T.dragonfire(); return d && Math.hypot(d.vel.x, d.vel.z) > 1; }, null, { timeout: 60000 }).catch(() => {});
await page.evaluate(() => { const T = window.__trollOps; for (let i = 0; i < 30; i++) T.updateStreakEntities(0.05); T.keys.delete("KeyW"); });
await sleep(1500);
const df1 = await page.evaluate(() => {
  const T = window.__trollOps; const d = T.dragonfire();
  const cam = T.camera.position;
  return { x: d.pos.x, y: d.pos.y, z: d.pos.z, camNear: cam.distanceTo(d.pos) < 1, hud: !document.querySelector(".to-df").hidden,
    body: T.localRig.root.visible, bodyAt: T.move.pos.distanceTo(d.pos) };
});
const moved = Math.hypot(df1.x - df0.x, df1.z - df0.z);
check("Dragonfire: in the pilot's seat (camera on the drone, feed up, body left behind)", df1.camNear && df1.hud && df1.body, df1);
check("Dragonfire flies off the stick", moved > 3, { moved: moved.toFixed(1) });
const shots = await page.evaluate(async () => {
  const T = window.__trollOps; let n = 0;
  for (let i = 0; i < 6; i++) { T.fireDragonfire(); n += T.dragonfire().rounds.length ? 1 : 0; T.dragonfire().fireT = 0; }
  return n;
});
check("Dragonfire's gun fires tracers", shots > 0, { shots });
if (SHOT) await page.screenshot({ path: `${SHOT}/fx3-dragonfire.png` });
// Shot down: the link ends and the view comes back.
await page.evaluate(() => { const T = window.__trollOps; T.shootDownAir(T.dragonfire().id, null, true); });
await sleep(300);
const dfEnd = await page.evaluate(() => ({ view: window.__trollOps.dragonfireView(), df: !!window.__trollOps.dragonfire() }));
check("a destroyed Dragonfire hands the view back", !dfEnd.view && !dfEnd.df, dfEnd);

// --- SAM Turret vs an enemy gunship
const samSet = await page.evaluate(() => {
  const T = window.__trollOps;
  const enemy = T.net.team === "phantom" ? "ghost" : "phantom";
  T.streaks.grant("samturret");
  T.fireStreak("samturret");
  T.spawnHelicopter({ id: "test-heli", seed: 40, owned: false, team: enemy });
  const sam = [...T.streakEntities.values()].find((e) => e.constructor.name === "SamTurret");
  return { sam: !!sam, team: T.net.team, enemy };
});
check("SAM Turret deployed", samSet.sam, samSet);
if (SHOT) { await sleep(1500); await page.screenshot({ path: `${SHOT}/fx3-sam.png` }); }
const downed = await page.evaluate(() => {
  const T = window.__trollOps;
  for (let i = 0; i < 600 && T.streakEntities.has("test-heli"); i++) T.updateStreakEntities(0.05);   // 30 s of game time
  return !T.streakEntities.has("test-heli");
});
const samInfo = await page.evaluate(() => {
  const s = [...window.__trollOps.streakEntities.values()].find((e) => e.constructor.name === "SamTurret");
  return s ? { target: s.targetId, lock: s.lockT, missiles: s.missiles.length, age: s.age } : null;
});
check("SAM Turret shoots an enemy gunship down", downed, samInfo);

// --- bots call Dragonfire and SAM Turrets
const botCalls = await page.evaluate(async () => {
  const T = window.__trollOps;
  const b = T.bots.bots.find((x) => x.alive);
  if (!b) return { none: true };
  const inPool = T.BOT_STREAK_POOL.includes("dragonfire") && T.BOT_STREAK_POOL.includes("samturret");
  if (!inPool) return { inPool };
  T.botFireStreak(b, "dragonfire");
  T.botFireStreak(b, "samturret");
  const ents = [...T.streakEntities.values()];
  const df = ents.find((e) => e.constructor.name === "Dragonfire" && e.botId === b.id);
  const sam = ents.find((e) => e.constructor.name === "SamTurret" && e.botId === b.id);
  const p0 = df ? df.pos.clone() : null;
  for (let i = 0; i < 60; i++) T.updateStreakEntities(0.05);
  return { df: !!df, sam: !!sam, flew: df && p0 ? +df.pos.distanceTo(p0).toFixed(1) : 0, piloting: !!b.piloting, log: T.botStreakLog.slice(-3).map((x) => x.id) };
});
check("bots call Dragonfire (and fly it, standing still) and SAM Turrets", botCalls.df && botCalls.sam && botCalls.flew > 1 && botCalls.piloting, botCalls);

// --- bots shoot enemy aircraft with their guns
const aa = await page.evaluate(() => {
  const T = window.__trollOps;
  const b = T.bots.bots.find((x) => x.alive && !x.piloting);
  if (!b) return { none: true };
  const enemy = b.team === "phantom" ? "ghost" : "phantom";
  // Earlier steps left SAM Turrets up; they'd take the gunship first.
  for (const [id, e] of [...T.streakEntities]) if (e.constructor.name === "SamTurret") { e.dispose(); T.streakEntities.delete(id); }
  const heli = T.spawnHelicopter({ id: "aa-heli", seed: 90, owned: true, team: enemy });
  for (let i = 0; i < 140; i++) T.updateStreakEntities(0.05);   // onto its orbit
  const hp0 = heli.hp;
  // Park the bot under the orbit with a clear sky and nobody else to fight.
  // Walk the bot round under the orbit (it moves every couple of seconds),
  // on the ground, so some spots have open sky over them.
  let shots = 0, noTarget = 0;
  for (let i = 0; i < 700 && T.streakEntities.has("aa-heli"); i++) {
    b.lastSeen = null;
    b.reloadT = 0;
    b.hp = 1e6;   // the gunship shoots back; keep the test about the bot's aim
    const ang = Math.floor(i / 40) * 1.1;
    const gx = heli.root.position.x + Math.cos(ang) * 8, gz = heli.root.position.z + Math.sin(ang) * 8;
    const gy = T.groundHeightAt(T.colliders, gx, gz, 40) ?? 0;
    b.pos.set(gx, gy, gz);
    b.groundY = gy;
    const before = heli.hp;
    T.updateBotAntiAir(0.05);
    T.updateStreakEntities(0.05);
    if (heli.hp < before) shots++;
    if (!b.aa) noTarget++;
  }
  return { hp0, hp: heli.hp, hits: shots, noTarget, down: !T.streakEntities.has("aa-heli"), inList: T.enemyAirFor(b.team, b.id).some((a) => a.id === "aa-heli"),
    staging: T.isStaging(), state: T.state(), alive: b.alive, melee: !!b.meleeOnly, air: !!b.airborne, pilot: b.piloting || null };
});
check("bots shoot enemy aircraft with their guns (a gunship takes real damage)", aa.hits >= 5 && aa.hp0 - aa.hp >= 80, aa);

// --- dying shows the body, not the guns
await page.evaluate(() => {
  const T = window.__trollOps;
  T.player.spawnGuard = 0;
  T.damagePlayer(999, null, "problem416");
});
await sleep(600);
await page.evaluate(() => { const T = window.__trollOps; if (T.killcam.active) T.killcam.cancel(); });
await sleep(800);
const dead = await page.evaluate(() => {
  const T = window.__trollOps;
  return { alive: T.player.alive, rig: T.weaponRig.visible, body: T.localRig.root.visible, held: T.localHeld.mesh ? T.localHeld.mesh.visible : false };
});
check("dead: no viewmodel guns, own body on screen, empty-handed", !dead.alive && !dead.rig && dead.body && !dead.held, dead);
if (SHOT) await page.screenshot({ path: `${SHOT}/fx3-dead.png` });

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} check(s) failed` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
