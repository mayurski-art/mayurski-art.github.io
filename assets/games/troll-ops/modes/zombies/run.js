// Troll Forces Zombies: the run. Waves to FINAL_WAVE with a break between
// each to spend (skippable), cash for every kill and every cleared wave,
// the upgrade column, going down instead of dying outright, and the win.
// The horde itself is zombies.js (ZombieDirector); this is everything
// around it. Modelled on Roblox's Zombie Rush Survival (Undead Dev).
//
// Down, not out: at 0 HP you drop to a crawl and bleed out. Solo there is
// nobody to pick you up, so it's a last stand: put LAST_STAND_KILLS down
// before you bleed out and you're back on your feet at half health. In
// co-op a teammate holds X by you to pick you up (coop.js); bleed out and
// you're out until the wave is cleared, and the run is lost only when
// nobody is left standing. A cleared wave gets everyone back up.

import { game } from "../../core/state.js?v=st1";
import { econ, earn, resetCash, tickCash, waveBonus } from "./economy.js?v=zr5-zr9-zr10-zc1-zc2-hr2";
import { buy, offers, resetUpgrades, upgradeState } from "./upgrades.js?v=zr5-zr9-zr10-zh1-zc1-zc2-hr2";
import { mountZombiesHud, showZombiesHud, updateZombiesHud, announceWave, zombiesBanner } from "../../view/zombies-hud.js?v=zr6-zr7-zr8-zr9-zr10";
import { updateZombieBars } from "../../view/zombies-bars.js?v=zr6-zr9-zr10";
import { dep, depWire, deployOffers, pickDeployable, cancelPlacing, placeDeployable, spawnDeployable, hitBlocker, resetDeployables, clearDeployables, updateDeployables } from "./deployables.js?v=zr6-zr8-zr9-zr10-zh1-zc1-zc2-hr2";
export { deployClick } from "./deployables.js?v=zr6-zr8-zr9-zr10-zh1-zc1-zc2-hr2";
import { bossState, bossWaveStarted, resetBosses, spawnBossNow, updateBosses } from "./boss.js?v=zr7-zr8-zr9-zr10-zh1-zc1-zc2-hr2";
import { coop, startCoop, stopCoop, coopPreFrame, coopPostFrame, coopTargets, coopSwing, voteSkip, playerCount, roomPlayers, coopDebug, REVIVE_TIME } from "./coop.js?v=zr8-zr9-zr10-zh1-zc1-zc2-hr2";
import { onZombieMessage as onCoopMessage } from "./coop.js?v=zr8-zr9-zr10-zh1-zc1-zc2-hr2";
import { onHubMessage } from "./hub.js?v=zh1-zc1-zc2-hr2";

/* Every "z" + letter message: the hub's pads (zP, zG), else the run's. */
export function onZombieMessage(p, m) {
  if (m.t === "zP" || m.t === "zG") onHubMessage(p, m);
  else onCoopMessage(p, m);
}

export const FINAL_WAVE = 30;
const BLEED_OUT = 15;           // seconds down before it's over
const BLEED_OUT_COOP = 30;      // ...with a team to come and get you
const LAST_STAND_KILLS = 3;     // solo: kills while down to get back up
const LAST_STAND_HP = 0.5;      // of max health

export const run = {
  live: false,
  won: false,
  downed: false,
  bleedT: 0,
  standKills: 0,
  out: false,          // co-op: bled out, back when the wave is cleared
};

/* Match setup, once the director exists and the loadout is equipped. */
export function startZombieRun() {
  run.live = true;
  run.won = false;
  run.downed = false;
  run.bleedT = 0;
  run.standKills = 0;
  run.out = false;
  game.player.downed = false;
  game.player.out = false;
  resetCash(0);
  resetUpgrades();
  resetDeployables();
  resetBosses();
  game.player.hp = game.player.maxHp;
  startCoop();
  coop.onWaveStart = waveStarted;
  coop.onCleared = (n) => game.zdir.events.push({ type: "cleared", wave: n });
  coop.onRevived = (name) => getUp(LAST_STAND_HP, `${name} picked you up`);
  coop.onLost = () => { stopZombieRun(); game.endGame("dead"); };
  mountZombiesHud({ onBuy: buyUpgrade, onSkip: skipBreak, onDeploy: deploy, onPlace: placeDeployable, onCancel: cancelPlacing, isPlacing: () => !!dep.placing });
  showZombiesHud(true);
}

/* The run is over (game over, quit, a new match): HUD off. */
export function stopZombieRun() {
  run.live = false;
  game.player.downed = false;
  game.player.out = false;
  stopCoop();
  clearDeployables();
  resetBosses();
  showZombiesHud(false);
}

/* The next wave: from the countdown, and after each break. */
export function nextZombieWave() {
  const zdir = game.zdir;
  if (!zdir) return;
  if (coop.on && !coop.host) return;   // the host starts them (waveStarted, off the wire)
  const n = zdir.round + 1;
  zdir.startRound(n, playerCount());
  waveStarted(n);
}

/* Wave n is on: ours, or the host's word on it. */
function waveStarted(n) {
  const zdir = game.zdir;
  zdir.round = n;
  if (coop.on && !coop.host) zdir.state = "spawning";
  game.player.wave = n;
  bossWaveStarted(n);
  game.els.hudWave.textContent = String(n);
  announceWave(n, FINAL_WAVE);
  game.audio.wave();
}

export function buyUpgrade(id) {
  if (!run.live || run.downed || game.gameState !== "playing") return false;
  const ok = buy(id);
  game.audio.zombieBuy(ok);
  if (ok && (id === "gun" || id === "melee")) tierFlourish(id);
  return ok;
}

/* A tier bought (P7): the new one gets admired in your hands, a rising
   chime and a shower of gold off it. Holding the other one, just the chime
   and the gold. */
export const flourish = { at: 0, id: null, inspected: false };
function tierFlourish(id) {
  flourish.at = performance.now(); flourish.id = id; flourish.inspected = false;
  game.audio.tierUp?.();
  if (game.player.holding === id) {
    game.inspectT = 0;
    game.startInspect();
    flourish.inspected = game.inspectT > 0;
  }
  const p = game.player.pos, yaw = game.look.yaw, pitch = game.look.pitch;
  const at = p.clone();
  at.x += -Math.sin(yaw) * Math.cos(pitch) * 0.8;
  at.z += -Math.cos(yaw) * Math.cos(pitch) * 0.8;
  at.y += Math.sin(pitch) * 0.8 - 0.25;
  game.spawnImpactBurst(at, 0xffc84a, 18);
}

/* The Deployables column: pick one to place (held = grid mode). */
export function deploy(id, grid = false) {
  if (!run.live || run.downed || game.gameState !== "playing") return false;
  const ok = pickDeployable(id, grid);
  if (!ok) game.audio.zombieBuy(false);
  return ok;
}

/* Solo: the break's over. Co-op: our vote (everyone has to want it). */
export function skipBreak() {
  if (!run.live || game.zdir?.state !== "between") return;
  if (coop.on && roomPlayers().length) voteSkip();
  else game.zdir.skipBreak();
}

/* A zombie the local player hit (combat/weapons.js, through game), or a
   deployable did (`by`: its owner, when that's someone else). */
export function zombieHit(actor, result, point, by = null) {
  if (!result.killed) return;
  by = by || dep.blastBy;
  if (by && coop.on) {
    // co-op: theirs, paid when the host's "died" reaches them (coop.js)
    actor.killedBy = by;
    actor.killCash = result.cash;
    return;
  }
  earn(result.cash, result.isHead ? "HEADSHOT KILL" : "ZOMBIE KILL", point);
  if (run.downed && !teamed()) {
    run.standKills++;
    if (run.standKills >= LAST_STAND_KILLS) getUp();
  }
}

/* A zombie's swipe landed: on the local player, or on a deployable in its
   way (zombies.js passes the blocker). */
function onZombieAttack(zombie, dmg, blocker = null) {
  // co-op: everyone sees the swing; a swing at someone else is theirs to take
  const theirs = coopSwing(zombie, dmg, !!blocker);
  if (blocker) { hitBlocker(blocker, dmg); return; }
  if (!theirs) game.damagePlayer(dmg, null, null, false, zombie.mesh?.position);
}

/* A teammate is around to pick us up (no last stand then). */
const teamed = () => coop.on && roomPlayers().length > 0;

/* combat/damage.js: the local player hit 0 HP in Zombies. */
export function zombieDowned() {
  if (run.downed) return;
  run.downed = true;
  run.bleedT = teamed() ? BLEED_OUT_COOP : BLEED_OUT;
  run.standKills = 0;
  game.player.downed = true;
  game.player.hp = 0;
}

function getUp(hp = LAST_STAND_HP, msg = "Back on your feet") {
  if (!run.downed) return;
  run.downed = false;
  run.out = false;
  game.player.downed = false;
  game.player.out = false;
  game.player.hp = Math.round(game.player.maxHp * hp);
  game.player.lastHurtAt = performance.now();
  zombiesBanner(msg);
}

function winRun() {
  run.won = true;
  stopZombieRun();
  game.endGame("won");
}

/* Tests (__trollOps.zrun()): read and poke the run. */
export function zombieRunDebug() {
  return {
    run, econ, upgrades: upgradeState, flourish,
    offers: () => offers(),
    buy: (id) => buyUpgrade(id),
    skip: () => skipBreak(),
    giveCash: (n) => earn(n),
    dep, deployOffers,
    deploy: (id, grid) => deploy(id, grid),
    place: () => placeDeployable(),
    cancel: () => cancelPlacing(),
    spawn: (id, x, y, z, yaw = 0) => { const e = spawnDeployable(id, x, y, z, yaw); depWire.add?.(e); return e; },
    coop: coopDebug(),
    bossState,
    spawnBoss: (kind) => spawnBossNow(kind),
    /* Jump to wave n with nobody left alive. */
    forceWave(n) {
      const zdir = game.zdir;
      zdir.clear();
      zdir.round = n - 1;
      nextZombieWave();
    },
  };
}

/* One frame of the run. Returns the meshes bullets can hit. */
export function updateZombieRun(dt) {
  const zdir = game.zdir;
  const p = game.player;
  coopPreFrame(dt);
  const host = !coop.on || coop.host;
  let roundOver = false;
  if (host) {
    zdir.targets = coop.on ? coopTargets() : null;
    roundOver = zdir.update(dt, p.pos, onZombieAttack, game.move.pos.y);
  } else zdir.updateProxies(dt);
  coopPostFrame(dt);
  if (!run.live) return [];   // the wire said it's over
  for (const ev of zdir.events.splice(0)) {
    if (ev.type === "cleared") {
      earn(waveBonus(ev.wave), `WAVE ${ev.wave} CLEARED`);
      if (ev.wave >= FINAL_WAVE) { winRun(); return []; }
      if (run.downed) getUp(1, run.out ? "Back in" : "Back on your feet");
    }
    else if (ev.type === "shriek") game.audio.zombieShriek(ev.at);
    else if (ev.type === "groan") game.audio.zombieGroan(ev.at, ev.voice);
    else if (ev.type === "snarl") game.audio.zombieSnarl(ev.at, ev.voice);
    else if (ev.type === "death") game.audio.zombieDeath(ev.at, ev.voice);
  }
  if (roundOver) nextZombieWave();
  updateDeployables(dt);
  // a boss walking in gets its name called, in red
  const boss = updateBosses(dt, FINAL_WAVE, (z) => zombiesBanner(z.type.name, true), host);

  if (run.downed && !run.out) {
    run.bleedT -= dt;
    if (run.bleedT <= 0) {
      if (!teamed()) {
        stopZombieRun();
        game.endGame("dead");
        return [];
      }
      // co-op: out until the wave's cleared (the host calls it if everyone is)
      run.out = true;
      game.player.out = true;
      zombiesBanner("Out till the wave's cleared");
    }
  }

  tickCash(dt);
  game.els.hudHostiles.textContent = String(zdir.remaining);
  updateZombiesHud(dt, {
    wave: zdir.round,
    final: FINAL_WAVE,
    between: zdir.state === "between",
    breakT: zdir.breakT,
    left: zdir.remaining,
    econ,
    offers: offers(),
    deploy: deployOffers(),
    boss,
    placing: dep.placing ? { id: dep.placing.id, name: dep.placing.stats.name, ok: dep.placing.ok, grid: dep.placing.grid } : null,
    downed: run.downed ? { t: run.bleedT, max: teamed() ? BLEED_OUT_COOP : BLEED_OUT, kills: run.standKills, need: teamed() ? 0 : LAST_STAND_KILLS, out: run.out } : null,
    vote: coop.on && roomPlayers().length ? { n: coop.host ? coop.votes.size : coop.wave.vn, of: coop.host ? playerCount() : coop.wave.vt, mine: coop.myVote } : null,
    revive: coop.revive ? { name: coop.revive.name, k: coop.revive.t / REVIVE_TIME } : null,
  });
  updateZombieBars(zdir.zombies, dep.list);
  return zdir.hitMeshes();
}
