// Troll Royale "Record my match" (modes/royale-record.js): the menu row shows
// under the modes while Troll Royale is picked, the canvas is filmed from the
// moment staging ends onto a recording canvas the window's size (each game
// frame copied in, the sniper scope drawn over it while aimed), the recorder
// stops the moment you die, and Save recording (Esc menu while spectating,
// the results screen after) downloads a non-empty clip named
// troll-royale-YYYYMMDD-HHMM.mp4 (or .webm where the browser has no H.264
// recorder). The next match frees the clip. Private room, solo against bots.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-record-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

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

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, acceptDownloads: true });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps && !!window.__trollRoyaleRecord, null, { timeout: 120000 });

const REC = () => page.evaluate(() => window.__trollRoyaleRecord.royaleRecordState());

// ---- the menu row: Private Match, Troll Royale picked
const menu = await page.evaluate(async () => {
  const R = window.__trollRoyaleRecord;
  try { localStorage.removeItem("trollops:royaleRecord"); } catch {}
  const navText = () => [...document.querySelectorAll(".to-bo2-panel button, nav button, [role=menu] button, button")].map((b) => b.textContent.trim());
  const clickText = (t) => { const b = [...document.querySelectorAll("button")].find((x) => x.offsetParent && x.textContent.trim().startsWith(t)); b?.click(); return !!b; };
  const out = { supported: R.recordSupported() };
  // the Fortnite-style lobby has no Private Match button on top: the screen itself
  window.__toBo2.menu.go("private");
  await new Promise((r) => setTimeout(r, 300));
  out.openedPrivate = [...document.querySelectorAll("*")].some((x) => x.offsetParent && x.children.length === 0 && x.textContent.trim() === "Private Match");
  out.tdmRow = navText().some((t) => t.startsWith("Record my match"));
  out.pickedRoyale = clickText("Troll Royale");
  await new Promise((r) => setTimeout(r, 300));
  const row = [...document.querySelectorAll("button")].find((x) => x.offsetParent && x.textContent.trim().startsWith("Record my match"));
  out.royaleRow = !!row;
  out.before = row?.textContent.trim();
  row?.click();
  await new Promise((r) => setTimeout(r, 200));
  out.after = [...document.querySelectorAll("button")].find((x) => x.offsetParent && x.textContent.trim().startsWith("Record my match"))?.textContent.trim();
  out.pref = R.recordPref();
  out.stored = localStorage.getItem("trollops:royaleRecord");
  return out;
});
check("this browser can record (canvas capture + MediaRecorder)", menu.supported);
check("Private Match: no record row while TDM is picked", menu.openedPrivate && !menu.tdmRow, JSON.stringify({ opened: menu.openedPrivate, tdmRow: menu.tdmRow }));
check("Troll Royale picked: a Record my match row, Off at first", menu.pickedRoyale && menu.royaleRow && /Off/.test(menu.before || ""), menu.before);
check("selecting it turns it On and saves it under trollops:royaleRecord", /On/.test(menu.after || "") && menu.pref && menu.stored === "1", JSON.stringify({ after: menu.after, stored: menu.stored }));

// ---- a private Royale against bots (no plane: straight to "DROP IN")
const room = `RR${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;   // room codes are 5 characters
await page.evaluate(async (room) => {
  const T = window.__trollOps;
  window.__trollRoyaleRecord.setRecordPref(true);
  T.DROP.enabled = false;
  T.setMode("royale");
  T.els.noBots.checked = false;
  T.els.room.value = room;
  T.els.room.dispatchEvent(new Event("input"));
  await T.startGame();
}, room);
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 240000 });
const inRoom = await page.evaluate(() => window.__trollOps.net.room);
check("the match is in the private room", inRoom === room, `${inRoom}`);
const staging = await REC();
check("nothing is filmed during the countdown", !staging.recording && !staging.clip, JSON.stringify(staging));
await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); T.player.spawnGuard = 1e9; });
await page.waitForFunction(() => window.__trollRoyaleRecord.royaleRecordState().recording, null, { timeout: 10000 }).catch(() => {});
const live = await REC();
check("filming starts as the match goes live", live.recording, `${live.mime}`);
check("a REC dot is up, and nothing else", await page.evaluate(() => { const d = document.querySelector(".to-rec-dot"); return !!d && !d.hidden && d.textContent === ""; }));

check("the recording canvas is the window's size", live.size?.w === 960 && live.size?.h === 540, JSON.stringify(live.size));

// ---- aim the sniper: the scope is in the footage
// a Deadpan DSR off the floor (the game's own copy of weapons.js: its tag from game.js)
const weaponsTag = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8").match(/\/weapons\/weapons\.js\?v=([\w-]+)/)[1];
const gun = await page.evaluate(async (tag) => {
  const T = window.__trollOps;
  const { WEAPON_DEFS } = await import(`/assets/games/troll-ops/weapons/weapons.js?v=${tag}`);
  T.royalePickupGun({ id: -1, k: "gun", def: WEAPON_DEFS.deadpan, r: 0 });
  return T.currentWeapon()?.def.id;
}, weaponsTag);
await sleep(800);
await page.evaluate(() => window.__trollOps.setAds(true));
await sleep(1500);
const scoped = await page.evaluate(() => {
  const T = window.__trollOps, c = window.__trollRoyaleRecord.recCanvas();
  const px = (x, y) => [...c.getContext("2d").getImageData(x, y, 1, 1).data.slice(0, 3)];
  const el = document.querySelector(".to-scope");
  return { scopeKey: T.activeWeaponMesh()?.userData.scopeKey, ads: T.currentWeapon().adsT, overlay: el && getComputedStyle(el).opacity,
    corner: px(20, 20), edge: px(80, 270), centre: px(480, 200) };
});
const black = (p) => p.every((v) => v < 12);
check("the sniper is in hand and aimed in", scoped.scopeKey === "scope8" && scoped.ads > 0.99 && +scoped.overlay > 0.99, JSON.stringify({ gun, ...scoped }));
check("the clip shows the scope: black outside the lens, the view inside", black(scoped.corner) && black(scoped.edge) && !black(scoped.centre), JSON.stringify(scoped));
await page.evaluate(() => window.__trollOps.setAds(false));
await sleep(1000);
const unscoped = await page.evaluate(() => { const c = window.__trollRoyaleRecord.recCanvas(); return [...c.getContext("2d").getImageData(20, 20, 1, 1).data.slice(0, 3)]; });
check("aimed out, the scope leaves the footage", !black(unscoped), JSON.stringify(unscoped));

await sleep(4000);   // play a few seconds (bots move, the zone runs)
const fr = await REC();
check("a frame recorded per game frame", fr.frames > 60, `${fr.frames} frames`);

// ---- kill the player
const death = await page.evaluate(() => {
  const T = window.__trollOps;
  T.player.spawnGuard = 0; T.player.armor = 0;
  const wasAlive = T.player.alive;
  T.damagePlayer(9999, null, "zone");
  const s = window.__trollRoyaleRecord.royaleRecordState();
  return { wasAlive, alive: T.player.alive, recording: s.recording, dot: document.querySelector(".to-rec-dot")?.hidden };
});
check("the player dies", death.wasAlive && !death.alive, JSON.stringify(death));
check("the recorder stops the moment you die", !death.recording && death.dot === true, JSON.stringify(death));
await page.waitForFunction(() => !!window.__trollRoyaleRecord.royaleRecordState().clip, null, { timeout: 10000 }).catch(() => {});
const after = await REC();
check("a clip is waiting, cut at the death", after.clip?.reason === "death" && after.clip.size > 20000, JSON.stringify(after.clip));
check("it's named troll-royale-YYYYMMDD-HHMM.mp4 or .webm, matching its type", /^troll-royale-\d{8}-\d{4}\.(mp4|webm)$/.test(after.clip?.name || "")
  && after.clip.name.endsWith(after.clip.type === "video/mp4" ? ".mp4" : ".webm"), `${after.clip?.name} ${after.clip?.type}`);
const head = await page.evaluate(async () => {
  const b = window.__trollRoyaleRecord.clipBlob();
  const u = new Uint8Array(await b.slice(0, 8).arrayBuffer());
  return { type: b.type, hex: [...u].map((x) => x.toString(16).padStart(2, "0")).join("") };
});
const container = head.type === "video/mp4" ? head.hex.slice(8) === "66747970" : head.hex.startsWith("1a45dfa3");
check(`it's a real ${head.type} (${head.type === "video/mp4" ? "ftyp box" : "EBML header"})`, container, JSON.stringify(head));
await sleep(1500);
const later = await REC();
check("spectating doesn't add to it", later.clip?.size === after.clip?.size && !later.recording, `${after.clip?.size} -> ${later.clip?.size}`);

// ---- Save from the Esc menu while spectating
const pauseBtn = await page.evaluate(() => { window.__trollOps.openPauseMenu(); const b = document.querySelector("#to-pause .to-rec-save"); return { shown: !!b && !b.hidden && !!b.offsetParent, text: b?.textContent }; });
check("Esc menu: a Save recording button", pauseBtn.shown && pauseBtn.text === "Save recording", JSON.stringify(pauseBtn));
const [dl1] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.click("#to-pause .to-rec-save")]);
const p1 = await dl1.path();
const size1 = p1 ? fs.statSync(p1).size : 0;
check("Save recording downloads the clip", dl1.suggestedFilename() === after.clip.name && size1 === after.clip.size, `${dl1.suggestedFilename()} ${size1} bytes`);
// the file itself, where ffprobe is on the PATH: 960x540, not the render's size
let probe = null;
try { probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height", "-of", "csv=p=0", p1], { encoding: "utf8" }).trim(); } catch {}
if (probe) check("the saved clip decodes at 960x540", /,960,540$/.test(probe), probe);
else console.log("skip  ffprobe not found: the clip's size wasn't decoded");
await page.evaluate(() => window.__trollOps.closePauseMenu());

// ---- the results screen
await page.evaluate(() => window.__trollOps.endMatch("The Cringe wins"));
await sleep(500);
const go = await page.evaluate(() => { const b = document.querySelector("#to-gameover .to-rec-save"); return { screen: !document.getElementById("to-gameover").hidden, shown: !!b && !b.hidden && !!b.offsetParent }; });
check("results screen: a Save recording button", go.screen && go.shown, JSON.stringify(go));
const [dl2] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.click("#to-gameover .to-rec-save")]);
const p2 = await dl2.path();
const bytes = p2 ? fs.readFileSync(p2) : Buffer.alloc(0);
check("the results-screen save is the same non-empty clip", bytes.length === after.clip.size && bytes.subarray(0, 8).toString("hex") === head.hex, `${bytes.length} bytes`);

// ---- the next match frees it
const freed = await page.evaluate(async () => {
  const T = window.__trollOps, url = window.__trollRoyaleRecord.royaleRecordState().clip?.url;
  T.setupRoyale();
  const s = window.__trollRoyaleRecord.royaleRecordState();
  let gone = false;
  try { await fetch(url); } catch { gone = true; }
  return { clip: s.clip, gone, buttonsHidden: s.buttons.every((b) => b.hidden) };
});
check("the next match frees the clip (blob URL revoked, buttons hidden)", !freed.clip && freed.gone && freed.buttonsHidden, JSON.stringify(freed));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
