// Two-client check for Troll Forces match chat and in-game profiles.
//
// Two tabs in one headless browser join the same private room over
// BroadcastChannel (Supabase blocked, like troll-ops-sync-test.mjs), with fake
// signed-in accounts so account ids travel with each player. Checks:
// all-chat reaches the other side, team chat stays on its side, keys open
// the right channel, account ids reach the scoreboard/roster as profile
// buttons, and a click opens the profile card with that id.
//
// Usage: node tools/troll-ops-chat-test.mjs
//   Needs Playwright (npm i -g playwright, or run from a checkout that has it).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(path.join(process.execPath, "../../lib/node_modules/playwright"))); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 900, height: 560 } });
await ctx.route(/supabase/, (r) => r.abort());   // BroadcastChannel transport
const ROOM = "CHAT" + Math.floor(Math.random() * 9);
const errors = [];
const ACCOUNTS = {
  A: { userId: "11111111-1111-4111-8111-111111111111", username: "alpha" },
  B: { userId: "22222222-2222-4222-8222-222222222222", username: "bravo" },
};

async function open(label) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  // A stand-in for troll-accounts.js: a signed-in profile and a profile card
  // that records which id it was asked for.
  await page.addInitScript((acc) => {
    window.__profileCalls = [];
    const stub = {
      getCachedProfile: () => acc,
      openProfileCard: (id) => window.__profileCalls.push(id),
      openProfile: () => window.__profileCalls.push("self"),
    };
    Object.defineProperty(window, "TrollrunnerAccounts", { get: () => stub, set: () => {}, configurable: true });
  }, ACCOUNTS[label]);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async (room) => {
    const T = window.__trollOps;
    T.composer && (T.composer.render = () => {});
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    await T.startGame();
  }, ROOM);
  return page;
}

const A = await open("A");
const B = await open("B");
await Promise.all([A, B].map((p) => p.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 30000 })));
await sleep(1500);

const info = await Promise.all([A, B].map((p) => p.evaluate(() => {
  const T = window.__trollOps;
  return { id: T.net.id, team: T.net.team, kind: T.net.transport?.kind, peers: [...T.net.peers.values()].map((q) => ({ id: q.id, uid: q.uid, name: q.name })) };
})));
check("both tabs are in the room", info[0].peers.some((q) => q.id === info[1].id) && info[1].peers.some((q) => q.id === info[0].id), JSON.stringify(info));
check("account ids travel with each player", info[0].peers.find((q) => q.id === info[1].id)?.uid === ACCOUNTS.B.userId
  && info[1].peers.find((q) => q.id === info[0].id)?.uid === ACCOUNTS.A.userId);
check("opposite teams (so team chat can be told apart)", info[0].team && info[1].team && info[0].team !== info[1].team, `${info[0].team} / ${info[1].team}`);

// A types in all-chat with the real keys: Enter opens, the form submits.
async function say(page, code, text) {
  return page.evaluate(async ({ code, text }) => {
    document.body.dispatchEvent(new KeyboardEvent("keydown", { code, key: code === "KeyY" ? "y" : "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    const form = document.querySelector(".to-chat-form"), input = document.querySelector(".to-chat-input");
    const chan = document.querySelector(".to-chat-chan").textContent, open = !form.hidden;
    // While the box is open the game's keys stand down.
    document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "w", bubbles: true }));
    input.value = text;
    form.requestSubmit();
    return { chan, open, closed: form.hidden };
  }, { code, text });
}
const all = await say(A, "Enter", "gg from alpha");
check("Enter opens ALL chat and sending closes it", all.open && all.chan === "ALL" && all.closed, JSON.stringify(all));
await sleep(800);
const team = await say(A, "KeyY", "alpha team secret");
check("Y opens TEAM chat", team.open && team.chan === "TEAM", JSON.stringify(team));
await sleep(1000);

const logs = await Promise.all([A, B].map((p) => p.evaluate(() => [...document.querySelectorAll(".to-chat-line")].map((l) => l.textContent))));
check("A sees both of its own lines", logs[0].length === 2, JSON.stringify(logs[0]));
check("B receives the all-chat line", logs[1].some((t) => t.includes("alpha") && t.includes("gg from alpha")), JSON.stringify(logs[1]));
check("B (other team) does not get A's team chat", !logs[1].some((t) => t.includes("alpha team secret")));
const moved = await A.evaluate(() => window.__trollOps.move?.velocity ? Math.hypot(window.__trollOps.move.velocity.x, window.__trollOps.move.velocity.z) : 0);
check("W while typing didn't reach the game", moved < 0.01, `speed ${moved}`);

// B clicks A's name in chat (cursor free) -> profile card for A's account.
const clicked = await B.evaluate(() => {
  const T = window.__trollOps;
  T.chat.setInteractive(true);
  const b = document.querySelector(".to-chat-name[data-uid]");
  b?.click();
  return { uid: b?.dataset.uid, calls: window.__profileCalls.slice() };
});
check("clicking a chat name opens that account's profile", clicked.uid === ACCOUNTS.A.userId && clicked.calls.includes(ACCOUNTS.A.userId), JSON.stringify(clicked));

// Paused roster + lobby roster carry profile buttons for the other player.
const rosters = await B.evaluate(() => {
  const T = window.__trollOps;
  T.renderMenuRoster();
  const menu = [...document.querySelectorAll("#to-menu-roster [data-uid]")].map((b) => b.dataset.uid);
  document.querySelector(`#to-menu-roster [data-uid="${"11111111-1111-4111-8111-111111111111"}"]`)?.click();
  T.renderLobbyRoster();
  const lobby = [...document.querySelectorAll("#to-pf-roster .to-pf-op-name")].map((b) => b.textContent);
  return { menu, lobby, calls: window.__profileCalls.slice() };
});
check("paused roster lists both players as profile buttons", rosters.menu.includes(ACCOUNTS.A.userId) && rosters.menu.includes(ACCOUNTS.B.userId), JSON.stringify(rosters.menu));
check("a paused-roster click opens the profile", rosters.calls.filter((c) => c === ACCOUNTS.A.userId).length >= 2, JSON.stringify(rosters.calls));
check("lobby roster names are profile buttons", rosters.lobby.includes("alpha") && rosters.lobby.includes("bravo"), JSON.stringify(rosters.lobby));

const self = await A.evaluate(() => { document.getElementById("to-pf-profile")?.click(); return { label: document.getElementById("to-pf-profile")?.textContent.trim(), calls: window.__profileCalls.slice() }; });
check("header profile button shows you and opens your profile", self.label === "alpha" && self.calls.includes("self"), JSON.stringify(self));

check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
