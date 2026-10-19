// Trollface Island back from Roblox Studio (doc "Troll Royale map in Roblox
// Studio"). Listens for studio/trollface-island/from-studio.luau, run in the
// Studio place over the MCP, and takes what it sends:
//   /colliders  the Colliders folder, as the game's AABBs
//   /terrain    the terrain's height at each 2 m grid point and its material
//               per 2 m paint cell (phase 3)
//
//   node tools/troll-ops-island-from-studio.mjs           check: print how
//        Studio's island differs from the game's files (no edits: none)
//   node tools/troll-ops-island-from-studio.mjs --write   write
//        maps/trollface-island-colliders.js and maps/trollface-island-ground.js,
//        then bump the ?v= tags of those two
//   [--port 5296]
//
// Wherever sculpt.json's `keep` is 0 (tools/troll-ops-island-sculpt.mjs)
// the height is held at 0, so the coast, lake, paths, POI floors and every collider's
// footing stay at y 0 whatever was sculpted there. Paint: only cells whose
// material differs from the game's own mask (studio/trollface-island/
// island.json) are kept, as overrides; the lake and the coast can't be
// repainted.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "assets/games/troll-ops/maps/trollface-island-colliders.js");
const GROUND = path.join(ROOT, "assets/games/troll-ops/maps/trollface-island-ground.js");
const STUDIO = path.join(ROOT, "assets/games/troll-ops/studio/trollface-island");
const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const pi = args.indexOf("--port");
const PORT = pi >= 0 ? +args[pi + 1] : 5296;
const KEYS = ["x", "z", "w", "d", "h", "y"];
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const STEEP = 1.5;   // m of rise allowed between 2 m neighbours (the contract)

const { ISLAND_SOLIDS: now } = await import(pathToFileURL(FILE).href + `?t=${Date.now()}`);

function colliders(body) {
  const got = JSON.parse(body).map((c) => ({ n: String(c.n), x: r4(c.x), z: r4(c.z), w: r4(c.w), d: r4(c.d), h: r4(c.h), y: r4(c.y), pen: r4(c.pen) }));
  let moved = 0;
  for (let i = 0; i < Math.max(got.length, now.length); i++) {
    const a = got[i], b = now[i];
    if (!a || !b) continue;
    const off = Math.max(...KEYS.map((k) => Math.abs(a[k] - b[k])));
    if (off > 0.01 || a.pen !== b.pen || a.n !== b.n) { if (moved++ < 8) console.log(`  #${i + 1} ${b.n}: off ${off.toFixed(3)} m`, JSON.stringify(a)); }
  }
  const added = Math.max(0, got.length - now.length), removed = Math.max(0, now.length - got.length);
  const diff = moved + added + removed;
  console.log(`colliders: ${got.length} from Studio (file has ${now.length}): ${moved} changed, ${added} added, ${removed} removed`);
  if (WRITE && diff) {
    const src = fs.readFileSync(FILE, "utf8");
    const head = src.slice(0, src.indexOf("export const ISLAND_SOLIDS"));
    const nl = src.includes("\r\n") ? "\r\n" : "\n";
    fs.writeFileSync(FILE, head + "export const ISLAND_SOLIDS = [" + nl + got.map((c) => "  " + JSON.stringify(c)).join("," + nl) + "," + nl + "];" + nl);
    console.log(`  wrote ${path.relative(ROOT, FILE)}`);
  }
  return diff ? `${diff} collider differences` : "colliders match";
}

function terrain(body) {
  if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, body);   // the raw export, for a look
  const T = JSON.parse(body);
  const S = JSON.parse(fs.readFileSync(path.join(STUDIO, "sculpt.json"), "utf8"));
  const I = JSON.parse(fs.readFileSync(path.join(STUDIO, "island.json"), "utf8"));
  if (T.w !== S.w || T.h !== S.h || T.minX !== S.minX || T.minZ !== S.minZ) throw new Error(`grid mismatch: Studio ${T.w}x${T.h}, sculpt ${S.w}x${S.h}`);
  const keep = Buffer.from(S.keep, "base64");
  const H = new Int16Array(T.w * T.h);
  let clamped = 0, top = 0, rising = 0;
  for (let k = 0; k < H.length; k++) {
    const raw = Math.max(0, Math.min(3000, T.heights[k] | 0));
    // The flat cores (keep 0) stay at y 0; the easing round them is the
    // sculpt's own, so a trip with no edits gives the same hills back.
    const v = keep[k] === 0 ? 0 : raw;
    if (raw > 5 && !v) clamped++;
    H[k] = v;
    top = Math.max(top, v);
    if (v > 5) rising++;
  }
  let steep = 0, steepAt = null;
  for (let j = 0; j < T.h; j++) for (let i = 0; i < T.w; i++) {
    const k = j * T.w + i;
    for (const n of [i < T.w - 1 ? k + 1 : -1, j < T.h - 1 ? k + T.w : -1]) {
      if (n < 0) continue;
      const d = Math.abs(H[n] - H[k]) / 100;
      if (d > steep) { steep = d; steepAt = [T.minX + i * T.cell, T.minZ + j * T.cell]; }
    }
  }
  // Paint overrides: cells Studio paints differently from the game's mask.
  const P = T.paint, M = I.mask, paint = [];
  if (P.w !== M.w || P.h !== M.h) throw new Error(`paint grid mismatch: Studio ${P.w}x${P.h}, mask ${M.w}x${M.h}`);
  for (let k = 0; k < P.cells.length; k++) {
    const was = M.cells[k], is = P.cells[k];
    if (is === was || was === "0" || was === "5" || is === "0" || is === "5") continue;
    paint.push([k % P.w, Math.floor(k / P.w), +is]);
  }
  console.log(`terrain: ${rising} points rise (${(100 * rising / H.length).toFixed(0)}%), top ${(top / 100).toFixed(2)} m, steepest ${steep.toFixed(2)} m per ${T.cell} m${steepAt ? ` at ${steepAt}` : ""}; ${clamped} sculpted points held flat (coast, lake, paths, POIs, colliders); ${paint.length} cells repainted`);
  if (steep > STEEP) console.log(`  TOO STEEP: over ${STEEP} m per ${T.cell} m, bots and the nav grid can't take it; smooth it in Studio`);
  const field = {
    minX: T.minX, minZ: T.minZ, cell: T.cell, w: T.w, h: T.h,
    heights: Buffer.from(H.buffer).toString("base64"),
    paint,
  };
  const old = fs.existsSync(GROUND) ? fs.readFileSync(GROUND, "utf8") : "";
  const same = old.includes(JSON.stringify(field.heights)) && old.includes(JSON.stringify(paint));
  if (WRITE && steep <= STEEP) {
    fs.writeFileSync(GROUND, `// Trollface Island's ground: the Studio terrain's heights (cm, Int16 LE in
// base64, at grid points x = minX + i * cell, z = minZ + j * cell) and its
// repainted cells ([i, j, code] on the 2 m paint mask: 1 grass, 2 sand,
// 3 path, 4 rock). Written by tools/troll-ops-island-from-studio.mjs --write
// (doc "Troll Royale map in Roblox Studio", phase 3).
export const ISLAND_GROUND = ${JSON.stringify(field)};
`);
    console.log(`  wrote ${path.relative(ROOT, GROUND)} (${(fs.statSync(GROUND).size / 1024).toFixed(0)} KB)`);
  }
  return steep > STEEP ? "terrain too steep" : same ? "terrain matches" : `terrain differs (top ${(top / 100).toFixed(2)} m)`;
}

const got = {};
const server = http.createServer((req, res) => {
  if (req.method !== "POST") { res.writeHead(404); return res.end(); }
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    let out;
    try {
      if (req.url.startsWith("/colliders")) out = got.colliders = colliders(body);
      else if (req.url.startsWith("/terrain")) out = got.terrain = terrain(body);
      else { res.writeHead(404); return res.end(); }
    } catch (e) { console.error(e); out = "error: " + e.message; got.error = true; }
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(out);
    if (got.colliders && got.terrain || got.error) {
      if (WRITE) console.log("now bump: node tools/troll-ops-bump-tags.mjs <suffix> assets/games/troll-ops/maps/trollface-island-colliders.js assets/games/troll-ops/maps/trollface-island-ground.js --write");
      server.close();
      process.exitCode = got.error || /steep/.test(got.terrain) ? 1 : 0;
    }
  });
});
server.listen(PORT, "127.0.0.1", () => console.log(`waiting for Studio on http://localhost:${PORT}`));
