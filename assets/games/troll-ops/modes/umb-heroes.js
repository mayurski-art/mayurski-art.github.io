// U Mad Bro? hero kit, the world side: abilities, shoves, the Hunter's dog,
// hero loadouts and the ability chip (heroes.js has the rules). Moved out of
// game.js (split phase 1).

import { HeroKit, FootprintTrail, randomHero, botStats } from "../heroes.js?v=umb2";
import { spawnComicWord, showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2";
import { round2, spawnK9 } from "../streaks/fire.js?v=sk1-si1-gj1-fu1b7b7dc2";
import { preloadHeroBodies, applyHeroBody, syncHeroBody } from "../hero-bodies.js?v=umb3g-nf-wst-ig1-soc1c2";
import { MELEE_DEFS, MeleeState } from "../gear.js?v=to-hb1kb3-bk1-wst-ig1";
import { game } from "../core/state.js?v=st1";

/* ---------------- U Mad Bro? heroes (heroes.js) ----------------
   The kit owns the rules; this is the world it acts on. Hits ride the
   normal damage path (onBulletActorHit: credit, killfeed, the death
   launch), and the shove rides heroFx: our own bots take it here, real
   players and other hosts' bots get a net "fx" and apply it themselves. */
export const HUNTER_DOG_BITE = 12, HUNTER_PIN = 2, HUNTER_DOG_TIME = 7;
export let heroKit = null, footprintTrail = null, heroWasOn = false;

export function hero() {
  return heroKit ||= new HeroKit({
    move: game.move, look: game.look, audio: game.audio,
    hostiles: heroHostiles,
    hit: heroHit,
    spawnDog: spawnHunterDog,
    word: (pos, text) => spawnComicWord(pos, false, text),
    banner: (text) => showWaveBanner(text, 1200),
    reEquip: heroReEquip,
  });
}
export function footprints() { return footprintTrail ||= new FootprintTrail(game.scene); }
export function heroActive() { return !!game.currentMode().funny; }

export function heroHostiles() {
  const out = [];
  for (const rp of game.remotes.byId.values()) if (rp.alive && !rp.dying) out.push({ id: rp.netId, pos: rp.pos });
  return out;
}

function heroHit(id, dmg, push, from) {
  const rp = game.remotes.byId.get(id);
  if (!rp || !rp.alive) return;
  const dir = push.clone().normalize();
  game.onBulletActorHit(rp, {
    damage: dmg, isHead: false, point: rp.pos.clone().setY(rp.pos.y + 1.1), dir,
    creditAs: hero().def.melee, distance: from ? rp.pos.distanceTo(from) : 0,
  });
  heroFx(id, "fling", { dx: round2(push.x), dy: round2(push.y), dz: round2(push.z) });
}

export function heroFx(id, kind, data) {
  const b = game.bots.byId(id);
  if (b) botFx(b, kind, data);
  else if (id === game.net.id) applyHeroFx({ to: game.net.id, k: kind, ...data });
  else if (game.net.active) game.net.publishFx(id, kind, data);
}

/* A shove on a bot we host: thrown up (its hop) and along, dazed a moment. */
function botFx(b, kind, d) {
  if (!b.alive) return;
  if (kind === "fling") {
    b.vel.set(+d.dx || 0, 0, +d.dz || 0);
    b.hopV = Math.max(b.hopV, +d.dy || 0);
    b.stun(0.8);
  } else if (kind === "pin") b.stun(+d.s || HUNTER_PIN);
}

export function applyHeroFx(m) {
  if (!game.currentMode().funny) return;
  if (m.to === game.net.id) {
    if (!game.player.alive) return;
    if (m.k === "fling") game.move.impulse(+m.dx || 0, +m.dy || 0, +m.dz || 0, 0.5);
    else if (m.k === "pin") { hero().pin(+m.s || HUNTER_PIN); showWaveBanner("PINNED BY A DOGE", 1200); }
    return;
  }
  const b = game.bots.byId(m.to);
  if (b) botFx(b, m.k, m);
}

/* Hunter: one Doge, out of the K9 pack code, that pins its first bite. */
function spawnHunterDog() {
  if (!heroHostiles().length) return false;
  const eid = `hero-dog-${game.net.id}-${Math.round(performance.now())}`;
  const pack = spawnK9({ id: eid, owned: true, team: game.net.team, ownerId: game.net.id, x: game.move.pos.x, y: game.move.pos.y, z: game.move.pos.z, yaw: game.look.yaw, count: 1, duration: HUNTER_DOG_TIME });
  pack.hunter = true;
  if (game.net.active) {
    game.net.publishStreak({ kind: "k9", action: "spawn", eid, team: game.net.team, n: 1, dur: HUNTER_DOG_TIME,
      x: round2(game.move.pos.x), y: round2(game.move.pos.y), z: round2(game.move.pos.z), yaw: round2(game.look.yaw) });
  }
  return true;
}

/* Spawn (and the match start): the hero's health and movement perks. Out
   of the mode, put everything back once. */
export function applyHeroLoadout() {
  if (!game.currentMode().funny) {
    if (heroWasOn) {
      hero().off();
      game.player.maxHp = 100;
      game.player.hp = Math.min(game.player.hp, 100);
      footprintTrail?.clear();
      heroWasOn = false;
    }
    return;
  }
  heroWasOn = true;
  preloadHeroBodies();
  hero().onSpawn();
  game.player.maxHp = hero().maxHp();
  game.player.hp = game.player.maxHp;
}

export function heroMeleeDef() {
  const k = hero();
  const base = MELEE_DEFS[k.def.melee] || MELEE_DEFS.keyboard;
  const mult = k.meleeMult();
  return mult === 1 ? base : { ...base, damage: Math.round(base.damage * mult) };
}

/* The Metamorph turning (or turning back): new health, harder hits. */
function heroReEquip() {
  const k = hero();
  game.player.maxHp = k.maxHp();
  game.player.hp = k.brute ? game.player.maxHp : Math.min(game.player.hp, game.player.maxHp);
  const def = heroMeleeDef();
  const wasMelee = game.player.holding === "melee";
  game.player.melee = new MeleeState(def);
  game.setActiveMeleeMesh(def);
  if (!wasMelee && game.activeMeleeMesh) game.activeMeleeMesh.visible = false;
}

export function useHeroAbility() {
  if (!game.currentMode().funny || game.gameState !== "playing" || !game.player.alive || game.isStaging()) return;
  hero().tryAbility();
}

export function updateHero(dt) {
  footprintTrail?.update(dt);
  const on = game.currentMode().funny && game.gameState === "playing";
  // Your own body in third person / the killcam wears your hero too.
  applyHeroBody(game.localRig, on ? hero().wireId() : null);
  syncHeroBody(game.localRig);
  if (on && game.player.alive) hero().update(dt);
  heroHud(on);
  // Phones: the gear row is hidden, so the streak button is the ability.
  if (game.isTouch && game.els.touchStreak && on) {
    game.els.touchStreak.hidden = !game.player.alive;
    game.els.touchStreak.classList.toggle("is-hero-ready", hero().hud().ready);
    game.els.touchStreak.setAttribute("aria-label", "Use hero ability");
  }
}

/* The ability chip, first in the gear row: key, name, cooldown or meter. */
let heroChip = null, heroChipKey = "";
function heroHud(on) {
  if (!heroChip) {
    if (!on) return;
    // A button: on a phone, tapping it is the ability.
    heroChip = document.createElement("button");
    heroChip.type = "button";
    heroChip.tabIndex = -1;
    heroChip.className = "to-gear-chip to-hero-chip";
    heroChip.setAttribute("aria-label", "Use hero ability");
    heroChip.innerHTML = `<kbd>${game.isTouch ? "" : "E"}</kbd><span></span><i></i><b aria-hidden="true"></b>`;
    heroChip.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); useHeroAbility(); });
    document.getElementById("to-hud-gear")?.prepend(heroChip);
  }
  heroChip.hidden = !on;
  if (!on) return;
  const h = hero().hud();
  const key = `${h.name}|${h.label}|${h.ready}`;
  if (key !== heroChipKey) {
    heroChipKey = key;
    heroChip.children[1].textContent = h.name;
    heroChip.children[2].textContent = h.label;
    heroChip.classList.toggle("is-ready", h.ready);
  }
  heroChip.lastChild.style.transform = `scaleX(${Math.max(0, Math.min(1, h.frac)).toFixed(3)})`;
}

/* Bots (we host) get a random hero: its health and speed, no abilities. */
export function assignBotHeroes() {
  for (const b of game.bots.bots) {
    if (b.hero) continue;
    b.hero = randomHero();
    const s = botStats(b.hero);
    b.maxHp = s.maxHp;
    b.speedMult = s.speedMult;
    if (b.alive) b.hp = b.maxHp;
  }
}
