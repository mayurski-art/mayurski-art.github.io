// Troll Forces cache-tag cascade (HANDOFF "Versioning and deploy"): bump the
// ?v= tag of every changed module in every file that imports it, then of
// those importers in theirs, and so on up to troll-ops.html.
//
//   node tools/troll-ops-bump-tags.mjs <suffix> <changed file> [...]   (dry run)
//   node tools/troll-ops-bump-tags.mjs <suffix> <changed file> [...] --write
//
// Files are paths from the repo root or from assets/games/troll-ops. Each
// import of a changed module gets "-<suffix>" appended to its tag (once), so
// importers that agreed before still agree. It then checks that every module
// is imported under ONE tag everywhere (two tags load it twice, with split
// state) and lists any that aren't. Line endings are left alone.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "assets/games/troll-ops");
const HTML = path.join(ROOT, "troll-ops.html");
const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const [suffix, ...changedArgs] = args.filter((a) => a !== "--write");
if (!suffix || !changedArgs.length || !/^[a-z0-9]+$/i.test(suffix)) {
  console.error("usage: node tools/troll-ops-bump-tags.mjs <suffix> <changed file> [...] [--write]");
  process.exit(2);
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!["models", "refs", "music", "medals", "textures", "node_modules"].includes(e.name)) walk(p, out); }
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}
const files = [...walk(GAME), HTML];
const src = new Map(files.map((f) => [f, fs.readFileSync(f, "utf8")]));
const norm = (p) => path.normalize(p).toLowerCase();

// every "./x.js?v=TAG" (imports, dynamic imports, script src) in a file
const SPEC = /(["'])((?:\.\.?\/|assets\/games\/troll-ops\/)[^"'?]+\.js)\?v=([^"']*)\1/g;
function refs(file) {
  const out = [];
  for (const m of src.get(file).matchAll(SPEC)) {
    const base = file === HTML ? ROOT : path.dirname(file);
    out.push({ quote: m[1], rel: m[2], tag: m[3], target: norm(path.resolve(base, m[2])), text: m[0] });
  }
  return out;
}

const resolveArg = (a) => {
  for (const base of [ROOT, GAME]) {
    const p = path.resolve(base, a);
    if (fs.existsSync(p)) return norm(p);
  }
  console.error(`no such file: ${a}`);
  process.exit(2);
};
const changed = new Set(changedArgs.map(resolveArg));
const queue = [...changed];
const edits = new Map();   // file -> [[oldText, newText]]
while (queue.length) {
  const target = queue.shift();
  for (const f of files) {
    for (const r of refs(f)) {
      if (r.target !== target) continue;
      if (r.tag.split("-").includes(suffix)) continue;
      const next = `${r.quote}${r.rel}?v=${r.tag}-${suffix}${r.quote}`;
      if (!edits.has(f)) edits.set(f, []);
      if (!edits.get(f).some(([o]) => o === r.text)) edits.get(f).push([r.text, next]);
      const nf = norm(f);
      if (f !== HTML && !changed.has(nf)) { changed.add(nf); queue.push(nf); }
    }
  }
}
for (const [f, list] of edits) {
  let s = src.get(f);
  for (const [o, n] of list) s = s.split(o).join(n);
  src.set(f, s);
  if (WRITE) fs.writeFileSync(f, s);
}

// one tag per module everywhere
const tags = new Map();
for (const f of files) {
  for (const r of refs(f)) {
    if (!tags.has(r.target)) tags.set(r.target, new Map());
    const m = tags.get(r.target);
    m.set(r.tag, [...(m.get(r.tag) || []), path.relative(ROOT, f)]);
  }
}
const split = [...tags].filter(([, m]) => m.size > 1);

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");
console.log(`${WRITE ? "bumped" : "would bump"} ${[...edits.values()].reduce((n, l) => n + l.length, 0)} import(s) in ${edits.size} file(s); ${changed.size} module(s) changed:`);
for (const f of edits.keys()) console.log(`  ${rel(f)}`);
if (split.length) {
  console.log(`\nmodules imported under more than one tag (${split.length}):`);
  for (const [t, m] of split) console.log(`  ${rel(t)}: ${[...m].map(([tag, fs2]) => `${tag} (${fs2.length})`).join(", ")}`);
}
