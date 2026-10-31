// Troll Forces care package (STREAK-REALISM.md phase 4): the crate is the
// wooden supply box and the helicopter that drops it is the Black Hawk.
//   1. a spawned care package loads drop-heli.glb with MainRotor, TailRotor
//      and the Strobe, and care-package.glb as the planked crate, both under
//      budget; the rotors turn and the strobe blinks on the way in;
//   2. the heli's model is a different file from the gunship's;
//   3. no page errors.
// Writes shots to [shotsDir] when given.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-streak-package-test.mjs [shotsDir]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, name) }); };

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 120000 });
await sleep(500);
await page.evaluate(() => { const T = window.__trollOps; T.closePauseMenu(); if (T.isStaging()) T.endStaging(); T.breakSpawnGuard(); });
const until = (fn, ms = 15000) => page.waitForFunction(fn, null, { timeout: ms, polling: 30 }).then(() => true, () => false);

await page.evaluate(() => { const T = window.__trollOps; T.spawnCarePackage({ id: "pkg-test", x: T.move.pos.x, z: T.move.pos.z - 12, reward: "ammo", owned: true, ownerTeam: null, groundY: T.move.pos.y }); });
await until(() => { const p = window.__trollOps.streakEntities.get("pkg-test"); return !!p && p.heliRotors.length === 2 && !!p.crate; }, 20000);
const info = () => page.evaluate(() => {
  const p = window.__trollOps.streakEntities.get("pkg-test");
  if (!p) return null;
  const tris = (root) => { let n = 0; root.traverse((o) => { if (o.isMesh && o.visible) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return Math.round(n); };
  return { rotors: p.heliRotors.map(([n]) => n.name), spin: p.heliRotors.map(([n, a]) => n.rotation[a]), strobe: p.heliStrobe ? p.heliStrobe.visible : null,
    heliModel: p.heli.children[0]?.userData.model, heliTris: tris(p.heli), crateModel: p.crate?.userData.model, crateTris: tris(p.crate), age: p.age };
});
const a = await info();
await page.waitForFunction((t0) => (window.__trollOps.streakEntities.get("pkg-test")?.age ?? 0) > t0 + 0.4, a?.age ?? 0, { timeout: 15000, polling: 30 }).catch(() => {});
const b = await info();
// look at the helicopter for the shot
await page.evaluate(() => { const T = window.__trollOps; const p = T.streakEntities.get("pkg-test"); const v = p.heli.position.clone().sub(T.move.pos); T.look.yaw = Math.atan2(-v.x, -v.z); T.look.pitch = Math.atan2(v.y - 1.6, Math.hypot(v.x, v.z)); });
await sleep(400);
await shot(page, "1-package-heli.png");
check("the drop helicopter is the Black Hawk (drop-heli.glb, MainRotor + TailRotor + Strobe)", !!a && a.heliModel === "drop-heli" && a.rotors.includes("MainRotor") && a.rotors.includes("TailRotor") && a.strobe !== null, JSON.stringify(a));
check("the crate is the planked box (care-package.glb)", !!a && a.crateModel === "care-package" && a.crateTris > 2000, `${a?.crateTris} tris`);
check("under the tri budgets", !!a && a.heliTris <= 15000 && a.crateTris <= 3500, `${a?.heliTris} / ${a?.crateTris}`);
check("the rotors turn", !!a && !!b && b.spin[0] !== a.spin[0] && b.spin[1] !== a.spin[1], `${a?.spin} -> ${b?.spin}`);
// the headless sim runs well under real time: sample until both states show
const blinks = new Set();
for (let i = 0; i < 60 && !(blinks.has(true) && blinks.has(false)); i++) { blinks.add((await info())?.strobe); await sleep(120); }
check("the strobe blinks", blinks.has(true) && blinks.has(false), [...blinks].join("/"));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
