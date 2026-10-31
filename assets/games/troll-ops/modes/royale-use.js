/* Troll Royale: putting on a Cope Plate and taking the Hopium, as you see
   it and as everyone else sees you.
   User, 2026-10-26: "there should be animations for when users wear the
   armor and inject the hopium".

   The channel itself is royale.js startRoyaleAct / updateRoyaleAct
   (royale.act = { kind, t, dur }); this only draws it, off the act's own
   progress k = t / dur, so the plate seats and the dose runs out exactly
   when the armour or health lands.

   Cope Plate (ROYALE.plateTime, 1.1 s):
     dip    0.00 - 0.11  the gun drops away (the swap raise run backwards)
     rise   0.08 - 0.40  both rods bring the plate up from low, its face to you
     turn   0.40 - 0.60  it swings upright, face out, the way it's worn
     slide  0.60 - 0.90  down into the vest at your chest, out of the bottom
     push   0.90 - 1.00  a shove and a settle; royale.js plays the clack
   Hopium (ROYALE.healTime, 2.6 s):
     dip    0.00 - 0.05
     rise   0.04 - 0.17  the right rod brings the injector up into view
     cap    0.15 - 0.28  the left rod flicks the orange safety cap off
     jab    0.28 - 0.36  a wind-up and a stab down into the thigh
     hold   0.36 - 0.92  the dose window drains green to empty while the
                         health comes back (a green pulse at the screen edge)
     toss   0.92 - 1.00  pulled out and flicked away; it tumbles off-screen
   At the end the gun comes back up (the swap raise). Firing, dying or
   swapping cancels the act (royale.js), and the props go with it.

   Everyone else sees it through the state packet's `ua` ("p"|"h" : percent :
   deciseconds), bots included (net.js builds theirs from b.act); the body
   pose is poseUseBody (yours in third person, players', bots'). */

import * as THREE from "three";
import { reachHand, setHandPose } from "../characters/character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1-pk1-mb1-mb2";
import { swapRaise, SWAP_RAISE } from "../combat/weapons.js?v=wp1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-ar0-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2-jx3-jx4-jx5-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-ll1";
import { buildCopePlate, buildHopium } from "./royale-loot-models.js?v=rlm1-rfx2";
import { game } from "../core/state.js?v=st1";

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
const span = (k, a, b) => ease((k - a) / (b - a));
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export const USE = {
  plate: { dip: 0.11, rise: [0.08, 0.4], turn: [0.4, 0.6], slide: [0.6, 0.9], push: [0.9, 1] },
  heal: { dip: 0.05, rise: [0.04, 0.17], cap: [0.15, 0.28], flick: 0.24, wind: [0.28, 0.32], jab: [0.32, 0.36], hold: [0.36, 0.92], pull: [0.92, 0.97], toss: 0.97 },
};
const PLATE_W = 0.3;               // royale-loot-models.js PLATE.w
const PLATE_BOW = 0.55;            // ...and its bow
const FP_PLATE = 0.6, FP_HOP = 0.55;   // first-person sizes (held right under the lens)
const ROD_TIP = 0.013;             // the rods' tip radius (streak-view.js)
const HOP_R = 0.042;               // the injector's radius at its grip
const TOSS_TIME = 0.55;

/* ------------------------------------------------------- our own act */

/* What the view draws: royale.js keeps it in step with royale.act. */
export const useAnim = { kind: null, t: 0, dur: 1, k: 0, tossT: -1 };

export function useAnimStart(kind, dur) {
  Object.assign(useAnim, { kind, t: 0, dur, k: 0 });
  fp.reset(kind);
}
export function useAnimTick(t, dur) {
  if (!useAnim.kind) return;
  useAnim.t = t; useAnim.dur = dur;
  useAnim.k = clamp01(t / dur);
}
/* Done: the plate is in, the dose is in. The empty injector flies off and
   the gun comes back up. */
export function useAnimFinish() {
  if (!useAnim.kind) return;
  if (useAnim.kind === "heal") fp.toss();
  else fp.hideAll();
  useAnim.kind = null;
  swapRaise.t = SWAP_RAISE;
  glow(0);
}
/* Cancelled (a shot, a swap, death, the match ending): everything goes now. */
export function useAnimCancel() {
  if (!useAnim.kind && useAnim.tossT < 0) return;
  const was = useAnim.kind;
  useAnim.kind = null;
  useAnim.tossT = -1;
  fp.hideAll();
  glow(0);
  if (was && game.player?.alive) swapRaise.t = SWAP_RAISE * 0.7;
}
export function useAnimBusy() { return !!useAnim.kind; }

/* On the wire: "p"|"h" : percent : deciseconds (state packet `ua`). */
export function useWire(act) {
  if (!act?.kind) return null;
  return `${act.kind === "plate" ? "p" : "h"}:${Math.round(clamp01(act.t / act.dur) * 100)}:${Math.round(act.dur * 10)}`;
}
export function parseUseWire(v) {
  if (!v || typeof v !== "string") return null;
  const [c, pc, d] = v.split(":");
  if (c !== "p" && c !== "h") return null;
  return { kind: c === "p" ? "plate" : "heal", k: clamp01((Number(pc) || 0) / 100), dur: Math.max(0.3, Math.min(6, (Number(d) || 11) / 10)) };
}

/* ------------------------------------------------------ first person */

/* The plate's inner face gets a pale label (a real plate's "this side
   toward body"): the side you see as you put it on. */
let labelGeo = null, labelMat = null;
function withBackLabel(plate) {
  labelGeo ||= new THREE.BoxGeometry(0.11, 0.05, 0.003);
  labelMat ||= new THREE.MeshStandardMaterial({ color: 0xc9d6e4, roughness: 0.6, emissive: 0x2a3644, emissiveIntensity: 0.4 });
  const m = new THREE.Mesh(labelGeo, labelMat);
  m.position.set(0, 0.06, -0.0185);
  plate.add(m);
  return plate;
}

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _q = new THREE.Quaternion(), _e = new THREE.Euler();

const fp = {
  plate: null, hop: null, cap: null, capVel: new THREE.Vector3(), capT: -1,
  tossVel: new THREE.Vector3(), tossSpin: new THREE.Vector3(), jabbed: false, capped: true,
  build() {
    if (this.plate) return;
    const keep = (m) => { m.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.renderOrder = 2; o.castShadow = false; } }); m.visible = false; return m; };
    this.plate = keep(withBackLabel(buildCopePlate()));
    this.plate.scale.setScalar(FP_PLATE);
    // The injector: its own dose window (it drains) and an orange safety cap
    // over the needle end that the left rod flicks off.
    this.hop = buildHopium();
    const glowMesh = this.hop.children[1];
    glowMesh.material = glowMesh.material.clone();
    this.hop.userData.glow = glowMesh;
    const empty = new THREE.Mesh(new THREE.CylinderGeometry(0.0415, 0.0415, 0.088, 18), new THREE.MeshStandardMaterial({ color: 0x18241c, roughness: 0.2, metalness: 0.1 }));
    empty.position.y = -0.03;
    this.hop.add(empty);
    keep(this.hop);
    this.hop.scale.setScalar(FP_HOP);
    const capGeo = new THREE.CylinderGeometry(0.047, 0.047, 0.085, 18);
    this.cap = keep(new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.45, emissive: 0x5a2400, emissiveIntensity: 0.4 })));
    this.cap.userData.home = new THREE.Vector3(0, -0.185, 0);
  },
  reset(kind) {
    const root = game.streakArms;
    if (!root) return;
    this.build();
    for (const m of [this.plate, this.hop]) if (m.parent !== root) root.add(m);
    useAnim.tossT = -1;
    this.capT = -1;
    this.jabbed = false;
    this.capped = true;
    if (this.cap.parent !== this.hop) { this.hop.add(this.cap); }
    this.cap.position.copy(this.cap.userData.home);
    this.cap.rotation.set(0, 0, 0);
    this.cap.scale.setScalar(1);
    this.setDose(1);
    this.plate.visible = false;
    this.hop.visible = false;
    this.cap.visible = kind === "heal";
  },
  /* the glowing dose: 1 full, 0 empty (drains from the top down) */
  setDose(l) {
    const g = this.hop?.userData.glow;
    if (!g) return;
    l = Math.max(0.02, l);
    g.scale.set(1, l, 1);
    g.position.y = -0.075 * (1 - l);
    g.material.emissiveIntensity = 0.35 + 0.75 * l;
  },
  hideAll() {
    if (!this.plate) return;
    this.plate.visible = this.hop.visible = this.cap.visible = false;
    useAnim.tossT = -1;
    this.capT = -1;
  },
  toss() {
    if (useAnim.tossT >= 0) return;
    if (!this.hop?.visible) { this.hideAll(); return; }
    useAnim.tossT = 0;
    this.tossVel.set(0.9, 0.55, -0.25);
    this.tossSpin.set(7, 2, -11);
  },
  /* the flicked cap and the tossed injector keep flying in viewmodel space */
  fly(dt) {
    if (this.capT >= 0) {
      this.capT += dt;
      this.capVel.y -= 2.6 * dt;
      this.cap.position.addScaledVector(this.capVel, dt);
      this.cap.rotation.x += dt * 13; this.cap.rotation.z += dt * 8;
      this.cap.visible = this.capT < 0.7 && this.cap.position.y > -0.7;
    }
    if (useAnim.tossT >= 0) {
      useAnim.tossT += dt;
      this.tossVel.y -= 3.2 * dt;
      this.hop.position.addScaledVector(this.tossVel, dt);
      this.hop.rotation.x += this.tossSpin.x * dt; this.hop.rotation.y += this.tossSpin.y * dt; this.hop.rotation.z += this.tossSpin.z * dt;
      if (useAnim.tossT > TOSS_TIME || this.hop.position.y < -0.75) { this.hop.visible = false; useAnim.tossT = -1; }
    }
  },
};

/* The first-person pieces (tests). */
export function useModels() { return fp.plate ? { plate: fp.plate, hop: fp.hop, cap: fp.cap } : null; }

/* A point on `obj` (local coords) in viewmodel space. */
function onProp(obj, x, y, z, out) {
  obj.updateMatrix();
  return out.set(x, y, z).applyMatrix4(obj.matrix);
}

/* Where a rod ends on the injector: the side of its body facing that rod's
   shoulder, at grip height, the tip just touching the surface. */
function hopRodTip(side, y, out) {
  const h = fp.hop;
  h.updateMatrix();
  const axis = _a.set(0, 1, 0).applyQuaternion(h.quaternion);
  const c = onProp(h, 0, y, 0, out);
  const sh = game.STREAK_SHOULDER[side > 0 ? 0 : 1];
  const d = _b.subVectors(sh, c);
  d.addScaledVector(axis, -d.dot(axis));
  if (d.lengthSq() < 1e-8) d.set(side, 0, 0);
  return c.addScaledVector(d.normalize(), HOP_R * FP_HOP + ROD_TIP * 0.6);
}

let lastAt = 0, glowEl = null;

/* The frame for view/fp-emote.js: {R, L, gun, cam} like a grenade throw, or
   null. `show` false (a grenade has the hands) just hides the props. Also
   flies the cap and the tossed injector, which outlive the act. */
export function royaleUseFrame(show = true) {
  const now = performance.now() / 1000, dt = Math.min(0.05, Math.max(0, now - (lastAt || now)));
  lastAt = now;
  if (!fp.plate) return null;
  if (!show || !game.player?.alive) {
    if (useAnim.kind || useAnim.tossT >= 0) fp.hideAll();
    if (!game.player?.alive) { useAnim.kind = null; glow(0); }
    return null;
  }
  fp.fly(dt);
  const kind = useAnim.kind, k = useAnim.k;
  if (!kind) {
    glow(0);
    // after the act: the injector still tumbling away (the gun's coming back up)
    return useAnim.tossT >= 0 || fp.capT >= 0 ? { R: null, L: null, gun: true, cam: { pitch: 0, yaw: 0 }, royaleUse: true } : null;
  }
  const T = USE[kind];
  // The dip: the gun goes down the way a swap brings it up.
  if (k < T.dip) {
    swapRaise.t = SWAP_RAISE * ease(k / T.dip);
    fp.plate.visible = fp.hop.visible = false;
    return null;
  }
  swapRaise.t = 0;
  return kind === "plate" ? plateFrame(k, T) : healFrame(k, T, now);
}

function plateFrame(k, T) {
  const p = fp.plate;
  const rise = span(k, ...T.rise), turn = span(k, ...T.turn), slide = span(k, ...T.slide);
  const push = clamp01((k - T.push[0]) / (T.push[1] - T.push[0]));
  // a shove past the seat and a little bounce back
  const shove = Math.sin(Math.min(1, push * 1.6) * Math.PI) * 0.045 - ease(push) * 0.012;
  let pos = lerp3([0.22, -0.62, -0.4], [0.03, -0.1, -0.52], rise);
  pos = lerp3(pos, [0.0, -0.1, -0.47], turn);
  pos = lerp3(pos, [0.0, -0.5, -0.3], slide);
  pos[1] -= shove;
  p.position.set(pos[0], pos[1], pos[2]);
  // Already the way it's worn (face out, the curve toward you, its "this
  // side toward body" label up at you), lying tipped forward in the rods,
  // then swung upright face-in to the chest: about the side-to-side axis
  // only, so each rod keeps its own edge and nothing crosses.
  const theta = 1.0 * (1 - turn) - 0.1 * slide;
  p.rotation.set(theta, Math.PI, 0.25 * (1 - rise) * (1 - turn), "YXZ");
  p.visible = true;
  fp.hop.visible = fp.cap.visible = false;
  // The rods on its two side edges, a little below the middle.
  const x = PLATE_W / 2 + ROD_TIP / FP_PLATE, z = -PLATE_BOW * (PLATE_W / 2) ** 2;
  const e1 = onProp(p, x, -0.04, z, new THREE.Vector3()), e2 = onProp(p, -x, -0.04, z, new THREE.Vector3());
  const [r, l] = e1.x >= e2.x ? [e1, e2] : [e2, e1];
  return {
    R: { pos: [r.x, r.y, r.z], rot: [0, 0, -Math.PI / 2], pose: "grip" },
    L: { pos: [l.x, l.y, l.z], rot: [0, 0, Math.PI / 2], pose: "grip" },
    gun: false, cam: { pitch: -0.012 * Math.sin(push * Math.PI), yaw: 0 }, royaleUse: true,
  };
}

function healFrame(k, T, now) {
  const h = fp.hop;
  const rise = span(k, ...T.rise), wind = span(k, ...T.wind);
  const jab = clamp01((k - T.jab[0]) / (T.jab[1] - T.jab[0]));
  const jabE = jab * jab;   // fast in, like a stab
  const pull = span(k, ...T.pull);
  let pos = lerp3([0.24, -0.6, -0.34], [0.07, -0.04, -0.46], rise);
  pos = lerp3(pos, [0.09, -0.01, -0.47], wind * (1 - jab));
  if (jab > 0) pos = lerp3([0.09, -0.01, -0.47], [0.12, -0.165, -0.35], jabE);
  // held in: a slight tremble while it doses
  const hold = k >= T.hold[0] && k < T.pull[0];
  if (hold) { pos[0] += Math.sin(now * 37) * 0.0012; pos[1] += Math.sin(now * 29) * 0.0012; }
  pos = lerp3(pos, [0.15, -0.09, -0.41], pull);
  const flying = useAnim.tossT >= 0;   // (fp.fly has it once it's thrown)
  if (!flying) h.position.set(pos[0], pos[1], pos[2]);
  // Show: needle down and to the left, the window to you. Jab: needle down
  // and away, button end toward you. Pulled out: tipped over for the toss.
  const rx = 0.25 + (0.4 - 0.25) * Math.max(wind, jabE) - 0.9 * pull;
  const rz = -0.35 + 0.2 * Math.max(wind, jabE) - 0.9 * pull;
  if (!flying) { h.rotation.set(rx, 0.15, rz, "YXZ"); h.visible = true; }
  fp.plate.visible = false;
  // The dose: full until the jab lands, empty by the pull.
  fp.setDose(k < T.jab[1] ? 1 : 1 - clamp01((k - T.jab[1]) / (T.pull[0] - T.jab[1])));
  if (jab >= 1 && !fp.jabbed) { fp.jabbed = true; game.audio?.slideRelease?.(); }
  glow(k >= T.jab[1] && k < 1 ? 0.6 + 0.4 * Math.sin(now * 6) : 0, (k - T.jab[1]) / (1 - T.jab[1]));
  // The cap: the left rod hooks it and flicks it off down-left.
  let L = null;
  if (k >= T.cap[0] && k < T.cap[1] + 0.06) {
    const c = clamp01((k - T.cap[0]) / (T.cap[1] - T.cap[0]));
    const capAt = onProp(h, -HOP_R - 0.012 / FP_HOP, -0.19, 0, _v);
    const reach = lerp3([-0.24, -0.55, -0.36], [capAt.x, capAt.y, capAt.z], ease(c / 0.6));
    const away = ease((k - T.flick) / 0.08);
    L = { pos: lerp3(reach, [-0.12, -0.42, -0.3], away), rot: [0, 0, Math.PI / 2], pose: "grip" };
    if (k >= T.flick && fp.capped) {
      fp.capped = false;
      // let it go into viewmodel space and fly
      game.streakArms.attach(fp.cap);
      fp.capVel.set(-0.7, 0.35, 0.15);
      fp.capT = 0;
      game.audio?.pinPull?.();
    }
  }
  if (fp.capped && k >= T.flick) { fp.capped = false; fp.cap.visible = false; }   // (a frame skipped past it)
  // The toss: at the end of the pull the rod flicks it away.
  if (k >= T.toss && useAnim.tossT < 0) fp.toss();
  const tossing = useAnim.tossT >= 0;
  const tip = hopRodTip(1, 0.03, _a);
  const R = tossing
    ? { pos: lerp3([tip.x, tip.y, tip.z], [0.3, -0.55, -0.32], ease(useAnim.tossT / 0.2)), rot: [0, 0, -Math.PI / 2], pose: "relaxed" }
    : { pos: [tip.x, tip.y, tip.z], rot: [0, 0, -Math.PI / 2], pose: "grip" };
  return { R, L, gun: false, cam: { pitch: -0.01 * Math.sin(jab * Math.PI), yaw: 0 }, royaleUse: true };
}

/* A soft green at the screen's edges while the Hopium works: `a` 0..1
   strength, `k` how far the dose is in (fades as you fill). */
function glow(a, k = 0) {
  if (!glowEl) {
    if (!a || typeof document === "undefined") return;
    glowEl = document.createElement("div");
    glowEl.id = "to-hopium-glow";
    glowEl.setAttribute("aria-hidden", "true");
    glowEl.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;transition:opacity .25s;"
      + "background:radial-gradient(ellipse at center, rgba(85,255,122,0) 58%, rgba(85,255,122,0.32) 100%);";
    document.body.appendChild(glowEl);
  }
  const o = a ? (a * (0.75 - 0.35 * clamp01(k))).toFixed(3) : "0";
  if (glowEl.style.opacity !== o) glowEl.style.opacity = o;
}

/* ------------------------------------------------------ on a body */

/* A body plating up or dosing (yours in third person, a player's from `ua`,
   a bot's): kind and k 0..1. After poseHumanoid; the caller hides the gun.
   The rig gets its own plate and injector (rig.useModels). */
const _tR = new THREE.Vector3(), _tL = new THREE.Vector3();
const _poleR = new THREE.Vector3(1, -1, 0.3), _poleL = new THREE.Vector3(-1, -1, 0.3);
const _pe = new THREE.Vector3(), _pa = new THREE.Vector3(), _pb = new THREE.Vector3();
function palm(rig, side, k, out) {
  const p = rig.parts;
  (side > 0 ? p.elbowR : p.elbowL).getWorldPosition(_pe);
  (side > 0 ? p.handR : p.handL).getWorldPosition(out);
  rig.root.worldToLocal(_pe); rig.root.worldToLocal(out);
  _pe.subVectors(out, _pe).normalize();
  return out.addScaledVector(_pe, 0.07 * k);
}
function bodyModels(rig) {
  if (!rig.useModels) {
    const plate = buildCopePlate(), hop = buildHopium();
    for (const m of [plate, hop]) { m.visible = false; m.traverse((o) => { if (o.isMesh) o.castShadow = false; }); }
    rig.useModels = { plate, hop };
  }
  const u = rig.useModels;
  for (const m of [u.plate, u.hop]) if (m.parent !== rig.root) rig.root.add(m);
  return u;
}
export function poseUseBody(rig, kind, k) {
  if (!rig?.parts?.handR) return;
  const s = rig.scale || 1;
  const u = bodyModels(rig);
  let r, l;
  if (kind === "plate") {
    const T = USE.plate;
    const rise = span(k, T.dip, T.rise[1]), press = span(k, T.turn[0], T.slide[1]);
    const push = Math.sin(clamp01((k - T.push[0]) / 0.1) * Math.PI) * 0.03;
    r = lerp3(lerp3([0.2, -0.45, -0.1], [0.13, -0.08, -0.4], rise), [0.13, -0.12, -0.24 + push], press);
    l = [-r[0], r[1], r[2]];
  } else {
    const T = USE.heal;
    const rise = span(k, T.dip, T.rise[1]), wind = span(k, ...T.wind), jab = span(k, ...T.jab), pull = span(k, ...T.pull);
    r = lerp3([0.2, -0.45, -0.1], [0.12, -0.1, -0.36], rise);
    r = lerp3(r, [0.15, -0.02, -0.3], wind * (1 - jab));
    r = lerp3(r, [0.16, -0.6, -0.12], jab);
    r = lerp3(r, [0.22, -0.3, -0.26], pull);
    const cap = k >= T.cap[0] && k < T.cap[1] ? Math.sin(clamp01((k - T.cap[0]) / (T.cap[1] - T.cap[0])) * Math.PI) : 0;
    l = lerp3([-0.2, -0.45, -0.05], [r[0] - 0.08, r[1] - 0.1, r[2] + 0.02], cap);
  }
  reachHand(rig, 1, _tR.set(r[0] * s, r[1] * s, r[2] * s), _poleR);
  reachHand(rig, -1, _tL.set(l[0] * s, l[1] * s, l[2] * s), _poleL);
  setHandPose(rig, 1, "fist");
  setHandPose(rig, -1, kind === "plate" ? "fist" : "open");
  rig.body?.update?.();
  rig.root.updateMatrixWorld(true);
  const pr = palm(rig, 1, s, _pa);
  if (kind === "plate") {
    const pl = palm(rig, -1, s, _pb);
    u.hop.visible = false;
    u.plate.visible = true;
    u.plate.position.set((pr.x + pl.x) / 2, (pr.y + pl.y) / 2, (pr.z + pl.z) / 2 - 0.02 * s);
    // face out (-Z is the body's front), tipped back while it's held up
    u.plate.rotation.set(-0.8 * (1 - span(k, USE.plate.turn[0], USE.plate.turn[1])), Math.PI, 0, "YXZ");
    u.plate.scale.setScalar(0.9 * s);
  } else {
    u.plate.visible = false;
    u.hop.visible = k < USE.heal.toss;
    u.hop.position.copy(pr);
    u.hop.rotation.set(0.35, 0, 0);   // needle down and a touch forward
    u.hop.scale.setScalar(1.15 * s);   // read at range, like a thrown grenade
  }
}
/* Put a body's props away (no act on). */
export function clearUseBody(rig) {
  const u = rig?.useModels;
  if (u) u.plate.visible = u.hop.visible = false;
}

/* Your own body in third person (view/third-person.js), from useAnim.
   Returns true when it posed (the caller hides the held gun). */
export function poseUseLocal(rig) {
  if (!useAnim.kind || !game.player?.alive || useAnim.k < USE[useAnim.kind].dip) { clearUseBody(rig); return false; }
  poseUseBody(rig, useAnim.kind, useAnim.k);
  return true;
}

/* Everyone else's (net/remote-players.js peerPosers; royale.js registers
   it): their `ua`, run on between packets. */
export function poseUsePeer(rp, dt) {
  const raw = rp.alive ? rp.peer?.useAct || null : null;
  if (raw !== rp.useRaw) {
    rp.useRaw = raw;
    const w = parseUseWire(raw);
    rp.useAct = w ? { kind: w.kind, k: w.k, dur: w.dur } : null;
  } else if (rp.useAct) rp.useAct.k = Math.min(1, rp.useAct.k + dt / rp.useAct.dur);
  const a = rp.useAct;
  if (!a || !rp.alive) { clearUseBody(rp.rig); return; }
  poseUseBody(rp.rig, a.kind, a.k);
  if (rp.weaponMesh) rp.weaponMesh.visible = false;
}
