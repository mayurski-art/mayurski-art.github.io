// Dumps Kabukigrin's layout (assets/games/troll-ops/maps/kabukigrin-layout.js:
// the colliders, markers and lights Studio exported) to
// models/kabukigrin-layout.json for build_kabukigrin.blender.py.
//
//   node tools/troll-ops-kabukigrin-layout.mjs
//
// Re-run after every layout change, then re-run the Blender build.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "assets/games/troll-ops");
const src = fs.readFileSync(path.join(DIR, "maps/kabukigrin-layout.js"), "utf8");
const mod = await import(`data:text/javascript;base64,${Buffer.from(src).toString("base64")}`);
// the layout's hash: the build records it, so art and colliders can't part
const hash = crypto.createHash("sha1").update(src).digest("hex").slice(0, 12);
const out = { hash, ...mod.KB_LAYOUT };
const file = path.join(DIR, "models/kabukigrin-layout.json");
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`wrote ${path.relative(ROOT, file)}: ${out.colliders.length} colliders, ${Object.keys(out.markers).length} markers, ${out.lights.length} lights, hash ${hash}`);
