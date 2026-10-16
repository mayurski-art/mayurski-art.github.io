// Troll Forces: does every path still point at something? (the file
// organisation plan, step 0; run after every move, user 2026-10-15).
//
// Static (always):
//   - every import in the game, troll-ops.html, the dev pages and the tools
//     resolves to a file that exists;
//   - every module is imported under ONE ?v= tag across the game (a second
//     tag loads it twice), and the tools use that same tag;
//   - every relative path literal in a game module ("./models/x.glb",
//     `./skins/${id}.jpg`'s folder, cosmetics' img: strings) resolves from
//     that module's own folder; root paths ("assets/games/troll-ops/...")
//     exist; so does every prefetch-manifest.json entry.
// --load (also): troll-ops.html opened offline (Supabase blocked) into the
//   Test Range, and each dev page that imports the game opened once, with
//   any 404 or page error a failure.
//
//   node tools/troll-ops-import-check.mjs [--load] [--warnings]
//   NODE_PATH=<checkout>/node_modules for --load (playwright)
import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "assets/games/troll-ops");
const rel = (f) => path.relative(ROOT, f).replace(/\\/g, "/");
const SKIP = new Set(["node_modules", "models", "refs", "ui", "textures", "skins", "medals", "music", "streak-icons", "trollface-characters", "troll-greencandles", "troll-melee-1"]);
// tagged twice before the organisation started (left alone on purpose)
const SPLIT_OK = new Set(["assets/games/troll-ops/weapons/hand-model.js"]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p, out); }
    else if (/\.(m?js|html)$/.test(e.name)) out.push(p);
  }
  return out;
}
const gameFiles = [...walk(GAME), path.join(ROOT, "troll-ops.html")];
// (not this file, whose comments name example paths, nor the one-off
// game.js split script, which wrote paths that didn't exist yet)
const toolFiles = fs.readdirSync(path.join(ROOT, "tools")).filter((f) => /\.(mjs|html)$/.test(f) && !["troll-ops-import-check.mjs", "troll-ops-move.mjs", "troll-ops-split.mjs"].includes(f)).map((f) => path.join(ROOT, "tools", f))
  .concat([path.join(ROOT, "assets/js/tf-prefetch.js")]);

const fails = [], warns = new Set();
const fail = (f, line, what) => fails.push(`${rel(f)}:${line}  ${what}`);
const lineOf = (t, i) => t.slice(0, i).split("\n").length;
const exists = (p) => fs.existsSync(decodeURIComponent(p));

// import specifiers: from "x", import("x"), import "x", src="x", href="x"
const IMPORT = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bsrc=|\bhref=)(["'])(\.{1,2}\/[^"'?]+\.m?js|[^"'?:]*?assets\/games\/troll-ops\/[^"'?]+\.(?:m?js|css))(\?v=[^"']*)?\2/g;
const resolveSpec = (from, spec) => {
  const i = spec.indexOf("assets/games/troll-ops/");
  return path.normalize(i >= 0 ? path.join(ROOT, spec.slice(i)) : path.join(path.dirname(from), spec));
};

const tags = new Map();   // module -> Map(tag -> [where])
const toolTags = [];      // [file, line, module, tag]
for (const f of [...gameFiles, ...toolFiles]) {
  const t = fs.readFileSync(f, "utf8");
  const isGame = gameFiles.includes(f);
  for (const m of t.matchAll(IMPORT)) {
    const target = resolveSpec(f, m[3]);
    const line = lineOf(t, m.index);
    if (!exists(target)) { fail(f, line, `missing: ${m[3]}`); continue; }
    if (!/\.m?js$/.test(target)) continue;
    const tag = m[4] ? m[4].slice(3) : "";
    if (isGame) {
      if (!tags.has(rel(target))) tags.set(rel(target), new Map());
      const byTag = tags.get(rel(target));
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag).push(`${rel(f)}:${line}`);
    } else toolTags.push([f, line, rel(target), tag]);
  }
  // tools: absolute module URLs inside strings ("/assets/games/troll-ops/x.js?v=..")
  if (!isGame) {
    for (const m of t.matchAll(/["'`]\/?(assets\/games\/troll-ops\/[^"'`?$]+\.m?js)(\?v=[^"'`$]*)?["'`]/g)) {
      const target = path.join(ROOT, m[1]);
      if (!exists(target)) fail(f, lineOf(t, m.index), `missing: ${m[1]}`);
      else toolTags.push([f, lineOf(t, m.index), m[1], m[2] ? m[2].slice(3) : null]);
    }
  }
}
for (const [mod, byTag] of tags) {
  if (byTag.size > 1 && !SPLIT_OK.has(mod)) fails.push(`${mod}  imported under ${byTag.size} tags: ${[...byTag].map(([t, w]) => `"${t}" (${w.slice(0, 2).join(", ")})`).join(" vs ")}`);
}
for (const [f, line, mod, tag] of toolTags) {
  const byTag = tags.get(mod);
  if (!byTag || tag === null || SPLIT_OK.has(mod)) continue;
  // a tool importing a game module under another tag gets its own copy of
  // it: right for a test poking a pure module, wrong for one reading the
  // running game's state. Many did this before the organisation, so it's a
  // warning; the move tool keeps a tool that matched the game matching.
  const gameTag = [...byTag.keys()][0];
  if (byTag.size === 1 && gameTag && tag !== gameTag && /\.mjs$/.test(f)) warns.add(`${rel(f)}:${line}  ${mod}?v=${tag || "(none)"}, the game uses ?v=${gameTag}`);
}

// relative path literals in game modules, resolved from the module's folder
// (a template: only its static part, up to the first ${, so a quote inside
// ${..} can't end the match: `./models/${f}?v=${x ?? "bb2"}`)
const LIT = /(["'])(\.{1,2}\/[^"'`\n]*?)\1|`(\.{1,2}\/[^`\n]*?)(?=`|\$\{)/g;
for (const f of gameFiles.filter((f) => /\.m?js$/.test(f))) {
  const t = fs.readFileSync(f, "utf8");
  for (const m of t.matchAll(LIT)) {
    let p = m[2] ?? m[3];
    if (m[3] !== undefined && t[m.index + 1 + p.length] === "$") p = p.slice(0, p.lastIndexOf("/") + 1);
    p = p.replace(/[?#].*$/, "");
    if (!p || p === "./" || p === "../") continue;
    const target = path.join(path.dirname(f), p);
    if (!exists(target)) fail(f, lineOf(t, m.index), `relative path points at nothing: ${m[2] ?? m[3]}`);
  }
  for (const m of t.matchAll(/(["'`])(assets\/games\/troll-ops\/[^"'`\n$]*?)(?:\?[^"'`\n]*)?\1/g)) {
    if (!exists(path.join(ROOT, m[2]))) fail(f, lineOf(t, m.index), `root path points at nothing: ${m[2]}`);
  }
}
// the prefetch manifest
const manifest = JSON.parse(fs.readFileSync(path.join(GAME, "prefetch-manifest.json"), "utf8"));
for (const [group, list] of Object.entries(manifest)) {
  for (const p of [].concat(list)) if (typeof p === "string" && !exists(path.join(ROOT, p.replace(/\?.*$/, "")))) fails.push(`prefetch-manifest.json [${group}]  missing: ${p}`);
}

const nMods = tags.size;
console.log(`static: ${gameFiles.length} game files, ${toolFiles.length} tools, ${nMods} modules imported`);
if (process.argv.includes("--warnings")) for (const x of warns) console.log("warn " + x);
else if (warns.size) console.log(`(${warns.size} tool imports on a tag other than the game's; --warnings lists them)`);
for (const x of fails) console.log("FAIL " + x);

// --load: the game and the dev pages in a browser, offline
if (process.argv.includes("--load")) {
  const http = await import("node:http");
  const { createRequire } = await import("node:module");
  const { chromium } = createRequire(import.meta.url)("playwright");
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav" };
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  const origin = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const open = async (url, after) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.route(/supabase|googleapis|gstatic|fonts\./, (r) => r.abort());
    const page = await ctx.newPage();
    const bad = [];
    page.on("pageerror", (e) => bad.push(`page error: ${e.message}`));
    page.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith(origin)) bad.push(`${r.status()} ${r.url().slice(origin.length)}`); });
    try { await page.goto(origin + url, { waitUntil: "load", timeout: 90000 }); if (after) await after(page); else await page.waitForTimeout(2500); }
    catch (e) { bad.push(`load: ${e.message.split("\n")[0]}`); }
    await ctx.close();
    return bad;
  };
  // already so on main before the organisation (2026-10-15): the preview's
  // reference picture is an untracked file, and the skin editor asks for a
  // folder. Not the move's doing; still shown, not counted.
  const KNOWN = ["/tools/trait-preview.html 404 /assets/games/troll-ops/refs/trolls-1718.png", "/tools/troll-skin-editor.html 404 /images"];
  const report = (url, all) => {
    const bad = all.filter((b) => !KNOWN.includes(`${url} ${b}`));
    for (const b of new Set(all.filter((b) => !bad.includes(b)))) console.log(`known ${url}  ${b}`); for (const b of new Set(bad)) fails.push(`load ${url}  ${b}`); console.log(`${bad.length ? "FAIL" : "ok  "} load ${url}`); for (const b of new Set(bad)) console.log(`       ${b}`); };
  report("/troll-ops.html (Test Range)", await open("/troll-ops.html?tohooks=1", async (page) => {
    await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
    await page.evaluate(async () => { if (!window.TrollrunnerAccounts) window.TrollrunnerAccounts = {}; window.__trollOps.setMode("range"); await window.__trollOps.startGame(); });
    await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 120000 });
    await page.waitForTimeout(2000);
  }));
  const pages = [...toolFiles.filter((f) => /\.html$/.test(f)), ...gameFiles.filter((f) => /\.html$/.test(f) && !/troll-ops\.html$/.test(f))]
    .filter((f) => !toolFiles.includes(f) || /games\/troll-ops\//.test(fs.readFileSync(f, "utf8")));
  for (const f of pages) report("/" + rel(f), await open("/" + rel(f)));
  await browser.close(); server.close();
}

console.log(fails.length ? `${fails.length} FAILED` : "ALL PASS");
process.exit(fails.length ? 1 : 0);
