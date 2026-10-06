// Troll Forces link check (gate step 1): every game.X a split-out module
// reads must be in game.js's linkGame table, and every one it writes must
// have a setter there. A getter-only entry for a written name throws
// "has only a getter" at runtime, only when that code path runs.
// Needs acorn (next to playwright in node_modules).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), "../assets/games/troll-ops"));
const acorn = require("acorn");
const dirs = ["input", "core", "modes", "streaks", "view", "combat", "menu"].filter((d) => fs.existsSync(d));
const reads = new Set(), writes = new Map();
for (const d of dirs) for (const f of fs.readdirSync(d)) {
  if (!f.endsWith(".js")) continue;
  const src = fs.readFileSync(path.join(d, f), "utf8");
  const ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "module" });
  (function walk(n, parent) {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "MemberExpression" && !n.computed && n.object.type === "Identifier" && n.object.name === "game") {
      reads.add(n.property.name);
      const w = parent && ((parent.type === "AssignmentExpression" && parent.left === n) || parent.type === "UpdateExpression");
      if (w) writes.set(n.property.name, `${d}/${f}`);
    }
    for (const k in n) { const v = n[k]; if (k === "loc") continue; if (Array.isArray(v)) v.forEach((c) => walk(c, n)); else if (v && typeof v.type === "string") walk(v, n); }
  })(ast, null);
}
const g = fs.readFileSync("game.js", "utf8");
const table = g.slice(g.indexOf("linkGame({"), g.indexOf("\n});", g.indexOf("linkGame({")));
const has = (n) => new RegExp(String.raw`(^|\s)(get )?${n}(\(\)|,)`).test(table);
const hasSet = (n) => table.includes(`set ${n}(v)`);
let bad = 0;
for (const n of reads) if (!has(n)) { console.log("MISSING", n); bad++; }
for (const [n, f] of writes) if (!hasSet(n)) { console.log("NO SETTER", n, "written in", f); bad++; }
console.log(bad ? `${bad} problems` : `link table ok: ${reads.size} names, ${writes.size} written`);
process.exit(bad ? 1 : 0);
