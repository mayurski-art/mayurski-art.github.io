// Troll Forces — writes the "gear" list into prefetch-manifest.json: every
// file a match can draw whichever map it's on (the guns and melee, the
// throwables, the class and scorestreak models, the characters and the NFT
// bodies), at the exact URL the game asks for, ?v= tag and all. The menu
// downloads it first, before the maps (map-preload.js; user, 2026-10-25:
// "load weapons, throwables, all the class stuff and the characters
// including their nft characters, then the next priority are the maps").
//
// Read straight from the code, so a new gun or body is picked up by
// re-running this: every new URL("../<file>", import.meta.url) art file in the
// gear folders, the NFT body pieces (models/blocky/, at blocky-body.js's tag)
// and the warm-up's streak models (match-start.js WARM_MODELS). What the menu
// already loads ("lobby") is left out.
//
// Usage: node tools/troll-ops-gear-manifest.mjs [--dry]
import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "assets/games/troll-ops");
const FOLDERS = ["weapons", "characters", "streaks", "combat", "progression", "bots", "view", "modes", "menu", "net"];
const ART = /\.(glb|png|jpe?g|webp)$/i;
// (encoded as the browser asks for it: a space is %20)
const site = (abs) => encodeURI(path.relative(ROOT, abs).split(path.sep).join("/"));

const out = new Set();
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.js$/.test(e.name) ? [path.join(dir, e.name)] : []));
for (const f of FOLDERS.flatMap((d) => walk(path.join(GAME, d)))) {
  const src = fs.readFileSync(f, "utf8");
  for (const [, rel] of src.matchAll(/new URL\(\s*["'](\.\.?\/[^"'`$]+)["']\s*,\s*import\.meta\.url\s*\)/g)) {
    const [file, query = ""] = rel.split("?");
    if (!ART.test(file)) continue;
    const abs = path.resolve(path.dirname(f), file);
    if (fs.existsSync(abs)) out.add(site(abs) + (query ? "?" + query : ""));
  }
}
// the NFT bodies: their pieces as blocky-body.js's glb() asks for them, and
// the garment art on them (traits/<garment>.block.png at its ART_V)
const bb = fs.readFileSync(path.join(GAME, "characters/blocky-body.js"), "utf8");
const pieceV = bb.match(/const glb = [^\n]*TRAITS_BUST \?\? "([^"]+)"/)?.[1];
const artV = bb.match(/const ART_V = [^\n]*TRAITS_BUST \?\? "([^"]+)"/)?.[1];
for (const f of fs.readdirSync(path.join(GAME, "models/blocky"))) if (/\.glb$/.test(f)) out.add(`assets/games/troll-ops/models/blocky/${f}${pieceV ? "?v=" + pieceV : ""}`);
for (const f of fs.readdirSync(path.join(GAME, "traits"))) if (/\.block\.png$/.test(f)) out.add(`assets/games/troll-ops/traits/${f}${artV ? "?v=" + artV : ""}`);
// the hero and cop bodies, named in characters/ as "<file>.glb?v=<tag>" in models/
for (const f of walk(path.join(GAME, "characters"))) {
  for (const [, name, query = ""] of fs.readFileSync(f, "utf8").matchAll(/["']([\w-]+\.glb)(?:\?(v=[^"']*))?["']/g)) {
    if (fs.existsSync(path.join(GAME, "models", name))) out.add(`assets/games/troll-ops/models/${name}${query ? "?" + query : ""}`);
  }
}
// the warm-up's models (loadModel: models/<name>.glb, no tag)
const warm = fs.readFileSync(path.join(GAME, "modes/match-start.js"), "utf8").match(/const WARM_MODELS = \[([^\]]*)\]/)?.[1] || "";
for (const [, n] of warm.matchAll(/"([^"]+)"/g)) out.add(`assets/games/troll-ops/models/${n}.glb`);

const file = path.join(GAME, "prefetch-manifest.json");
const raw = fs.readFileSync(file, "utf8");
const manifest = JSON.parse(raw);
const lobby = new Set(manifest.lobby || []);
const gear = [...out].filter((p) => !lobby.has(p)).sort();
const size = gear.reduce((n, p) => n + fs.statSync(path.join(ROOT, decodeURIComponent(p.split("?")[0]))).size, 0);
console.log(`gear: ${gear.length} files, ${(size / 1e6).toFixed(1)} MB (${out.size - gear.length} already in lobby)`);
if (process.argv.includes("--dry")) { for (const p of gear) console.log("  " + p); process.exit(0); }
// gear goes right after lobby, so the file reads in download order
const next = {};
for (const [k, v] of Object.entries(manifest)) { if (k === "gear") continue; next[k] = v; if (k === "lobby") next.gear = gear; }
if (!next.gear) next.gear = gear;
const nl = raw.includes("\r\n") ? "\r\n" : "\n";
fs.writeFileSync(file, JSON.stringify(next, null, 1).replace(/\n/g, nl) + nl);
console.log("wrote", site(file));
