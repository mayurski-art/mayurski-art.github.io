// Troll Forces: move game files into folders and fix every path that
// pointed at them (the file organisation plan, step 0; user 2026-10-15).
//
//   node tools/troll-ops-move.mjs --to bots bots.js nav.js enemies.js [--dry [--show]] [--suffix or1]
//   (paths relative to assets/games/troll-ops; --to is a folder there)
//
// What it does, in order:
//   1. every relative path in the game is re-pointed: imports, `new URL(..,
//      import.meta.url)` assets, template-literal folders, data strings like
//      cosmetics' img:, src=/href= in the game's own pages, markdown links in
//      the game's docs. A moved file's own paths are re-expressed from its
//      new folder; anyone's path to a moved file follows it.
//   2. full paths ("assets/games/troll-ops/bots.js") follow too, everywhere:
//      the game, troll-ops.html, tools/*.mjs + *.html, assets/js, the docs,
//      and the gate's TEST_MAP (its regex-escaped "troll-ops\/bots\.js").
//   3. git mv (history follows the file).
//   4. the cache cascade (--suffix, default or1; --base origin/main --unify).
//   5. a tool that imported a module on the game's own tag before is put on
//      the game's new tag after (it was reading the running game's copy).
// Then run tools/troll-ops-import-check.mjs.
//
// Line endings are kept: files are read and written whole, only the matched
// paths change.
import fs from "node:fs"; import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "assets/games/troll-ops");
const GAME_REL = "assets/games/troll-ops/";
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const dry = argv.includes("--dry");
const show = argv.includes("--show");   // print every changed line
const to = flag("to");
const suffix = flag("suffix", "or1");
const names = argv.filter((a, i) => !a.startsWith("--") && !["--to", "--suffix"].includes(argv[i - 1]));
if (!to || !names.length) { console.error("usage: troll-ops-move.mjs --to <folder> <file> ... [--dry] [--suffix or1]"); process.exit(2); }

const slash = (p) => p.replace(/\\/g, "/");
const rel = (f) => slash(path.relative(ROOT, f));
const gameRel = (f) => slash(path.relative(GAME, f));

/* the moves: old absolute path -> new absolute path */
const moves = new Map();
for (const n of names) {
  const from = path.join(GAME, n), dest = path.join(GAME, to, path.basename(n));
  if (!fs.existsSync(from)) { console.error(`no such file: ${n}`); process.exit(1); }
  if (fs.existsSync(dest)) { console.error(`already there: ${gameRel(dest)}`); process.exit(1); }
  moves.set(path.normalize(from), path.normalize(dest));
}
const after = (abs) => moves.get(path.normalize(abs)) || path.normalize(abs);

/* files that can hold a path */
const SKIP = new Set(["node_modules", "models", "refs", "ui", "textures", "skins", "medals", "music", "streak-icons", "trollface-characters", "troll-greencandles", "troll-melee-1"]);
function walk(dir, re, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p, re, out); }
    else if (re.test(e.name)) out.push(p);
  }
  return out;
}
const gameFiles = [...walk(GAME, /\.(m?js|html|md|css)$/), path.join(ROOT, "troll-ops.html")];
const otherFiles = [
  ...fs.readdirSync(path.join(ROOT, "tools")).filter((f) => /\.(mjs|js|html|md|py)$/.test(f) && !["troll-ops-move.mjs", "troll-ops-import-check.mjs", "troll-ops-split.mjs"].includes(f)).map((f) => path.join(ROOT, "tools", f)),
  ...fs.readdirSync(path.join(ROOT, "assets/js")).filter((f) => /\.js$/.test(f)).map((f) => path.join(ROOT, "assets/js", f)),
  path.join(ROOT, "CLAUDE.md"),
].filter((f) => fs.existsSync(f));

/* a relative path, from a folder, as a literal: "./x" or "../x" */
function relLit(fromDir, abs, dirSlash) {
  let r = slash(path.relative(fromDir, abs));
  if (!r.startsWith("../")) r = "./" + r;
  return dirSlash && !r.endsWith("/") ? r + "/" : r;
}
const existsAt = (abs) => fs.existsSync(decodeURIComponent(abs));

/* re-point one relative path written in file F (F's old location) */
function repoint(F, lit) {
  // the static part: up to a query/hash, and for a template, up to the
  // folder before the first ${
  let stat = lit, rest = "";
  const d = stat.indexOf("${");
  if (d >= 0) { const cut = stat.lastIndexOf("/", d) + 1; rest = stat.slice(cut); stat = stat.slice(0, cut); }
  const q = stat.search(/[?#]/);
  if (q >= 0) { rest = stat.slice(q) + rest; stat = stat.slice(0, q); }
  if (!stat || stat === "./" && !rest) return null;
  const target = path.normalize(path.join(path.dirname(F), stat));
  if (!existsAt(target)) return null;   // not a path we know: leave it
  const newF = after(F), newT = after(target);
  if (newF === path.normalize(F) && newT === target) return null;
  return relLit(path.dirname(newF), newT, stat.endsWith("/")) + rest;
}

const edits = new Map();   // file -> new text
let changes = 0;
const note = [];
for (const F of gameFiles) {
  const before = fs.readFileSync(F, "utf8");
  let t = before;
  if (/\.m?js$/.test(F) || /\.html$/.test(F)) {
    // quoted relative literals ('./x', "../x", `./x/${y}`)
    t = t.replace(/(["'`])(\.{1,2}\/[^"'`\n]*?)\1/g, (m, q, lit) => {
      const r = repoint(F, lit);
      if (r === null) return m;
      changes++; return q + r + q;
    });
  }
  if (/\.html$/.test(F)) {
    // src="x.js" / href="style.css" without ./ (a page's own folder)
    t = t.replace(/(\b(?:src|href)=)(["'])(?![a-z]+:|\/|#|\.{1,2}\/|data:|\{|\$)([^"'\s]+)\2/g, (m, a, q, lit) => {
      const r = repoint(F, "./" + lit);
      if (r === null) return m;
      changes++; return a + q + r + q;
    });
  }
  if (/\.md$/.test(F)) {
    // markdown links: ](path) and ](path#anchor)
    t = t.replace(/(\]\()(?![a-z]+:|\/|#)([^)\s]+)(\))/g, (m, a, lit, b) => {
      const r = repoint(F, lit.startsWith(".") ? lit : "./" + lit);
      if (r === null) return m;
      changes++; return a + r + b;
    });
  }
  if (t !== before) edits.set(F, t);
}

/* full paths, everywhere: assets/games/troll-ops/<old> (and regex-escaped) */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const full = [...moves].map(([a, b]) => [gameRel(a), gameRel(b)]);
for (const F of [...gameFiles, ...otherFiles]) {
  const before = edits.get(F) ?? fs.readFileSync(F, "utf8");
  let t = before;
  for (const [o, n] of full) {
    t = t.replace(new RegExp(`(games/troll-ops/)${esc(o)}(?![\\w./-])`, "g"), (m, a) => { changes++; return a + n; });
    const eo = o.replace(/\//g, "\\/").replace(/\./g, "\\."), en = n.replace(/\//g, "\\/").replace(/\./g, "\\.");
    t = t.replace(new RegExp(`(troll-ops\\\\/)${esc(eo)}(?![\\w])`, "g"), (m, a) => { changes++; return a + en; });
    // tests that read a tag off game.js by its path there: tag("bots")
    if (otherFiles.includes(F)) {
      const ob = o.replace(/\.js$/, ""), nb = n.replace(/\.js$/, "");
      t = t.replace(new RegExp(`(\\btag\\((["']))${esc(ob)}\\2\\)`, "g"), (m, a, q) => { changes++; return a + nb + q + ")"; });
    }
  }
  if (t !== before) edits.set(F, t);
}

/* the game's tags before, so tools on them can follow (step 5) */
const IMPORT = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bsrc=|\bhref=)(["'])(\.{1,2}\/[^"'?]+\.m?js|[^"'?:]*?assets\/games\/troll-ops\/[^"'?]+\.m?js)(\?v=[^"']*)?\2/g;
function gameTags() {
  const tags = new Map();
  for (const F of walk(GAME, /\.(m?js|html)$/).concat(path.join(ROOT, "troll-ops.html"))) {
    const t = fs.readFileSync(F, "utf8");
    for (const m of t.matchAll(IMPORT)) {
      const i = m[3].indexOf(GAME_REL);
      const abs = path.normalize(i >= 0 ? path.join(ROOT, m[3].slice(i)) : path.join(path.dirname(F), m[3]));
      tags.set(rel(abs), m[4] ? m[4].slice(3) : "");
    }
  }
  return tags;
}
const tagsBefore = gameTags();

console.log(`${moves.size} files -> ${to}/; ${changes} paths re-pointed in ${edits.size} files`);
for (const [F, t] of edits) {
  console.log("  edit " + rel(F));
  if (!show) continue;
  const a = fs.readFileSync(F, "utf8").split("\n"), b = t.split("\n");
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) console.log(`    -${a[i].trim().slice(0, 160)}\n    +${b[i].trim().slice(0, 160)}`);
}
if (dry) { console.log("(dry run: nothing written, nothing moved)"); process.exit(0); }

for (const [F, t] of edits) fs.writeFileSync(F, t);
fs.mkdirSync(path.join(GAME, to), { recursive: true });
for (const [a, b] of moves) execFileSync("git", ["mv", rel(a), rel(b)], { cwd: ROOT });

execFileSync("node", ["tools/troll-ops-cache-cascade.mjs", "--suffix", suffix, "--base", "origin/main", "--unify"], { cwd: ROOT, stdio: "inherit" });

/* step 5: tools that were on the game's tag stay on it */
const tagsAfter = gameTags();
const movedTo = new Map(full.map(([o, n]) => [GAME_REL + o, GAME_REL + n]));
let synced = 0;
for (const F of otherFiles.filter((f) => /\.(mjs|html)$/.test(f))) {
  const before = fs.readFileSync(F, "utf8");
  const t = before.replace(/(assets\/games\/troll-ops\/[^"'`?$\s]+\.m?js)\?v=([A-Za-z0-9-]*)/g, (m, mod, tag) => {
    const was = [...movedTo].find(([, n]) => n === mod)?.[0] || mod;
    const tb = tagsBefore.get(was), ta = tagsAfter.get(mod);
    if (tb === undefined || ta === undefined || tag !== tb || ta === tb) return m;
    synced++; return `${mod}?v=${ta}`;
  });
  if (t !== before) fs.writeFileSync(F, t);
}
console.log(`moved; ${synced} tool imports kept on the game's tag`);
