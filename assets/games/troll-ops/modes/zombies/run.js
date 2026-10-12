// Troll Forces Zombies: the run. Waves to FINAL_WAVE with a break between
// each to spend (skippable), cash for every kill and every cleared wave,
// the upgrade column, going down instead of dying outright, and the win.
// The horde itself is zombies.js (ZombieDirector); this is everything
// around it. Modelled on Roblox's Zombie Rush Survival (Undead Dev).
//
// Down, not out: at 0 HP you drop to a crawl and bleed out. Solo there is
// nobody to pick you up, so it's a last stand: put LAST_STAND_KILLS down
// before you bleed out and you're back on your feet at half health. Co-op
// revives replace that (P4).

import { game } from "../../core/state.js?v=st1";
import { econ, earn, resetCash, tickCash, waveBonus } from "./economy.js?v=zr5";
import { buy, offers, resetUpgrades, upgradeState } from "./upgrades.js?v=zr5";
import { mountZombiesHud, showZombiesHud, updateZombiesHud, announceWave, zombiesBanner } from "../../view/zombies-hud.js?v=zr6";
import { updateZombieBars } from "../../view/zombies-bars.js?v=zr6";
import { dep, deployOffers, pickDeployable, cancelPlacing, placeDeployable, spawnDeployable, hitBlocker, resetDeployables, clearDeployables, updateDeployables } from "./deployables.js?v=zr6";
export { deployClick } from "./deployables.js?v=zr6";

export const FINAL_WAVE = 30;
const BLEED_OUT = 15;           // seconds down before it's over
const LAST_STAND_KILLS = 3;     // solo: kills while down to get back up
const LAST_STAND_HP = 0.5;      // of max health

export const run = {
  live: false,
  won: false,
  downed: false,
  bleedT: 0,
  standKills: 0,
};

/* Match setup, once the director exists and the loadout is equipped. */
export function startZombieRun() {
  run.live = true;
  run.won = false;
  run.downed = false;
  run.bleedT = 0;
  run.standKills = 0;
  game.player.downed = false;
  resetCash(0);
  resetUpgrades();
  resetDeployables();
  game.player.hp = game.player.maxHp;
  mountZombiesHud({ onBuy: buyUpgrade, onSkip: skipBreak, onDeploy: deploy, onPlace: placeDeployable, onCancel: cancelPlacing });
  showZombiesHud(true);
}

/* The run is over (game over, quit, a new match): HUD off. */
export function stopZombieRun() {
  run.live = false;
  game.player.downed = false;
  clearDeployables();
  showZombiesHud(false);
}

/* The next wave: from the countdown, and after each break. */
export function nextZombieWave() {
  const zdir = game.zdir;
  if (!zdir) return;
  const n = zdir.round + 1;
  game.player.wave = n;
  zdir.startRound(n);
  game.els.hudWave.textContent = String(n);
  announceWave(n, FINAL_WAVE);
  game.audio.wave();
}

export function buyUpgrade(id) {
  if (!run.live || run.downed || game.gameState !== "playing") return false;
  const ok = buy(id);
  game.audio.zombieBuy(ok);
  return ok;
}

/* The Deployables column: pick one to place (held = grid mode). */
export function deploy(id, grid = false) {
  if (!run.live || run.downed || game.gameState !== "playing") return false;
  const ok = pickDeployable(id, grid);
  if (!ok) game.audio.zombieBuy(false);
  return ok;
}

export function skipBreak() {
  if (!run.live || game.zdir?.state !== "between") return;
  game.zdir.skipBreak();
}

/* A zombie the local player hit (combat/weapons.js, through game). */
export function zombieHit(actor, result, point) {
  if (!result.killed) return;
  earn(result.cash, result.isHead ? "HEADSHOT KILL" : "ZOMBIE KILL", point);
  if (run.downed) {
    run.standKills++;
    if (run.standKills >= LAST_STAND_KILLS) getUp();
  }
}

/* A zombie's swipe landed: on the local player, or on a deployable in its
   way (zombies.js passes the blocker). */
function onZombieAttack(zombie, dmg, blocker = null) {
  if (blocker) { hitBlocker(blocker, dmg); return; }
  game.damagePlayer(dmg, null, null, false, zombie.mesh?.position);
}

/* combat/damage.js: the local player hit 0 HP in Zombies. */
export function zombieDowned() {
  if (run.downed) return;
  run.downed = true;
  run.bleedT = BLEED_OUT;
  run.standKills = 0;
  game.player.downed = true;
  game.player.hp = 0;
}

function getUp() {
  run.downed = false;
  game.player.downed = false;
  game.player.hp = Math.round(game.player.maxHp * LAST_STAND_HP);
  game.player.lastHurtAt = performance.now();
  zombiesBanner("Back on your feet");
}

function winRun() {
  run.won = true;
  stopZombieRun();
  game.endGame("won");
}

/* Tests (__trollOps.zrun()): read and poke the run. */
export function zombieRunDebug() {
  return {
    run, econ, upgrades: upgradeState,
    offers: () => offers(),
    buy: (id) => buyUpgrade(id),
    skip: () => skipBreak(),
    giveCash: (n) => earn(n),
    dep, deployOffers,
    deploy: (id, grid) => deploy(id, grid),
    place: () => placeDeployable(),
    cancel: () => cancelPlacing(),
    spawn: (id, x, y, z, yaw = 0) => spawnDeployable(id, x, y, z, yaw),
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
  const roundOver = zdir.update(dt, p.pos, onZombieAttack, game.move.pos.y);
  for (const ev of zdir.events.splice(0)) {
    if (ev.type === "cleared") {
      earn(waveBonus(ev.wave), `WAVE ${ev.wave} CLEARED`);
      if (ev.wave >= FINAL_WAVE) { winRun(); return []; }
    }
    else if (ev.type === "shriek") game.audio.zombieShriek(ev.at);
    else if (ev.type === "groan") game.audio.zombieGroan(ev.at, ev.voice);
    else if (ev.type === "snarl") game.audio.zombieSnarl(ev.at, ev.voice);
    else if (ev.type === "death") game.audio.zombieDeath(ev.at, ev.voice);
  }
  if (roundOver) nextZombieWave();
  updateDeployables(dt);

  if (run.downed) {
    run.bleedT -= dt;
    if (run.bleedT <= 0) {
      stopZombieRun();
      game.endGame("dead");
      return [];
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
    placing: dep.placing ? { id: dep.placing.id, name: dep.placing.stats.name, ok: dep.placing.ok, grid: dep.placing.grid } : null,
    downed: run.downed ? { t: run.bleedT, max: BLEED_OUT, kills: run.standKills, need: LAST_STAND_KILLS } : null,
  });
  updateZombieBars(zdir.zombies, dep.list);
  return zdir.hitMeshes();
}
