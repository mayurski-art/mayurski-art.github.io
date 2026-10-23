// Grin Beach 5a: the waves and the bigger map. Builds the map headless and
// checks the new size, the surf strip, the wade zone and the new strips.
//
//   node tools/troll-ops-beach-test.mjs
//
// - bounds are the 5a ones; the side walls, back wall and seawall reach them
// - the surf strip is drawn, with its shader's clock and set uniforms
// - seaHeight is smooth and stays within 0.9 m over an (x, z, t) grid, flat
//   on the sand side of the seawall
// - the wade zone covers the surf and stops at the seawall
// - gb-venice loads; every spawn (the 5 new ones too) stands clear of every
//   collider and inside the bounds
import { createRequire } from "node:module";
import { ROOT, serve } from "./troll-ops-map-capture.mjs";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const mapsTag = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8").match(/"\.\/maps\/maps\.js\?v=([^"]+)"/)[1];
const server = await serve(0, undefined, "none");
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
// no Supabase, no live room: this page only builds the map
await page.route(/supabase/, (r) => r.abort());
await page.goto(`http://127.0.0.1:${server.address().port}/__export.html`);
const res = await page.evaluate(async (tag) => {
  const { buildMap } = await import(`/assets/games/troll-ops/maps/maps.js?v=${tag}`);
  const src = await (await fetch(`/assets/games/troll-ops/maps/maps.js?v=${tag}`)).text();
  const surf = await import("/assets/games/troll-ops/maps/" + src.match(/\.\/(surf-sea\.js\?v=[^"]+)/)[1]);
  const colliders = [], arena = {};
  const built = buildMap("grinbeach", { colliders, arena });
  const models = () => { const s = new Set(); built.root.traverse((o) => { if (o.userData?.model) s.add(o.userData.model); }); return s; };
  const t0 = performance.now();
  while (performance.now() - t0 < 40000 && !models().has("gb-venice")) await new Promise((r) => setTimeout(r, 500));
  let strip = null;
  built.root.traverse((o) => { if (o.name === "surf-strip") strip = o; });
  // the sea over a grid: the largest height, the largest step between
  // neighbours 0.5 m apart, and anything off the flat on the sand side
  let maxH = 0, maxStep = 0, dry = 0;
  for (let t = 0; t < 120; t += 7.3) {
    for (let x = -60; x <= 80; x += 4) {
      let prev = null;
      for (let z = -15; z >= -61; z -= 0.5) {
        const h = surf.seaHeight(x, z, t);
        if (z > -21 && Math.abs(h) > 1e-3) dry++;
        maxH = Math.max(maxH, Math.abs(h));
        if (prev !== null) maxStep = Math.max(maxStep, Math.abs(h - prev));
        prev = h;
      }
    }
  }
  const inPoly = (poly, x, z) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
  const wade = arena.wade;
  const b = built.map.bounds;
  const blocked = (x, z) => colliders.find((c) => c.min.y < 1.2 && c.max.y > 0.3 && x > c.min.x - 0.35 && x < c.max.x + 0.35 && z > c.min.z - 0.35 && z < c.max.z + 0.35);
  const badSpawns = built.map.spawns.filter(([x, z]) => blocked(x, z) || x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ)
    .map(([x, z]) => { const c = blocked(x, z); return [x, z, c ? [c.min.x, c.min.z, c.max.x, c.max.z].map((v) => +v.toFixed(2)) : "out"]; });
  // the walls that close the map reach its edges
  const wall = (fn) => colliders.some(fn);
  return {
    bounds: b,
    walls: {
      west: wall((c) => c.min.x <= b.minX + 0.1 && c.max.x <= b.minX + 1.5 && c.min.z <= -43 && c.max.z >= 39),
      east: wall((c) => c.max.x >= b.maxX - 0.1 && c.min.x >= b.maxX - 1.5 && c.min.z <= -43 && c.max.z >= 39),
      back: wall((c) => c.min.z >= b.maxZ - 1.5 && c.min.x <= b.minX && c.max.x >= b.maxX),
      seawall: wall((c) => Math.abs((c.min.z + c.max.z) / 2 + 21) < 0.1 && c.min.x <= b.minX && c.max.x >= b.maxX),
    },
    strip: strip ? { uniforms: Object.keys(strip.userData.seaUniforms || {}) } : null,
    sea: { maxH, maxStep, dry },
    wade: wade ? { surf: inPoly(wade, 20, -30) && inPoly(wade, -50, -40), sand: inPoly(wade, 20, -18) || inPoly(wade, 0, 5) } : null,
    venice: models().has("gb-venice"),
    spawns: built.map.spawns.length, badSpawns,
  };
}, mapsTag);

let failed = 0;
const check = (ok, name, info = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${info ? "  " + info : ""}`); if (!ok) failed++; };
const b = res.bounds;
check(b.minX === -56 && b.maxX === 74 && b.minZ === -44 && b.maxZ === 40, "bounds", JSON.stringify(b));
for (const [k, v] of Object.entries(res.walls)) check(v, `${k} wall reaches the edges`);
check(!!res.strip && ["uSeaT", "uShore"].every((u) => res.strip.uniforms.includes(u)), "the surf strip, on the sea clock", JSON.stringify(res.strip?.uniforms));
check(res.sea.maxH > 0.3 && res.sea.maxH <= 0.9, "waves 0.3-0.9 m", res.sea.maxH.toFixed(3));
check(res.sea.maxStep < 0.25, "the sea is smooth (0.5 m apart)", res.sea.maxStep.toFixed(3));
check(res.sea.dry === 0, "flat on the sand side", String(res.sea.dry));
check(!!res.wade && res.wade.surf && !res.wade.sand, "wade over the surf only", JSON.stringify(res.wade));
check(res.venice, "gb-venice loads");
check(res.spawns === 13 && !res.badSpawns.length, "13 spawns, all clear", JSON.stringify(res.badSpawns));
check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
console.log(failed ? `FAIL (${failed})` : "PASS");
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
