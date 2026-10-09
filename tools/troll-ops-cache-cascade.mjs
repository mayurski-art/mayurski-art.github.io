// Troll Forces — the ?v= cache-tag cascade (HANDOFF "Cache-bust tags").
//
// Every module the branch changed gets `-<suffix>` on every import of it;
// a file whose import line changed is itself changed, so its importers get
// the suffix too, up to game.js and troll-ops.html. Every importer of a
// module ends up on the same tag, so nothing loads twice.
//
// Usage: node tools/troll-ops-cache-cascade.mjs --suffix ar1 [--base origin/main] [--dry]
//   [--seed path ...]   (extra changed modules; default: git diff --name-only <base>)
//   [--unify]           (then put every importer of a split module on its
//                        longest tag carrying the suffix: after a merge
//                        took main's side of tag-only conflicts)
// Run it after merging main, right before the gate.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "assets/games/troll-ops");
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const suffix = flag("suffix");
const base = flag("base", "origin/main");
const dry = argv.includes("--dry");
if (!suffix) { console.error("usage: troll-ops-cache-cascade.mjs --suffix <tag> [--base origin/main] [--dry]"); process.exit(2); }

/* every script and page that can import a game module */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!["node_modules", "models", "refs", "ui", "audio"].includes(e.name)) walk(p, out); }
    else if (/\.(m?js|html)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = [...walk(GAME), path.join(ROOT, "troll-ops.html")].filter((f) => fs.existsSync(f));

/* import specifiers: from "x", import("x"), import "x", src="x" / href="x" */
const IMPORT = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bsrc=|\bhref=)(["'])(\.{1,2}\/[^"'?]+\.m?js|assets\/games\/troll-ops\/[^"'?]+\.m?js)(\?v=[^"']*)?\2/g;
const resolve = (from, spec) => path.normalize(spec.startsWith("assets/") ? path.join(ROOT, spec) : path.join(path.dirname(from), spec));

const rel = (f) => path.relative(ROOT, f).replace(/\\/g, "/");
const seeds = flag("seed") ? argv.filter((a, i) => argv[i - 1] === "--seed") :
  execSync(`git diff --name-only ${base}`, { cwd: ROOT }).toString().split(/\r?\n/)
    .concat(execSync("git ls-files --others --exclude-standard", { cwd: ROOT }).toString().split(/\r?\n/))
    .filter((f) => /^assets\/games\/troll-ops\/.*\.m?js$/.test(f));
const changed = new Set(seeds.map((f) => path.normalize(path.join(ROOT, f))));
const text = new Map(files.map((f) => [f, fs.readFileSync(f, "utf8")]));
const tagged = (t) => t.split("-").some((p) => p === suffix);

let edits = 0, round = 0, grew = true;
while (grew) {
  grew = false; round++;
  for (const f of files) {
    const before = text.get(f);
    const after = before.replace(IMPORT, (m, pre, q, spec, tag) => {
      if (!changed.has(resolve(f, spec))) return m;
      const t = tag ? tag.slice(3) : "";
      if (t && tagged(t)) return m;
      edits++;
      return `${pre}${q}${spec}?v=${t ? `${t}-${suffix}` : suffix}${q}`;
    });
    if (after !== before) {
      text.set(f, after);
      if (!changed.has(f) && !f.endsWith(".html")) { changed.add(f); grew = true; }
    }
  }
}
const touched = files.filter((f) => text.get(f) !== fs.readFileSync(f, "utf8"));
if (!dry) for (const f of touched) fs.writeFileSync(f, text.get(f));
console.log(`${dry ? "[dry] " : ""}${edits} import tags across ${touched.length} files, ${round} rounds; seeds: ${seeds.join(", ")}`);
for (const f of touched) console.log("  " + rel(f));

/* any module its importers disagree on: it would load twice */
const tags = new Map();
for (const f of files) for (const m of text.get(f).matchAll(IMPORT)) {
  const mod = rel(resolve(f, m[3])), t = m[4] ? m[4].slice(3) : "(none)";
  if (!tags.has(mod)) tags.set(mod, new Map());
  const by = tags.get(mod);
  if (!by.has(t)) by.set(t, []);
  by.get(t).push(rel(f));
}
let split = [...tags].filter(([, by]) => by.size > 1);
if (argv.includes("--unify") && !dry) {
  let fixed = 0;
  for (const [mod, by] of split) {
    const ts = [...by.keys()];
    if (ts.includes("(none)") || !ts.every(tagged)) continue;
    const want = ts.reduce((x, y) => (y.length > x.length ? y : x));
    for (const f of [...new Set([...by.values()].flat())]) {
      const file = path.join(ROOT, f), before = fs.readFileSync(file, "utf8");
      const after = before.replace(IMPORT, (m, pre, q, spec, tag) =>
        rel(resolve(file, spec)) === mod && tag && tag.slice(3) !== want ? (fixed++, `${pre}${q}${spec}?v=${want}${q}`) : m);
      if (after !== before) fs.writeFileSync(file, after);
    }
    by.clear(); by.set(want, []);
  }
  console.log(`unified ${fixed} import tags`);
  split = [...tags].filter(([, by]) => by.size > 1);
}
console.log(split.length ? `\n${split.length} modules imported under more than one tag:` : "\nevery module has one tag across its importers");
for (const [mod, by] of split) {
  console.log("  " + mod);
  for (const [t, fs_] of by) console.log(`    ?v=${t}: ${fs_.join(", ")}`);
}
