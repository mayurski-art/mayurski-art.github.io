// Dumps The Grinjuku's layout (assets/games/troll-ops/grinjuku-layout.js)
// to models/grinjuku-layout.json for the Blender build script.
//
//   node tools/troll-ops-grinjuku-layout.mjs
//
// Re-run after every layout change, then re-run build_grinjuku.blender.py.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "assets/games/troll-ops");
// The layout file is a plain ES module with no imports; load it as one
// whatever the repo's package type is.
const src = fs.readFileSync(path.join(DIR, "grinjuku-layout.js"), "utf8");
const mod = await import(`data:text/javascript;base64,${Buffer.from(src).toString("base64")}`);
const out = { GJ: mod.GJ, ...mod.grinjukuLayout() };
const file = path.join(DIR, "models/grinjuku-layout.json");
fs.writeFileSync(file, JSON.stringify(out, null, 1));
const kinds = {};
for (const s of out.solids) kinds[s.k] = (kinds[s.k] || 0) + 1;
console.log(`wrote ${path.relative(ROOT, file)}: ${out.solids.length} solids`, kinds);
