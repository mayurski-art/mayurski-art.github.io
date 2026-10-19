// Trollface Island back from Roblox Studio (doc "Troll Royale map in Roblox
// Studio"). Listens for studio/trollface-island/from-studio.luau, run in the
// Studio place over the MCP, and takes the colliders it sends.
//
//   node tools/troll-ops-island-from-studio.mjs           check: Studio's
//        colliders match maps/trollface-island-colliders.js to within 1 cm
//        (phase 1's round trip with no edits); prints what changed
//   node tools/troll-ops-island-from-studio.mjs --write   write them to that
//        file (after an edit in Studio), then bump the ?v= tags
//   [--port 5296]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "assets/games/troll-ops/maps/trollface-island-colliders.js");
const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const pi = args.indexOf("--port");
const PORT = pi >= 0 ? +args[pi + 1] : 5296;
const KEYS = ["x", "z", "w", "d", "h", "y"];
const r4 = (v) => Math.round(v * 1e4) / 1e4;

const { ISLAND_SOLIDS: now } = await import(pathToFileURL(FILE).href + `?t=${Date.now()}`);

function report(got) {
  let moved = 0;
  for (let i = 0; i < Math.max(got.length, now.length); i++) {
    const a = got[i], b = now[i];
    if (!a || !b) continue;
    const off = Math.max(...KEYS.map((k) => Math.abs(a[k] - b[k])));
    if (off > 0.01 || a.pen !== b.pen || a.n !== b.n) { if (moved++ < 8) console.log(`  #${i + 1} ${b.n}: off ${off.toFixed(3)} m`, JSON.stringify(a)); }
  }
  const added = Math.max(0, got.length - now.length), removed = Math.max(0, now.length - got.length);
  console.log(`${got.length} colliders from Studio (file has ${now.length}): ${moved} changed, ${added} added, ${removed} removed`);
  return moved + added + removed;
}

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || !req.url.startsWith("/colliders")) { res.writeHead(404); return res.end(); }
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    const got = JSON.parse(body).map((c) => ({ n: String(c.n), x: r4(c.x), z: r4(c.z), w: r4(c.w), d: r4(c.d), h: r4(c.h), y: r4(c.y), pen: r4(c.pen) }));
    const diff = report(got);
    if (WRITE) {
      const src = fs.readFileSync(FILE, "utf8");
      const head = src.slice(0, src.indexOf("export const ISLAND_SOLIDS"));
      const nl = src.includes("\r\n") ? "\r\n" : "\n";
      fs.writeFileSync(FILE, head + "export const ISLAND_SOLIDS = [" + nl + got.map((c) => "  " + JSON.stringify(c)).join("," + nl) + "," + nl + "];" + nl);
      console.log(`wrote ${path.relative(ROOT, FILE)}; now bump: node tools/troll-ops-bump-tags.mjs <suffix> assets/games/troll-ops/maps/trollface-island-colliders.js --write`);
    } else console.log(diff ? `${diff} DIFFERENCES` : "PASS Studio's colliders match the game's to within 1 cm");
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(diff ? `${diff} differences` : "match");
    server.close();
    process.exitCode = WRITE || !diff ? 0 : 1;
  });
});
server.listen(PORT, "127.0.0.1", () => console.log(`waiting for Studio on http://localhost:${PORT}/colliders`));
