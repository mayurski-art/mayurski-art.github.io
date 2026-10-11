// Troll Forces perks test: BO2's perks, one per tier in each class. The
// active class's three are carried from each spawn (a class change lands
// on the respawn), the spawn card shows them, the ones other players need
// go out on the wire, and each perk does its thing.
// Supabase is blocked: the page must never join the live public room.
//
// Usage: node tools/troll-ops-perks-test.mjs
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
// The game's own copy of perks.js (its ?v= tag as combat/perk-carry.js
// imports it): any other tag is a second module instance.
const PERKS_TAG = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/combat/perk-carry.js"), "utf8").match(/perks\.js\?v=([\w-]+)/)[1];

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];
async function open(label) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.addInitScript(() => {
    const fake = { getCachedProfile: () => ({ username: "troll_runner", tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
  });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 300000 });
  await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
  return page;
}
// fn runs in the page with P = the game's perks module, T = its hooks.
const perks = async (page, fn, arg) => {
  await page.evaluate(async (tag) => { window.__P ||= await import(`/assets/games/troll-ops/perks.js?v=${tag}`); }, PERKS_TAG);
  return page.evaluate(fn, arg);
};

const A = await open("A");
// Class 1 gets one perk per tier; Class 2 gets three others.
await A.evaluate(() => {
  const L = window.__trollOps.loadout;
  L.setActiveClass(1);
  ["ghost", "toughness", "deadsilence"].forEach((id, t) => L.setClassPerk(t, id));
  L.setActiveClass(0);
  ["lightweight", "hardwired", "dexterity"].forEach((id, t) => L.setClassPerk(t, id));
});
await A.evaluate(async () => { const T = window.__trollOps; T.setMode("ops"); await T.startGame(); });
await A.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 300000 });
await A.evaluate(() => window.__trollOps.endStaging?.());
await A.waitForTimeout(700);

// 1. Carried from the spawn, shown on the card, not on the wire (none of these three are wire perks).
const s1 = await perks(A, () => { const P = window.__P, T = window.__trollOps; return ({
  carried: P.carriedPerks(), light: P.hasPerk("lightweight"), ghost: P.hasPerk("ghost"),
  card: document.querySelector(".to-perk-card")?.classList.contains("is-visible"),
  cardText: document.querySelector(".to-perk-card")?.textContent || "", wire: T.net.perks | 0,
}); });
check("the class's three perks are carried from the spawn", s1.carried.join(",") === "lightweight,hardwired,dexterity" && s1.light && !s1.ghost, s1.carried.join(","));
check("the spawn card shows the class and its perks", s1.card && /Class 1/.test(s1.cardText) && /Lightweight/.test(s1.cardText) && /Dexterity/.test(s1.cardText), s1.cardText);
check("perks nobody else needs stay off the wire", s1.wire === 0, String(s1.wire));
await A.screenshot({ path: path.join(ROOT, ".claude/run/perk-card.png") });

// 2. Change class from the pause menu: nothing changes until the respawn.
const s2 = await perks(A, () => { const P = window.__P, T = window.__trollOps; return (() => {
  T.openPauseMenu();
  document.querySelectorAll("#to-pause-classes button")[1].click();
  const mid = P.carriedPerks().join(",");
  T.respawnPlayer();
  T.closePauseMenu();
  return { mid, after: P.carriedPerks().join(","), wire: T.net.perks | 0, ghostBit: P.WIRE_PERKS.ghost, dsBit: P.WIRE_PERKS.deadsilence };
})(); });
check("a class change waits for the respawn", s2.mid === "lightweight,hardwired,dexterity", s2.mid);
check("and then carries the new class's perks", s2.after === "ghost,toughness,deadsilence", s2.after);
check("Ghost and Dead Silence go out on the wire", s2.wire === (s2.ghostBit | s2.dsBit), `${s2.wire}`);

// 3. Locked perks can't be carried; Royale carries none.
const s3 = await perks(A, () => { const P = window.__P; return ({ valid: P.validPerks(["ghost", "lightweight", "nope"]), tiers: [0, 1, 2].map((t) => P.perksInTier(t).length) }); });
check("each slot only takes its own tier's perk", s3.valid[0] === "ghost" && s3.valid[1] === null && s3.valid[2] === null, JSON.stringify(s3.valid));
check("BO2's sixteen perks: 5, 5 and 6 a tier", s3.tiers.join(",") === "5,5,6", s3.tiers.join(","));

// ---- 4. Each perk's effect, solo (perks set directly, then put back).
// The game's own module instances, by the tags their importers use.
const tagOf = (importer, mod) => fs.readFileSync(path.join(ROOT, "assets/games/troll-ops", importer), "utf8").match(new RegExp(`${mod.replace(/\./g, "\\.")}\\?v=([\\w-]+)`))[1];
const TAGS = {
  calling: tagOf("view/engineer-marks.js", "calling.js"),
  throwables: tagOf("game.js", "combat/throwables.js"),
  throwAnim: tagOf("game.js", "combat/throw-anim.js"),
  scavenger: tagOf("combat/scoring.js", "scavenger.js"),
  gear: tagOf("combat/damage.js", "gear.js"),
  fire: tagOf("game.js", "streaks/fire.js"),
  weapons: tagOf("game.js", "combat/weapons.js"),
};
await A.evaluate(async (tags) => {
  const base = "/assets/games/troll-ops/";
  window.__M = {
    G: (await import(`${base}core/state.js?v=st1`)).game,
    C: await import(`${base}streaks/calling.js?v=${tags.calling}`),
    TH: await import(`${base}combat/throwables.js?v=${tags.throwables}`),
    TA: await import(`${base}combat/throw-anim.js?v=${tags.throwAnim}`),
    SV: await import(`${base}combat/scavenger.js?v=${tags.scavenger}`),
    GEAR: await import(`${base}gear.js?v=${tags.gear}`),
    FI: await import(`${base}streaks/fire.js?v=${tags.fire}`),
    WP: await import(`${base}combat/weapons.js?v=${tags.weapons}`),
  };
}, TAGS);
const fx = await A.evaluate(async () => {
  const P = window.__P, T = window.__trollOps, { G, C, TH, TA, SV, GEAR, FI, WP } = window.__M;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const keep = P.carriedPerks();
  const set = (...ids) => P.setCarriedPerks(ids);
  T.player.spawnGuard = 0;

  // Hardline: the UAV's 200 is 160.
  T.streaks.setSelected(["uav"]);
  set(); out.uav = T.streaks.nextProgress()?.cost;
  set("hardline"); out.uavHard = T.streaks.nextProgress()?.cost;

  // Flak Jacket: a frag lands at 35%; bullets don't change.
  const hit = (dmg, w) => { T.player.hp = 100; T.damagePlayer(dmg, null, w); return T.player.hp; };
  set(); out.frag = hit(50, "frag");
  set("flakjacket"); out.fragFlak = hit(50, "frag"); out.bulletFlak = hit(50, "problem416");

  // Toughness: the hit kick at a quarter.
  const kick = () => { G.shakeMag = 0; G.shakeT = 0; T.player.hp = 100; T.damagePlayer(20, null, "problem416"); return G.shakeMag; };
  set(); out.kick = kick();
  set("toughness"); out.kickTough = kick();
  T.player.hp = 100;

  // Hard Wired: an enemy Counter-UAV doesn't jam the radar.
  G.jammedUntil = performance.now() + 5000;
  set(); out.jammed = C.minimapJammed();
  set("hardwired"); out.jammedHw = C.minimapJammed();
  G.jammedUntil = 0;

  // Tactical Mask: a flash in your face at a fifth.
  const fwd = G.move.pos.clone().set(0, 0, 0); G.camera.getWorldDirection(fwd);
  const at = G.player.pos.clone().addScaledVector(fwd, 2); at.y += 1.4;
  const flash = () => { G.blindT = 0; TH.flashPlayer(at, GEAR.THROWABLE_DEFS.flash); return G.blindT; };
  set(); out.blind = flash();
  set("tacticalmask"); out.blindMask = flash();
  G.blindT = 0;

  // Fast Hands: the draw (0.12 s) is done in 0.08 s.
  const draw = () => { TA.throwStart(GEAR.THROWABLE_DEFS.frag); TA.updateThrow(0.08); const ph = TA.throwState.phase; TA.throwCancel(); return ph; };
  set(); out.draw = draw();
  set("fasthands"); out.drawFast = draw();

  // Dexterity: the gun's ADS speed doubles on the next frame.
  const w = () => T.player.weapons[T.player.weaponId];
  set(); await wait(150); out.ads = w().adsMult;
  set("dexterity"); await wait(150); out.adsDex = w().adsMult;

  // Scavenger: a pack at your feet refills a mag and a throwable.
  set("scavenger");
  const kind = T.loadout.throwKind;
  w().ammoReserve = 0; T.player.gear[kind] = 0;
  SV.scavengerDrop(G.player.pos.clone());
  await wait(300);
  out.scavReserve = w().ammoReserve; out.scavMag = w().def.magSize; out.scavGear = T.player.gear[kind];

  // Engineer: an enemy streak in front of you gets a mark.
  set("engineer");
  const ePos = G.player.pos.clone().addScaledVector(fwd, 12); ePos.y += 4;
  C.streakEntities.set("test-enemy", { team: "enemy-side", owned: false, pos: ePos });
  await wait(200);
  out.marks = [...document.querySelectorAll(".to-engineer-marks i")].filter((i) => !i.hidden).length;
  C.streakEntities.delete("test-enemy");
  set(); await wait(150);
  out.marksOff = document.querySelector(".to-engineer-marks")?.hidden;

  // Engineer: your own landed crate re-rolls once on the reload button.
  const pp = G.move.pos;
  const pkg = FI.spawnCarePackage({ id: "test-pkg", x: pp.x, z: pp.z, groundY: 0, reward: "streak:uav", owned: true, ownerTeam: G.net.team });
  pkg.landed = true; pkg.phase = "rest"; pkg.landT = 5;
  WP.tryReload(true);
  out.rrNoPerk = pkg.reward;
  set("engineer");
  WP.updatePickupPrompt(0.016);
  out.rrPrompt = G.els.pickupPromptText?.textContent || "";
  WP.tryReload(false);
  out.rrAuto = pkg.reward;
  WP.tryReload(true);
  out.rrOnce = pkg.reward;
  WP.tryReload(true);
  out.rrTwice = pkg.reward;
  pkg.dispose(); C.streakEntities.delete("test-pkg");
  set(); await wait(100);

  set(...keep);
  return out;
});
check("Hardline: the UAV costs 160, not 200", fx.uav === 200 && fx.uavHard === 160, `${fx.uav} -> ${fx.uavHard}`);
check("Flak Jacket: a frag hurts 35%, bullets the same", fx.frag === 50 && Math.abs(fx.fragFlak - 82.5) < 0.01 && fx.bulletFlak === 50, `${fx.frag} / ${fx.fragFlak} / ${fx.bulletFlak}`);
check("Toughness: a quarter of the hit kick", fx.kick > 0 && Math.abs(fx.kickTough - fx.kick * 0.25) < 1e-6, `${fx.kick} -> ${fx.kickTough}`);
check("Hard Wired: a Counter-UAV doesn't jam you", fx.jammed === true && fx.jammedHw === false);
check("Tactical Mask: a flash at a fifth", fx.blind > 0 && Math.abs(fx.blindMask - fx.blind * 0.2) < 1e-6, `${fx.blind} -> ${fx.blindMask}`);
check("Fast Hands: the throw comes out twice as fast", fx.draw === "draw" && fx.drawFast === "pin", `${fx.draw} -> ${fx.drawFast}`);
check("Dexterity: ADS twice as fast", fx.ads === 1 && fx.adsDex === 2, `${fx.ads} -> ${fx.adsDex}`);
check("Scavenger: a pack refills a mag and a throwable", fx.scavReserve === fx.scavMag && fx.scavGear === 1, `reserve ${fx.scavReserve}/${fx.scavMag}, throwable ${fx.scavGear}`);
check("Engineer: the crate re-rolls once, on the reload button only", fx.rrNoPerk === "streak:uav" && fx.rrAuto === "streak:uav" && /^streak:/.test(fx.rrOnce) && fx.rrOnce !== "streak:uav" && fx.rrTwice === fx.rrOnce, `${fx.rrNoPerk} -> ${fx.rrOnce} -> ${fx.rrTwice}`);
check("Engineer: the prompt says reload re-rolls", /re-rolls/.test(fx.rrPrompt), fx.rrPrompt);
check("Engineer: an enemy streak is marked; off without it", fx.marks === 1 && fx.marksOff === true, `${fx.marks} marks, hidden after ${fx.marksOff}`);


// Lightweight and Extreme Conditioning: faster on foot (speed after a second's walk/sprint).
const pace = async (ids, sprint) => A.evaluate(async ({ ids, sprint }) => {
  const P = window.__P, { G } = window.__M;
  P.setCarriedPerks(ids);
  G.keys.add("KeyW"); if (sprint) G.keys.add("ShiftLeft");
  await new Promise((r) => setTimeout(r, 1300));
  const v = Math.hypot(G.move.velocity.x, G.move.velocity.z);
  G.keys.delete("KeyW"); G.keys.delete("ShiftLeft");
  await new Promise((r) => setTimeout(r, 600));
  return v;
}, { ids, sprint });
const walk = await pace([], false), walkLight = await pace(["lightweight"], false);
const run = await pace([], true), runExtreme = await pace(["extremeconditioning"], true);
check("Lightweight: 7% faster", walk > 0 && Math.abs(walkLight / walk - 1.07) < 0.03, `${walk.toFixed(2)} -> ${walkLight.toFixed(2)} m/s`);
check("Extreme Conditioning: 8% faster sprint", run > walk && Math.abs(runExtreme / run - 1.08) < 0.03, `${run.toFixed(2)} -> ${runExtreme.toFixed(2)} m/s`);
await A.close();

// ---- 5. Two players in a private room: what the other side sees.
const ROOM = "PK" + Math.floor(Math.random() * 900 + 100);
async function join(label, perks) {
  const page = await open(label);
  await page.evaluate(async ({ room, perks }) => {
    const T = window.__trollOps;
    perks.forEach((id, t) => T.loadout.setClassPerk(t, id));
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    await T.startGame();
  }, { room: ROOM, perks });
  return page;
}
const X = await join("X", [null, null, "awareness"]);
const Y = await join("Y", ["ghost", "coldblooded", "deadsilence"]);
await Promise.all([X, Y].map((p) => p.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging(), null, { timeout: 300000 })));
await X.waitForTimeout(1500);
const teamX = await X.evaluate(() => window.__trollOps.net.team);
await Y.evaluate((t) => window.__trollOps.net.setTeam(t === "phantom" ? "ghost" : "phantom"), teamX);
const yId = await Y.evaluate(() => window.__trollOps.net.id);
await X.waitForTimeout(1500);
const seen = await X.evaluate((yId) => {
  const rp = window.__trollOps.remotes.byId.get(yId);
  return { perks: rp?.peer.perks ?? null, tag: rp?.tagColor ?? null };
}, yId);
check("the other side learns Ghost, Cold Blooded and Dead Silence", seen.perks === (1 | 2 | 4), String(seen.perks));
check("Cold Blooded: their name isn't red", !!seen.tag && seen.tag !== "#ff4d3d", String(seen.tag));

// Dead Silence: Y walks past X and X hears nothing; without it, X does.
await X.evaluate(() => {
  const a = window.__trollOps.audio;
  const f = a.step.bind(a);
  a.step = (at, v) => { if (at) window.__steps = (window.__steps || 0) + 1; return f(at, v); };
});
async function stepsHeard() {
  await X.evaluate(() => { window.__steps = 0; });
  const near = await X.evaluate(() => { const p = window.__trollOps.move.pos; return { x: p.x, z: p.z }; });
  for (let i = 0; i < 16; i++) {
    await Y.evaluate(({ x, z }) => { const T = window.__trollOps; T.move.pos.x = x; T.move.pos.z = z; T.player.pos.x = x; T.player.pos.z = z; }, { x: near.x + 4 + (i % 2) * 2.4, z: near.z + 2 });
    await Y.waitForTimeout(140);
  }
  return X.evaluate(() => window.__steps);
}
const silentSteps = await stepsHeard();
await Y.evaluate(() => { window.__trollOps.net.perks = 0; });
await Y.waitForTimeout(400);
const loudSteps = await stepsHeard();
check("Dead Silence: their footsteps are silent", silentSteps === 0 && loudSteps > 0, `${silentSteps} with, ${loudSteps} without`);

// Bots carry a class too: one perk a tier, fixed per bot, on the wire, and
// the host simulates theirs (Flak Jacket here). Ops has no bots: a TDM
// page of its own (offline, Supabase is blocked), last, because it upset
// page A's per-frame checks when it ran before them.
const BP = await open("bots");
await BP.evaluate(async () => { const T = window.__trollOps; T.setMode("tdm"); await T.startGame(); });
await BP.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 300000 });
await BP.evaluate(() => window.__trollOps.endStaging?.());
await BP.waitForFunction(() => window.__trollOps.bots?.bots?.length > 0, null, { timeout: 30000 }).catch(() => {});
await BP.waitForTimeout(800);
const bp = await perks(BP, async () => {
  const P = window.__P, G = (await import("/assets/games/troll-ops/core/state.js?v=st1")).game;
  const list = G.bots?.bots || [];
  const tiersOk = list.every((b) => b.perks.size === 3 && [0, 1, 2].every((t) => [...b.perks].some((id) => P.PERK_DEFS[id]?.tier === t)));
  const wireOk = list.every((b) => (G.net.peers.get(b.id)?.perks | 0) === b.perkBits);
  const same = list.every((b) => [...P.botPerks(b.id)].join() === [...b.perks].join());
  const flak = list.find((b) => b.alive && b.perks.has("flakjacket"));
  const plain = list.find((b) => b.alive && !b.perks.has("flakjacket"));
  const hit = (b, explosive) => { const hp = b.hp; G.bots.applyHit(b.id, 10, { explosive }); const d = hp - b.hp; b.hp = hp; return d; };
  return {
    n: list.length, tiersOk, wireOk, same,
    flak: flak ? [hit(flak, true), hit(flak, false)] : null,
    plain: plain ? hit(plain, true) : null,
    kinds: new Set(list.flatMap((b) => [...b.perks])).size,
  };
});
await BP.close();
check("bots: one perk a tier each, the same on every client", bp.n > 0 && bp.tiersOk && bp.same, `${bp.n} bots, ${bp.kinds} different perks`);
check("bots: their wire perks are on their peers", bp.wireOk);
check("bots: Flak Jacket cuts a bot's blast damage, not bullets", !bp.flak || (Math.abs(bp.flak[0] - 3.5) < 1e-6 && bp.flak[1] === 10 && bp.plain === 10), JSON.stringify(bp));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `PERKS RED: ${failures} failed` : "PERKS GREEN");
process.exit(failures ? 1 : 0);
