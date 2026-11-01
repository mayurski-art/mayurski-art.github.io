// Troll Forces Zombies economy check (design doc "Zombies economy",
// claude.ai/artifact/CX7UuR3ybkeUvvNrbk9muS). Solo, no network, Supabase
// blocked. One section per system; run one with ONLY=<name>:
//   points   a hit pays 10, the first 6 hits a zombie only, a shotgun's
//            pellets once; a kill pays by type (walker 50, headshot 100,
//            melee 130); the HUD shows points with no $; the upgrade column
//            is priced in points.
//   walls    you start with the melee only; the map's six chalk walls hang
//            on solid wall with nothing in front of them (CLAUDE.md rule 9:
//            rays from a grid of eye points to a grid on each outline, and
//            a head-on shot plus two angles of each); the Starter wall's gun
//            is free once, a gun you carry sells ammo at half, a second gun
//            fills the empty slot, a third replaces the one in your hands,
//            no points no buy, ammo is finite, the gun tier carries over;
//            no grenades to start, the Frags wall tops you up to 4 for 250
//            ("full" at 4), and G throws a frag whatever the class carries.
//
//   Run it for each Zombies map: pentagrin, hollowgrin, trollcity.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-zecon-test.mjs [mapId]
//   SHOTS_DIR=<dir>
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const ONLY = process.env.ONLY || "";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const map = process.argv[2] || "hollowgrin";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (name) => !ONLY || ONLY === name;

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
// solo, no room code: a Zombies run here never touches the network
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async (map) => {
  const T = window.__trollOps;
  T.setMode("zombies");
  T.loadout.poolMapId = map;
  await T.startGame();
  if (T.isStaging?.()) T.endStaging();
  if (!T.els.pause.hidden) T.closePauseMenu();
}, map);
await page.waitForFunction(() => !!window.__trollOps.zdir() && window.__trollOps.zdir().round >= 1, null, { timeout: 120000 });
// no power-ups: a Double Points would double what we measure
await page.evaluate(() => window.__trollOps.zrun().drops.force(null, 0));

const R = (fn, arg) => page.evaluate(fn, arg);
const waitAlive = (n) => page.waitForFunction((n) => window.__trollOps.zdir().zombies.filter((q) => q.alive && !q.dying && !q.type.boss).length >= n, n, { timeout: 120000 }).then(() => true).catch(() => false);
const cash = () => R(() => window.__trollOps.zrun().econ.cash);
/* `n` hits of `dmg` on a fresh zombie, `gap` ms apart; what they paid. */
const hits = (opt) => R(async ({ n, dmg, gap, head, melee }) => {
  const T = window.__trollOps;
  const fresh = () => T.zdir().zombies.find((q) => q.alive && !q.dying && !q.type.boss && !q.paidHits && !(q.riseT > 0));
  for (let t = 0; t < 600 && !fresh(); t++) await new Promise((r) => setTimeout(r, 100));
  const z = fresh();
  if (!z) return null;
  if (melee) T.setHolding("melee");
  const c0 = T.zrun().econ.cash;
  for (let i = 0; i < n; i++) {
    if (melee) T.player.melee.t = 0.1;
    const point = z.mesh.position.clone(); point.y += 1.5;
    T.onBulletActorHit(z, { damage: dmg, isHead: !!head, point, dir: new T.THREE.Vector3(0, 0, -1) });
    if (gap) await new Promise((r) => setTimeout(r, gap));
  }
  if (melee) { T.player.melee.t = 0; T.setHolding("gun"); }
  return { paid: T.zrun().econ.cash - c0, type: z.type.id, dying: z.dying, hp: z.hp };
}, opt);

if (want("points")) {
  await waitAlive(3);
  // eight scratch hits: six paid
  const a = await hits({ n: 8, dmg: 1, gap: 90 });
  check(a && a.paid === 60, "8 hits pay 60 (10 each, first 6 only)", JSON.stringify(a));
  // nine pellets in one shot: one hit
  const b = await hits({ n: 9, dmg: 1, gap: 0 });
  check(b && b.paid === 10, "a shot's pellets pay once", JSON.stringify(b));
  // kills, by type
  const pay = { walker: 50, runner: 60, leaper: 70, spitter: 90, bloater: 90, armoured: 100, brute: 120 };
  const k = await hits({ n: 1, dmg: 1e7, gap: 0 });
  check(k && k.dying && k.paid === pay[k.type], `a ${k?.type} kill pays ${pay[k?.type]}`, JSON.stringify(k));
  await waitAlive(2);
  const h = await hits({ n: 1, dmg: 1e7, gap: 0, head: true });
  check(h && h.dying && h.paid === pay[h.type] + 50, `a ${h?.type} headshot kill pays ${pay[h?.type] + 50}`, JSON.stringify(h));
  await waitAlive(2);
  const m = await hits({ n: 1, dmg: 1e7, gap: 0, melee: true });
  check(m && m.dying && m.paid === pay[m.type] + 80, `a ${m?.type} melee kill pays ${pay[m?.type] + 80}`, JSON.stringify(m));
  await sleep(400);
  const hud = await R(() => ({
    cash: document.querySelector(".zh-cash-n")?.textContent || "",
    feed: document.querySelector(".zh-feed")?.textContent || "",
    prices: [...document.querySelectorAll(".zh-card .zh-price")].map((e) => e.textContent),
    offers: window.__trollOps.zrun().offers().map((o) => `${o.id}:${o.price}`),
    deploy: window.__trollOps.zrun().deployOffers().map((o) => `${o.id}:${o.price}`),
  }));
  check(/^[\d,]+$/.test(hud.cash) && Number(hud.cash.replace(/,/g, "")) === await cash(), "the HUD shows the points, no $", hud.cash);
  check(/MELEE KILL/.test(hud.feed) && !/\$/.test(hud.feed), "the feed reads +N ... KILL, no $", hud.feed);
  check(hud.offers.join() === "hp:1000,gun:1500,melee:500", "upgrades: health 1,000, gun tier 1,500, melee 500", hud.offers.join());
  check(hud.deploy.join() === "turret:1000,barricade:750,barrel:500", "deployables: 1,000 / 750 / 500", hud.deploy.join());
  check(!hud.prices.some((p) => p.includes("$")), "no $ on any card", hud.prices.join(" "));
  await page.screenshot({ path: path.join(SHOTS, "zecon-points.png") });
}

if (want("walls")) {
  // no zombies in the way of the camera or the hold
  await R(() => { const T = window.__trollOps; T.zdir().clear(); T.zdir().state = "between"; T.zdir().breakT = 1e6; T.player.hp = T.player.maxHp = 1e9; });
  const start = await R(() => {
    const T = window.__trollOps, p = T.player;
    T.switchWeapon("primary");
    return { gunless: !!p.gunless, holding: p.holding, secondary: p.secondaryId, hint: document.querySelector(".zb-hint")?.textContent || "",
      gear: { lethal: p.gear.lethal, tactical: p.gear.tactical, chip: !T.els.gearLethal.classList.contains("is-uncarried") } };
  });
  check(start.gunless && start.holding === "melee" && !start.secondary, "no gun to start: the melee only, and 1 doesn't draw one", JSON.stringify(start));
  await sleep(300);
  const hint = await R(() => document.querySelector(".zb-hint:not([hidden])")?.textContent || "");
  check(/Starter wall/.test(hint), "the hint says where your gun is", hint);

  const walls = await R(() => window.__trollOps.zrun().walls.walls.map((w) => ({ gun: w.gunId, starter: w.starter, snapped: w.snapped, x: w.pos.x, y: w.spot.y, z: w.pos.z, nx: w.n.x, nz: w.n.z, face: w.spot.face })));
  check(walls.length === 7, "six wall guns and a Frags wall", walls.map((w) => w.gun).join(","));
  check(walls.filter((w) => w.gun === "frags").length === 1, "one Frags wall");
  check(walls.every((w) => w.snapped), "each one found its wall", walls.filter((w) => !w.snapped).map((w) => w.gun).join(",") || "all");

  // rule 9: in front of each outline, nothing; behind it, solid wall
  const clear = await R(() => {
    const T = window.__trollOps, THREE = T.THREE;
    const rc = new THREE.Raycaster();
    const root = T.builtMap().root;
    const out = [];
    for (const w of T.zrun().walls.walls) {
      const n = w.n, side = new THREE.Vector3(n.z, 0, -n.x);
      const faces = [];
      for (const u of [-0.74, -0.37, 0, 0.37, 0.74]) for (const v of [1.04, 1.45, 1.86]) faces.push(w.pos.clone().addScaledVector(side, u).setY(w.spot.y + v));
      let blocked = 0, holes = 0, rays = 0, worst = "";
      const behind = [];
      for (const f of faces) {
        // behind the chalk: wall within 15 cm
        rc.set(f.clone().addScaledVector(n, 0.2), n.clone().negate());
        rc.far = 0.4;
        const bh = rc.intersectObject(root, true).find((h) => h.object.visible);
        if (!bh) { holes++; worst = `hole at ${f.x.toFixed(1)},${f.y.toFixed(1)},${f.z.toFixed(1)}`; } else behind.push(bh);
        for (const d of [1.2, 2.2]) for (const s of [-1.2, 0, 1.2]) for (const eye of [1.0, 1.6]) {
          const e = w.pos.clone().addScaledVector(n, d).addScaledVector(side, s).setY(w.spot.y + eye);
          const dir = f.clone().sub(e); const len = dir.length(); dir.normalize();
          rc.set(e, dir); rc.far = len - 0.06;
          const hit = rc.intersectObject(root, true).find((h) => h.object.visible);
          rays++;
          if (hit) { blocked++; worst = `${hit.object.name || hit.object.type} at ${hit.distance.toFixed(2)} of ${len.toFixed(2)}`; }
        }
      }
      // one flat surface under the whole outline: no poster, sign or frame
      // under the chalk. One building's own boards (hg-barn_1, hg-barn_5:
      // its siding) count as one wall; anything else under it doesn't.
      const objs = new Set(behind.map((h) => h.object));
      const owners = new Set([...objs].map((o) => (o.name ? o.name.split("_")[0] : `?${o.id}`)));
      const depth = behind.length ? Math.max(...behind.map((h) => h.distance)) - Math.min(...behind.map((h) => h.distance)) : 0;
      if (owners.size > 1 || depth > 0.06) { holes++; worst = `not flat: ${objs.size} objects (${[...objs].map((o) => o.name || o.type).join(",")}), ${depth.toFixed(3)} m deep`; }
      out.push({ gun: w.gunId, blocked, holes, rays, worst });
    }
    return out;
  });
  for (const c of clear) check(c.blocked === 0 && c.holes === 0, `${c.gun}: nothing in front, solid behind`, `${c.blocked}/${c.rays} blocked, ${c.holes} bad behind ${c.worst}`);

  // each one head-on and from two angles
  for (const [i, w] of walls.entries()) {
    for (const [tag, ang] of [["front", 0], ["left", 0.6], ["right", -0.6]]) {
      await R(({ w, ang }) => {
        const T = window.__trollOps;
        const a = w.face + ang;
        T.move.pos.set(w.x + Math.sin(a) * 2.6, w.y, w.z + Math.cos(a) * 2.6);
        T.look.yaw = a; T.look.pitch = -0.04;
      }, { w, ang });
      await sleep(350);
      await page.screenshot({ path: path.join(SHOTS, `zecon-wall-${map}-${i}-${w.gun}-${tag}.png`) });
    }
  }

  /* Stand at wall `gun` and hold X; what the prompt said and what changed. */
  const holdAt = async (gun) => {
    const w = walls.find((q) => (gun === "starter" ? q.starter : q.gun === gun && !q.starter));
    await page.bringToFront();
    await R((w) => { const T = window.__trollOps; T.move.pos.set(w.x + w.nx * 1.0, w.y, w.z + w.nz * 1.0); T.look.yaw = w.face; T.look.pitch = 0; }, w);
    // this wall's prompt, not the last one's: the nearest wall is this one, and a frame has drawn it
    await page.waitForFunction((w) => {
      const n = window.__trollOps.zrun().walls.nearWall();
      return !!n && Math.abs(n.pos.x - w.x) < 0.01 && Math.abs(n.pos.z - w.z) < 0.01;
    }, w, { timeout: 5000, polling: 50 }).catch(() => {});
    await sleep(120);
    await page.waitForFunction(() => !!document.querySelector(".zb-prompt:not([hidden]) .zb-t"), null, { timeout: 5000, polling: 100 }).catch(() => {});
    const prompt = await R(() => ({ t: document.querySelector(".zb-prompt:not([hidden]) .zb-t")?.textContent || "", poor: !!document.querySelector(".zb-prompt .is-poor") }));
    const c0 = await cash();
    const n0 = await R(() => window.__trollOps.zrun().walls.st.buys);
    // held till the buy lands (frames run slow with other tabs going), 3 s at most
    await page.keyboard.down("KeyX");
    await page.waitForFunction((n0) => window.__trollOps.zrun().walls.st.buys > n0, n0, { timeout: 3000, polling: 50 }).catch(() => {});
    await page.keyboard.up("KeyX");
    await sleep(150);
    const after = await R(() => {
      const T = window.__trollOps, p = T.player, cw = T.currentWeapon();
      return { gunless: !!p.gunless, primary: p.weaponId, secondary: p.secondaryId, holding: p.holding, held: cw?.def.id, mag: cw?.ammoInMag, reserve: cw?.ammoReserve, full: cw ? cw.def.reserveMax - cw.def.magSize : null, dmg: cw?.def.damage };
    });
    return { prompt, paid: c0 - await cash(), ...after };
  };

  await R(() => { window.__trollOps.zrun().econ.cash = 0; });
  const free = await holdAt("starter");
  check(/^Hold X · .+ · FREE$/.test(free.prompt.t), "the Starter wall: Hold X · gun · FREE", free.prompt.t);
  check(!free.gunless && free.holding === "gun" && free.paid === 0, "the first one's free, and in your hands", JSON.stringify(free));
  check(free.reserve === free.full && Number.isFinite(free.reserve), "with a full, finite reserve", `${free.reserve} / ${free.full}`);
  await R(() => { const w = window.__trollOps.currentWeapon(); w.ammoInMag = 0; w.ammoReserve = 0; window.__trollOps.zrun().econ.cash = 1000; });
  const ammo = await holdAt("starter");
  check(/ammo · 250$/.test(ammo.prompt.t) && ammo.paid === 250 && ammo.reserve === ammo.full && ammo.mag > 0, "again: ammo, 250, full", `${ammo.prompt.t} paid ${ammo.paid}, ${ammo.mag}+${ammo.reserve}`);

  await R(() => { window.__trollOps.zrun().econ.cash = 100; });
  const poor = await holdAt("sixtynine");
  check(poor.prompt.poor && poor.paid === 0 && !poor.secondary, "100 points: the price is red and nothing's bought", JSON.stringify(poor));
  await R(() => { window.__trollOps.zrun().econ.cash = 600; });
  const second = await holdAt("sixtynine");
  check(second.paid === 500 && second.secondary === "sixtynine" && second.held === "sixtynine", "a second gun: 500, into the empty slot", JSON.stringify(second));
  // the gun tier carries over to the next wall gun
  await R(() => { const R = window.__trollOps.zrun(); R.econ.cash = 1500; R.buy("gun"); R.econ.cash = 750; });
  const third = await holdAt("true69");
  const base = await R(() => { const T = window.__trollOps; return T.WEAPON_DEFS?.true69?.damage ?? null; });
  check(third.paid === 750 && third.secondary === "true69" && third.primary === free.primary, "a third: 750, in place of the one in your hands", JSON.stringify(third));
  check(base == null || Math.abs(third.dmg / base - 1.25) < 0.2, "at the run's gun tier", `${third.dmg} vs ${base}`);
  await page.screenshot({ path: path.join(SHOTS, `zecon-walls-${map}-bought.png`) });

  // Frags: none to start, whatever the class carries; the wall tops up to 4
  const gear = () => R(() => {
    const T = window.__trollOps, g = T.player.gear;
    return { lethal: g.lethal, tactical: g.tactical, chip: !T.els.gearLethal.classList.contains("is-uncarried") };
  });
  const g0 = start.gear || await gear();
  check(g0.lethal === 0 && g0.tactical === 0 && g0.chip, "no grenades to start, and the frag chip shows", JSON.stringify(g0));
  await R(() => { window.__trollOps.zrun().econ.cash = 100; });
  const fPoor = await holdAt("frags");
  check(fPoor.prompt.poor && fPoor.paid === 0 && (await gear()).lethal === 0, "100 points: Frags red, none bought", fPoor.prompt.t);
  await R(() => { window.__trollOps.zrun().econ.cash = 600; });
  const f1 = await holdAt("frags");
  const g1 = await gear();
  check(f1.prompt.t === "Hold X · Frags · 250" && f1.paid === 250 && g1.lethal === 4, "Frags: 250 for four", `${f1.prompt.t} paid ${f1.paid}, ${g1.lethal}`);
  const full = await holdAt("frags");
  check(full.prompt.t === "Frags · full" && full.paid === 0, "four already: 'full', and nothing's charged", `${full.prompt.t} paid ${full.paid}`);
  // G throws a frag even when the class carries a tactical
  await R(() => { const T = window.__trollOps; T.loadout.throwKind = "tactical"; T.updateGearHud?.(); T.move.pos.x += T.zrun().walls.walls[0].n.x * 2; });
  await page.keyboard.down("KeyG"); await sleep(250); await page.keyboard.up("KeyG");
  await page.waitForFunction(() => window.__trollOps.player.gear.lethal < 4, null, { timeout: 4000, polling: 50 }).catch(() => {});
  const g2 = await gear();
  await R(() => { window.__trollOps.loadout.throwKind = "lethal"; });
  check(g2.lethal === 3 && g2.tactical === 0, "G throws a frag (class carries a flashbang)", JSON.stringify(g2));
  const f2 = await holdAt("frags");
  check(f2.paid === 250 && (await gear()).lethal === 4, "three left: 250 tops it back to four", `paid ${f2.paid}`);

  // Fire Sale: walls half price, the full one struck through; upgrades stay full
  const up0 = await R(() => window.__trollOps.zrun().offers().map((o) => `${o.id}:${o.price}`).join());
  await R(() => {
    const T = window.__trollOps, p = T.move.pos;
    T.player.gear.lethal = 0; T.zrun().econ.cash = 1000;
    T.zrun().drops.spawn("firesale", p.x, p.y, p.z);
  });
  await page.waitForFunction(() => window.__trollOps.zrun().drops.dropFx.firesale > 0, null, { timeout: 5000, polling: 50 }).catch(() => {});
  const fs1 = await holdAt("frags");
  check(fs1.paid === 125 && (await gear()).lethal === 4, "Fire Sale: Frags 125", `${fs1.prompt.t} paid ${fs1.paid}`);
  check(/Frags · 250 125$/.test(fs1.prompt.t), "the prompt strikes 250 through, 125 beside it", fs1.prompt.t);
  const up1 = await R(() => window.__trollOps.zrun().offers().map((o) => `${o.id}:${o.price}`).join());
  check(up1 === up0, "the upgrade column stays full price", `${up0} -> ${up1}`);
  await R(() => { const w = window.__trollOps.currentWeapon(); w.ammoReserve = 0; window.__trollOps.zrun().econ.cash = 1000; });
  const held = await R(() => window.__trollOps.currentWeapon().def.id);
  const fs2 = await holdAt(held);
  const m = fs2.prompt.t.match(/ammo · ([\d,]+) ([\d,]+)$/);
  const [full2, half2] = m ? [Number(m[1].replace(/,/g, "")), Number(m[2].replace(/,/g, ""))] : [0, -1];
  check(m && half2 === Math.round(full2 / 2 / 5) * 5 && fs2.paid === half2, `Fire Sale: ${held} ammo at half`, `${fs2.prompt.t} paid ${fs2.paid}`);
  await page.screenshot({ path: path.join(SHOTS, `zecon-firesale-${map}.png`) });
}

if (want("doors")) {
  await R(() => { const T = window.__trollOps; T.zdir().clear(); T.zdir().state = "between"; T.zdir().breakT = 1e6; T.player.hp = T.player.maxHp = 1e9; });
  const info = await R(() => {
    const T = window.__trollOps, D = T.zrun().doors, st = D.st, Z = T.zdir();
    return {
      areas: st.areas.map((a) => a.id), open: [...st.open], doors: st.doors.map((d) => ({ id: d.id, label: d.label, price: d.price, between: d.between, x: d.mid.x, y: d.y, z: d.mid.z, ux: d.u.x, uz: d.u.z })),
      wins: Z.windows.length, all: st.allWindows?.length ?? 0, closedWins: Z.windows.filter((w) => !D.zoneOpen(w)).length,
      blocked: st.doors.every((d) => d.cols.every((c) => T.colliders.includes(c))),
    };
  });
  check(info.doors.length > 0 && info.open.length === 1, "doors up, only the start area open", JSON.stringify({ areas: info.areas, open: info.open, doors: info.doors.length }));
  check(info.wins > 0 && info.wins < info.all && info.closedWins === 0, "zombies spawn only in the open area", `${info.wins} of ${info.all}, ${info.closedWins} in a shut area`);
  check(info.blocked, "every door is solid");
  // each door, shut, from its open side
  const sideOf = (d, s) => ({ x: d.x + d.uz * s * 1.0, z: d.z - d.ux * s * 1.0 });
  const openSide = async (d) => {
    for (const s of [1, -1]) {
      const p = sideOf(d, s);
      if (await R(({ p }) => { const D = window.__trollOps.zrun().doors; return D.zoneOpen(p); }, { p })) return s;
    }
    return 1;
  };
  for (const d of info.doors) {
    const s = await openSide(d);
    await R(({ d, s }) => {
      const T = window.__trollOps;
      T.move.pos.set(d.x + d.uz * s * 3.2, d.y, d.z - d.ux * s * 3.2);
      T.look.yaw = Math.atan2(d.uz * s, -d.ux * s); T.look.pitch = -0.05;
    }, { d, s });
    await sleep(450);
    await page.screenshot({ path: path.join(SHOTS, `zecon-door-${map}-${d.id}-shut.png`) });
  }
  // the first door: poor, then bought
  const d = info.doors.find((q) => q.between.includes(info.open[0]));
  const s = await openSide(d);
  const standAt = () => R(({ d, s }) => { const T = window.__trollOps; T.move.pos.set(d.x + d.uz * s * 1.0, d.y, d.z - d.ux * s * 1.0); T.look.yaw = Math.atan2(d.uz * s, -d.ux * s); T.look.pitch = 0; }, { d, s });
  await R(() => { window.__trollOps.zrun().econ.cash = 100; });
  await standAt();
  await page.waitForFunction(() => !!document.querySelector(".zb-prompt:not([hidden]) .zb-t"), null, { timeout: 5000, polling: 100 }).catch(() => {});
  await sleep(150);
  const poor = await R(() => ({ t: document.querySelector(".zb-prompt:not([hidden]) .zb-t")?.textContent || "", poor: !!document.querySelector(".zb-prompt .is-poor") }));
  check(poor.t === `Hold X · ${d.label} · ${d.price.toLocaleString()}` && poor.poor, "at a door: Hold X · its name · its price, red when you can't", poor.t);
  await page.keyboard.down("KeyX"); await sleep(900); await page.keyboard.up("KeyX");
  check(await R((id) => !window.__trollOps.zrun().doors.st.doors.find((q) => q.id === id).open, d.id), "100 points: it stays shut");
  await R((p) => { window.__trollOps.zrun().econ.cash = p + 100; }, d.price);
  const w0 = await R(() => window.__trollOps.zdir().windows.length);
  await page.bringToFront();
  await page.keyboard.down("KeyX");
  await page.waitForFunction((id) => window.__trollOps.zrun().doors.st.doors.find((q) => q.id === id).open, d.id, { timeout: 3000, polling: 50 }).catch(() => {});
  await page.keyboard.up("KeyX");
  await sleep(200);
  const after = await R((id) => {
    const T = window.__trollOps, D = T.zrun().doors, door = D.st.doors.find((q) => q.id === id);
    return { open: door.open, solid: door.cols.some((c) => T.colliders.includes(c)), cash: T.zrun().econ.cash, areas: [...D.st.open], wins: T.zdir().windows.length, banner: document.querySelector(".zh-banner")?.textContent || "" };
  }, d.id);
  check(after.open && !after.solid && after.cash === 100, `bought: ${d.label} open, not solid, ${d.price} paid`, JSON.stringify(after));
  check(d.between.every((a) => after.areas.includes(a)) && after.wins > w0, "its area opens, and its entry points with it", `${w0} -> ${after.wins} ${after.areas}`);
  check(/^New area: /.test(after.banner), "the banner names the new area", after.banner);
  await sleep(1200);
  await R(({ d, s }) => { const T = window.__trollOps; T.move.pos.set(d.x + d.uz * s * 3.2, d.y, d.z - d.ux * s * 3.2); }, { d, s });
  await sleep(400);
  await page.screenshot({ path: path.join(SHOTS, `zecon-door-${map}-${d.id}-open.png`) });
  // a walk through it: from the open side to the far side, nothing in the way
  const through = await R(({ d, s }) => {
    const T = window.__trollOps;
    const a = { x: d.x + d.uz * s * 1.2, z: d.z - d.ux * s * 1.2 }, b = { x: d.x - d.uz * s * 1.2, z: d.z + d.ux * s * 1.2 };
    return !T.colliders.some((c) => !c.deploy && c.max.y > d.y + 0.6 && c.min.y < d.y + 1.7 && [0.25, 0.5, 0.75].some((t) => { const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t; return x > c.min.x && x < c.max.x && z > c.min.z && z < c.max.z; }));
  }, { d, s });
  check(through, "the way through is clear");
}

check(errors.length === 0, "no page errors", errors.slice(0, 4).join(" | "));
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
