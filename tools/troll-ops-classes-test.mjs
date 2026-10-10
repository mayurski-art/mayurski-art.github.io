// Troll Forces classes test: five saved classes (BO2 Create a Class). An old
// single-loadout save becomes Class 1 (and 2-5 copies of it); each class
// keeps its own guns, gear and three scorestreaks; switching class switches
// what you carry and the streak picker; a rename sticks; a cloud copy of the
// save reloads whole (classes and attachments).
// Supabase is blocked: the page must never join the live public room.
//
// Usage: node tools/troll-ops-classes-test.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  // The owner account: every level gate is open, so any pick is valid.
  const fake = { getCachedProfile: () => ({ username: "troll_runner", tags: [] }) };
  Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
  if (!sessionStorage.getItem("seeded")) {
    sessionStorage.setItem("seeded", "1");
    // A v1 save: one loadout, the streaks in their own key.
    localStorage.setItem("trollops:loadout", JSON.stringify({
      weaponId: "snubgrin", secondaryId: "sixtynine", meleeId: "trollsaber",
      lethalId: "frag", tacticalId: "smoke", throwKind: "tactical", attachments: {},
    }));
    localStorage.setItem("trollops:streaks", JSON.stringify({ selected: ["uav", "k9", "warship"] }));
  }
});
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await page.waitForTimeout(1500);

// 1. The old save, migrated.
const m = await page.evaluate(() => {
  const { loadout: L, streakPicker: P } = window.__trollOps;
  const saved = JSON.parse(localStorage.getItem("trollops:loadout"));
  return {
    n: L.classes.length, active: L.active, names: L.classes.map((c) => c.name),
    weapons: L.classes.map((c) => c.weaponId), melee: L.melee.id, throwable: L.throwable.id,
    streaks: [...P.selected], classStreaks: L.classes.map((c) => c.streaks.join("/")),
    savedV: saved.v ?? null,
  };
});
check("an old save becomes five classes", m.n === 5 && m.active === 0, JSON.stringify(m.names));
check("Class 1 is the old loadout", m.weapons[0] === "snubgrin" && m.melee === "trollsaber" && m.throwable === "smoke", `${m.weapons[0]} ${m.melee} ${m.throwable}`);
check("Classes 2-5 start as copies of it", m.weapons.every((w) => w === "snubgrin") && m.names.join(",") === "Class 1,Class 2,Class 3,Class 4,Class 5", m.weapons.join(","));
check("the old streak picks came along", m.streaks.join("/") === "uav/k9/warship" && m.classStreaks.every((s) => s === "uav/k9/warship"), m.streaks.join("/"));

// 2. Edit Class 2, then switch between them.
const sw = await page.evaluate(() => {
  const { loadout: L, streakPicker: P } = window.__trollOps;
  L.setActiveClass(1);
  L.weaponId = "shotgun";
  L.meleeId = "keyboard";
  L.throwKind = "lethal";
  L.persist();
  P.toggle("uav");   // drop one, then add another
  P.toggle("swarm");
  const two = { gun: L.resolved.id, melee: L.melee.id, throwable: L.throwable.id, streaks: [...P.selected] };
  L.setActiveClass(0);
  const one = { gun: L.resolved.id, melee: L.melee.id, throwable: L.throwable.id, streaks: [...P.selected] };
  L.setActiveClass(1);
  const twoAgain = { gun: L.resolved.id, streaks: [...P.selected] };
  const saved = JSON.parse(localStorage.getItem("trollops:loadout"));
  return { two, one, twoAgain, savedActive: saved.active, savedV: saved.v, flat: saved.weaponId,
    mirror: JSON.parse(localStorage.getItem("trollops:streaks")).selected };
});
check("Class 2 carries its own picks", sw.two.gun === "shotgun" && sw.two.melee === "keyboard" && sw.two.throwable === "frag", JSON.stringify(sw.two));
check("Class 2 has its own three scorestreaks", sw.two.streaks.includes("swarm") && !sw.two.streaks.includes("uav"), sw.two.streaks.join("/"));
check("back on Class 1, everything is Class 1's again", sw.one.gun === "snubgrin" && sw.one.melee === "trollsaber" && sw.one.throwable === "smoke" && sw.one.streaks.join("/") === "uav/k9/warship", JSON.stringify(sw.one));
check("and Class 2 kept its edits", sw.twoAgain.gun === "shotgun" && sw.twoAgain.streaks.includes("swarm"), JSON.stringify(sw.twoAgain));
check("the save is v2 with the active class (and its picks flat, for old builds)", sw.savedV === 2 && sw.savedActive === 1 && sw.flat === "shotgun", `v${sw.savedV} active ${sw.savedActive} flat ${sw.flat}`);
check("the streak key mirrors the active class", sw.mirror.includes("swarm"), sw.mirror.join("/"));

// 3. Rename.
const rn = await page.evaluate(() => {
  const { loadout: L } = window.__trollOps;
  const ok = L.renameClass(2, "  Sniper <Boi>!! ");
  const bad = L.renameClass(3, "   ");
  return { ok, bad, name: L.classes[2].name, saved: JSON.parse(localStorage.getItem("trollops:loadout")).classes[2].name };
});
check("a rename is cleaned and saved", rn.ok && rn.name === "Sniper Boi!!" && rn.saved === "Sniper Boi!!", JSON.stringify(rn));
check("an empty name is refused", rn.bad === false);

// 4. A cloud copy of the save arrives: the whole thing reloads.
const cl = await page.evaluate(() => {
  const { loadout: L } = window.__trollOps;
  const saved = JSON.parse(localStorage.getItem("trollops:loadout"));
  saved.classes[3].weaponId = "snicker";
  saved.attachments.snicker = { ...(saved.attachments.snicker || {}), skin: null, barrel: "long" };
  localStorage.setItem("trollops:loadout", JSON.stringify(saved));
  const changed = L.restoreSaved();
  return { changed, w: L.classes[3].weaponId, barrel: L.attachmentsByWeapon.snicker?.barrel };
});
check("a cloud copy reloads the classes and the attachments", cl.changed && cl.w === "snicker" && cl.barrel === "long", JSON.stringify(cl));

// 5. A reload keeps it all.
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await page.waitForTimeout(1500);
const rl = await page.evaluate(() => {
  const { loadout: L, streakPicker: P } = window.__trollOps;
  return { active: L.active, gun: L.resolved.id, name: L.classes[2].name, w4: L.classes[3].weaponId, streaks: [...P.selected] };
});
check("after a reload: the same class, picks, names and streaks", rl.active === 1 && rl.gun === "shotgun" && rl.name === "Sniper Boi!!" && rl.w4 === "snicker" && rl.streaks.includes("swarm"), JSON.stringify(rl));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `CLASSES RED: ${failures} failed` : "CLASSES GREEN");
process.exit(failures ? 1 : 0);
