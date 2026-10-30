// Players on the plain stick figure wear the NPCs' 3D trollface head
// (user, 2026-10-30: "individual players playing as stick figure should also
// have that 3D head like the NPCs"), as bots and townsfolk already did:
// someone else in your match (net/remote-players.js), your own body in third
// person (view/third-person.js) and the lobby operator (menu/lobby.js,
// char-inspector.js). A TROLLS / hero / cop body keeps its own head.
// Private room, Supabase blocked. SHOT_DIR (optional) gets screenshots.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-player-head-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOT = process.env.SHOT_DIR;
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

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, name) }); } };

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });

// What a rig's head is wearing: the relief group loaded, on the board, shown.
const HEAD = `(rig) => {
  const r = rig?.reliefFace, head = rig?.parts?.head;
  const g = head?.children.find((c) => c.name === "relief-face");
  return { on: !!r, loaded: !!g, shown: !!g && g.visible, boardHidden: !!head && head.layers.mask === 0 };
}`;

// ---- the lobby operator
await sleep(4000);
const lobby = await page.evaluate(async (HEAD) => {
  const T = window.__trollOps, head = eval(HEAD);
  const h = T.charInspector?.humanoid;
  if (!h) return { missing: true };
  await h.reliefFace?.ready;
  return head(h);
}, HEAD);
check("lobby operator: 3D head", lobby.on && lobby.loaded && lobby.shown, JSON.stringify(lobby));
await shot("head-lobby.png");

// ---- a match: our own body, a remote human, the bots
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  T.loadout.mapId = "grinsite";
  // always a private room, never the public one
  T.els.room.value = "PH" + Math.random().toString(36).slice(2, 6).toUpperCase(); T.els.room.dispatchEvent(new Event("input"));
  if (T.els.noBots) T.els.noBots.checked = false;
  await T.startGame();
  if (T.isStaging()) T.endStaging();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && window.__trollOps.bots.bots.length > 0, null, { timeout: 90000 });
await page.evaluate(() => {
  const T = window.__trollOps;
  T.player.maxHp = T.player.hp = 1e9;
  T.matchIntro?.skip?.();   // (the intro shows your body on purpose)
  if (!T.settings.thirdPerson) T.toggleThirdPerson();
  // A human in the room: a bot's peer copied, minus the bot.
  const src = T.net.peers.get(T.bots.bots[0].id);
  window.__heroTest = undefined;
  const copy = () => Object.assign(T.net.peers.get("human-test") || {}, src, { id: "human-test", name: "someone", isBot: false, botSkill: undefined, hero: window.__heroTest, body: undefined, look: undefined, last: performance.now() });
  T.net.peers.set("human-test", copy());
  window.__copyHuman = setInterval(() => T.net.peers.set("human-test", copy()), 100);
});
await sleep(4000);
const match = await page.evaluate(async (HEAD) => {
  const T = window.__trollOps, head = eval(HEAD);
  await T.localRig.reliefFace?.ready;
  const human = T.remotes.byId.get("human-test");
  await human?.rig.reliefFace?.ready;
  const bot = T.remotes.byId.get(T.bots.bots[0].id);
  await bot?.rig.reliefFace?.ready;
  return { local: head(T.localRig), human: human ? head(human.rig) : null, bot: bot ? head(bot.rig) : null, tp: !!T.settings.thirdPerson };
}, HEAD);
check("own body in third person: 3D head", match.tp && match.local.on && match.local.loaded && match.local.shown, JSON.stringify(match.local));
check("another player: 3D head", !!match.human?.on && match.human.loaded, JSON.stringify(match.human));
check("bots still: 3D head", !!match.bot?.on && match.bot.loaded, JSON.stringify(match.bot));
await shot("head-third-person.png");

// (user, 2026-10-30: every bot is just "bot")
const names = await page.evaluate(() => [...new Set(window.__trollOps.bots.bots.map((b) => b.name))]);
check("bots are all named bot", names.length === 1 && names[0] === "bot", JSON.stringify(names));

// A hero body (U Mad Bro?) brings its own head: the relief comes off. The
// rule no longer tells players from bots, so a bot in one (the funny mode's
// path: bot.hero on the wire) stands for anyone.
const hero = await page.evaluate(async (HEAD) => {
  const T = window.__trollOps, head = eval(HEAD);
  const b = T.bots.bots[0];
  b.hero = "knight";
  await new Promise((r) => setTimeout(r, 2000));
  const h = T.remotes.byId.get(b.id);
  const out = h ? { hero: h.peer.hero, ...head(h.rig) } : { gone: true };
  b.hero = undefined;
  return out;
}, HEAD);
check("in a hero body: no relief head", !hero.gone && hero.hero === "knight" && !hero.on && !hero.loaded, JSON.stringify(hero));

// First person: our own head stays out of the view.
const fp = await page.evaluate(async () => {
  const T = window.__trollOps;
  clearInterval(window.__copyHuman);
  T.net.peers.delete("human-test");
  T.matchIntro?.skip?.();
  if (T.settings.thirdPerson) T.toggleThirdPerson();
  await new Promise((r) => setTimeout(r, 800));
  const r = T.localRig;
  let shown = r.root.visible;
  for (let o = r.parts.head; o && shown; o = o.parent) shown = o.visible;
  return { rootVisible: r.root.visible, headShown: shown };
});
check("first person: own head not drawn", !fp.headShown, JSON.stringify(fp));
await shot("head-first-person.png");

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
