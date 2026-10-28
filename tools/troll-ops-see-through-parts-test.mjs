// Troll Forces: nothing on a gun's attachments draws through the gun except
// a sight's reticle, and that only once aimed (weapons/attachment-models.js
// sightMark: hidden until weapon-view.js shows it). The laser's red lens was
// on the reticle material (depthTest off) and showed through the stock as a
// second red dot. Builds every optic, barrel and underbarrel part and checks
// each mesh with depthTest off is a hidden reticle.
//
// Usage: node tools/troll-ops-see-through-parts-test.mjs

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

// the tag the game imports it under, so the page's copy is the one tested
const tag = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/weapons/weapon-model.js"), "utf8")
  .match(/attachment-models\.js\?v=([\w-]+)/)[1];

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const page = await browser.newPage();
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });

const out = await page.evaluate(async (tag) => {
  const A = await import(`/assets/games/troll-ops/weapons/attachment-models.js?v=${tag}`);
  const res = { built: 0, bad: [], laser: null };
  for (const [set, builders] of Object.entries({ OPTIC_BUILDERS: A.OPTIC_BUILDERS, BARREL_BUILDERS: A.BARREL_BUILDERS, UNDER_BUILDERS: A.UNDER_BUILDERS })) {
    for (const [key, build] of Object.entries(builders || {})) {
      let g;
      try { g = build(); } catch (e) { res.bad.push(`${set}.${key}: threw ${e.message}`); continue; }
      if (!g) continue;
      res.built++;
      g.traverse((o) => {
        const mats = [].concat(o.material || []);
        if (!mats.some((m) => m.depthTest === false)) return;
        let hiddenReticle = false;   // it, or a group it's in, is a sightMark
        for (let p = o; p && !hiddenReticle; p = p.parent) hiddenReticle = !!p.userData.reticle && p.visible === false;
        if (!hiddenReticle) res.bad.push(`${set}.${key}: ${o.type} ${o.name || ""} draws through (reticle ${!!o.userData.reticle}, visible ${o.visible})`);
      });
      if (set === "UNDER_BUILDERS" && key === "laser") {
        let lens = null;
        g.traverse((o) => { if (o.geometry?.type === "CircleGeometry") lens = o; });
        res.laser = lens ? { depthTest: lens.material.depthTest, visible: lens.visible, color: lens.material.color.getHex() } : null;
      }
    }
  }
  return res;
}, tag);

check("every attachment part builds", out.built > 5 && !out.bad.some((b) => /threw/.test(b)), `${out.built} built`);
check("the laser's lens is there, lit red, depth tested", out.laser && out.laser.depthTest === true && out.laser.visible && out.laser.color === 0xff3b30, JSON.stringify(out.laser));
check("only a hidden reticle draws through the gun", out.bad.length === 0, out.bad.slice(0, 5).join(" | "));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "ALL PASS");
process.exit(failures ? 1 : 0);
