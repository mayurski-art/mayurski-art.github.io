// Troll Forces — Troll Royale in teams, phase 3: down, not out
// (docs/ROYALE-SQUADS.md). In Duo, Trio and Squad, 0 health puts you down
// while a teammate is still on their feet: you crawl, you can't shoot, you
// bleed out in 30 s, and enemy fire finishes you off. A teammate holds X
// beside you for 5 s and you're back up at 30 health. Your whole team down
// is your whole team out. Bots go down the same way (the bot host's), and
// pick a downed teammate up when nobody's shooting at them.
//
// The wire: who's down rides everyone's state (net.js dn: 1); a revive is
// one "rv" message to whoever was picked up (net.js onRevive), which the
// bot host also takes for its bots.

import { game } from "../core/state.js?v=st1";
import { squadSize } from "./royale-squads.js?v=sq1-wb1-mt2";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2";
import { updateReviveRings, clearReviveRings } from "../view/revive-ring.js?v=rv1-zp1-bf1";

export const DOWN = {
  bleed: 30,     // s down before you're out
  hp: 100,       // what enemy fire has to take off you while you're down
  revive: 5,     // s holding X beside them
  reach: 1.8,    // m
  back: 30,      // health when you're picked up
  botLook: 30,   // m: how far a bot goes to pick a teammate up
};

const down = { on: false, t: 0, hp: 0, by: null, weapon: null, finishing: false, revive: null, savedBy: null };
let hud = null;

const teams = () => squadSize() > 1;
const pressingX = () => game.keys.has("KeyX") || (game.isTouch && !!game.touchState?.swap) || !!game.gamepadState?.pickup;

/* Everyone on our side but us: { id, name, pos, alive, downed, bot (a bot we host) }. */
function sideOf(team, notId) {
  const out = [];
  if (!team) return out;
  if (game.net.team === team && game.net.id !== notId && game.player.alive) out.push({ id: game.net.id, name: "You", pos: game.move.pos, alive: true, downed: down.on, me: true });
  for (const rp of game.remotes.byId.values()) {
    if (rp.team !== team || rp.netId === notId || rp.netId === game.net.id) continue;
    const b = game.bots.byId(rp.netId);
    out.push({ id: rp.netId, name: rp.peer.name || "operator", pos: b ? b.pos : rp.pos, alive: b ? b.alive : rp.alive, downed: b ? !!b.downed : rp.peer.downed === 1, bot: b });
  }
  return out;
}
const anyoneUp = (team, notId) => sideOf(team, notId).some((m) => m.alive && !m.downed);

/* ── You ─────────────────────────────────────────────────────────────── */

export const royaleDowned = () => down.on;

/* combat/damage.js: we hit 0 health in Royale. True: we went down instead
   of out (in teams, a teammate still up). */
export function goDown(fromId, weaponId) {
  if (!teams() || down.on || down.finishing || !anyoneUp(game.net.team, game.net.id)) return false;
  Object.assign(down, { on: true, t: DOWN.bleed, hp: DOWN.hp, by: fromId || null, weapon: weaponId || null });
  game.player.downed = true;
  game.player.hp = 0;
  game.player.armor = 0;
  game.mouseDown = false;
  game.setHolding("none");
  showWaveBanner("You're down — hold on for a teammate", 1800);
  return true;
}

/* combat/damage.js: hit while down. Enemy fire (and the Cringe) finishes you. */
export function hurtDown(amount, fromId, weaponId) {
  if (!down.on) return;
  down.hp -= amount;
  if (fromId) down.by = fromId;
  if (weaponId) down.weapon = weaponId;
  if (down.hp <= 0) finish();
}

/* Out for good: the death we put off, credited to whoever downed (or
   finished) us. */
function finish() {
  if (!down.on) return;
  down.on = false;
  down.finishing = true;
  game.player.downed = false;
  game.player.hp = 1;
  game.player.armor = 0;
  game.player.spawnGuard = 0;
  game.damagePlayer(999, down.by, down.weapon || "zone", false, null);
  down.finishing = false;
}

function getUp(by) {
  if (!down.on) return;
  down.on = false;
  game.player.downed = false;
  game.player.hp = DOWN.back;
  game.player.lastHurtAt = performance.now();
  game.setHolding("gun");
  showWaveBanner(by ? `Back up — ${by} picked you up` : "Back up", 1800);
}

/* ── Bots (the host's) ───────────────────────────────────────────────── */

/* bots.js applyHit, a bot at 0 health: true puts it down instead. */
function botGoDown(b) {
  if (b.downed) { b.downed = false; return false; }   // finished off
  if (!teams() || !game.net.isBotHost() || !anyoneUp(b.team, b.id)) return false;
  b.downed = true;
  b.downT = DOWN.bleed;
  b.hp = DOWN.hp;
  b.armor = 0;
  b.reviveT = 0;
  return true;
}

function botOut(b) {
  b.hp = 0;
  const { killed } = game.bots.applyHit(b.id, 999, { pierce: true });
  if (killed) {
    game.net.reportDeathAs(b.id, null, "zone", false);
    game.registerDeath(b.name, null, "zone", { victimTeam: b.team, victimIsBot: true, victimId: b.id });
  }
}

function botUp(b) {
  if (!b.downed) return;
  b.downed = false;
  b.hp = DOWN.back;
  b.reviveT = 0;
}

/* modes/royale.js royaleBotObjective: a downed teammate near and nobody in
   sight, go and get them. */
export function botReviveGoal(b) {
  if (!teams() || b.downed || b.seenId) return null;
  let best = null, bestD = DOWN.botLook;
  for (const m of sideOf(b.team, b.id)) {
    if (!m.alive || !m.downed) continue;
    const d = Math.hypot(m.pos.x - b.pos.x, m.pos.z - b.pos.z);
    if (d < bestD) { bestD = d; best = m; }
  }
  b.reviving = best?.id || null;
  return best ? { id: `revive-${best.id}`, x: best.pos.x, z: best.pos.z, radius: DOWN.reach * 0.6, urgent: true } : null;
}

/* Someone was picked up: us, or a bot we host. */
function revived(id, by) {
  if (id === game.net.id) { getUp(by); return; }
  const b = game.bots.byId(id);
  if (b) botUp(b);
}
function sendRevive(m, byName) {
  if (m.me || m.bot) revived(m.id, byName);
  else game.net.send({ t: "rv", id: game.net.id, to: m.id });
}

/* ── Each frame (royale.js updateRoyale) ─────────────────────────────── */

export function updateRoyaleDown(dt) {
  if (!teams()) return;
  game.net.onRevive = (p, m) => revived(m.to, p?.name || "A teammate");
  game.bots.rules.goDown = botGoDown;

  // us, down: bleeding, and out if nobody's left standing to come
  if (down.on) {
    down.t -= dt;
    if (down.t <= 0 || !anyoneUp(game.net.team, game.net.id)) finish();
  }

  // the bots we host: bleeding, and picking each other (and us) up
  if (game.net.isBotHost()) {
    for (const b of game.bots.bots) {
      if (!b.alive) continue;
      if (b.downed) {
        b.stance = "crouch";
        b.downT -= dt;
        if (b.downT <= 0 || !anyoneUp(b.team, b.id)) botOut(b);
        continue;
      }
      const m = b.reviving && sideOf(b.team, b.id).find((x) => x.id === b.reviving && x.alive && x.downed);
      if (m && !b.seenId && Math.hypot(m.pos.x - b.pos.x, m.pos.z - b.pos.z) < DOWN.reach) {
        b.reviveT = (b.reviveT || 0) + dt;
        if (b.reviveT >= DOWN.revive) { b.reviveT = 0; b.reviving = null; sendRevive(m, b.name); }
      } else b.reviveT = 0;
    }
  }

  // us, up: hold X by a downed teammate
  const rings = [];
  let near = null, nearD = DOWN.reach;
  if (game.player.alive && !down.on) {
    for (const m of sideOf(game.net.team, game.net.id)) {
      if (!m.alive || !m.downed) continue;
      rings.push({ id: m.id, x: m.pos.x, y: m.pos.y || 0, z: m.pos.z });
      const d = Math.hypot(m.pos.x - game.move.pos.x, m.pos.z - game.move.pos.z);
      if (d < nearD && Math.abs((m.pos.y || 0) - game.move.pos.y) < 1.5) { nearD = d; near = m; }
    }
  }
  if (!near) down.revive = null;
  else {
    if (down.revive?.id !== near.id) down.revive = { id: near.id, name: near.name, t: 0 };
    down.revive.t = pressingX() && !game.localPauseOnly ? down.revive.t + dt : 0;
    if (down.revive.t >= DOWN.revive) { sendRevive(near, "You"); down.revive = null; }
  }
  updateReviveRings(rings, down.revive, DOWN.revive);
  renderHud(near);
}

/* ── The line in the middle: down, or the revive in your hands ───────── */

function renderHud(near) {
  const text = down.on ? `Down — ${Math.ceil(down.t)} s · a teammate can pick you up`
    : near ? (down.revive?.t > 0 ? `Picking up ${near.name} — ${Math.round(down.revive.t / DOWN.revive * 100)}%` : `Hold X — pick up ${near.name}`)
    : "";
  if (!hud && !text) return;
  if (!hud) {
    hud = document.createElement("div");
    hud.className = "to-down-hud";
    hud.setAttribute("role", "status");
    hud.innerHTML = `<span></span><i><b></b></i>`;
    document.body.append(hud);
  }
  hud.hidden = !text;
  hud.classList.toggle("is-down", down.on);
  if (hud.firstChild.textContent !== text) hud.firstChild.textContent = text;
  const k = down.on ? Math.max(0, down.hp / DOWN.hp) : down.revive ? Math.min(1, down.revive.t / DOWN.revive) : 0;
  hud.querySelector("b").style.width = `${(k * 100).toFixed(1)}%`;
}

/* The match is over (royale.js teardownRoyale). */
export function clearRoyaleDown() {
  Object.assign(down, { on: false, t: 0, hp: 0, by: null, weapon: null, finishing: false, revive: null });
  game.player.downed = false;
  if (game.net) game.net.onRevive = null;
  if (game.bots?.rules) game.bots.rules.goDown = null;
  clearReviveRings();
  if (hud) hud.hidden = true;
}

/* Tests: the state. */
export const royaleDownState = () => ({ ...down, revive: down.revive && { ...down.revive } });
