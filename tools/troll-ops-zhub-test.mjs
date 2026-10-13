// Troll Forces Zombies hub check (Zombie Rush P5). Tabs in one headless
// browser share a PRIVATE hub code over BroadcastChannel (Supabase is
// blocked; never QZHB, the public hub):
//   1. A and B load the hub: The Hub map, its HUD, five signs.
//   2. A steps on Hollowgrin's pad: both see "Players: 1/4"; B steps on: 2/4.
//   3. A (the owner) holds X: both leave for one co-op run on Hollowgrin, on
//      the same fresh code; A hosts.
//   4. The run ends: both are back in the same hub 8 s later.
//   5. The private pad: B follows A's invite and lands on it, 2/4; a stranger
//      on the pad is in a party of its own; A holds X and A + B go.
//   6. The countdown runs out on a lone player's pad (shortened): it goes.
// Text-overlap scans on the hub HUD. Screenshots for a look.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-zhub-test.mjs
//   SHOTS_DIR=<dir>; PHONE=1 for a landscape phone
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
import { textClash as scanText } from "./troll-ops-text-scan.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const TAG = process.env.PHONE ? "-phone" : "";
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
const ctx = await browser.newContext(process.env.PHONE
  ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
  : { viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// a private hub code, never QZHB (the public hub) and never blank
const HUBROOM = "ZH" + String(Math.floor(Math.random() * 900 + 100));
const errors = [];

async function open(label, query = "") {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED|supabase/i.test(m.text())) errors.push(`${label}: ${m.text()}`); });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1${query}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollHub, null, { timeout: 180000 });
  return page;
}
/* Into the hub on our private hub code (an invite's code when the page has one). */
async function enterHub(page) {
  await page.evaluate(async (room) => {
    const T = window.__trollOps;
    T.setMode("zhub");
    if (!new URLSearchParams(location.search).has("zhub")) {
      T.els.room.value = room;
      T.els.room.dispatchEvent(new Event("input"));
    }
    await T.startGame();
  }, HUBROOM);
}
async function loaded(page, ms = 240000) {
  const t0 = Date.now();
  await sleep(500);
  while (Date.now() - t0 < ms && await page.evaluate(() => window.__trollOps.loadState().open)) await sleep(250);
  // a load without a click lands on the pause screen (no pointer lock): a real
  // player clicks Resume
  await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); if (!T.els.pause.hidden) T.closePauseMenu(); });
}
const until = async (page, fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
const R = (page, fn, arg) => page.evaluate(fn, arg);
const stand = (page, pad) => R(page, (pad) => {
  const H = window.__trollHub, T = window.__trollOps;
  const p = pad === "floor" ? { x: 0, z: 10 } : pad === "priv" ? H.HUB.private : H.HUB.pads.find((q) => q.id === pad);
  T.move.pos.set(p.x + (Math.random() - 0.5) * 0.6, T.move.pos.y, p.z + (Math.random() - 0.5) * 0.6);
}, pad);
const signOf = (page, pad) => R(page, (pad) => window.__trollHub.signs()?.[pad] || "", pad);
const where = (page) => R(page, () => ({ mode: window.__trollOps.modeId(), room: window.__trollOps.net.room, map: window.__trollOps.builtMap()?.map?.name, state: window.__trollHub.state() }));
// the tab in front runs its frames; one behind it may not (headless)
const holdX = async (page, ms = 1400) => { await page.bringToFront(); await R(page, () => window.__trollOps.keys.add("KeyX")); await sleep(ms); await R(page, () => window.__trollOps.keys.delete("KeyX")); };
async function backInHub(page) {
  await until(page, () => window.__trollOps.modeId() === "zhub" && !window.__trollOps.loadState().open, null, 120000);
  await loaded(page);
}

const a = await open("A"), b = await open("B");
await Promise.all([enterHub(a), sleep(400).then(() => enterHub(b))]);
await Promise.all([loaded(a), loaded(b)]);

// ---- 1. the hub
const wa = await where(a), wb = await where(b);
check(wa.map === "The Hub" && wb.map === "The Hub", "both are in The Hub", `${wa.map} / ${wb.map}`);
check(wa.room === HUBROOM && wb.room === HUBROOM, "on the private hub code", `${wa.room} / ${wb.room}`);
const signs = await R(a, () => Object.keys(window.__trollHub.signs() || {}).length);
check(signs === 5, "five pad signs", String(signs));
check(await R(a, () => !document.querySelector(".zhb")?.hidden), "the hub HUD shows");
// the boards: this week's Zombies rows, best wave and kills summed per player
await R(a, () => window.__trollHub.setBoardRows([
  { user_id: "u1", username: "grinlord", meta: { mode: "zombies", wave: 12, kills: 140 } },
  { user_id: "u1", username: "grinlord", meta: { mode: "zombies", wave: 9, kills: 90 } },
  { user_id: "u2", username: "pepe_enjoyer", meta: { mode: "zombies", wave: 15, kills: 60 } },
  // 40 days ago: on neither the weekly nor the monthly board
  { user_id: "u3", username: "old_timer", achieved_at: new Date(Date.now() - 40 * 86400000).toISOString(), meta: { mode: "zombies", wave: 99, kills: 999 } },
]));
const tally = await R(a, () => window.__trollHub.boards());
const monthly = await R(a, () => window.__trollHub.boards("month"));
check(!JSON.stringify([tally, monthly]).includes("old_timer") && monthly.wave[0][0] === "pepe_enjoyer", "boards: last month's run is on neither", JSON.stringify(monthly));
await R(a, () => window.__trollHub.setBoardPeriod("month"));
check(tally.wave[0][0] === "pepe_enjoyer" && tally.wave[0][1] === 15 && tally.kills[0][0] === "grinlord" && tally.kills[0][1] === 230,
  "boards: best wave, kills summed", JSON.stringify(tally));
await R(a, () => { const T = window.__trollOps; T.move.pos.set(0, T.move.pos.y, -2); T.look.yaw = 0; T.look.pitch = 0.12; });
await sleep(800);
await a.screenshot({ path: path.join(SHOTS, `zhub-boards${TAG}.png`) });
// the kiosks (P6 placeholders): X by one opens its screen, Escape shuts it
for (const k of ["weapons", "classes"]) {
  await R(a, (k) => { const T = window.__trollOps, K = window.__trollHub.HUB.kiosks.find((q) => q.id === k); T.move.pos.set(K.x - 1.6, T.move.pos.y, K.z); }, k);
  await sleep(300);
  await holdX(a, 300);
  check(await until(a, () => window.__trollHub.kioskOpen(), null, 3000), `${k} kiosk opens`);
  const txt = await R(a, () => document.querySelector(".zk")?.innerText || "");
  check(/Coming soon/i.test(txt) && /Credits/.test(txt) && (k === "weapons" ? /Tier 4/.test(txt) : /Rookie/.test(txt)), `${k}: placeholder cards and Credits`, txt.replace(/\s+/g, " ").slice(0, 120));
  if (k === "weapons") await a.click(".zk-tab[data-tier='3']");
  await scanText(a, check, `the ${k} kiosk`);
  await a.screenshot({ path: path.join(SHOTS, `zhub-kiosk-${k}${TAG}.png`) });
  await a.keyboard.press("Escape");
  check(await until(a, () => !window.__trollHub.kioskOpen(), null, 3000), `${k} kiosk closes`);
}
await stand(a, "floor"); await stand(b, "floor");
await sleep(600);
await a.screenshot({ path: path.join(SHOTS, `zhub-floor${TAG}.png`) });

// ---- 2. a pad's party
await stand(a, "p2");
check(await until(b, () => /"1\/4"/.test(window.__trollHub.signs()?.p2 || ""), null, 6000), "B's sign: Hollowgrin 1/4", await signOf(b, "p2"));
await stand(b, "p2");
check(await until(a, () => /2\/4/.test(window.__trollHub.signs()?.p2 || ""), null, 6000), "A's sign: 2/4", await signOf(a, "p2"));
const pa = await R(a, () => window.__trollHub.party("p2"));
const idA = await R(a, () => window.__trollOps.net.id);
check(pa.owner === idA, "A owns the pad", JSON.stringify({ idA, pa }));
check(await R(a, () => !document.querySelector(".zhb-hold").hidden) && await R(b, () => document.querySelector(".zhb-hold").hidden), "only the owner has hold X");
await a.screenshot({ path: path.join(SHOTS, `zhub-pad${TAG}.png`) });
await scanText(a, check, "the hub, on a pad");

// ---- 3. go
await holdX(a);
await Promise.all([
  until(a, () => window.__trollOps.modeId() === "zombies", null, 15000),
  until(b, () => window.__trollOps.modeId() === "zombies", null, 15000),
]);
await Promise.all([loaded(a), loaded(b)]);
const ra = await where(a), rb = await where(b);
check(ra.mode === "zombies" && rb.mode === "zombies", "both left for Zombies", `${ra.mode} / ${rb.mode}`);
check(ra.room === rb.room && ra.room !== HUBROOM && /^[A-Z0-9]{5}$/.test(ra.room || ""), "on one fresh code", `${ra.room} / ${rb.room}`);
check(ra.map === "Hollowgrin" && rb.map === "Hollowgrin", "on Hollowgrin", `${ra.map} / ${rb.map}`);
const rolesOf = () => Promise.all([a, b].map((p) => R(p, () => { const c = window.__trollOps.zrun().coop.coop; return { on: c.on, host: c.host }; })));
let roles = await rolesOf();
for (let i = 0; i < 40 && roles[0].host === roles[1].host; i++) { await sleep(250); roles = await rolesOf(); }
check(roles[0].on && roles[1].on && roles[0].host !== roles[1].host, "co-op, one host", JSON.stringify(roles));

// ---- 4. back to the hub
await Promise.all([R(a, () => window.__trollHub.endRun("dead")), R(b, () => window.__trollHub.endRun("dead"))]);
check(await R(a, () => document.getElementById("to-retry-btn").textContent) === "Back to the hub", "the end screen says Back to the hub");
await Promise.all([backInHub(a), backInHub(b)]);
const ha = await where(a), hb = await where(b);
check(ha.mode === "zhub" && hb.mode === "zhub" && ha.room === HUBROOM && hb.room === HUBROOM, "both back in the hub", `${ha.mode} ${ha.room} / ${hb.mode} ${hb.room}`);

// ---- 5. the private pad
await stand(a, "priv");
await sleep(400);
const url = await R(a, () => window.__trollHub.inviteUrl());
const party = new URL(url).searchParams.get("party");
check(new URL(url).searchParams.get("zhub") === HUBROOM && /^[A-Z0-9]{5}$/.test(party || ""), "the invite names the hub and the party", url);
// B takes the link: a fresh tab on it
await b.close();
const b2 = await open("B2", `&zhub=${HUBROOM}&party=${party}`);
const menuScreen = await R(b2, () => window.__toBo2?.menu?.current?.());
check(/zombies/.test(JSON.stringify(menuScreen || "")), "the invite opens the menu on Zombies", JSON.stringify(menuScreen));
await R(b2, () => window.__trollHub.hub.invite = new URLSearchParams(location.search).get("party"));
await enterHub(b2);
await loaded(b2);
check((await where(b2)).room === HUBROOM, "B lands in A's hub");
check(await until(b2, () => window.__trollHub.hub.pad === "priv", null, 5000), "B lands on the private pad");
check(await until(a, () => window.__trollHub.party("priv").members.length === 2, null, 6000), "A's private lobby: 2/4", String(await R(a, () => window.__trollHub.party("priv").members.length)));
// a stranger walking onto the private pad isn't in it
const c = await open("C");
await enterHub(c); await loaded(c);
await stand(c, "priv");
await sleep(2500);
check(await R(a, () => window.__trollHub.party("priv").members.length) === 2, "a stranger on the pad stays out of A's lobby");
check(await R(c, () => window.__trollHub.party("priv").owner === window.__trollOps.net.id), "the stranger owns a lobby of their own");
await stand(c, "floor");
await a.screenshot({ path: path.join(SHOTS, `zhub-private${TAG}.png`) });
await holdX(a);
await Promise.all([until(a, () => window.__trollOps.modeId() === "zombies", null, 15000), until(b2, () => window.__trollOps.modeId() === "zombies", null, 15000)]);
check(await R(c, () => window.__trollOps.modeId()) === "zhub", "the stranger stays in the hub");
await Promise.all([loaded(a), loaded(b2)]);
const pa2 = await where(a), pb2 = await where(b2);
check(pa2.room === pb2.room && pa2.mode === "zombies", "A and B in one private run", `${pa2.room} / ${pb2.room}`);

// ---- 6. the countdown runs out
await R(c, () => { window.__trollHub.HUB_T.countdown = 3; });
await stand(c, "p1");
check(await until(c, () => window.__trollOps.modeId() === "zombies", null, 15000), "a lone player's countdown runs out and goes");
await loaded(c);
check(!!(await where(c)).map, "the run loads a map", (await where(c)).map);

check(!errors.length, "no page errors", errors.slice(0, 6).join(" | "));
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
