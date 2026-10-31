// Troll Forces Domination (user, 2026-10-17): Black Ops 2's three flags.
//
// A sits towards one side's spawns, B in the middle, C towards the other
// side's. Stand on a flag with nobody from the other side on it and it
// fills towards your side; full, it's yours. Each flag a side holds scores
// it a point every SCORE_EVERY seconds; kills score nothing for the side
// here. First side to the mode's scoreLimit wins.
//
// Authority: the bot host (or a solo client) runs the flags and sends the
// whole state a few times a second, captures as they happen; everyone else
// only draws what it's told. King of the Hill lets every client count the
// ring itself, but a flag that flips is a state, and two clients that saw a
// packet a frame apart would disagree about who owns it for the rest of the
// match.

import * as THREE from "three";
import { updateTeamHud, checkMatchEnd, awardScore, addMatchXp } from "../combat/scoring.js?v=sc1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-sr2-sr3-sr4-sr5-sr6";
import { SCORE } from "../streaks/scorestreaks.js?v=umb1-wst-sb2-fu1-wb1-ar1-ar2-cl1-bp1-fj1-zc1-zc2-nf1-or1-sam1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4";
import { XP } from "../progression/progression.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4";
import { groundHeightAt } from "../core/movement.js?v=umb2-sb2-gj1b7-or1-gf1-tg1-rfx1-hb4";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4";
import { splitSpawnSides, findOpenGround, reachableFrom } from "./modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69b7b7d-wb1-ar1-ar2-zh1-fl1-or1-ffa1-dom1-gf1-tg1-kb9-sp1-gb2-tb1-dm1-tfb8-ug1-ugm1-hgb8-hgb9-mt2-hb4";
import { game, match } from "../core/state.js?v=st1";

export const DOM = {
  radius: 4.5,        // m, the ring you stand in
  capTime: 10,        // s for one troll to take a neutral flag
  crowdMax: 2,        // more of you on it is faster, up to twice as fast
  scoreEvery: 3,      // s between a held flag's points
  sendEvery: 0.25,    // s between state messages from the host
};

const COLORS = { mine: 0x4fa3ff, theirs: 0xff5a4a, none: 0xe8e2d8 };
const CSS = { mine: "#4fa3ff", theirs: "#ff5a4a", none: "#e8e2d8" };
const other = (t) => (t === "phantom" ? "ghost" : "phantom");

/* Three flags along the line between the two sides' spawns: A a little
   short of one side, B in the middle, C mirrored. Each snaps to the nearest
   open ground someone can walk to, like the bomb sites. */
export function pickDomFlags(bounds, spawnPoints, colliders = []) {
  const sides = splitSpawnSides(spawnPoints);
  const axis = sides.axis, across = axis === "x" ? "z" : "x";
  const mean = (idx, k) => idx.reduce((s, i) => s + spawnPoints[i][k], 0) / idx.length;
  const lo = { [axis]: mean(sides.lo, axis), [across]: mean(sides.lo, across) };
  const hi = { [axis]: mean(sides.hi, axis), [across]: mean(sides.hi, across) };
  const mid = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
  const toward = (end, k) => ({ x: mid.x + (end.x - mid.x) * k, z: mid.z + (end.z - mid.z) * k });
  const reach = reachableFrom(colliders, bounds, spawnPoints);
  const raw = [toward(lo, 0.55), mid, toward(hi, 0.55)];
  const out = [];
  for (const [i, p] of raw.entries()) {
    const apart = (x, z) => out.every((o) => Math.hypot(o.x - x, o.z - z) >= 12) && (!reach || reach(x, z));
    const q = findOpenGround(colliders, bounds, p.x, p.z, DOM.radius * 0.5, apart);
    out.push({ id: "ABC"[i], x: q.x, z: q.z });
  }
  return out;
}

/* One flag: who owns it, and a capture under way (`cap` 0..1 towards `capTeam`). */
function newFlag(p) { return { id: p.id, x: p.x, z: p.z, owner: null, capTeam: null, cap: 0, contested: false }; }

let markers = [];
let hud = null, capEl = null;
let scoreT = 0, sendT = 0;
let standing = null;   // the flag we're standing on, for the capture credit

export function setupDomination() {
  teardownDomination();
  if (!game.currentMode().flags) return;
  const pts = game.builtMap.map.domFlags
    || pickDomFlags(game.builtMap.map.bounds, game.builtMap.spawnPoints, game.colliders);
  match.dom = { flags: pts.map(newFlag) };
  scoreT = 0; sendT = 0; standing = null;
  game.net.h.onDom = applyDomMessage;
  buildMarkers();
  buildHud();
  paint();
}

export function teardownDomination() {
  for (const m of markers) game.scene.remove(m.ring, m.label, m.fill);
  markers = [];
  if (hud) { hud.remove(); hud = null; }
  if (capEl) { capEl.remove(); capEl = null; }
  match.dom = null;
}

const isAuthority = () => !game.net.active || game.net.isBotHost();

/* Who's on each flag: alive, inside the ring, counted per side. */
function occupants(f) {
  const n = { phantom: 0, ghost: 0 };
  const on = (x, z) => Math.hypot(x - f.x, z - f.z) <= DOM.radius;
  if (game.player.alive && game.net.team && on(game.move.pos.x, game.move.pos.z)) n[game.net.team]++;
  for (const rp of game.remotes.byId.values()) if (rp.alive && n[rp.team] != null && on(rp.pos.x, rp.pos.z)) n[rp.team]++;
  for (const b of game.bots.bots) if (b.alive && n[b.team] != null && on(b.pos.x, b.pos.z)) n[b.team]++;
  return n;
}

/* Every frame. The host moves the flags and the score; everyone keeps the
   HUD, the rings and the capture bar in step with what they hold. */
export function updateDomination(dt) {
  const dom = match.dom;
  if (!dom) return;
  if (isAuthority()) {
    for (const f of dom.flags) stepFlag(f, occupants(f), dt);
    scoreT += dt;
    if (scoreT >= DOM.scoreEvery) {
      scoreT -= DOM.scoreEvery;
      let any = false;
      for (const f of dom.flags) if (f.owner) { game.teamScores[f.owner]++; any = true; }
      if (any) { updateTeamHud(); checkMatchEnd(); }
    }
    sendT -= dt;
    if (game.net.active && sendT <= 0) { sendT = DOM.sendEvery; sendState(); }
  }
  standing = dom.flags.find((f) => game.player.alive && Math.hypot(game.move.pos.x - f.x, game.move.pos.z - f.z) <= DOM.radius) || null;
  paint();
}

function stepFlag(f, n, dt) {
  const teams = ["phantom", "ghost"].filter((t) => n[t] > 0);
  f.contested = teams.length === 2;
  if (teams.length !== 1) {
    // Nobody on it: a half-taken flag drains back. Both sides: it holds.
    if (!teams.length && f.cap > 0) { f.cap = Math.max(0, f.cap - dt / DOM.capTime); if (!f.cap) f.capTeam = null; }
    return;
  }
  const t = teams[0];
  if (f.owner === t) { f.cap = 0; f.capTeam = null; return; }
  const rate = Math.min(DOM.crowdMax, 1 + 0.5 * (n[t] - 1)) / DOM.capTime;
  if (f.capTeam && f.capTeam !== t) {
    // Their half-capture comes off first, twice as fast as it went on.
    f.cap -= rate * 2 * dt;
    if (f.cap <= 0) { f.cap = 0; f.capTeam = t; }
    return;
  }
  f.capTeam = t;
  f.cap += rate * dt;
  if (f.cap >= 1) captured(f, t, true);
}

/* A flag changed hands. On the host this is the decision; elsewhere it's
   the host's message arriving. Each client pays its own player if they were
   standing on it. */
function captured(f, team, decide) {
  const was = f.owner;
  f.owner = team; f.cap = 0; f.capTeam = null;
  if (decide && game.net.active) game.net.publishDom({ kind: "cap", flag: f.id, team });
  const ours = team === game.net.team;
  showWaveBanner(ours ? `Flag ${f.id} secured` : was === game.net.team ? `Flag ${f.id} lost` : `Enemy took ${f.id}`, 1500);
  game.audio.wave?.();
  if (ours && game.player.alive && Math.hypot(game.move.pos.x - f.x, game.move.pos.z - f.z) <= DOM.radius) {
    awardScore(SCORE.plant);
    addMatchXp(XP.objective * 5, "CAPTURED");
  }
}

function sendState() {
  const flags = match.dom.flags.map((f) => [f.owner ? f.owner[0] : "", f.capTeam ? f.capTeam[0] : "", Math.round(f.cap * 100), f.contested ? 1 : 0]);
  game.net.publishDom({ kind: "state", flags, s: [game.teamScores.phantom, game.teamScores.ghost] });
}

const team = (c) => (c === "p" ? "phantom" : c === "g" ? "ghost" : null);

function applyDomMessage(m) {
  const dom = match.dom;
  if (!dom || m.id === game.net.id || isAuthority()) return;
  if (m.kind === "cap") {
    const f = dom.flags.find((x) => x.id === m.flag);
    if (f && f.owner !== m.team) captured(f, m.team, false);
    return;
  }
  if (m.kind !== "state" || !Array.isArray(m.flags)) return;
  m.flags.forEach((row, i) => {
    const f = dom.flags[i];
    if (!f || !Array.isArray(row)) return;
    const owner = team(row[0]);
    if (owner && f.owner !== owner) captured(f, owner, false);   // a lost "cap" message
    f.owner = owner;
    f.capTeam = team(row[1]);
    f.cap = Math.max(0, Math.min(1, (row[2] | 0) / 100));
    f.contested = !!row[3];
  });
  if (Array.isArray(m.s)) {
    const [p, g] = m.s.map((v) => v | 0);
    if (p !== game.teamScores.phantom || g !== game.teamScores.ghost) {
      game.teamScores.phantom = p; game.teamScores.ghost = g;
      updateTeamHud();
      checkMatchEnd();
    }
  }
}

/* Where a bot we host goes: the nearest flag its side doesn't hold, spread
   by id so they don't all pile onto one; when it holds all three, one to
   sit on. */
export function domBotObjective(bot) {
  const dom = match.dom;
  if (!dom) return null;
  let h = 0;
  for (let i = 0; i < bot.id.length; i++) h = (h * 31 + bot.id.charCodeAt(i)) >>> 0;
  const want = dom.flags.filter((f) => f.owner !== bot.team);
  let f;
  if (want.length) {
    // Two in three go to the nearest; the rest to one picked by id.
    const near = want.reduce((a, b) => (Math.hypot(a.x - bot.pos.x, a.z - bot.pos.z) <= Math.hypot(b.x - bot.pos.x, b.z - bot.pos.z) ? a : b));
    f = h % 3 ? near : want[h % want.length];
  } else {
    f = dom.flags[h % dom.flags.length];
  }
  return { id: `flag-${f.id}`, x: f.x, z: f.z, radius: DOM.radius * 0.55 };
}

// ---------------------------------------------------------------- drawing

function side(f) { return !f.owner ? "none" : f.owner === game.net.team ? "mine" : "theirs"; }

function letterTexture(letter, css) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.font = "bold 84px 'DM Mono', monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 8; ctx.strokeStyle = "rgba(0,0,0,.85)";
  ctx.strokeText(letter, 64, 68);
  ctx.fillStyle = css;
  ctx.fillText(letter, 64, 68);
  return new THREE.CanvasTexture(c);
}

function buildMarkers() {
  for (const f of match.dom.flags) {
    const y = groundHeightAt(game.colliders, f.x, f.z, 1) ?? 0;
    // An open wall you can see through, like the hill, plus a disc that
    // fills as the flag is taken.
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(DOM.radius, DOM.radius, 2.2, 40, 1, true),
      new THREE.MeshBasicMaterial({ color: COLORS.none, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.position.set(f.x, y + 1.1, f.z);
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(DOM.radius, 40),
      new THREE.MeshBasicMaterial({ color: COLORS.none, transparent: true, opacity: 0.32, depthWrite: false }),
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(f.x, y + 0.06, f.z);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture(f.id, CSS.none), depthTest: false, transparent: true }));
    label.scale.set(1.7, 1.7, 1);
    label.renderOrder = 20;
    label.position.set(f.x, y + 3.1, f.z);
    for (const o of [ring, fill, label]) { o.userData.noBulletCollide = true; game.scene.add(o); }
    markers.push({ f, ring, fill, label, side: "none" });
  }
}

function buildHud() {
  const parent = document.getElementById("to-hud");
  if (!parent) return;
  hud = document.createElement("div");
  hud.className = "to-dom";
  hud.setAttribute("aria-label", "Flags");
  hud.innerHTML = match.dom.flags.map((f) => `<span class="to-dom-flag" data-flag="${f.id}"><i></i><b>${f.id}</b></span>`).join("");
  parent.appendChild(hud);
  // Its own box: inside the flags row it would centre on the row, not the screen.
  capEl = document.createElement("div");
  capEl.className = "to-dom-cap";
  capEl.hidden = true;
  capEl.innerHTML = `<span></span><div class="to-bomb-bar"><b></b></div>`;
  parent.appendChild(capEl);
}

function paint() {
  const dom = match.dom;
  if (!dom) return;
  for (const m of markers) {
    const s = side(m.f);
    if (s !== m.side) {
      m.side = s;
      m.ring.material.color.setHex(COLORS[s]);
      m.label.material.map.dispose();
      m.label.material.map = letterTexture(m.f.id, CSS[s]);
      m.label.material.needsUpdate = true;
    }
    // The disc shows a capture under way in the capturer's colour.
    const capSide = m.f.capTeam ? (m.f.capTeam === game.net.team ? "mine" : "theirs") : s;
    m.fill.material.color.setHex(COLORS[capSide]);
    m.fill.scale.setScalar(m.f.capTeam ? Math.max(0.05, m.f.cap) : 1);
  }
  if (!hud) return;
  for (const el of hud.querySelectorAll(".to-dom-flag")) {
    const f = dom.flags.find((x) => x.id === el.dataset.flag);
    const s = side(f);
    el.dataset.side = s;
    // Text, not colour alone: owned / taking / contested in the title.
    el.title = `${f.id}: ${s === "mine" ? "yours" : s === "theirs" ? "theirs" : "neutral"}${f.contested ? ", contested" : f.capTeam ? ", being taken" : ""}`;
    el.classList.toggle("is-contested", !!f.contested);
    const bar = el.querySelector("i");
    bar.style.setProperty("--p", f.capTeam ? f.cap.toFixed(3) : "0");
    bar.dataset.side = f.capTeam ? (f.capTeam === game.net.team ? "mine" : "theirs") : "";
  }
  const cap = capEl;
  const f = standing;
  const show = !!f && (f.owner !== game.net.team || f.capTeam || f.contested);
  cap.hidden = !show;
  if (show) {
    const text = f.contested ? `Flag ${f.id} contested`
      : f.capTeam === game.net.team ? `Capturing ${f.id}`
      : f.capTeam ? `Losing ${f.id}`
      : `Capture ${f.id}`;
    const span = cap.querySelector("span");
    if (span.textContent !== text) span.textContent = text;
    cap.querySelector("b").style.width = `${Math.round((f.capTeam === game.net.team ? f.cap : 0) * 100)}%`;
  }
}

/* The minimap: a ring and a letter per flag, in its side's colour. */
export function drawDomMinimap(ctx, toMap, size) {
  const dom = match.dom;
  if (!dom) return;
  const span = game.ARENA.maxX - game.ARENA.minX;
  for (const f of dom.flags) {
    const [x, z] = toMap(f.x, f.z);
    const r = Math.max(5, (DOM.radius / span) * (size - 12));
    ctx.strokeStyle = CSS[side(f)];
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, z, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = CSS[side(f)];
    ctx.font = "bold 10px 'DM Mono', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(f.id, x, z);
  }
  ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
}
