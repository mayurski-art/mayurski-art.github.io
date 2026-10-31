// Troll Forces Zombies: power-up drops (design doc "Zombie Rush: what's
// next", phase M1; claude.ai/artifact/4pfaNykEVdLDTmpYkxL1vs).
//
// Now and then a kill leaves a glowing trollface on the floor; walk into it
// and the whole team gets it:
//   Kaboom       every zombie on the field drops (not a boss), +$400 each
//   One Tap      20 s: any hit kills (not a boss)
//   Double Cash  20 s: everything pays twice
//   Rebuild      every deployable back to full health
//   Fire Sale    30 s: deployables at half price
// A boss always drops one. Otherwise a kill has DROP_ODDS of it, at most
// 1 + wave / 6 a wave, so the early waves see one at most. A drop fades
// after LIFE seconds, blinking for the last few.
//
// Co-op: the host rolls and says so; whoever touches one asks the host, and
// the host hands it out, so two players can't both take it. The wire
// (net.js routes "zu" here through run.js):
//   zu { s: [n, kind, x, y, z] }    host: a drop fell
//   zu { p: n }                     player -> host: I've touched n
//   zu { g: [n, kind, name, id] }   host: n is taken, by `name` (player
//                                   `id`); everyone applies it
//   zu { x: n }                     host: n faded

import * as THREE from "three";
import { game } from "../../core/state.js?v=st1";
import { econ, earn } from "./economy.js?v=zr5-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-zd1-wb1-mt2-sk1-hb4-sr8";
import { SALE } from "./kits.js?v=zr6-zr9-zr10-zd1-wb1";
import { HORDE_FX } from "./horde.js?v=zr4c-sb2b7b7dc2f1m1u-gt1-gt2-zr5-zr6-zr7-zr8-zr9-zr10-zc2-zp1-bf1-sr1-fl1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-gf1-tg1-er1-cl1-rb4-rb6-hp1-ht1-bx1-sp1-tfb8-rfx1-zd1-ze1-wb1-hb4";

export const DROPS = {
  kaboom: { name: "Kaboom", color: "#ff4a3a", weight: 1 },
  onetap: { name: "One Tap", color: "#ffe14a", weight: 1.2, secs: 20 },
  double: { name: "Double Cash", color: "#7dff4f", weight: 1.2, secs: 20 },
  rebuild: { name: "Rebuild", color: "#4aa8ff", weight: 0.8 },
  firesale: { name: "Fire Sale", color: "#ff9a2a", weight: 0.8, secs: 30 },
};
export const DROP_ODDS = 0.035;
const LIFE = 25;           // s on the floor
const BLINK = 5;           // ...the last of them blinking
const REACH = 1.25;        // m, feet to the drop's centre on the floor
const KABOOM_PAY = 400;

const drops = new Map();   // n -> { n, kind, mesh, t }
export const dropFx = { onetap: 0, double: 0, firesale: 0 };   // seconds left
const state = { wave: 0, rolled: 0, n: 0, asked: new Set(), hooks: null };

const net = () => game.net;
const me = () => net().id;
const isHost = () => !net().connected || net().hostId() === me();
function send(m) {
  if (!net().connected) return;
  m.t = "zu";
  m.id = me();
  net().send(m);
}

/* ------------------------------------------------------------ the look */

/* A drop's face: the real trollface art on a disc of its colour. */
const faceTex = new Map();
let art = null;
function faceTexture(kind) {
  if (faceTex.has(kind)) return faceTex.get(kind);
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  faceTex.set(kind, t);
  const draw = () => {
    const g = c.getContext("2d");
    const col = DROPS[kind].color;
    const halo = g.createRadialGradient(128, 128, 40, 128, 128, 128);
    halo.addColorStop(0, col); halo.addColorStop(0.62, col); halo.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = halo; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(128, 128, 82, 0, Math.PI * 2); g.fill();
    if (art?.complete && art.naturalWidth) {
      const s = 150 / Math.max(art.naturalWidth, art.naturalHeight);
      g.drawImage(art, 128 - art.naturalWidth * s / 2, 128 - art.naturalHeight * s / 2, art.naturalWidth * s, art.naturalHeight * s);
    }
    g.lineWidth = 8; g.strokeStyle = col; g.beginPath(); g.arc(128, 128, 84, 0, Math.PI * 2); g.stroke();
    t.needsUpdate = true;
  };
  if (!art) {
    art = new Image();
    art.src = new URL("../../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
  }
  if (art.complete) draw(); else art.addEventListener("load", draw, { once: true });
  draw();
  return t;
}

function beamTexture() {
  const c = document.createElement("canvas");
  c.width = 32; c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "rgba(255,255,255,0)"); grad.addColorStop(1, "rgba(255,255,255,.75)");
  g.fillStyle = grad; g.fillRect(0, 0, 32, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}
let beamTex = null;

function makeMesh(kind, x, y, z) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  const face = new THREE.Sprite(new THREE.SpriteMaterial({ map: faceTexture(kind), transparent: true, depthWrite: false, toneMapped: false }));
  face.scale.set(0.75, 0.75, 1);
  face.position.y = 1.0;
  root.add(face);
  beamTex ||= beamTexture();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 2.6, 16, 1, true), new THREE.MeshBasicMaterial({
    map: beamTex, color: new THREE.Color(DROPS[kind].color), transparent: true, opacity: 0.55, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  }));
  beam.position.y = 1.3;
  root.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 32), new THREE.MeshBasicMaterial({
    color: new THREE.Color(DROPS[kind].color), transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  root.add(ring);
  root.userData = { face, beam, ring };
  root.name = "zdrop";
  return root;
}

/* ------------------------------------------------------------ the floor */

function place(n, kind, x, y, z) {
  if (drops.has(n) || !DROPS[kind] || !game.scene) return;
  const mesh = makeMesh(kind, x, y, z);
  game.scene.add(mesh);
  drops.set(n, { n, kind, mesh, t: LIFE });
}

function remove(n) {
  const d = drops.get(n);
  if (!d) return;
  d.mesh.parent?.remove(d.mesh);
  d.mesh.traverse((o) => { o.geometry?.dispose(); if (o.material && o.material.map !== faceTex.get(d.kind)) o.material.dispose?.(); });
  drops.delete(n);
}

/* Host: a kill might leave one. */
function roll(z) {
  const zdir = game.zdir;
  if (state.wave !== zdir.round) { state.wave = zdir.round; state.rolled = 0; }
  const boss = !!z.type?.boss;
  if (!boss) {
    if (state.rolled >= 1 + Math.floor(zdir.round / 6)) return;
    if (Math.random() >= (state.forceOdds ?? DROP_ODDS)) return;
    state.rolled++;
  }
  const p = z.mesh.position;
  spawnDrop(pickKind(), p.x, p.y, p.z);
}

function pickKind() {
  if (state.forceKind) return state.forceKind;
  const kinds = Object.entries(DROPS).filter(([id]) => id !== "rebuild" || state.hooks?.deployables().length);
  let r = Math.random() * kinds.reduce((a, [, d]) => a + d.weight, 0);
  for (const [id, d] of kinds) if ((r -= d.weight) <= 0) return id;
  return kinds[0][0];
}

function spawnDrop(kind, x, y, z) {
  const n = `${me()?.slice(0, 4) || "solo"}.${++state.n}`;
  place(n, kind, x, y, z);
  send({ s: [n, kind, +x.toFixed(2), +y.toFixed(2), +z.toFixed(2)] });
  return n;
}

/* ------------------------------------------------------------ taking one */

/* Host: hand drop n out (to us or to whoever asked), once. */
function grant(n, name, by) {
  const d = drops.get(n);
  if (!d) return;
  send({ g: [n, d.kind, name, by] });
  take(n, d.kind, name, by);
}

/* Everyone: n is taken; the team gets what it does. */
function take(n, kind, name, by) {
  remove(n);
  state.asked.delete(n);
  const D = DROPS[kind];
  if (!D) return;
  const mine = !by || by === me();
  state.hooks?.banner(net().connected && !mine && name ? `${D.name}! (${name})` : `${D.name}!`);
  game.audio.tierUp();
  if (D.secs) dropFx[kind] = D.secs;
  if (kind === "kaboom") kaboom();
  if (kind === "rebuild") state.hooks?.rebuild(isHost());
  applyFx();
}

/* Every zombie on the field drops at once. The host kills them (the wire
   carries the deaths); everyone hears it and is paid. */
function kaboom() {
  game.audio.explosion(1.2, game.player?.pos || null);
  if (isHost()) {
    for (const z of game.zdir?.zombies || []) {
      if (!z.alive || z.dying || z.type?.boss || z.proxy) continue;
      z.killCash = 0;
      z.takeDamage(z.hp + 1e6, false);
    }
  }
  earn(KABOOM_PAY, "KABOOM");
}

function applyFx() {
  HORDE_FX.instakill = dropFx.onetap > 0;
  econ.mult = dropFx.double > 0 ? 2 : 1;
  SALE.mult = dropFx.firesale > 0 ? 0.5 : 1;
}

/* net.js -> run.js: a "zu" message. */
export function onDropMessage(p, m) {
  if (Array.isArray(m.s)) place(...m.s);
  else if (m.p != null && isHost()) grant(String(m.p), p?.name || "A teammate", p?.id);
  else if (Array.isArray(m.g)) take(...m.g);
  else if (m.x != null) remove(String(m.x));
}

/* ------------------------------------------------------------ each frame */

/* `hooks`: { banner(text), rebuild(host), deployables(), canTake() }, from run.js. */
export function startDrops(hooks) {
  resetDrops();
  state.hooks = hooks;
}

export function resetDrops() {
  for (const n of [...drops.keys()]) remove(n);
  for (const k of Object.keys(dropFx)) dropFx[k] = 0;
  state.wave = 0; state.rolled = 0; state.asked.clear();
  applyFx();
}

let clock = 0;
export function updateDrops(dt) {
  clock += dt;
  const host = isHost();
  // host: every kill gets its roll, once
  if (host) for (const z of game.zdir?.zombies || []) {
    if (z.dying && !z.dropRolled && !z.proxy) { z.dropRolled = true; roll(z); }
  }
  // the timers
  let changed = false;
  for (const k of Object.keys(dropFx)) {
    if (dropFx[k] > 0) { dropFx[k] = Math.max(0, dropFx[k] - dt); if (!dropFx[k]) changed = true; }
  }
  if (changed) applyFx();
  // the drops: spin, bob, blink, fade, and our feet in one
  const feet = game.move?.pos;
  const canTake = state.hooks?.canTake?.() ?? true;
  for (const d of [...drops.values()]) {
    d.t -= dt;
    const { face, beam, ring } = d.mesh.userData;
    face.position.y = 1.0 + Math.sin(clock * 2.4 + d.mesh.position.x) * 0.1;
    ring.rotation.z = clock * 1.5;
    const on = d.t > BLINK || Math.floor(d.t * 6) % 2 === 0;
    face.visible = beam.visible = on;
    if (d.t <= 0) { if (host) send({ x: d.n }); remove(d.n); continue; }
    if (!feet || !canTake || state.asked.has(d.n)) continue;
    const p = d.mesh.position;
    if (Math.hypot(feet.x - p.x, feet.z - p.z) < REACH && Math.abs(feet.y - p.y) < 2.2) {
      if (host) grant(d.n, net().name || "", me());
      else { state.asked.add(d.n); send({ p: d.n }); }
    }
  }
}

/* The HUD's timer chips: [{ id, name, color, t, max }]. */
export function dropChips() {
  return Object.entries(dropFx).filter(([, t]) => t > 0).map(([id, t]) => ({ id, name: DROPS[id].name, color: DROPS[id].color, t, max: DROPS[id].secs }));
}

/* Tests (__trollOps.zrun().drops). */
export function dropsDebug() {
  return {
    drops, dropFx, state,
    spawn: (kind, x, y, z) => spawnDrop(kind, x, y, z),
    force: (kind = null, odds = null) => { state.forceKind = kind; state.forceOdds = odds; },
  };
}
