// Troll Forces menu: Who's Online and the Server Browser (menu/online.js).
// Supabase is blocked, so the roster is just this tab; joining is tried on
// a PRIVATE code dressed as a server (never a public room).
//   1. The main menu has both; the count in the corner opens Who's Online,
//      which lists us as a guest with what we're doing.
//   2. The Server Browser lists each mode's public room by default.
//   3. Joining a server from the list puts us in its room, on its mode.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-online-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOM = "OL" + String(Math.floor(Math.random() * 900 + 100));
const errors = [];

const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2, null, { timeout: 180000 });
const items = () => page.evaluate(() => [...document.querySelectorAll(".tr-menu-item")].map((e) => e.textContent.trim().replace(/\s+/g, " ")).filter(Boolean));

// ---- 1
const main = await items();
check(main.some((t) => t.startsWith("Server Browser")), "main menu: Server Browser", main.slice(0, 8).join(" | "));
check(main.some((t) => t.startsWith("Who's Online")), "main menu: Who's Online");
await page.click(".to-bo2-online");
await sleep(300);
const cur = await page.evaluate(() => window.__toBo2.menu.current());
const online = await items();
check(cur === "online", "the Online count opens Who's Online", cur);
check(online.some((t) => /Guest\d{3} \(you\)/.test(t)), "...listing us, as a guest", online.slice(0, 4).join(" | "));

// ---- 2
await page.evaluate(() => window.__toBo2.menu.go("servers"));
await sleep(300);
const servers = await items();
for (const name of ["Team Deathmatch", "Zombies"]) check(servers.some((t) => t.startsWith(name)), `servers: ${name}'s public room`, servers.slice(0, 12).join(" | "));

// ---- 3
const joined = await page.evaluate(async (room) => {
  const { game } = await import("/assets/games/troll-ops/core/state.js?v=st1");
  const src = await (await fetch("/assets/games/troll-ops/menu-bo2.js")).text();
  const i = src.indexOf("./menu/online.js?v=");
  const O = await import("/assets/games/troll-ops/" + src.slice(i + 2, src.indexOf(String.fromCharCode(34), i)));
  game.els.noBots.checked = true;
  O.joinServer({ room, mode: "koth", modeName: "King of the Hill", map: "grinsite", players: ["someone"] });
  await new Promise((r) => setTimeout(r, 4000));
  return { room: game.net.room, mode: game.modeId, connected: game.net.connected };
}, ROOM);
check(joined.room === ROOM && joined.mode === "koth" && joined.connected, "joining from the list: that room, its mode", JSON.stringify(joined));

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
