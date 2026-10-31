// Troll Forces — townsfolk for the Socialize hangout (user, 2026-10-04:
// "in socialize section for troll city fill it with a decent amount of
// troll characters acting like NPCs and make them interacting with
// things").
//
// A map lists its cast as `rp.npcs()` (trollcity.js): name, role, where,
// which way, and the loop they play (`act`). They're props with a body:
// every client runs its own copy, nothing goes on the wire, nobody can
// hurt them, and players walk through them. Far ones pose less often and
// the furthest are hidden, so a full town costs little.
//
// Loops: drink (sip a mug or a shot now and then), cards (hands on the
// table, slap a card down), piano (both hands working the keys), dance,
// wipe (a rag on the bar), hammer (the anvil), brush (a horse), count
// (money or goods on a counter), tend (the doctor over the exam table),
// guard (arms folded, looking round), sit-read (feet up, reading), walk
// (round a path, stopping to look about; `pace` walks it back and forth;
// a corner [x, z, y] sets the floor's height there),
// phone (waiting in a line: thumbing a phone, looking up now and then),
// smith (anvil, forge and quench barrel, with the tools: smithy.js).
// roam (`stops`: [{ x, z, act, secs, dance, yaw }]): stand at a stop doing
// its act (dance, phone...) for about `secs`, then walk to the next one,
// round the list (a clubber who dances a while, steps off the floor to film
// the DJ, then finds another spot).
// The kitchen (Trolling Loud): cook (a spatula at the range, the pan
// shaken now and then), chop (a knife on the board), wash (both hands in the
// sink, a rack lifted out), expo (at the pass: plates slid along, the bell
// rung), carry (a runner on a path with a tray of food).
// The beach (Grin Beach): lie (flat on the back on a towel or a lounger,
// sunbathing; `towel` lays one under him), lift (dumbbell curls at Muscle
// Beach), ready (a player's stance on a court, weight on the toes, waiting
// on the ball).
//
// Optional per NPC: `height`, `build` (a bouncer's shoulders), `dance`
// (which of DANCES), `zone` (its room, if not where it stands), `outfit`
// (clothes, outfits.js). A map whose music has a clock passes `beat` (beats since it
// started, trollingloud.js) and its dancers move on that beat instead of
// their own.

import * as THREE from "three";
import { buildHumanoid, poseHumanoid, aimRig, gaitPhaseRate, gaitFromVelocity, DANCES, reachHand, setHandPose } from "../characters/character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1-pk1";
import { buildDrink, mountDrink, poseDrinkArm } from "./saloon-bar.js?v=sb1b7-cup1-gt1-gt2-cw1-zr10-hr2-zp1-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";
import { SmithWork } from "./smithy.js?v=sm1b7b7dc2f1m1-gt1-gt2-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";
import { setReliefFace } from "../characters/blocky-body.js?v=bk1-cw1-zr10-bf1-sr1-nf1-nx1-or1-nf2-em2-nb2-sb1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-gt1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-rb1-fg3-hd1-rc1-rc3-rc4-rc5-ls1-ut1-er1-cl1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-hl1-mg1-sp1-rh1-ci6-pm1";
import { wearOutfit } from "../characters/outfits.js?v=of1m1-nc1-cd1-sh1-hr2-zp1-sr1-or1-gb3-rh1";
import { holdInstrument, poseInstrument } from "../characters/instruments.js?v=in1-bw2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";

const WALK_MPS = 1.25;
const _lean = new THREE.Vector3(), _poleL = new THREE.Vector3(-1, -1, 0.3);
const NEAR = 40;     // full rate inside this
const FAR = 85;      // hidden past this
const TAG_RANGE = 12; // name tags only inside this
const RELIEF_RANGE = 30; // the 3D head inside this, the flat board past it
/* Background extras go untagged: only someone with a job to roleplay (the
   barkeep, the sheriff, the doctor...) wears a name. */
const UNTAGGED = new Set(["Townsfolk", "Drifter", "Barfly", "Regular", "Gambler", "Clubgoer", "Raver", "VIP", "Beachgoer", "Surfer", "Lifter", "Baller"]);
/* Each dance's own time per beat of the music (character.js DANCES: bounce,
   floss, headbang, wave) and where in it the hit lands, so a beat-locked
   dancer drops, swings or nods on the beat. */
const DANCE_BEAT = [[1 / 3.6, 0.5], [1 / 4.4, 0], [1 / 2.6, 0.25], [1 / 3.08, 0]];
const TAG_COLOR = "#ffd28a";   // townsfolk tags read warm, players' white
const _hand = new THREE.Vector3(), _poleR = new THREE.Vector3(1, -1, 0.3), _poleL2 = new THREE.Vector3(-1, -1, 0.3);
const WALKERS = new Set(["walk", "carry"]);

/* The kitchen's props: a tool in the right fist (on the grip mount), or a
   tray of food carried in front (on the chest). Shared materials. */
const PROP_MATS = new Map();
const propMat = (c, rough = 0.4, metal = 0.6) => PROP_MATS.get(c) ?? PROP_MATS.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal })).get(c);
function kitchenProp(act) {
  const g = new THREE.Group();
  const box = (c, w, h, d, x, y, z, rough, metal) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), propMat(c, rough, metal)); m.position.set(x, y, z); g.add(m); return m; };
  if (act === "cook") {   // a spatula
    box(0x1a1a1a, 0.026, 0.026, 0.13, 0, 0, -0.02, 0.7, 0);
    box(0xb0b4bc, 0.012, 0.012, 0.12, 0, 0, -0.14);
    box(0xc8ccd4, 0.09, 0.004, 0.11, 0, -0.012, -0.25);
  } else if (act === "chop") {   // a chef's knife
    box(0x1a1a1a, 0.024, 0.03, 0.11, 0, 0, -0.01, 0.7, 0);
    box(0xd8dce2, 0.005, 0.045, 0.21, 0, -0.01, -0.16, 0.2, 0.9);
  } else if (act === "carry") {   // a tray: two burger baskets and some wings
    box(0x26262a, 0.5, 0.02, 0.36, 0, 0, 0, 0.5, 0.3);
    for (const [x, z] of [[-0.13, -0.07], [0.12, 0.08]]) {
      box(0xb81e1e, 0.2, 0.05, 0.14, x, 0.035, z, 0.6, 0);
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), propMat(0xd8963e, 0.6, 0));
      bun.position.set(x - 0.04, 0.06, z); g.add(bun);
      for (let i = 0; i < 5; i++) box(0xf0c450, 0.01, 0.01, 0.07, x + 0.04 + (i % 3) * 0.015, 0.075, z - 0.02 + i * 0.01, 0.6, 0).rotation.y = i * 0.7;
    }
    for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), propMat(0xb8481a, 0.5, 0)); w.scale.set(1.6, 0.75, 1); w.position.set(0.13 + (i % 2) * 0.05, 0.03, -0.1 + Math.floor(i / 2) * 0.05); g.add(w); }
  } else if (act === "lift") {   // a dumbbell: the handle through the fist, a bell either side
    box(0x2a2c30, 0.15, 0.025, 0.025, 0, 0, 0, 0.5, 0.6);
    for (const x of [-0.085, 0.085]) box(0x3a3c40, 0.04, 0.09, 0.09, x, 0, 0, 0.5, 0.6);
  } else return null;
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}
/* A beach towel laid under a sunbather (`towel`: its colour), and its stripe. */
function beachTowel(color) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.012, 1.9), propMat(color, 0.95, 0));
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.014, 0.16), propMat(0xf4efe4, 0.95, 0));
  for (const z of [-0.7, 0.7]) { const b = band.clone(); b.position.z = z; g.add(b); }
  g.add(t);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  return g;
}

/* A small name tag: "Name · Role". */
function npcTag(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext("2d");
  let fs = 26;
  ctx.font = `bold ${fs}px 'DM Mono', monospace`;
  while (fs > 14 && ctx.measureText(text).width > 248) { fs -= 2; ctx.font = `bold ${fs}px 'DM Mono', monospace`; }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,.85)";
  ctx.strokeText(text, 128, 32, 248);
  ctx.fillStyle = TAG_COLOR;
  ctx.fillText(text, 128, 32, 248);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(0.72, 0.18, 1);
  s.renderOrder = 5;
  return s;
}

/* A seeded 0..1 per NPC, so two clients' townsfolk keep the same rhythm. */
function hash01(str) {
  let h = 2166136261;
  for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

const _v = new THREE.Vector3();

export class TownNpcs {
  /* `opts` is the map's rp block: `beat` (above), `npcShadows` (false where
     the crowd is indoors under lights that cast none), and `view`: { zoneOf(x,
     y, z), sees(a, b) }, which rooms can see into which, so a crowd in a room
     the camera can't see into isn't drawn. */
  constructor(scene, cast, { beat = null, npcShadows = true, view = null, smithy = null } = {}) {
    this.scene = scene;
    this.beat = beat;
    this.shadows = npcShadows;
    this.view = view;
    this.smithy = smithy?.() ?? null;
    this.material = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.1 });
    this.list = cast.map((c, i) => this.spawn(c, i));
    this.t = 0;
  }

  spawn(c, i) {
    const seed = hash01(c.name + i);
    const rig = buildHumanoid(this.material, { height: c.height ?? 1.72 + seed * 0.16, build: c.build ?? 1, gun: false });
    rig.face = `${c.act === "drink" && seed > 0.75 ? "sad" : "grin"}:og`;
    if (c.outfit) wearOutfit(rig, c.outfit);   // dressed for the night (outfits.js)
    setReliefFace(rig);   // the NFT body's 3D trollface head (blocky-body.js)
    const tag = UNTAGGED.has(c.role) ? null : npcTag(`${c.name} · ${c.role}`);
    // Above the head either way: sitting drops the whole body, tag and all.
    if (tag) { tag.position.y = 2.2; rig.root.add(tag); }
    rig.root.traverse((o) => { if (o.isMesh) o.castShadow = this.shadows; });
    this.scene.add(rig.root);
    const n = { c, rig, tag, seed, phase: seed * 10, t: seed * 20, poseAcc: 0, x: c.x ?? 0, z: c.z ?? 0, yaw: c.yaw ?? 0 };
    if (c.act === "drink") {
      n.drink = buildDrink(c.drink === "whiskey" ? "whiskey" : "beer");
      mountDrink(rig, n.drink);
    }
    if (c.act === "smith") n.smith = new SmithWork(this.scene, n, this.smithy);
    if (c.act === "guitar" || c.act === "trumpet") holdInstrument(rig, c.act);   // the saloon band (instruments.js)
    const prop = kitchenProp(c.act);
    if (prop) {
      const k = rig.scale || 1;
      prop.scale.setScalar(k);
      if (c.act === "carry") { prop.position.set(0, -0.3 * k, -0.42 * k); rig.parts.chest.add(prop); }
      else rig.parts.gripR.add(prop);
      n.prop = prop;
      if (c.act === "lift") { const l = prop.clone(); l.position.set(0, -0.03 * k, -0.03 * k); rig.parts.handL.add(l); }
    }
    if (c.act === "lie") {
      // flat on his back, the head where he faces (the tilt after the yaw)
      rig.root.rotation.order = "YXZ";
      if (c.towel) {
        const t = beachTowel(c.towel);
        // the body runs from the feet (the root) toward the face
        t.position.set(c.x - Math.sin(c.yaw ?? 0) * 0.85, 0.012, c.z - Math.cos(c.yaw ?? 0) * 0.85);
        t.rotation.y = c.yaw ?? 0;
        this.scene.add(t);
        n.towel = t;
      }
    }
    if (c.path) {
      // Where on the loop they start (`at`, 0..1 of its length).
      n.seg = 0; n.segT = 0; n.dir = 1; n.wait = 0;
      const pts = c.path, lens = [];
      let total = 0;
      const nSeg = c.pace ? pts.length - 1 : pts.length;
      for (let s = 0; s < nSeg; s++) {
        const a = pts[s], b = pts[(s + 1) % pts.length];
        lens.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
        total += lens[s];
      }
      n.lens = lens;
      let d = (c.at || 0) * total;
      while (d > lens[n.seg]) { d -= lens[n.seg]; n.seg = (n.seg + 1) % nSeg; }
      n.segT = d;
    }
    if (c.stops) {
      // a roamer starts at its first stop, part way through its time there
      const s0 = c.stops[0];
      n.x = s0.x; n.z = s0.z; n.yaw = s0.yaw ?? n.yaw;
      n.stop = 0; n.leg = null; n.wait = s0.secs * (0.2 + seed * 0.8);
    }
    // A walker keeps to one room (its path's first corner says which)
    const at = c.path ? c.path[0] : [n.x, n.z];
    n.zone = c.zone ?? (this.view ? this.view.zoneOf(at[0], c.y ?? 0, at[1]) : null);
    return n;
  }

  /* A player took a job (rp-roles.js ROLES[].npc): whoever had it goes
     off shift, out of sight, until it's free again. */
  setYield(roles) {
    for (const n of this.list) n.off = roles.has(n.c.role);
  }

  /* Someone else drives this NPC for a while (a fist fight,
     modes/social-duel.js): `fn(n, rig, dt)` poses him after the base pose,
     and his loop (walking, his act) stops until release(). */
  takeOver(i, fn) {
    const n = this.list[i];
    if (!n) return null;
    n.override = fn;
    n.home ??= { x: n.x, z: n.z, yaw: n.yaw };
    return n;
  }

  /* Back to his loop: a seated or standing NPC goes back to his spot; a
     walker carries on from wherever the fight left him. */
  release(i) {
    const n = this.list[i];
    if (!n?.override) return;
    n.override = null;
    if (!n.c.path && n.home) { n.x = n.home.x; n.z = n.home.z; n.yaw = n.home.yaw; }
    n.home = null;
  }

  /* Who's sitting where, so a player doesn't sit in their lap. */
  sitters() {
    return this.list.filter((n) => n.c.sit && !n.off).map((n) => ({ x: n.x, z: n.z, y: n.c.y ?? 0, role: n.c.role }));
  }

  /* `eye`: where the local camera is, for the level of detail; `audio` for
     the few that make a sound (the smith's anvil). */
  update(dt, eye, audio = null) {
    this.audio = audio;
    this.eye = eye;
    this.t += dt;
    const from = this.view ? this.view.zoneOf(eye.x, eye.y, eye.z) : null;
    for (const n of this.list) {
      const d = Math.hypot(n.x - eye.x, n.z - eye.z);
      const hidden = d > FAR || n.off || (from !== null && !this.view.sees(from, n.zone));
      n.rig.root.visible = !hidden;
      // Tags only up close, so a full room doesn't turn into a wall of names.
      if (n.tag) n.tag.visible = d < TAG_RANGE;
      n.rig.reliefFace?.near(d < RELIEF_RANGE);
      n.t += dt;
      if (n.override) { if (!hidden) this.poseOverride(n, dt); continue; }
      if (n.c.stops) this.roam(n, dt);
      else if (WALKERS.has(n.c.act)) this.walk(n, dt);
      n.smith?.step(dt, hidden ? Infinity : d, audio);
      if (hidden) continue;
      // Far off, pose a few times a second instead of every frame.
      n.poseAcc += dt;
      const every = d < NEAR ? 0 : 0.12;
      if (n.poseAcc < every) continue;
      this.pose(n, n.poseAcc);
      n.poseAcc = 0;
    }
  }

  /* A roamer (`stops`): its time at a stop runs down, then it walks
     straight to the next stop, a touch slower than a walker. */
  roam(n, dt) {
    const stops = n.c.stops;
    if (!n.leg) {
      n.moving = false;
      if ((n.wait -= dt) > 0) return;
      const next = (n.stop + 1) % stops.length, b = stops[next];
      n.leg = { ax: n.x, az: n.z, bx: b.x, bz: b.z, len: Math.hypot(b.x - n.x, b.z - n.z), s: 0, next };
      n.yaw = Math.atan2(-(b.x - n.x), -(b.z - n.z));
    }
    const L = n.leg;
    L.s = Math.min(L.len, L.s + WALK_MPS * 0.85 * dt);
    const k = L.len ? L.s / L.len : 1;
    n.x = L.ax + (L.bx - L.ax) * k;
    n.z = L.az + (L.bz - L.az) * k;
    n.moving = true;
    if (L.s < L.len) return;
    // there: face the stop's way and stay a while (a bit more or less each time)
    const s = stops[n.stop = L.next];
    n.leg = null;
    n.moving = false;
    if (s.yaw != null) n.yaw = s.yaw;
    n.wait = s.secs * (0.75 + 0.5 * hash01(n.c.name + n.t));
  }

  walk(n, dt) {
    const pts = n.c.path;
    if (n.wait > 0) { n.wait -= dt; n.moving = false; return; }
    const nSeg = n.lens.length;
    n.segT += WALK_MPS * dt;
    while (n.segT >= n.lens[n.seg]) {
      n.segT -= n.lens[n.seg];
      if (n.c.pace) {
        // Back and forth: turn round at either end, and stand a moment.
        n.seg += n.dir;
        if (n.seg >= nSeg || n.seg < 0) { n.dir = -n.dir; n.seg = Math.max(0, Math.min(nSeg - 1, n.seg)); n.wait = 2 + hash01(n.c.name + n.t) * 3; }
      } else {
        n.seg = (n.seg + 1) % nSeg;
        // A pause at some corners: look about, wave.
        if (hash01(n.c.name + Math.floor(n.t)) < 0.5) { n.wait = 1.5 + hash01(n.c.name + n.seg) * 2.5; n.waveT = 0; }
      }
    }
    // Pacing back, a segment is walked from its far end.
    const back = n.c.pace && n.dir < 0;
    const a = back ? pts[n.seg + 1] : pts[n.seg];
    const b = back ? pts[n.seg] : pts[(n.seg + 1) % pts.length];
    const k = n.segT / n.lens[n.seg];
    n.x = a[0] + (b[0] - a[0]) * k;
    n.z = a[1] + (b[1] - a[1]) * k;
    // a corner may give its floor's height ([x, z, y]: up a step, into a room)
    if (a.length > 2 || b.length > 2) n.y = (a[2] ?? n.c.y ?? 0) + ((b[2] ?? n.c.y ?? 0) - (a[2] ?? n.c.y ?? 0)) * k;
    n.yaw = Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]));
    n.moving = true;
  }

  /* Driven from outside: stood up where he's put, the base pose, then the
     driver's. */
  poseOverride(n, dt) {
    const { rig } = n;
    rig.root.position.set(n.x, n.c.y ?? 0, n.z);
    rig.root.rotation.set(0, 0, 0);
    aimRig(rig, n.yaw, dt, { snap: true, moving: !!n.moving });
    // The driver walks him at its own pace: the legs go at the speed he
    // actually covers ground (smoothed), not a fixed 3.5 m/s.
    if (n.drvX != null && dt > 0 && Math.hypot(n.x - n.drvX, n.z - n.drvZ) < 3) {
      const k = Math.min(1, dt * 8);
      n.drvVx += ((n.x - n.drvX) / dt - n.drvVx) * k;
      n.drvVz += ((n.z - n.drvZ) / dt - n.drvVz) * k;
    } else n.drvVx = n.drvVz = 0;
    n.drvX = n.x; n.drvZ = n.z;
    const g = gaitFromVelocity(n.yaw, n.drvVx, n.drvVz, n.drvGait || (n.drvGait = {}));
    if (n.moving) n.phase += dt * gaitPhaseRate(g.speed);
    poseHumanoid(rig, { phase: n.phase, moving: !!n.moving, pitch: 0, lower: 0, strafe: g.strafe, forward: g.forward, speed: n.moving ? Math.min(1, g.speed / 4.2) : 0, mps: n.moving ? g.speed : 0, dt, hold: "none" });
    if (n.drink) n.drink.visible = false;
    for (const o of n.smith?.tools || []) o.visible = false;
    n.override(n, rig, dt);
    rig.body?.update?.();
  }

  pose(n, dt) {
    const { rig, c } = n;
    if (n.drink) n.drink.visible = true;
    rig.root.rotation.x = 0; rig.root.rotation.z = 0;   // up again after a fight that floored him
    const p = rig.parts;
    const t = n.t;
    // a roamer does its stop's act there, and walks between
    const stop = c.stops?.[n.stop];
    const act = c.stops ? (n.leg ? "walk" : stop.act) : c.act;
    const moving = (WALKERS.has(act) || act === "smith") && n.moving;
    if (moving) n.phase += dt * gaitPhaseRate(WALK_MPS);
    rig.root.position.set(n.x, n.y ?? c.y ?? 0, n.z);
    aimRig(rig, n.yaw, dt, { snap: true, moving });

    if (act === "dance") {
      const i = (stop ? stop.dance : c.dance) ?? Math.floor(n.seed * DANCES.length) % DANCES.length;
      // On the music's beat if the map has one (a whole beat in for some,
      // so the two-beat moves don't all sway the same way)
      const b = this.beat?.();
      const [perBeat, hit] = DANCE_BEAT[i];
      DANCES[i](rig, b == null ? t : (b + hit + (n.seed > 0.5 ? 1 : 0)) * perBeat);
      return;
    }
    poseHumanoid(rig, {
      phase: n.phase, moving, pitch: act === "sit-read" || act === "count" || act === "tend" ? -0.35 : 0,
      lower: 0, strafe: 0, forward: 1, speed: moving ? 0.3 : 0, mps: moving ? WALK_MPS : 0, dt, hold: "none",
    });

    if (c.sit) this.sit(n);
    const sw = (rate, off = 0) => Math.sin(t * rate + n.seed * 6 + off);
    switch (act) {
      case "drink": {
        // A sip every 6-9 s: up, hold, down.
        const cyc = 6 + n.seed * 3, u = (t % cyc) / cyc;
        const sip = u < 0.08 ? u / 0.08 : u < 0.2 ? 1 : u < 0.28 ? 1 - (u - 0.2) / 0.08 : 0;
        poseDrinkArm(rig, sip, 0, !!c.stool);
        // the other arm: the forearm on the bar top at a stool, the hand on
        // the thigh in a seat
        if (c.stool) {
          const k = rig.scale || 1;
          reachHand(rig, -1, _lean.set(-0.14 * k, -0.2 * k, -0.42 * k), _poleL);
          rig.body?.update?.();
        }
        else if (c.sit) { p.armL.rotation.set(0.3, 0, 0.12); p.elbowL.rotation.set(0.75, 0, 0); }
        break;
      }
      case "cards": {
        // Both forearms on the table; every few seconds one slaps a card down.
        const slap = Math.max(0, sw(0.9)) ** 8;
        p.armL.rotation.set(0.85, 0, 0.12); p.elbowL.rotation.set(0.9, 0, 0);
        p.armR.rotation.set(0.85 + slap * 0.5, 0, -0.12); p.elbowR.rotation.set(0.9 - slap * 0.5, 0, 0);
        break;
      }
      case "guitar":
      case "trumpet": {
        // the band: busier while a song's on (n.playing, modes/social-band.js), noodling between
        const busy = n.playing ? 1 : 0.3 + 0.2 * Math.max(0, sw(0.35));
        poseInstrument(rig, t, busy);
        break;
      }
      case "piano": {
        p.armL.rotation.set(0.95 + sw(9) * 0.06, 0, 0.18 + sw(2.1) * 0.12); p.elbowL.rotation.set(0.75, 0, 0);
        p.armR.rotation.set(0.95 + sw(11, 1) * 0.06, 0, -0.18 + sw(1.7) * 0.12); p.elbowR.rotation.set(0.75, 0, 0);
        p.chest.rotation.z = sw(1.6) * 0.06;
        break;
      }
      case "wipe": {
        // A rag in circles on the bar top.
        p.armR.rotation.set(0.8 + sw(3) * 0.12, 0, -0.25 + Math.cos(t * 3 + n.seed) * 0.15); p.elbowR.rotation.set(0.7, 0, 0);
        p.armL.rotation.set(0.5, 0, 0.1); p.elbowL.rotation.set(0.6, 0, 0);
        p.chest.rotation.x += 0.12;
        break;
      }
      case "hammer": {
        // Up slow, down fast onto the anvil, every 1.4 s.
        const u = (t % 1.4) / 1.4;
        const lift = u < 0.7 ? u / 0.7 : 1 - (u - 0.7) / 0.08;
        p.armR.rotation.set(0.6 + Math.max(0, lift) * 1.7, 0, -0.1); p.elbowR.rotation.set(0.4 + Math.max(0, lift) * 0.8, 0, 0);
        p.armL.rotation.set(0.75, 0, 0.15); p.elbowL.rotation.set(1.0, 0, 0);   // holding the work with tongs
        p.chest.rotation.x += 0.15;
        break;
      }
      case "smith": n.smith.pose(rig, t); return;
      case "cook": case "chop": case "wash": case "expo": case "carry": this.kitchen(n, t, sw); break;
      case "brush": {
        p.armR.rotation.set(0.95 + sw(2.4) * 0.3, 0, -0.1); p.elbowR.rotation.set(0.5 + sw(2.4) * 0.2, 0, 0);
        p.armL.rotation.set(0.7, 0, 0.1); p.elbowL.rotation.set(0.4, 0, 0);
        break;
      }
      case "count":
      case "tend": {
        // Hands busy over a counter or the exam table.
        p.armL.rotation.set(0.75 + sw(4) * 0.08, 0, 0.12); p.elbowL.rotation.set(0.85, 0, 0);
        p.armR.rotation.set(0.75 + sw(4, 2) * 0.08, 0, -0.12 + sw(1.3) * 0.08); p.elbowR.rotation.set(0.85, 0, 0);
        p.chest.rotation.x += 0.18;
        break;
      }
      case "guard": {
        // Arms folded, the head slowly scanning the street.
        // (upper arms hang a touch forward; each forearm swings flat across
        // the chest about the elbow's z, then forward about its y)
        p.armL.rotation.set(0.35, 0, 0.05); p.elbowL.rotation.set(0, 0.95, 2.02);
        p.armR.rotation.set(0.42, 0, -0.05); p.elbowR.rotation.set(0, -0.95, -2.02);
        p.headPivot.rotation.y = sw(0.35) * 0.6;
        break;
      }
      case "preach": {
        // At the pulpit: the left hand on the book, the right raised to the
        // pews and brought down again on the point; the head sweeps the rows.
        const up = 0.5 + 0.5 * sw(0.7);
        p.armL.rotation.set(0.75, 0, 0.15); p.elbowL.rotation.set(0.7, 0, 0);
        p.armR.rotation.set(1.1 + up * 1.4, 0, -0.25 - up * 0.2); p.elbowR.rotation.set(0.5 - up * 0.35, 0, 0);
        p.headPivot.rotation.y = sw(0.4, 1) * 0.45;
        p.headPivot.rotation.x = -0.08 * up;
        break;
      }
      case "phone": {
        // Thumbing a phone held at the chest; every so often look up the line.
        const up = Math.max(0, sw(0.45)) ** 6;
        p.armR.rotation.set(0.95, 0, -0.25); p.elbowR.rotation.set(1.55, 0, 0);
        p.armL.rotation.set(0.2, 0, 0.12); p.elbowL.rotation.set(0.3, 0, 0);
        p.headPivot.rotation.x = 0.45 * (1 - up);
        p.headPivot.rotation.y = up * sw(0.3, 1) * 0.7;
        break;
      }
      case "sit-read": {
        p.armL.rotation.set(0.9, 0, 0.2); p.elbowL.rotation.set(1.3, 0, 0);
        p.armR.rotation.set(0.9, 0, -0.2); p.elbowR.rotation.set(1.3, 0, 0);
        p.headPivot.rotation.x = 0.35;
        break;
      }
      case "lie": {
        // Sunbathing: on the back, arms loose at the sides or folded under
        // the head, one knee up on some; a slow breath. On the back x-
        // swings a limb up toward the sky, and torso x+ sits up. On a
        // lounger (`recline`: its backrest angle) the torso lies up the
        // backrest and the legs stay flat on the seat.
        rig.root.rotation.x = -Math.PI / 2;
        rig.root.position.y += 0.14 * (rig.scale || 1);
        if (n.seed > 0.5) {
          // the upper arms overhead, the hands folded back under the head
          p.armL.rotation.set(-2.75, 0, 0.55); p.elbowL.rotation.set(-2.1, 0, 0);
          p.armR.rotation.set(-2.75, 0, -0.55); p.elbowR.rotation.set(-2.1, 0, 0);
        } else {
          p.armL.rotation.set(0.05, 0, 0.3); p.elbowL.rotation.set(0.15, 0, 0);
          p.armR.rotation.set(0.05, 0, -0.3); p.elbowR.rotation.set(0.15, 0, 0);
        }
        if (n.c.recline) p.torso.rotation.x = n.c.recline;
        else if (n.seed > 0.3 && n.seed < 0.7) { p.legL.rotation.set(-0.75, 0, 0.05); p.kneeL.rotation.set(1.4, 0, 0); }
        p.chest.rotation.x = 0.03 * sw(0.9);
        p.headPivot.rotation.x = -0.15;
        break;
      }
      case "lift": {
        // Curls at Muscle Beach: one arm up as the other comes down, a breath
        // between sets.
        const set = (t % 14) < 10;
        const u = set ? 0.5 + 0.5 * sw(2.6) : 0.1;
        p.armR.rotation.set(0.12, 0, -0.12); p.elbowR.rotation.set(0.15 + 2.0 * u, 0, 0);
        p.armL.rotation.set(0.12, 0, 0.12); p.elbowL.rotation.set(0.15 + 2.0 * (set ? 1 - u : 0.1), 0, 0);
        p.chest.rotation.x -= 0.06;
        p.headPivot.rotation.x = set ? 0 : 0.3;
        break;
      }
      case "ready": {
        // On the court: knees bent, leaning in, hands up in front, a bounce
        // on the toes, the head following the play.
        const b = 0.04 * (0.5 + 0.5 * sw(5));
        p.legL.rotation.set(0.45, 0, 0.12); p.kneeL.rotation.set(-0.8, 0, 0);
        p.legR.rotation.set(0.45, 0, -0.12); p.kneeR.rotation.set(-0.8, 0, 0);
        p.ankleL.rotation.set(0.35, 0, 0); p.ankleR.rotation.set(0.35, 0, 0);
        p.torso.rotation.x = -0.35;
        p.armL.rotation.set(0.9, 0, 0.25); p.elbowL.rotation.set(0.9, 0, 0);
        p.armR.rotation.set(0.9, 0, -0.25); p.elbowR.rotation.set(0.9, 0, 0);
        p.headPivot.rotation.x = -0.15;   // up off the lean, on the ball
        p.headPivot.rotation.y = sw(0.5) * 0.4;
        rig.root.position.y -= (0.1 - b) * (rig.scale || 1);
        break;
      }
      case "walk": {
        // Stopped: look about, and now and then wave at the street.
        if (!n.moving) {
          p.headPivot.rotation.y = sw(0.8) * 0.5;
          if (n.waveT !== undefined && n.waveT < 1.6) {
            n.waveT += dt;
            p.armR.rotation.set(2.6, 0, -0.35 + Math.sin(n.waveT * 10) * 0.3); p.elbowR.rotation.set(0.5, 0, 0);
          }
        }
        break;
      }
    }
    rig.body?.update?.();
  }

  /* The kitchen's acts: hands placed in chest space (+X right, -Z ahead). */
  kitchen(n, t, sw) {
    const { rig, c } = n;
    const p = rig.parts, k = rig.scale || 1;
    const R = (x, y, z) => reachHand(rig, 1, _hand.set(x * k, y * k, z * k), _poleR);
    const L = (x, y, z) => reachHand(rig, -1, _hand.set(x * k, y * k, z * k), _poleL2);
    switch (c.act) {
      case "cook": {
        // the spatula working the flat-top; every few seconds a flip, and the pan shaken
        const cyc = 3 + n.seed * 1.5, u = (t % cyc) / cyc;
        const flip = u < 0.12 ? Math.sin(u / 0.12 * Math.PI) : 0;
        R(0.2 + sw(2.2) * 0.04, -0.32 + flip * 0.14, -0.46 + sw(3.1) * 0.03);
        if (p.gripR) p.gripR.rotation.set(1.7 - flip * 0.9, 0, 0);   // the blade down at the flat-top
        const shake = u > 0.5 && u < 0.7 ? Math.sin(t * 22) * 0.035 : 0;
        L(-0.22, -0.33 + Math.abs(shake), -0.42 + shake);
        p.chest.rotation.x += 0.1;
        p.headPivot.rotation.x = 0.3;
        break;
      }
      case "chop": {
        // bursts of quick chops, then a scrape of the board to one side
        const cyc = 5 + n.seed * 2, u = (t % cyc) / cyc;
        const chopping = u < 0.7, scrape = u > 0.75 && u < 0.9 ? (u - 0.75) / 0.15 : 0;
        const dn = chopping ? Math.abs(Math.sin(t * 9)) * 0.07 : 0.03;
        R(0.1 + (chopping ? u * 0.08 : 0) + scrape * 0.15, -0.37 + dn, -0.44);
        if (p.gripR) p.gripR.rotation.set(1.6, 0, -0.2);
        L(-0.1, -0.4, -0.44 + (chopping ? u * 0.05 : 0));
        p.chest.rotation.x += 0.16;
        p.headPivot.rotation.x = 0.45;
        break;
      }
      case "wash": {
        // scrubbing in the sink; now and then a rack lifted and set on the side
        const cyc = 9 + n.seed * 3, u = (t % cyc) / cyc;
        const lift = u > 0.8 ? Math.sin((u - 0.8) / 0.2 * Math.PI) : 0;
        R(0.12 + Math.cos(t * 5) * 0.05, -0.46 + lift * 0.3, -0.46 + Math.sin(t * 5) * 0.04);
        L(-0.12 - Math.cos(t * 5 + 1) * 0.04, -0.46 + lift * 0.3, -0.44);
        p.chest.rotation.x += 0.22;
        p.headPivot.rotation.x = 0.4;
        break;
      }
      case "expo": {
        // plates slid down the pass; the bell rung now and then ("order up")
        const cyc = 7 + n.seed * 2, u = (t % cyc) / cyc;
        const slide = u < 0.5 ? Math.sin(u / 0.5 * Math.PI) : 0;
        const ring = u > 0.6 && u < 0.68 ? Math.sin((u - 0.6) / 0.08 * Math.PI) : 0;
        R(0.15 + slide * 0.18 - ring * 0.12, -0.3 + ring * 0.02, -0.44);
        L(-0.22 + slide * 0.1, -0.32, -0.42);
        p.headPivot.rotation.y = sw(0.4) * 0.4;
        const cycN = Math.floor(t / cyc);
        if (u > 0.64 && n.rang !== cycN) {
          n.rang = cycN;
          const e = this.eye;
          if (cycN % 3 === 0 && this.audio?._ready?.() && e && Math.hypot(e.x - n.x, e.z - n.z) < 14) {
            const at = { x: n.x, y: (c.y ?? 0) + 1, z: n.z };
            this.audio._tone({ freq: 2490, duration: 0.7, gain: 0.05, type: "sine", at });
            this.audio._tone({ freq: 3740, duration: 0.4, gain: 0.02, type: "sine", at });
          }
        }
        break;
      }
      case "carry": {
        // the tray out in front, a hand under each side
        const bob = n.moving ? Math.abs(Math.sin(n.phase)) * 0.015 : 0;
        if (n.prop) n.prop.position.y = (-0.3 + bob) * k;
        R(0.2, -0.33 + bob, -0.42);
        L(-0.2, -0.33 + bob, -0.42);
        break;
      }
    }
    setHandPose(rig, 1, c.act === "cook" || c.act === "chop" ? "fist" : "open");
    setHandPose(rig, -1, c.act === "cook" ? "fist" : "open");
  }

  /* Seated: thighs forward, shins down (a stool's are tucked), the body
     dropped so the hips rest on the seat. */
  sit(n) {
    const { rig, c } = n;
    const p = rig.parts;
    const tuck = c.stool ? 0.55 : 0;
    p.legL.rotation.set(1.5, 0, 0.06);
    p.legR.rotation.set(1.5, 0, -0.06);
    p.kneeL.rotation.set(-1.45 - tuck, 0, 0);
    p.kneeR.rotation.set(-1.45 - tuck * 0.7, 0, 0);
    p.ankleL.rotation.set(0, 0, 0);
    p.ankleR.rotation.set(0, 0, 0);
    p.torso.rotation.x = 0;
    p.spine.rotation.x = 0;
    p.chest.rotation.x = -0.05;
    // Hips onto the seat top (`y` is the seat top for seated NPCs).
    rig.root.updateMatrixWorld(true);
    const hipY = p.hips.getWorldPosition(_v).y - rig.root.position.y;
    rig.root.position.y = (c.y ?? 0) + 0.08 - hipY;
  }

  dispose() {
    for (const n of this.list) {
      n.rig.root.parent?.remove(n.rig.root);
      n.smith?.dispose();
      n.tag?.material.map?.dispose();
      n.tag?.material.dispose();
      n.towel?.parent?.remove(n.towel);
    }
    this.list.length = 0;
  }
}
