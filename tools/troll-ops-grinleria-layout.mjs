// Dumps The Grinleria's layout (assets/games/troll-ops/grinleria-layout.js)
// to models/grinleria-layout.json for the Blender build script.
//
//   node tools/troll-ops-grinleria-layout.mjs
//
// Re-run after every layout change, then re-run build_grinleria.blender.py.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "assets/games/troll-ops");
// The layout file is a plain ES module with no imports; load it as one
// whatever the repo's package type is.
const src = fs.readFileSync(path.join(DIR, "grinleria-layout.js"), "utf8");
const mod = await import(`data:text/javascript;base64,${Buffer.from(src).toString("base64")}`);
const out = { GL: mod.GL, STORES: mod.STORES, WINGS: mod.WINGS, STALLS: mod.STALLS, KIOSKS: mod.KIOSKS, ...mod.grinleriaLayout() };
const file = path.join(DIR, "models/grinleria-layout.json");
fs.writeFileSync(file, JSON.stringify(out, null, 1));
const kinds = {};
for (const s of out.solids) kinds[s.k] = (kinds[s.k] || 0) + 1;
console.log(`wrote ${path.relative(ROOT, file)}: ${out.solids.length} solids`, kinds);
