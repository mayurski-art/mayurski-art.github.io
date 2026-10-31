// Troll Royale, the jump out of the C-130, phase 4 (modes/royale-team-hud.js,
// docs/ROYALE-EXIT.md): where the squad leader is, at all times, unless
// they're dead. Troll Royale as Trios in a PRIVATE room (Supabase blocked;
// never the public room), us and two bot teammates:
//   - us the only human: we lead ("You lead" heads the panel);
//   - the crown handed to a bot teammate (pinSquadLeader, as if they'd
//     joined first): crown, LEADER, gold, their row first, in the plane,
//     in the fall and on the ground, a crown on the minimap;
//   - behind us: held to the screen's edge with an arrow and the distance;
//   - downed: still there, flashing red; out: the marker's gone, and the
//     crown doesn't pass on;
//   - screenshots of each.
//
//   NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-leader-test.mjs [outDir]
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || path.join(os.tmpdir(), "royale-leader");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.route(/supabase/, (r) => r.abort());
let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const errors = [];
const src = (f) => fs.readFileSync(path.join(ROOT, "assets/games/troll-ops", f), "utf8");
const STATE = "/assets/games/troll-ops/core/state.js?v=st1";
const ROY = "/assets/games/troll-ops/" + src("modes/match-start.js").match(/\.\/royale\.js\?v=[\w-]+/)[0].replace("./", "modes/");
const HUD = "/assets/games/troll-ops/" + src("modes/royale.js").match(/\.\/royale-team-hud\.js\?v=[\w-]+/)[0].replace("./", "modes/");

const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.DROP.lobbySeconds = 30;
  T.setMode("royale_trio");
  T.els.noBots.checked = false;
  T.els.room.value = "SQL" + Math.floor(Math.random() * 900 + 100);   // a private room: never the public one
  T.els.room.dispatchEvent(new Event("input"));
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && window.__trollOps.planes()?.hold?.plane, null, { timeout: 240000 });

// What the HUD shows, read off the page.
const look = (u) => page.evaluate(async ([u]) => {
  const { game } = await import(u);
  const marks = [...document.querySelectorAll(".to-team-mark")];
  const lead = marks.find((m) => m.classList.contains("is-leader"));
  const crown = lead?.querySelector(".to-crown");
  const rows = [...document.querySelectorAll(".to-team-panel > .to-team-row")].filter((r) => !r.hidden);
  return {
    me: game.net.id, leader: game.teamLeader, marks: marks.length,
    lead: lead && { shown: !lead.hidden && getComputedStyle(lead).display !== "none", crown: !!crown && getComputedStyle(crown).display !== "none",
      word: getComputedStyle(lead.querySelector("em")).display !== "none" ? lead.querySelector("em").textContent : "",
      held: lead.classList.contains("is-held"), arrow: getComputedStyle(lead.querySelector("u")).display !== "none",
      down: lead.classList.contains("is-down"), dist: lead.querySelector("small").textContent, xf: lead.style.transform,
      // what it covers of the HUD: the team panel's rows, the minimap
      over: [...document.querySelectorAll(".to-team-panel > .to-team-row:not([hidden]), #to-minimap")].filter((el) => {
        const a = lead.getBoundingClientRect(), b = el.getBoundingClientRect();
        return b.width && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      }).length },
    rows: rows.map((r) => ({ text: r.textContent.trim(), leader: r.classList.contains("is-leader"), me: r.classList.contains("to-team-me") })),
    panelShown: !document.querySelector(".to-team-panel")?.hidden,
  };
}, [u]);
const shot = (n) => page.screenshot({ path: path.join(OUT, n) });
const at = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 240000, polling: 100 });

// 1. In the plane, the squad up: we're the only human, so we lead.
await at(() => window.__trollOps.royale()?.planeT > -8);
let s = await look(STATE);
check(s.leader === s.me, "the only human leads", `${s.leader} / ${s.me}`);
check(s.rows[0]?.me && /You lead/.test(s.rows[0].text), "\"You lead\" heads the panel", JSON.stringify(s.rows));
check(s.marks === 2 && !s.lead, "two teammate markers, no crown on either", `${s.marks}`);
await shot("1-plane-you-lead.png");

// 2. The crown handed to a bot teammate.
const pinned = await page.evaluate(async ([hud]) => {
  const H = await import(hud);
  const id = H.teammates()[1]?.id;   // not the first by name: the row has to move
  H.pinSquadLeader(id);
  return id;
}, [HUD]);
await page.waitForTimeout(300);
s = await look(STATE);
check(s.leader === pinned, "the crown on the bot teammate", `${s.leader} / ${pinned}`);
check(s.lead?.shown && s.lead.crown && s.lead.word === "LEADER", "their marker: crown and LEADER, in the plane", JSON.stringify(s.lead));
check(!s.lead?.held || +s.lead.xf.match(/-?\d+/g)[1] <= 450, "...not under the letterbox", s.lead?.xf);
check(s.rows[0]?.leader && !s.rows.some((r) => r.me), "their row heads the panel, \"You lead\" gone", JSON.stringify(s.rows));
await shot("2-plane-leader.png");

// 3. In the fall.
await at(() => { const r = window.__trollOps.royale(); return r && r.me !== "aboard" && r.planeT > 6; });
s = await look(STATE);
check(s.leader === pinned && s.lead?.shown && s.lead.crown, "in the fall: still crowned", JSON.stringify(s.lead));
await shot("3-fall-leader.png");

// 4. On the ground.
await at(() => window.__trollOps.royale()?.me === "ground" && window.__trollOps.royale()?.live);
await page.waitForTimeout(1500);
s = await look(STATE);
check(s.leader === pinned && s.lead?.shown && s.lead.crown, "on the ground: still crowned", JSON.stringify(s.lead));
const pip = await page.evaluate(async ([u, id]) => {
  const { game } = await import(u);
  return { teamLeader: game.teamLeader, alive: game.remotes.byId.get(id)?.alive };
}, [STATE, pinned]);
check(pip.teamLeader === pinned && pip.alive, "the minimap's crown goes to them (game.teamLeader)", JSON.stringify(pip));
await shot("4-ground-leader.png");

// 5. Behind us: turned away from them.
await page.evaluate(async ([u, id]) => {
  const { game } = await import(u);
  const rp = game.remotes.byId.get(id), m = game.move;
  window.__faceAway = () => { m.yaw = Math.atan2(-(m.pos.x - rp.pos.x), -(m.pos.z - rp.pos.z)) + Math.PI; };
  // keep them a way off, so behind is behind
  const b = game.bots.byId(id);
  if (b) { b.pos.x = m.pos.x + 30; b.pos.z = m.pos.z; }
}, [STATE, pinned]);
for (let i = 0; i < 10; i++) { await page.evaluate(() => window.__faceAway()); await page.waitForTimeout(60); }
s = await look(STATE);
check(s.lead?.shown && s.lead.held && s.lead.arrow, "behind us: held to the edge with an arrow", JSON.stringify(s.lead));
check(/^\d+ m$/.test(s.lead?.dist || "") && parseInt(s.lead.dist) > 5, "...and how far", s.lead?.dist);
const [hx, hy] = (s.lead?.xf.match(/-?\d+/g) || []).map(Number);
check(hx >= 220 && hx <= 740 && hy >= 90 && hy <= 450 && s.lead.over === 0, "...on the ring, clear of the HUD's corners and the team panel", `${hx},${hy} over ${s.lead?.over}`);
await shot("5-ground-behind.png");

// 6. Downed: still there, flashing red.
await page.evaluate(async ([u, id]) => {
  const { game } = await import(u);
  game.bots.applyHit(id, 999, { pierce: true });
  window.__faceAway = () => {};
  game.move.yaw += Math.PI;   // face them again
}, [STATE, pinned]);
await page.waitForTimeout(800);
s = await look(STATE);
check(s.lead?.shown && s.lead.crown && s.lead.down, "downed: the crown stays, flashing", JSON.stringify(s.lead));
await shot("6-ground-down.png");

// 7. Out: the marker goes, and nobody else gets the crown.
await page.evaluate(async ([u, id]) => {
  const { game } = await import(u);
  const { killed } = game.bots.applyHit(id, 999, { pierce: true });
  if (killed) game.net.reportDeathAs(id, null, "zone", false);
}, [STATE, pinned]);
await page.waitForTimeout(1200);
s = await look(STATE);
const dead = await page.evaluate(async ([u, id]) => (await import(u)).game.remotes.byId.get(id)?.alive, [STATE, pinned]);
check(dead === false, "they're out", String(dead));
check(!s.lead?.shown, "out: the leader's marker gone", JSON.stringify(s.lead));
check(s.leader === pinned && !s.rows.some((r) => r.me), "...and the crown doesn't pass on", `${s.leader}`);
await shot("7-ground-out.png");

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
console.log("frames:", OUT);
await browser.close(); server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
