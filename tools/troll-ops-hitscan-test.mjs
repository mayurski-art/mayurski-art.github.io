// Troll Forces: your bullets are hitscan, the way Call of Duty's are
// (weapons/ballistics.js isHitscan). A head 300 m out, dead on the line, is
// hit on the first update with no drop; a round slower than a bullet (the
// launcher) still flies as a projectile; a thick wall stops a round, a thin
// one is punched through (damage cut) and the head behind it still hit; a
// tracer is drawn down the line; a scoped sniper's cone is zero.
//
// Usage: node tools/troll-ops-hitscan-test.mjs

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
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// the game's own copies (their tags from the files that import them)
const GAME = path.join(ROOT, "assets/games/troll-ops");
const tagOf = (file, mod) => fs.readFileSync(path.join(GAME, file), "utf8").match(new RegExp(`${mod}\\?v=([\\w-]+)`))[1];
const tags = { ballistics: tagOf("game.js", "ballistics\\.js"), weapons: tagOf("game.js", "/weapons\\.js") };

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const page = await browser.newPage();
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });

const out = await page.evaluate(async (tags) => {
  const THREE = window.__trollOps.THREE;
  const B = await import(`/assets/games/troll-ops/weapons/ballistics.js?v=${tags.ballistics}`);
  const { WEAPON_DEFS } = await import(`/assets/games/troll-ops/weapons/weapons.js?v=${tags.weapons}`);
  const scene = new THREE.Scene();
  // a 24 cm head at 300 m, 1.6 m up, straight down -Z from the eye
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial());
  head.position.set(0, 1.6, -300);
  head.userData.isHead = true;
  scene.add(head);
  head.updateMatrixWorld(true);
  const actor = { netId: "enemy" };
  const run = (def, colliders = [], frames = 1) => {
    const sys = new B.BulletSystem(scene, { maxBullets: 16 });
    const hits = [];
    sys.spawn({ origin: new THREE.Vector3(0, 1.6, 0), dir: new THREE.Vector3(0, 0, -1), def, ownerId: "player" });
    const ctx = { colliders, targetMeshes: [head], resolveTarget: (o) => (o === head ? actor : null),
      onActorHit: (a, info) => hits.push({ isHead: info.isHead, y: +info.point.y.toFixed(3), z: +info.point.z.toFixed(1), dmg: +info.damage.toFixed(1) }) };
    for (let f = 0; f < frames; f++) sys.update(1 / 60, ctx);
    const left = sys.bullets.map((b) => ({ cosmetic: b.cosmetic, straight: !!b.straight, range: Math.round(b.range) }));
    return { hits, left };
  };
  const deadpan = WEAPON_DEFS.deadpan, launcher = Object.values(WEAPON_DEFS).find((d) => (d.muzzleVelocity || 700) < 100);
  const wall = (thick, pen) => [{ min: new THREE.Vector3(-5, 0, -150 - thick), max: new THREE.Vector3(5, 5, -150), pen }];
  return {
    hitscan: { deadpan: B.isHitscan(deadpan), launcher: launcher && B.isHitscan(launcher), launcherId: launcher?.id },
    clear: run(deadpan),
    launcherRun: launcher ? run(launcher) : null,
    thick: run(deadpan, wall(2, 5)),
    thin: run(deadpan, wall(0.1, 1)),
    sniperAds: Object.values(WEAPON_DEFS).filter((d) => d.cls === "sniper").map((d) => [d.id, d.spreadAds]),
  };
}, tags);

const c = out.clear;
check("a sniper round is hitscan, a launcher's isn't", out.hitscan.deadpan && out.hitscan.launcher === false, JSON.stringify(out.hitscan));
check("a head 300 m out is hit on the first frame", c.hits.length === 1 && c.hits[0].isHead && Math.abs(c.hits[0].z - (-300 + 0.12)) < 0.2, JSON.stringify(c.hits));
check("no drop: it lands at eye height", c.hits[0] && Math.abs(c.hits[0].y - 1.6) < 0.02, JSON.stringify(c.hits[0]));
check("a straight cosmetic tracer flies the line to the hit", c.left.length === 1 && c.left[0].cosmetic && c.left[0].straight && Math.abs(c.left[0].range - 300) <= 1, JSON.stringify(c.left));
const l = out.launcherRun;
check("the launcher's round is still in the air after a frame", !l || (l.hits.length === 0 && l.left.length === 1 && !l.left[0].cosmetic), JSON.stringify(l));
check("a 2 m wall it can't punch stops it", out.thick.hits.length === 0, JSON.stringify(out.thick));
check("a thin wall is punched, the head behind still hit, for less", out.thin.hits.length === 1 && out.thin.hits[0].dmg < c.hits[0].dmg, `${JSON.stringify(out.thin.hits)} vs ${c.hits[0]?.dmg}`);
check("every sniper is dead-on scoped (spreadAds 0)", out.sniperAds.length >= 4 && out.sniperAds.every(([, s]) => s === 0), JSON.stringify(out.sniperAds));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "ALL PASS");
process.exit(failures ? 1 : 0);
