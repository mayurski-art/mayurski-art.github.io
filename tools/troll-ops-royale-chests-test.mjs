// Troll Royale chests on Trollface Island (modes/royale-chests.js): about 60
// a match at the places, every hot place with some, on dry land; holding X a
// second opens one, which spills a better-than-floor gun, ammo and a heal or
// plates in front of it and sends only { k: "chest" }; the wire's chest opens
// with the same items everywhere; bots open them too.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-chests-test.mjs

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

// The game's own module instances: the tags game.js and royale.js import them under.
const GAME = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8");
const ROYALE_URL = "/assets/games/troll-ops/modes/" + GAME.match(/modes\/(royale\.js\?v=[^"]+)/)[1];
const ROYALE_SRC = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/modes/royale.js"), "utf8");
const CHESTS_URL = "/assets/games/troll-ops/modes/" + ROYALE_SRC.match(/\.\/(royale-chests\.js\?v=[^"]+)/)[1];

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async () => { const T = window.__trollOps; T.DROP.enabled = false; T.setMode("royale"); await T.startGame(); });
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging(), null, { timeout: 120000 });
await page.waitForFunction(() => window.__trollOps.royale()?.live, null, { timeout: 30000 });

const info = await page.evaluate(async () => {
  const T = window.__trollOps, r = T.royale(), map = T.builtMap().map;
  const { insidePolygon } = await import("/assets/games/troll-ops/maps/edge.js?v=or1");
  const pois = map.royale.pois, cs = r.chests?.chests || [];
  const hot = pois.map((p, i) => [p, i]).filter(([p]) => p.tier === "hot");
  return {
    map: T.loadedMapId(), n: cs.length, spots: map._chestSpots?.length || 0, loot: r.loot.items.size,
    wet: cs.filter((c) => !insidePolygon(map.edge, c.x, c.z) || insidePolygon(map.wade, c.x, c.z)).length,
    hotEmpty: hot.filter(([p]) => !cs.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < p.r + 3)).map(([p]) => p.name),
    open: cs.filter((c) => c.open).length,
    // the doorways the map keeps clear (map.royale.keepClear): no chest spot, no floor loot
    clear: (map.royale.keepClear || []).length,
    inDoorAt: (map._chestSpots || []).map((p) => ({ ...p, k: "chest" })).concat([...r.loot.items.values()].filter((it) => (it.y ?? it.mesh?.position.y ?? 0) < 0.2))
      .filter((p) => (map.royale.keepClear || []).some(([a, b, c, d]) => p.x >= a && p.x <= c && p.z >= b && p.z <= d)).map((p) => [p.k, +p.x.toFixed(1), +p.z.toFixed(1)]),
  };
});
check("Troll Royale on Trollface Island", info.map === "trollface", info.map);
check("about 120 chest spots on the island", info.spots >= 100 && info.spots <= 140, `${info.spots}`);
check("about 60 chests this match", info.n >= 45 && info.n <= 75, `${info.n}`);
check("every hot place has a chest", info.hotEmpty.length === 0, info.hotEmpty.join(", "));
check("no chest in the sea or the lake", info.wet === 0, `${info.wet}`);
// the band grew with the lake's five places (Trollface Island phase 3) and their deck loot
check("floor loot thinned by about a quarter", info.loot >= 190 && info.loot <= 285, `${info.loot} items`);
check("no chest or floor loot in a doorway", info.clear >= 11 && info.inDoorAt.length === 0, `${info.inDoorAt.length} in ${info.clear} doorways ${JSON.stringify(info.inDoorAt.slice(0, 3))}`);
check("every chest starts shut", info.open === 0, `${info.open} open`);

// Nobody shoots, bots stand still: this part is about us.
await page.evaluate(() => { const T = window.__trollOps; T.__botsUpdate = T.bots.update; T.bots.update = () => {}; T.player.spawnGuard = 1e9; });

// Stand at a chest and hold X.
const opened = await page.evaluate(async ({ CHESTS_URL }) => {
  const T = window.__trollOps, r = T.royale();
  const sent = [];
  const pub = T.net.publishLoot.bind(T.net);
  T.net.publishLoot = (m) => { sent.push(m); return pub(m); };
  const c = r.chests.chests.find((x) => !x.open && x.y < 0.5);
  T.move.pos.set(c.x + Math.sin(c.yaw) * 1.1, c.y + 1, c.z + Math.cos(c.yaw) * 1.1);
  await new Promise((res) => setTimeout(res, 500));
  const prompt = T.els.pickupPrompt && !T.els.pickupPrompt.hidden ? T.els.pickupPromptText.textContent : null;
  T.keys.add("KeyX");
  await new Promise((res) => setTimeout(res, 500));
  const half = c.open;
  await new Promise((res) => setTimeout(res, 900));
  T.keys.delete("KeyX");
  // (standing right there, the ammo and the heal or plates go straight into our pockets)
  const items = [0, 1, 2].map((n) => r.loot.items.get(`c${c.id}.${n}`));
  const { chestContents } = await import(CHESTS_URL);
  const again = chestContents(r.seed, c.id, c.hot);
  return {
    prompt, half, open: c.open, sent: sent.filter((m) => m.k === "chest"), adds: sent.filter((m) => m.k === "add").length,
    kinds: again.map((it) => it.k), gunR: items[0]?.r,
    near: items.filter(Boolean).every((it) => Math.hypot(it.x - c.x, it.z - c.z) < 2.2),
    same: !!items[0] && items.every((it, n) => !it || (it.k === again[n].k && it.w === again[n].w && (it.r | 0) === (again[n].r | 0))),
    id: c.id,
  };
}, { CHESTS_URL });
check("the prompt says to open it", /Open the chest/.test(opened.prompt || ""), opened.prompt);
check("half a second isn't enough", !opened.half);
check("holding X a second opens it", opened.open);
check("it spills a gun, ammo and a heal or plates", opened.kinds.length === 3 && opened.kinds[0] === "gun" && opened.kinds[1] === "ammo" && ["heal", "plate"].includes(opened.kinds[2]), opened.kinds.join(","));
check("the gun is better than common", opened.gunR >= 1, `rarity ${opened.gunR}`);
check("the items land in front of it", opened.near);
check("only \"chest opened\" goes out", opened.sent.length === 1 && opened.sent[0].c === opened.id && opened.adds === 0, JSON.stringify(opened.sent) + ` adds ${opened.adds}`);
check("the contents come from the match seed", opened.same);

// Another player opened one: it opens here with the same items, once.
const wire = await page.evaluate(async ({ ROYALE_URL }) => {
  const T = window.__trollOps, r = T.royale();
  const { onRoyaleLoot } = await import(ROYALE_URL);
  const c = r.chests.chests.find((x) => !x.open);
  const before = r.loot.items.size;
  onRoyaleLoot({ id: "peer" }, { k: "chest", c: c.id });
  const mid = r.loot.items.size;
  onRoyaleLoot({ id: "peer2" }, { k: "chest", c: c.id });
  onRoyaleLoot({ id: "peer" }, { k: "take", i: `c${c.id}.0` });
  return { open: c.open, added: mid - before, twice: r.loot.items.size - mid };
}, { ROYALE_URL });
check("a chest opened on the wire opens here", wire.open && wire.added === 3, `+${wire.added}`);
check("opening it twice spills nothing more; its items take as usual", wire.twice === -1, `${wire.twice}`);

// Bots: let them loose for a while; some go to chests and open them.
await page.evaluate(() => { const T = window.__trollOps; T.bots.update = T.__botsUpdate; });
const t0 = Date.now();
let botOpened = 0;
while (Date.now() - t0 < 60000) {
  await sleep(3000);
  botOpened = await page.evaluate(() => window.__trollOps.royale().chests.chests.filter((c) => c.open).length - 2);
  if (botOpened >= 3) break;
}
check("bots open chests too", botOpened >= 3, `${botOpened} in ${Math.round((Date.now() - t0) / 1000)} s`);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
