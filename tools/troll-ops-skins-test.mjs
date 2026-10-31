// Troll Warfare weapon camos (docs/DESIGN-SKINS.md §7), headless, through
// labs/arms-sheet.html; Supabase blocked, never a live room.
//  1. every camo on the Problem 416 (kit gun), LOD0 and LOD1: the camo
//     material with its mask and tile, gun-space attributes, the kit kept
//     (moving parts, one kit draw)
//  2. a side shot against factory: the shell changes, the muzzle device
//     and barrel don't (the core keeps its own finish)
//  3. prestige finishes on the kit gun go on as paint (parts kept); Ghost
//     Glass still swaps the whole gun
//  4. older guns (traced, old GLB, box) take the flat path; steel stays
//  5. the loadout's lock: a camo opens at its weapon level
//  6. no page errors
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-skins-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let fails = 0;
const check = (name, ok, info = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !info ? "" : "  " + info}`);
  if (!ok) fails++;
};

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await page.goto(`${BASE}/assets/games/troll-ops/labs/arms-sheet.html`);
await page.waitForFunction(() => window.sheet, null, { timeout: 60000 });
await page.evaluate(() => window.sheet.ready);
// the same module instances the sheet uses (its import tags)
const WM = await page.evaluate(() => [...document.scripts].map((s) => s.textContent.match(/"(\.\.\/weapons\/weapon-model\.js[^"]*)"/)?.[1]).find(Boolean));
// skins.js under the tag weapon-model.js imports it with
const SK = "../characters/" + fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/weapons/weapon-model.js"), "utf8")
  .match(/"\.\.\/characters\/(skins\.js\?v=[^"]*)"/)[1];

// 1. every camo on the 416, both LODs
const built = await page.evaluate(async ([wm, sk]) => {
  const { buildWeaponMesh } = await import(new URL(wm, location.href).href);
  const { CAMOS } = await import(new URL(sk, location.href).href);
  const { resolveWeapon, defaultLoadoutFor } = await import(new URL("../weapons/attachments.js?v=cg1-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416", location.href).href);
  const out = [];
  for (const c of CAMOS) for (const lod of [0, 1]) {
    const def = resolveWeapon("problem416", { ...defaultLoadoutFor("problem416"), skin: c.id });
    const g = buildWeaponMesh(def, { lod });
    const kits = [];
    g.traverse((o) => { if (o.isMesh && o.material.name === "PF_Kit") kits.push(o); });
    out.push({
      id: c.id, lod, camo: g.userData.camo, kits: kits.length,
      allCamo: kits.every((o) => o.material.userData.camo === c.id),
      attrs: kits.every((o) => !!o.geometry.attributes.camoPos && !!o.geometry.attributes.camoNrm),
      parts: !!g.userData.gunParts, lodTag: g.userData.lod,
    });
  }
  return out;
}, [WM, SK]);
for (const r of built) {
  check(`${r.id} LOD${r.lod}: camo on every kit mesh, gun-space attributes`, r.camo === r.id && r.kits > 0 && r.allCamo && r.attrs, JSON.stringify(r));
  if (r.lod === 0) check(`${r.id} LOD0 keeps the kit's moving parts`, r.parts, JSON.stringify(r));
  else check(`${r.id} LOD1 is the one-node model`, r.lodTag === 1 && r.kits === 1, JSON.stringify(r));
}

// 2. pixels: a side shot in each camo against factory
const shot = async (skin) => {
  const url = await page.evaluate((s) => window.sheet.orbit("problem416", 0, 0, { skin: s }), skin);
  return url;
};
const diff = await page.evaluate(async (urls) => {
  const load = async (u) => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); };
  const [a, ...rest] = await Promise.all(urls.map(load));
  const W = a.width, H = a.height, bg = [a.data[0], a.data[1], a.data[2]];
  // the gun's extent: pixels unlike the corner (background)
  let x0 = W, x1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (Math.abs(a.data[i] - bg[0]) + Math.abs(a.data[i + 1] - bg[1]) + Math.abs(a.data[i + 2] - bg[2]) > 12) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  }
  // muzzle end: the last 7 % of the gun (hider, barrel); shell: 45-75 % (handguard)
  const band = (b, f0, f1) => {
    let n = 0, d = 0;
    for (let y = 0; y < H; y++) for (let x = Math.round(x0 + (x1 - x0) * f0); x < Math.round(x0 + (x1 - x0) * f1); x++) {
      const i = (y * W + x) * 4;
      if (Math.abs(a.data[i] - bg[0]) + Math.abs(a.data[i + 1] - bg[1]) + Math.abs(a.data[i + 2] - bg[2]) <= 12) continue;
      n++;
      if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 30) d++;
    }
    return n ? d / n : 0;
  };
  return rest.map((b) => ({ muzzle: band(b, 0.93, 1.0), shell: band(b, 0.45, 0.75) }));
}, [await shot(null), await shot("grinwood"), await shot("tigertooth"), await shot("snowblind")]);
for (const [i, id] of ["grinwood", "tigertooth", "snowblind"].entries()) {
  check(`${id}: the handguard changes against factory (> 50 % of its pixels)`, diff[i].shell > 0.5, JSON.stringify(diff[i]));
  check(`${id}: the muzzle device stays factory (< 3 % of its pixels)`, diff[i].muzzle < 0.03, JSON.stringify(diff[i]));
}

// 3. finishes on the kit gun; 4. older guns flat
const misc = await page.evaluate(async ([wm]) => {
  const { buildWeaponMesh } = await import(new URL(wm, location.href).href);
  const { resolveWeapon, defaultLoadoutFor } = await import(new URL("../weapons/attachments.js?v=cg1-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416", location.href).href);
  const build = (id, skin, lod = 0) => buildWeaponMesh(resolveWeapon(id, { ...defaultLoadoutFor(id), skin }), { lod });
  const fin = {};
  for (const f of ["bronzegrin", "silvergrin", "goldgrin", "diamondgrin", "darkmatter", "ghostglass"]) {
    const g = build("problem416", f);
    let kit = 0, painted = 0;
    g.traverse((o) => { if (o.isMesh && o.material.name === "PF_Kit") { kit++; if (o.material.userData.camo === f) painted++; } });
    fin[f] = { finish: g.userData.finish, parts: !!g.userData.gunParts, kit, painted };
  }
  const flat = {};
  for (const id of ["howl", "kek", "snubgrin"]) {
    const g = build(id, "grinwood");
    let camo = 0, steel = 0, steelKept = 0;
    g.traverse((o) => {
      if (!o.isMesh || Array.isArray(o.material)) return;
      if (o.material.userData.camo === "grinwood") camo++;
      if (o.material.metalness >= 0.8 && !o.material.userData.camo) steelKept++;
      if (o.material.metalness >= 0.8) steel++;
    });
    flat[id] = { tag: g.userData.camo, camo, steel, steelKept };
  }
  return { fin, flat };
}, [WM]);
for (const f of ["bronzegrin", "silvergrin", "goldgrin", "diamondgrin", "darkmatter"]) {
  const r = misc.fin[f];
  check(`${f} on the 416 is paint on the kit (parts kept)`, r.finish === f && r.parts && r.kit > 0 && r.painted === r.kit, JSON.stringify(r));
}
check("ghostglass still swaps the whole gun", misc.fin.ghostglass.finish === "ghostglass" && misc.fin.ghostglass.painted === 0, JSON.stringify(misc.fin.ghostglass));
for (const [id, r] of Object.entries(misc.flat)) check(`${id}: flat camo on its body, steel kept`, r.tag === "grinwood" && r.camo > 0 && r.steelKept === r.steel, JSON.stringify(r));

// 5. the lock: a camo opens at its weapon level (finishUnlocked reads weapon-xp)
const lock = await page.evaluate(async (sk) => {
  // a stand-in signed-in profile, so weapon XP reads the save (this page
  // never talks to the accounts server)
  window.TrollrunnerAccounts = { getCachedProfile: () => ({ userId: "skins-test" }) };
  localStorage.setItem("trollops:wxp", "{}");
  const lo = await import(new URL("../progression/loadout.js?v=skins-test", location.href).href);
  const wx = await import(new URL("../progression/weapon-xp.js?v=wx1", location.href).href);
  const { SKIN_BY_ID } = await import(new URL(sk, location.href).href);
  const lvl1 = wx.weaponLevel("problem416");
  const r = { lvl1, gwAt1: lo.finishUnlocked(SKIN_BY_ID.grinwood, "problem416"), wrapAt1: lo.finishUnlocked(SKIN_BY_ID.grinwrap, "problem416"),
    goldNoPrestige: lo.finishUnlocked(SKIN_BY_ID.goldgrin, "problem416") };
  localStorage.setItem("trollops:wxp", JSON.stringify({ problem416: 2000 }));   // level 4+
  r.lvl = wx.weaponLevel("problem416");
  r.gw = lo.finishUnlocked(SKIN_BY_ID.grinwood, "problem416");
  r.wrap = lo.finishUnlocked(SKIN_BY_ID.grinwrap, "problem416");
  r.otherGun = lo.finishUnlocked(SKIN_BY_ID.grinwood, "kek");
  return r;
}, SK);
check("a new gun (level 1) has every camo locked", lock.lvl1 === 1 && !lock.gwAt1 && !lock.wrapAt1, JSON.stringify(lock));
check("levelled up, Grinwood opens on that gun only; Grinwrap stays locked", lock.lvl >= 4 && lock.lvl < 30 && lock.gw && !lock.wrap && !lock.otherGun, JSON.stringify(lock));
check("a prestige finish keeps its prestige gate", lock.goldNoPrestige === false, JSON.stringify(lock));

check("no page errors", errors.length === 0, errors.slice(0, 4).join(" | "));
await browser.close();
server.close();
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
