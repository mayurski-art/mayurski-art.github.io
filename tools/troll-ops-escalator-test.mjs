// Troll Forces: nothing goes off the side of the Grinleria's escalators.
//
// Their glass balustrades were only drawn, so bots crowding up a flight in
// Infection shoved each other off its side, fell to the floor and walked
// back round to try again (user, 2026-10-11). For every flight, a body
// halfway up (a bot's radius, then a player's) is pushed sideways with the
// collision call both use (movement.js resolveCircle, the bots' step-up);
// it has to stay on the treads. The bots still climbing every flight is the
// stairs test's job: node tools/troll-ops-bot-stairs-test.mjs --sim-only grinleria
//
// Usage: node tools/troll-ops-escalator-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/assets/vendor/three.module.min.js","three/addons/":"/assets/vendor/addons/"}}</script><body>escalators</body>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__esc.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  const p = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": p.endsWith(".js") ? "text/javascript" : "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/__esc.html`);
const gameSrc = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8");
const tag = (mod) => gameSrc.match(new RegExp(`\\./${mod}\\.js(\\?v=[^"']*)?["']`))?.[1] || "";
const mods = { maps: `/assets/games/troll-ops/maps.js${tag("maps")}`, movement: `/assets/games/troll-ops/core/movement.js${tag("core/movement")}`,
  layout: "/assets/games/troll-ops/grinleria-layout.js" };

const res = await page.evaluate(async (mods) => {
  const THREE = await import("three");
  const { buildMap } = await import(mods.maps);
  const { resolveCircle } = await import(mods.movement);
  const { grinleriaLayout } = await import(mods.layout);
  const colliders = [], arena = {};
  buildMap("grinleria", { colliders, arena });
  const out = [];
  for (const e of grinleriaLayout().escalators) {
    const i = Math.floor(e.steps / 2), feet = e.rise * (i + 1);
    const x = e.x0 + e.dir * e.run * (i + 0.5);   // x0 already carries the side
    for (const [who, r] of [["bot", 0.36], ["player", 0.35]]) {
      for (const side of [-1, 1]) {
        const pos = new THREE.Vector3(x, feet, e.z);
        let worst = 0;
        for (let k = 0; k < 40; k++) {   // 2 m of shove, 5 cm a frame
          pos.z += side * 0.05;
          resolveCircle(colliders, pos, r, feet, 2, who === "bot" ? 0.5 : undefined);
          worst = Math.max(worst, Math.abs(pos.z - e.z));
        }
        out.push({ name: `${e.moving} escalator at x ${x.toFixed(1)}, z ${e.z}: a ${who} shoved ${side < 0 ? "-z" : "+z"}`,
          ok: worst <= e.width / 2, worst: +worst.toFixed(2), half: e.width / 2 });
      }
    }
  }
  return out;
}, mods);

for (const r of res) check(`${r.name} stays on the treads`, r.ok, `${r.worst} m from the middle, the tread's ${r.half} m`);
check("4 flights tested", res.length === 16, `${res.length / 4}`);
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} failed` : "\nALL PASS");
process.exit(failures ? 1 : 0);
