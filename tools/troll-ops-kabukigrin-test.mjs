// Kabukigrin's Studio layout against Grinjuku (doc docs/KABUKIGRIN.md 6.5).
// Builds both maps headless and compares what the game gets from each:
// colliders, ropes, spawns, sites, stair links, and the drawn town (its
// triangles, how many meshes are light-mapped, retextured, glowing).
//
//   node tools/troll-ops-kabukigrin-test.mjs           (phase 0: the export
//        of an untouched place must match Grinjuku exactly)
//   node tools/troll-ops-kabukigrin-test.mjs --report  (later phases: print
//        the differences and check only that the map builds and stands)
import { createRequire } from "node:module";
import { ROOT, serve } from "./troll-ops-map-capture.mjs";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const REPORT = process.argv.includes("--report");

const mapsTag = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8").match(/"\.\/maps\/maps\.js\?v=([^"]+)"/)[1];
const server = await serve(0, undefined, "none");
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "warning" && /Kabukigrin/.test(m.text())) errors.push(m.text()); });
// no Supabase, no live room: this page only builds maps
await page.route(/supabase/, (r) => r.abort());
await page.goto(`http://127.0.0.1:${server.address().port}/__export.html`);
const res = await page.evaluate(async (tag) => {
  const { buildMap } = await import(`/assets/games/troll-ops/maps/maps.js?v=${tag}`);
  const r4 = (v) => Math.round(v * 1e3) / 1e3;
  const one = async (id) => {
    const colliders = [], arena = {};
    const built = buildMap(id, { colliders, arena });
    const count = () => { let n = 0; built.root.traverse((o) => { if (o.isMesh) n++; }); return n; };
    const t0 = performance.now();
    let last = count(), quiet = 0;
    while (performance.now() - t0 < 40000) {
      await new Promise((r) => setTimeout(r, 500));
      const n = count();
      if (n === last) { if ((quiet += 500) >= 3000) break; } else { last = n; quiet = 0; }
    }
    // the town, without the far city (the same model on both)
    let tris = 0, meshes = 0, lit = 0, textured = 0, glow = 0;
    built.root.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      for (let q = o; q; q = q.parent) if (q.userData?.model === "gj-skyline") return;
      if (/^dress_/.test(o.name || o.parent?.name || "")) return;
      const g = o.geometry, m = o.material;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      meshes++;
      if (m.lightMap) lit += (g.index ? g.index.count : g.attributes.position.count) / 3;
      if (m.map) textured += (g.index ? g.index.count : g.attributes.position.count) / 3;
      if (m.emissive && m.emissive.getHex() !== 0) glow += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    // the borrowed rooms' shootables (phase 3b): a round into the koi tank's
    // glass and one into the office's mirror from the hall
    let rooms = null;
    if (built.map.debug?.().rooms) {
      built.map.onShot({ x: -31.25, y: 1.6, z: 27.4 });
      built.map.onShot({ x: -13.88, y: 4.6, z: 21.2 });
      rooms = built.map.debug().rooms;
    }
    // the booth heard along the seam (phase 4): A Main, in the main door,
    // across the hall, out the west back door, through the tatami room to the yard
    let seam = null;
    const mAt = built.map.debug?.().muffleAt;
    if (rooms && mAt) {
      const W = [[-27.4, 1, -20], [-27.6, 1.5, 0], [-27.6, 1.5, 6], [-22, 1.5, 15], [-27, 1.5, 21], [-27, 1.5, 27], [-27, 1.5, 32], [-27.5, 1.5, 38]];
      seam = [];
      for (let i = 0; i + 1 < W.length; i++) {
        const [a, b] = [W[i], W[i + 1]], n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.5);
        for (let k = 0; k < n; k++) { const t = k / n; seam.push([a[2] + (b[2] - a[2]) * t, mAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)]); }
      }
      seam.ends = { aMainFar: mAt(-27.4, 1, -25), hall: mAt(-22, 1.5, 15), vip: mAt(-29.5, 1.5, 28.5), yard: mAt(-27.5, 1.5, 39), bSide: built.map.debug().muffleAt(20, 1, 15) };
      seam = { pts: seam, ends: seam.ends };
    }
    const box = (c) => [...c.min.toArray(), ...c.max.toArray(), c.pen ?? null].map((v) => (typeof v === "number" ? r4(v) : v)).join(",");
    return {
      colliders: colliders.filter((c) => !c.live).map(box).sort(),
      ropes: (built.ropes || []).map((r) => [r.x, r.z, r.y0, r.y1, r.dx, r.dz].map(r4).join(",")).sort(),
      stairs: built.stairs.map((s) => [s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z].map(r4).join(",") + (s.rope ? " rope" : "")).sort(),
      spawns: built.map.spawns.map((s) => s.map(r4).join(",")),
      sites: (built.map.bombSites || []).map((s) => `${s.id}:${r4(s.x)},${r4(s.z)}`),
      playerSpawn: [r4(built.map.playerSpawn.x), r4(built.map.playerSpawn.z)].join(","),
      tris, meshes, lit, textured, glow, rooms, seam,
    };
  };
  return { gj: await one("grinjuku"), kb: await one("kabukigrin_wip") };
}, mapsTag);
await browser.close();
server.close();

const { gj, kb } = res;
let fails = 0;
const check = (ok, what, detail = "") => { console.log(`${ok ? "ok  " : (REPORT ? "diff" : "FAIL")} ${what}${detail ? `: ${detail}` : ""}`); if (!ok && !REPORT) fails++; };
const sameList = (k) => {
  const a = new Set(gj[k]), b = new Set(kb[k]);
  const lost = gj[k].filter((x) => !b.has(x)), extra = kb[k].filter((x) => !a.has(x));
  check(!lost.length && !extra.length && gj[k].length === kb[k].length, `${k} (${kb[k].length}, Grinjuku ${gj[k].length})`,
    lost.length || extra.length ? `${lost.length} only on Grinjuku, ${extra.length} only on Kabukigrin; e.g. ${[...lost.slice(0, 2), ...extra.slice(0, 2)].join(" | ")}` : "");
};
for (const k of ["colliders", "ropes", "stairs"]) sameList(k);
for (const k of ["spawns", "sites", "playerSpawn"]) check(JSON.stringify(gj[k]) === JSON.stringify(kb[k]), k, JSON.stringify(kb[k]) === JSON.stringify(gj[k]) ? "" : `${JSON.stringify(kb[k])} vs ${JSON.stringify(gj[k])}`);
const near = (a, b, tol) => Math.abs(a - b) <= Math.max(1, b * tol);
check(near(kb.tris, gj.tris, 0.002), "town triangles", `${kb.tris} vs ${gj.tris}`);
for (const k of ["lit", "textured", "glow"]) check(near(kb[k], gj[k], 0.002), `${k} triangles`, `${kb[k]} vs ${gj[k]}`);
console.log(`meshes drawn: ${kb.meshes} (Grinjuku ${gj.meshes})`);
if (kb.rooms) {
  const R = kb.rooms;
  console.log(`${R.koi.cracked ? "ok  " : "FAIL"} the koi tank cracks where it's shot (${R.koi.cracked} star)`);
  console.log(`${R.mirror.broken ? "ok  " : "FAIL"} the office's mirror shatters`);
  if (!R.koi.cracked || !R.mirror.broken) fails++;
}
if (kb.seam) {
  const { pts, ends } = kb.seam;
  // half a metre never changes the sound by more than half an octave of cutoff
  let worst = 1, at = null;
  for (let i = 1; i < pts.length; i++) { const r = Math.max(pts[i][1], pts[i - 1][1]) / Math.min(pts[i][1], pts[i - 1][1]); if (r > worst) { worst = r; at = pts[i][0]; } }
  const ok = (c, what) => { console.log(`${c ? "ok  " : "FAIL"} ${what}`); if (!c) fails++; };
  ok(worst < 1.42, `walking the seam the booth opens up gradually (worst step x${worst.toFixed(2)} at z ${at})`);
  ok(ends.hall >= 16000 && ends.aMainFar < 600 && ends.vip < 4000 && ends.yard < 1500 && ends.bSide <= 200,
    `full in the hall, muffled outside: ${JSON.stringify(ends)}`);
}
// standing at all: something to stand on and somewhere to spawn, whatever the phase
if (REPORT) {
  if (!kb.colliders.length || kb.spawns.length < 2 || !kb.tris) { console.log("FAIL the map doesn't stand: no colliders, spawns or town"); fails++; }
}
if (errors.length) { console.log("page errors:\n  " + errors.join("\n  ")); fails++; }
console.log(fails ? `${fails} FAILED` : "PASS");
process.exit(fails ? 1 : 0);
