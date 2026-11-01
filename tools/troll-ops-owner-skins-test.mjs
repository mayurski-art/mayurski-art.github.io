// Troll Forces: the owner opens every lock (user, 2026-11-01: "having the
// owner badge should mean i have access to everything in the game").
//  1. owner (troll_runner) on a level-1 gun: every skin is open and
//     selectable (camos at any weapon level, prestige finishes), every head
//     and every TROLLS body is wearable
//  2. a signed-in level-1 player: every locked skin carries a visible tag
//     ("LV 12", "P3") saying what opens it, on the BO2 Skin screen too, and
//     no tag overlaps its name or leaves the screen (desktop and phone)
//  3. no page errors
// Supabase is blocked: never a live room.
//
// Usage: node tools/troll-ops-owner-skins-test.mjs [outDir]   (screenshots go to outDir)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "tools", "out"));
fs.mkdirSync(OUT, { recursive: true });
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
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail && !ok ? `  (${detail})` : ""}`); if (!ok) failures++; };

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const GUN = "problem416";
// cosmetics.js under the tag the game imports it with (the same module instance)
const COSMETICS = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/menu/lobby.js"), "utf8")
  .match(/"\.\.\/(characters\/cosmetics\.js\?v=[^"]*)"/)[1];

async function open(username, viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(([name, gun]) => {
    const fake = { getCachedProfile: () => ({ id: `id-${name}`, username: name, xp: 0, level: 1, tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
    localStorage.removeItem("trollops:wxp");
    localStorage.removeItem("trollops:wxp-guest");
    localStorage.setItem("trollops:loadout", JSON.stringify({ weaponId: gun, attachments: {} }));
  }, [username, GUN]);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => !!window.__trollOps?.loadout && !!window.__toBo2, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.evaluate((g) => { const L = window.__trollOps.loadout; L.weaponId = g; L.persist(); L.render(); }, GUN);
  return { ctx, page, errors };
}

// The Customize skin cards (the loadout DOM the BO2 screens are built from):
// their state and the tag each carries.
const cards = (page) => page.evaluate(() => [...document.querySelectorAll(".to-lo-skin")].map((b) => ({
  name: b.querySelector("strong").textContent, locked: b.classList.contains("is-locked"), disabled: b.disabled,
  tag: b.querySelector(".to-lo-skin-lv")?.textContent || "",
})));

// The BO2 Skin screen (Create a Class > Attachments > Skin), what the player
// actually sees: each row's label, value and lock, and whether the value
// overlaps the label or leaves its row or the screen.
const skinScreen = (page) => page.evaluate(() => {
  const m = window.__toBo2.menu;
  while (m.back());
  m.go("atts");
  const slots = [...document.querySelectorAll("#to-lo-atts .to-lo-slot")];
  m.go(`att-${slots.findIndex((s) => s.classList.contains("to-lo-skinrow"))}`);
  const W = innerWidth;
  return [...document.querySelectorAll(".tr-menu-item")].filter((b) => b.offsetParent).map((b) => {
    const lab = b.querySelector("span"), val = b.querySelector("small"), br = b.getBoundingClientRect();
    const lr = lab.getBoundingClientRect(), vr = val?.getBoundingClientRect();
    return { label: lab.textContent, value: val?.textContent || "", locked: b.getAttribute("aria-disabled") === "true",
      overlap: !!vr && vr.left < lr.right - 0.5 && vr.right > lr.left + 0.5 && vr.top < lr.bottom - 0.5 && vr.bottom > lr.top + 0.5,
      outside: (!!vr && (vr.right > br.right + 0.5 || vr.bottom > br.bottom + 0.5 || vr.right > W)) || lr.right > W || lab.scrollWidth > lab.clientWidth + 1 };
  });
});
async function shoot(page, file) {
  // (a news popup can sit over the menu on a first visit: the shot is of the list)
  await page.evaluate(() => {
    const leaf = [...document.querySelectorAll("body *")].find((el) => !el.children.length && /^halloween update$/i.test(el.textContent.trim()));
    let box = leaf;
    while (box && box.parentElement && getComputedStyle(box).position === "static") box = box.parentElement;
    if (box && !box.querySelector(".tr-menu-item")) box.style.visibility = "hidden";
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: file });
  return fs.existsSync(file);
}

// 1. the owner
{
  const { ctx, page, errors } = await open("troll_runner", { width: 1280, height: 800 });
  const st = await page.evaluate(async (g) => {
    const L = window.__trollOps.loadout;
    const wl = (await import(new URL("assets/games/troll-ops/progression/weapon-xp.js?v=wx1-gc1", location.href).href)).weaponLevel(g);
    return { active: L.activeId, wl };
  }, GUN);
  check("owner: the gun is a level-1 gun", st.active === GUN && st.wl === 1, JSON.stringify(st));
  const cs = await cards(page);
  check("owner: the skin row has camos and prestige finishes", cs.length > 10 && cs.some((c) => /^P\d+$/.test(c.tag)) && cs.some((c) => /^LV \d+$/.test(c.tag)), JSON.stringify(cs.map((c) => c.tag)));
  check("owner: no skin is locked", cs.every((c) => !c.locked && !c.disabled), cs.filter((c) => c.locked).map((c) => c.name).join(", "));
  const picked = await page.evaluate(() => {
    const L = window.__trollOps.loadout, bad = [];
    for (const [id, { b }] of L.skinButtons) {
      if (!id) continue;
      b.click();
      if (L.attachments.skin !== id) bad.push(id);
    }
    return bad;
  });
  check("owner: every skin is selectable and equips", picked.length === 0, picked.join(", "));
  const wear = await page.evaluate(async (spec) => {
    const mod = await import(new URL(`assets/games/troll-ops/${spec}`, location.href).href);
    return { heads: mod.HEADS.map((h) => [h.id, mod.canWearHead(h.id)]), bodies: mod.BODIES.map((b) => [b.id, mod.canWearBody(b.id)]) };
  }, COSMETICS).catch((e) => ({ err: e.message }));
  check("owner: every head piece is wearable", wear.heads?.every(([, ok]) => ok), JSON.stringify(wear));
  check("owner: every TROLLS body is wearable", wear.bodies?.every(([, ok]) => ok), JSON.stringify(wear));
  await page.evaluate(() => { const L = window.__trollOps.loadout; L.attachments.skin = "concretejaw"; L.persist(); L.render(); });
  const rows = await skinScreen(page);
  check("owner: the BO2 Skin screen has no locked row", rows.length > 10 && rows.every((r) => !r.locked), JSON.stringify(rows.filter((r) => r.locked).map((r) => r.label)));
  const f = path.join(OUT, "owner-skins.png");
  check(`owner: Skin screen screenshot ${f}`, await shoot(page, f));
  check("owner: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// 2. a level-1 player, desktop and phone
for (const [label, vp] of [["desktop", { width: 1280, height: 800 }], ["phone", { width: 390, height: 844 }]]) {
  const { ctx, page, errors } = await open("rookie", vp);
  const cs = await cards(page);
  const locked = cs.filter((c) => c.locked);
  check(`player (${label}): camos and prestige finishes are locked on a level-1 gun`, locked.length > 5 && locked.some((c) => /^LV \d+$/.test(c.tag)) && locked.some((c) => /^P\d+$/.test(c.tag)), JSON.stringify(locked.map((c) => c.tag)));
  check(`player (${label}): every locked card carries its tag`, locked.every((c) => /^(LV \d+|P\d+)$/.test(c.tag)), JSON.stringify(locked.map((c) => [c.name, c.tag])));
  const rows = await skinScreen(page);
  const lockedRows = rows.filter((r) => r.locked);
  check(`player (${label}): BO2 Skin screen: every locked row shows what it needs`, lockedRows.length === locked.length && lockedRows.every((r) => /^(LV \d+|P\d+)$/.test(r.value)), JSON.stringify(lockedRows.map((r) => [r.label, r.value])));
  check(`player (${label}): BO2 Skin screen: Concrete Jaw says LV 12, Gold Grin says P3`, rows.some((r) => r.label === "Concrete Jaw" && r.value === "LV 12") && rows.some((r) => r.label === "Gold Grin" && r.value === "P3"), JSON.stringify(rows));
  check(`player (${label}): no tag overlaps its name or leaves the row/screen`, rows.every((r) => !r.overlap && !r.outside), JSON.stringify(rows.filter((r) => r.overlap || r.outside)));
  const f = path.join(OUT, `player-skins-${label}.png`);
  check(`player (${label}): Skin screen screenshot ${f}`, await shoot(page, f));
  check(`player (${label}): no page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
