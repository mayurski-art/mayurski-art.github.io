// A map's fingerprint: builds it headless and hashes everything the game
// gets from it (every mesh's geometry, material and place, the lights, the
// colliders, stair links, ropes, Socialize seats), so a refactor can be
// checked as changing nothing (the same hash before and after).
//
//   node tools/troll-ops-map-fingerprint.mjs <mapId> [--out file.json]
//   node tools/troll-ops-map-fingerprint.mjs <mapId> --against file.json
import { createRequire } from "node:module";
import { ROOT, serve } from "./troll-ops-map-capture.mjs";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
if (!id) { console.log("usage: troll-ops-map-fingerprint.mjs <mapId> [--out f] [--against f]"); process.exit(2); }

const mapsTag = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8").match(/"\.\/maps\/maps\.js\?v=([^"]+)"/)[1];
const server = await serve(0, undefined, "none");
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/supabase/, (r) => r.abort());
// some canvas textures draw with Math.random: seed it so two runs match
await page.addInitScript(() => { let s = 1; Math.random = () => ((s = Math.imul(s ^ (s >>> 15), 2654435761) + 0x6d2b79f5 >>> 0) / 4294967296); });
if (process.env.FPDBG) await page.addInitScript(() => { globalThis.__FPDBG_ON = 1; });
await page.goto(`http://127.0.0.1:${server.address().port}/__export.html`);
const res = await page.evaluate(async ({ tag, id }) => {
  globalThis.__FPDBG = !!globalThis.__FPDBG_ON;
  const { buildMap, MAPS } = await import(`/assets/games/troll-ops/maps/maps.js?v=${tag}`);
  const h = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
  const ha = (a) => { let x = 2166136261; const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let i = 0; i < u.length; i++) { x ^= u[i]; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
  const texes = new Map();
  const texH = (t) => {
    if (!t) return null;
    if (texes.has(t)) return texes.get(t);
    const im = t.image;
    let v = `${t.wrapS},${t.wrapT},${t.repeat.x},${t.repeat.y}`;
    if (im?.getContext) v += ":" + ha(im.getContext("2d").getImageData(0, 0, im.width, im.height).data);
    else if (im) v += `:${(im.src || im.constructor?.name).replace(location.origin, "")}`;   // a loaded picture: its file, not its load state
    texes.set(t, globalThis.__FPDBG ? v : h(v));
    return texes.get(t);
  };
  const matH = (m) => {
    const o = {};
    for (const [k, v] of Object.entries(m)) {
      if (k === "uuid" || k === "id" || k === "version" || k.startsWith("_")) continue;
      if (v?.isTexture) o[k] = texH(v);
      else if (v?.isColor) o[k] = v.getHexString();
      else if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") o[k] = v;
    }
    o.cache = m.customProgramCacheKey?.toString().replace(/\r/g, "") ?? "";
    o.compile = m.onBeforeCompile?.toString().replace(/\r/g, "").length ?? 0;   // a file's line endings aren't a change
    o.user = JSON.stringify(m.userData);
    return globalThis.__FPDBG ? JSON.stringify(o) : h(JSON.stringify(o));
  };
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
  built.root.updateMatrixWorld(true);
  const parts = [];
  built.root.traverse((o) => {
    const mw = Array.from(o.matrixWorld.elements, (e) => Math.round(e * 1e4) / 1e4).join(",");
    if (o.isMesh) {
      const g = o.geometry;
      const at = Object.keys(g.attributes).sort().map((k) => `${k}:${ha(g.attributes[k].array)}`).join(";");
      const mats = [].concat(o.material).map(matH).join("+");
      parts.push(`mesh ${o.name}|${mw}|${at}|i${g.index ? ha(g.index.array) : "-"}|${mats}|ro${o.renderOrder}|fc${o.frustumCulled}|s${o.castShadow}${o.receiveShadow}|v${o.visible}|br${!!o.onBeforeRender}`);
    } else if (o.isLight) parts.push(`light ${o.type}|${mw}|${o.color.getHexString()}|${o.intensity}|${o.distance}|${o.decay}|${o.castShadow}`);
    else parts.push(`node ${o.type}|${o.name}|${mw}`);
  });
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  const box = (c) => [...c.min.toArray(), ...c.max.toArray(), c.pen ?? null].map((v) => (typeof v === "number" ? r4(v) : v)).join(",");
  const M = MAPS[id];
  const rp = M.rp ? { seats: M.rp.seats?.(), arm: M.rp.arm?.(), npcs: (M.rp.npcs?.() || []).map((n) => ({ ...n, outfit: undefined })) } : null;
  const groups = {
    meshes: parts,
    colliders: colliders.map(box),
    stairs: (built.stairs || []).map((s) => JSON.stringify(s)),
    ropes: (built.ropes || []).map((r) => JSON.stringify(r)),
    rp: [JSON.stringify(rp)],
    zombies: [JSON.stringify(M.zombieLayout?.() ?? null)],
  };
  const out = {};
  for (const [k, list] of Object.entries(groups)) out[k] = { n: list.length, hash: h(list.join("\n")), list };
  return out;
}, { tag: mapsTag, id });
await browser.close();
server.close();

const brief = Object.fromEntries(Object.entries(res).map(([k, v]) => [k, `${v.n} ${v.hash}`]));
for (const [k, v] of Object.entries(brief)) console.log(`${k.padEnd(10)} ${v}`);
if (opt("--out")) fs.writeFileSync(opt("--out"), JSON.stringify(res));
let fails = errors.length;
if (errors.length) console.log("page errors:\n  " + errors.join("\n  "));
if (opt("--against")) {
  const was = JSON.parse(fs.readFileSync(opt("--against"), "utf8"));
  for (const k of Object.keys(res)) {
    if (was[k]?.hash === res[k].hash) { console.log(`same ${k}`); continue; }
    fails++;
    const a = new Set(was[k]?.list || []), b = new Set(res[k].list);
    const lost = (was[k]?.list || []).filter((x) => !b.has(x)), extra = res[k].list.filter((x) => !a.has(x));
    console.log(`DIFF ${k}: ${lost.length} gone, ${extra.length} new${!lost.length && !extra.length ? " (order only)" : ""}`);
    for (const x of lost.slice(0, 3)) console.log(`  - ${x.slice(0, 220)}`);
    for (const x of extra.slice(0, 3)) console.log(`  + ${x.slice(0, 220)}`);
  }
  console.log(fails ? "CHANGED" : "IDENTICAL");
}
process.exit(fails ? 1 : 0);
