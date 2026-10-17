// Grin Sabers phase 1 test: the page loads clean, bot-vs-bot duels play
// out to a match result (combat, rounds, KOs), and the rules hold in
// scripted exchanges: a clean hit costs HP, a guard on the wrong side costs
// block points, a perfect block costs nothing and bounces the attacker, a
// perfect block plus a flick disarms, a heavy breaks a wrong-side guard,
// and two strikes meeting lock into a clash. No network: the game makes no
// requests beyond its own files.
//   node tools/grin-sabers-p1-test.mjs [--shots]
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5231;
const SHOTS = process.argv.includes("--shots");
const OUT = path.join(ROOT, ".claude/run");
fs.mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, [path.join(ROOT, "tools/static-serve.mjs"), String(PORT)], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 700));
const results = [];
const check = (name, ok, info = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${info ? `  (${info})` : ""}`); };

try {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const offsite = [];
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(`http://localhost:${PORT}/`) || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
    if (u.includes("fonts.g")) return route.abort();
    offsite.push(u);
    return route.abort();
  });
  await page.addInitScript(() => { window.__gsHeadless = true; });
  await page.goto(`http://localhost:${PORT}/sabers.html?debug`);
  await page.waitForFunction(() => window.__gs && window.__gs.duel, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  if (SHOTS) await page.screenshot({ path: path.join(OUT, "gs-title.png") });
  check("page loads with no errors", errors.length === 0, errors.slice(0, 3).join(" | "));

  // 1. bot vs bot plays a whole match (sim stepped by hand: the headless GPU is slow)
  const demo = await page.evaluate(() => {
    const g = window.__gs;
    g.manual(true);
    g.startDemo();
    g.events.length = 0;
    const n = (t) => g.events.filter((e) => e.type === t).length;
    for (let i = 0; i < 400 && !n("matchEnd"); i++) g.step(1);
    return { secs: +g.now.toFixed(0), hits: n("hit"), blocks: n("block"), perfects: n("perfect"), kos: n("ko"), rounds: n("roundEnd"), matches: n("matchEnd"), clashes: n("clash"), disarms: n("disarm"), strikes: n("strike"), guardbreaks: n("guardbreak"), feints: n("feint") };
  });
  check("a bot-vs-bot match plays to the end", demo.matches >= 1, JSON.stringify(demo));
  check("bots land hits and block", demo.hits > 3 && demo.blocks + demo.perfects > 0);

  // 2. scripted rules on a player duel. Bots switched off, intents set by hand.
  const rules = await page.evaluate(() => {
    const g = window.__gs;
    g.startDuel(0);
    g.skipIntro();
    g.step(0.1);
    const du = g.duel, me = du.a, bot = du.b;
    du.bots.length = 0;                   // the bot stands still unless told
    du.clock = 999;
    const place = () => {
      me.pos.set(0, 0, 0.75); bot.pos.set(0, 0, -0.75);
      me.vel.set(0, 0, 0); bot.vel.set(0, 0, 0);
      me.yaw = 0; bot.yaw = Math.PI;
      for (const f of [me, bot]) {
        f.state = "idle"; f.swing = null; f.clash = null; f.saberDrop = null; f.hp = 100; f.bp = 100; f.frozen = false;
        f.counterUntil = -9; f.flickAt = -9; f.saber.ignite(0.01);
        Object.assign(f.intent, { attack: false, attackHeld: false, guard: false, dir: null, heavy: false, flick: null, mx: 0, mz: 0, aimX: 0, aimY: 0, touchGuard: false, mash: false });
      }
      g.step(0.2);
    };
    const press = (f, dir, heavy = false) => (k) => { f.intent.attack = k === 0; f.intent.dir = dir; f.intent.heavy = heavy; };
    const guard = (f, zone) => { f.intent.guard = true; f.intent.aimX = zone === "left" ? -1 : zone === "right" ? 1 : 0; f.intent.aimY = zone === "high" ? 1 : 0; };
    const since = (i) => g.events.slice(i).map((e) => e.type);
    const out = {};

    place();
    let i0 = g.events.length;
    g.step(1, press(me, "R"));
    out.cleanHit = { botHp: bot.hp, ev: since(i0) };

    place(); guard(bot, "right"); g.step(0.15);
    i0 = g.events.length;
    g.step(1, press(me, "R"));          // R arrives on the bot's LEFT: wrong side
    out.wrongGuard = { botHp: bot.hp, botBp: Math.round(bot.bp), ev: since(i0) };

    place(); guard(bot, "left"); g.step(0.15);
    i0 = g.events.length;
    let sawRebound = false;
    g.step(1, (k) => { press(me, "R")(k); if (me.state === "rebound") sawRebound = true; });
    out.perfect = { botHp: bot.hp, botBp: Math.round(bot.bp), rebound: sawRebound, ev: since(i0) };

    place(); guard(bot, "left"); g.step(0.15);
    let flicked = false;
    g.step(0.8, (k) => {
      press(me, "R")(k);
      bot.intent.flick = null;
      if (!flicked && me.state === "swing" && me.swing.phase === "windup" && me.swing.windup - me.swing.t < 0.06) { bot.intent.flick = { x: 1, y: 0 }; flicked = true; }
    });
    out.disarm = { meState: me.state, dropped: !!me.saberDrop };
    bot.intent.guard = false;
    g.step(5.5);
    out.disarmBack = { meState: me.state, lit: me.saber.lit };

    place(); guard(bot, "right"); g.step(0.15);
    i0 = g.events.length;
    let botStagger = false;
    g.step(1.6, (k) => { press(me, "R", true)(k); if (bot.state === "stagger") botStagger = true; });
    out.guardBreak = { botStagger, ev: since(i0) };

    place();
    i0 = g.events.length;
    let clashed = false;
    g.step(0.8, (k) => { press(me, "R")(k); press(bot, "R")(k); if (me.state === "clash") clashed = true; });
    out.clash = { clashed, ev: since(i0) };
    // mash it out: me mashes every other frame, bot never
    g.step(2, (k) => { me.intent.mash = k % 2 === 0; });
    out.clashEnd = { winner: g.events.slice(i0).find((e) => e.type === "clashEnd")?.winner };

    place();
    i0 = g.events.length;
    let combo = 0;
    g.step(2.4, (k) => { me.intent.attack = k % 9 === 0; me.intent.dir = null; if (me.combo > combo) combo = me.combo; });
    out.combo = { combo, ev: since(i0).filter((t) => t === "strike").length };

    // running: sideways at full speed, facing the way it runs, no block-point refill
    place();
    bot.pos.set(0, 0, -6);
    me.bp = 50;
    let topSpeed = 0;
    g.step(1, () => { me.intent.sprint = true; me.intent.mx = 1; me.intent.mz = 0; topSpeed = Math.max(topSpeed, Math.hypot(me.vel.x, me.vel.z)); });
    const turn = Math.abs(Math.atan2(Math.sin(me.yaw - me.lockYaw), Math.cos(me.yaw - me.lockYaw)));
    out.run = { topSpeed: +topSpeed.toFixed(2), turnedDeg: Math.round(turn * 57.3), bp: Math.round(me.bp) };
    me.intent.sprint = false; me.intent.mx = 0;
    g.step(0.6);
    out.runStop = { turnBackDeg: Math.round(Math.abs(Math.atan2(Math.sin(me.yaw - me.lockYaw), Math.cos(me.yaw - me.lockYaw))) * 57.3) };
    return out;
  });
  console.log(JSON.stringify(rules));
  check("a clean hit costs 10 HP (Shii-Cho light)", rules.cleanHit.botHp === 90, JSON.stringify(rules.cleanHit));
  check("a wrong-side guard blocks but costs block points", rules.wrongGuard.botHp === 100 && rules.wrongGuard.botBp < 100, JSON.stringify(rules.wrongGuard));
  check("a perfect block costs nothing and bounces the attacker", rules.perfect.botHp === 100 && rules.perfect.botBp >= 99 && rules.perfect.rebound, JSON.stringify(rules.perfect));
  check("perfect block + flick disarms", rules.disarm.meState === "disarmed" && rules.disarm.dropped, JSON.stringify(rules.disarm));
  check("a dropped saber comes back lit", rules.disarmBack.meState !== "disarmed" && rules.disarmBack.lit, JSON.stringify(rules.disarmBack));
  check("a heavy breaks a wrong-side guard", rules.guardBreak.botStagger && rules.guardBreak.ev.includes("guardbreak"), JSON.stringify(rules.guardBreak));
  check("two strikes meeting lock into a clash", rules.clash.clashed, JSON.stringify(rules.clash));
  check("the masher wins the clash", rules.clashEnd.winner === "You", JSON.stringify(rules.clashEnd));
  check("clicking through a combo chains to the form's limit (4)", rules.combo.combo === 4, JSON.stringify(rules.combo));
  check("running reaches run speed and faces the way it runs", rules.run.topSpeed > 6 && rules.run.turnedDeg > 60, JSON.stringify(rules.run));
  check("running doesn't refill block points", rules.run.bp <= 50, JSON.stringify(rules.run));
  check("letting go of run turns back to face the opponent", rules.runStop.turnBackDeg < 15, JSON.stringify(rules.runStop));
  await page.evaluate(() => window.__gs.manual(false));
  await page.waitForTimeout(800);
  if (SHOTS) await page.screenshot({ path: path.join(OUT, "gs-duel.png") });

  // 3. phone-sized layout renders and shows touch controls in a duel
  await page.close();
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  phone.on("pageerror", (e) => errors.push(String(e)));
  await phone.route("**/*", (route) => (route.request().url().startsWith(`http://localhost:${PORT}/`) ? route.continue() : route.abort()));
  await phone.addInitScript(() => { window.__gsHeadless = true; });
  await phone.goto(`http://localhost:${PORT}/sabers.html?debug`, { waitUntil: "domcontentloaded" });
  await phone.waitForFunction(() => window.__gs && window.__gs.duel, null, { timeout: 30000 });
  await phone.waitForTimeout(1500);
  if (SHOTS) await phone.screenshot({ path: path.join(OUT, "gs-phone-title.png") });
  await phone.evaluate(() => { window.__gs.startDuel(1); window.__gs.skipIntro(); });
  await phone.waitForTimeout(1500);
  if (SHOTS) await phone.screenshot({ path: path.join(OUT, "gs-phone-duel.png") });
  const touchShown = await phone.evaluate(() => !document.getElementById("gs-touch").hidden);
  check("phone duel shows touch controls", touchShown);
  check("no page errors anywhere", errors.length === 0, errors.slice(0, 3).join(" | "));
  check("no off-site requests", offsite.length === 0, offsite.slice(0, 3).join(" "));
  await browser.close();
} finally {
  server.kill();
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `${failed} FAILED` : "ALL PASS");
process.exit(failed ? 1 : 0);
