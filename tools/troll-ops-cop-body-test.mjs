// Cops and Robbers: the skinned officer (cop-bodies.js) follows the stick rig.
// Sweeps every pose the game uses (cop-lab.html) over time and asserts:
// no NaN, both palms on the rig's palms (on the gun) within 2 cm, the feet on
// the floor (ball of the foot within 4 cm of y=0 when standing and planted),
// and the page throws nothing. Writes a screenshot per pose to
// .claude/cop-shots/.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-cop-body-test.mjs
// LOOK=grin for the cosmetic; GUN=<weapon id>; POSES=run,crouch to narrow.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".claude", "cop-shots");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

const LOOK = process.env.LOOK || "patrol";
const ALL = ["idle", "walk", "run", "strafe", "back", "crouch", "crouchwalk", "prone", "ads", "fire", "reload", "throw", "lookup", "lookdown", "dance", "death"];
const POSES = process.env.POSES ? process.env.POSES.split(",") : ALL;
// palms are checked only while the hands are on the gun
const ON_GUN = new Set(["idle", "walk", "run", "strafe", "back", "crouch", "crouchwalk", "ads", "fire", "lookup", "lookdown"]);
// feet are checked where the rig stands on them
const ON_FEET = new Set(["idle", "crouch", "ads", "fire", "reload", "lookup", "lookdown"]);

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if ((m.type() === "error" || m.type() === "warning") && !/toNonIndexed/.test(m.text())) errors.push(m.text()); });
const gun = process.env.GUN ? `&gun=${process.env.GUN}` : "";
await page.goto(`${BASE}/assets/games/troll-ops/cop-lab.html?still=1&look=${LOOK}${gun}`);
await page.waitForFunction(() => !!window.__lab, null, { timeout: 60000 });
await page.evaluate(async () => { await window.__lab.ready(); });
check("body loaded", await page.evaluate(() => !!window.__lab.rig.cop));

for (const pose of POSES) {
  const r = await page.evaluate((pose) => {
    const L = window.__lab;
    let worstPalm = 0, worstFoot = 0, nan = false;
    for (let i = 0; i < 24; i++) {
      const d = L.pose(pose, i * 0.11);
      nan ||= d.nan;
      worstPalm = Math.max(worstPalm, d.palmL, d.palmR);
      worstFoot = Math.max(worstFoot, Math.min(d.ballLY, d.ballRY));
    }
    L.pose(pose, 0.9);
    L.render();
    return { worstPalm, worstFoot, nan, url: L.rig.cop ? document.querySelector("canvas").toDataURL("image/png") : null };
  }, pose);
  const bits = [`palm ${(r.worstPalm * 100).toFixed(1)} cm`, `lowest foot ${(r.worstFoot * 100).toFixed(1)} cm`];
  check(`${pose}: no NaN`, !r.nan);
  if (ON_GUN.has(pose)) check(`${pose}: hands on the gun`, r.worstPalm < 0.02, bits[0]);
  if (ON_FEET.has(pose)) check(`${pose}: feet on the floor`, r.worstFoot < 0.04 && r.worstFoot > -0.03, bits[1]);
  if (r.url) fs.writeFileSync(path.join(OUT, `${LOOK}-${pose}.png`), Buffer.from(r.url.split(",")[1], "base64"));
}
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
