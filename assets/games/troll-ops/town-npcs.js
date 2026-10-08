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
// (round a path, stopping to look about; `pace` walks it back and forth),
// phone (waiting in a line: thumbing a phone, looking up now and then),
// smith (anvil, forge and quench barrel, with the tools: smithy.js).
//
// Optional per NPC: `height`, `build` (a bouncer's shoulders), `dance`
// (which of DANCES), `zone` (its room, if not where it stands), `outfit`
// (clothes, outfits.js). A map whose music has a clock passes `beat` (beats since it
// started, trollingloud.js) and its dancers move on that beat instead of
// their own.

import * as THREE from "three";
import { buildHumanoid, poseHumanoid, aimRig, gaitPhaseRate, DANCES } from "./character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1";
import { buildDrink, mountDrink, poseDrinkArm } from "./saloon-bar.js?v=sb1b7";
import { SmithWork } from "./smithy.js?v=sm1b7b7dc2f1";
import { wearOutfit } from "./outfits.js?v=of1";

const WALK_MPS = 1.25;
const NEAR = 40;     // full rate inside this
const FAR = 85;      // hidden past this
const TAG_RANGE = 12; // name tags only inside this
/* Background extras go untagged: only someone with a job to roleplay (the
   barkeep, the sheriff, the doctor...) wears a name. */
const UNTAGGED = new Set(["Townsfolk", "Drifter", "Barfly", "Regular", "Gambler", "Clubgoer", "Raver", "VIP"]);
/* Each dance's own time per beat of the music (character.js DANCES: bounce,
   floss, headbang, wave) and where in it the hit lands, so a beat-locked
   dancer drops, swings or nods on the beat. */
const DANCE_BEAT = [[1 / 3.6, 0.5], [1 / 4.4, 0], [1 / 2.6, 0.25], [1 / 3.08, 0]];
const TAG_COLOR = "#ffd28a";   // townsfolk tags read warm, players' white

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
    this.t += dt;
    const from = this.view ? this.view.zoneOf(eye.x, eye.y, eye.z) : null;
    for (const n of this.list) {
      const d = Math.hypot(n.x - eye.x, n.z - eye.z);
      const hidden = d > FAR || n.off || (from !== null && !this.view.sees(from, n.zone));
      n.rig.root.visible = !hidden;
      // Tags only up close, so a full room doesn't turn into a wall of names.
      if (n.tag) n.tag.visible = d < TAG_RANGE;
      n.t += dt;
      if (n.override) { if (!hidden) this.poseOverride(n, dt); continue; }
      if (n.c.act === "walk") this.walk(n, dt);
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
    if (n.moving) n.phase += dt * gaitPhaseRate(3.5);
    poseHumanoid(rig, { phase: n.phase, moving: !!n.moving, pitch: 0, lower: 0, strafe: 0, forward: 1, speed: n.moving ? 0.8 : 0, mps: n.moving ? 3.5 : 0, dt, hold: "none" });
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
    const moving = (c.act === "walk" || c.act === "smith") && n.moving;
    if (moving) n.phase += dt * gaitPhaseRate(WALK_MPS);
    rig.root.position.set(n.x, c.y ?? 0, n.z);
    aimRig(rig, n.yaw, dt, { snap: true, moving });

    if (c.act === "dance") {
      const i = c.dance ?? Math.floor(n.seed * DANCES.length) % DANCES.length;
      // On the music's beat if the map has one (a whole beat in for some,
      // so the two-beat moves don't all sway the same way)
      const b = this.beat?.();
      const [perBeat, hit] = DANCE_BEAT[i];
      DANCES[i](rig, b == null ? t : (b + hit + (n.seed > 0.5 ? 1 : 0)) * perBeat);
      return;
    }
    poseHumanoid(rig, {
      phase: n.phase, moving, pitch: c.act === "sit-read" || c.act === "count" || c.act === "tend" ? -0.35 : 0,
      lower: 0, strafe: 0, forward: 1, speed: moving ? 0.3 : 0, mps: moving ? WALK_MPS : 0, dt, hold: "none",
    });

    if (c.sit) this.sit(n);
    const sw = (rate, off = 0) => Math.sin(t * rate + n.seed * 6 + off);
    switch (c.act) {
      case "drink": {
        // A sip every 6-9 s: up, hold, down.
        const cyc = 6 + n.seed * 3, u = (t % cyc) / cyc;
        const sip = u < 0.08 ? u / 0.08 : u < 0.2 ? 1 : u < 0.28 ? 1 - (u - 0.2) / 0.08 : 0;
        poseDrinkArm(rig, sip);
        if (c.sit) { p.armL.rotation.set(0.45, 0, 0.05); p.elbowL.rotation.set(0.9, 0, 0); }   // the other arm on the bar
        break;
      }
      case "cards": {
        // Both forearms on the table; every few seconds one slaps a card down.
        const slap = Math.max(0, sw(0.9)) ** 8;
        p.armL.rotation.set(0.85, 0, 0.12); p.elbowL.rotation.set(0.9, 0, 0);
        p.armR.rotation.set(0.85 + slap * 0.5, 0, -0.12); p.elbowR.rotation.set(0.9 - slap * 0.5, 0, 0);
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
    }
    this.list.length = 0;
  }
}
