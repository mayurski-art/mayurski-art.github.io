// Troll Forces — lobby operator (character locker) inspector.
//
// Fortnite's locker shows your equipped skin turning in 3D before you
// drop in; this is the same idea for the trollface operator. It reuses
// the exact humanoid builder the match uses for bots/other players
// (buildHumanoid/poseHumanoid in character.js) rather than a separate
// model, so the operator you see here is the same one you play as.
//
// Mechanically this is WeaponInspector (inspector.js) with the mesh
// swapped for a posed humanoid and a slow idle sway instead of a flat
// spin - see that file for the drag/zoom/pinch input notes, which are
// identical here and not re-explained.

import * as THREE from "three";
import { buildHumanoid, poseHumanoid, aimRig, mountHeldWeapon } from "../characters/character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";
import { buildWeaponMesh } from "../weapons/weapon-model.js?v=p5-em1-wst-hf1-wb1-ar1-ar2-fj1-br1-or1-rt1-ut1-rb4-hp1-bx1-mg1-sp1-lz1-ret1-ret2-mrg1-hd1-rt2-fd1-ars1-mrg3-p416-mt2-sk1-hb4";
import { drawInkOverlay } from "../view/char-ink.js?v=ci1-ci2-ci3-ci4-ci5-rb4-rb5-mg1-sp1-ci6";
import { poseEmoteCode, emoteCode, emoteSeconds } from "../characters/emotes.js?v=hb4-em1-wst-soc1-ng1c2f1m1u-gt1-gt2-cw1-zr10-bf1-sr1-or1-nf2-em2-cf1-gs2-lh1-fg2-lp1-fg3-rc1-rc4-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-ht2-bx1-cg1-mg1-sp1-chg1";
import { buildPlinth } from "./lobby-stage.js?v=ps2-ng2-hwl1";
import { wearBlocky, setReliefFace } from "../characters/blocky-body.js?v=bk1-cw1-zr10-bf1-sr1-nf1-nx1-or1-nf2-em2-nb2-sb1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-gt1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-rb1-fg3-hd1-rc1-rc3-rc4-rc5-ls1-ut1-er1-cl1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-hl1-mg1-sp1-rh1-ci6-pm1";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.2;
const LOOK_Y = -0.1;
// Default view (user): the operator stands straight, square to the camera,
// face centred. Dragging still orbits; a double-click comes back here.
const REST_YAW = 0;
const REST_PITCH = 0.04;
const FACING = Math.PI;
// Port arms: the rifle held diagonally across the chest, muzzle up and out
// to the operator's left, so it reads side-on while the body faces the lens.
const LOW_READY = 1.2;     // aim pitch (tips the muzzle up)
const PORT_YAW = 1.15;     // turns the barrel across the body
const PORT_ROLL = 0.5;

const OPERATOR_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x0a0a0a, roughness: 0.7, metalness: 0.1,
});

/* The Play page's stage (user, 2026-10-27, the Fortnite lobby's phase 2):
   you on a glowing pad in the middle, up to three of your party: one on
   each side a step back, the fourth further out on the left, all turned a
   little in (user, 2026-10-30: a party of 4). [x, z, yaw] in the
   rig's space (its feet at y 0). The pads are stone plinths (lobby-stage.js). */
const SLOTS = [[0, 0, 0], [-1.05, -0.55, 0.28], [1.05, -0.55, -0.28], [-2.05, -1.2, 0.5]];
const STAGE_MARGIN = 0.5;   // room (rig units) beside the outermost on the stage, for their name
export class CharacterInspector {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;   // as the game renderer (-tm2)
    this.renderer.toneMappingExposure = 1.5;

    this.scene = new THREE.Scene();
    this.rig = new THREE.Group();
    this.scene.add(this.rig);

    const key = new THREE.DirectionalLight(0xfff2d8, 3.4);
    key.position.set(1.1, 2.0, 1.6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd0ff, 1.1);
    rim.position.set(-1.3, 0.8, -1.1);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xc8ffb8, 0.7);
    fill.position.set(0, -0.5, 1.0);
    this.scene.add(fill);
    this.scene.add(new THREE.AmbientLight(0xaebccd, 1.1));

    this.camera = new THREE.PerspectiveCamera(28, 4 / 5, 0.01, 40);

    this.humanoid = buildHumanoid(OPERATOR_MATERIAL, { height: 1.8, gun: false });
    this.rig.add(this.humanoid.root);
    this.held = null;
    this.heldKey = null;
    this.hasGun = true;
    this.emote = null;   // { code, t, secs } while the operator plays one
    aimRig(this.humanoid, FACING, 0, { snap: true });
    // No idle glances left and right: the face stays centred on the camera.
    this.humanoid.noIdleGlance = true;
    // The rig's root sits at the feet (y=0) with the crown at `height` -
    // recentre it on its own midpoint so it doesn't swing off-screen when
    // orbited, same reasoning as WeaponInspector's bounding-box centring.
    this.rig.position.y = -0.9;

    // Close enough that the operator actually reads as a hero shot rather
    // than a small figure lost in a big empty frame, while still leaving
    // clearance above the head and below the feet so nothing clips the top/bottom edges of the free-floating layer.
    // (closer since 2026-10-12, user: "the size of the troll character needs to increase")
    this.baseDist = 4.6;
    this.zoom = 1;
    this.zoomTarget = 1;
    this.yaw = REST_YAW;
    this.pitch = REST_PITCH;
    // No idle sway off-centre: the camera holds the front view until the
    // player drags it.
    this.autoSpin = false;
    this.spinT = 0;
    this.breathT = 0;
    this.width = 0;
    this.height = 0;

    // the stage: pads, and the party on them (setStage, setParty)
    this.stage = false;
    this.pads = SLOTS.map(([x, z], i) => {
      const p = buildPlinth(i ? 0.42 : 0.5, i ? 0x1ea0d8 : 0x8a3cf0);
      p.position.x = x; p.position.z = z;
      p.visible = false;
      this.rig.add(p);
      return p;
    });
    this.party = [];        // [{ id, slot, humanoid, key }]
    this.onAnchors = null;  // (anchors) => ..., each frame on the stage
    this._v = new THREE.Vector3();

    this.bindInput();
  }

  /* The Play page's stage on or off: the pads, the party, and the camera
     back far enough for all four (the box's --char-dist, re-read). */
  setStage(on) {
    this.stage = !!on;
    for (const p of this.pads) p.visible = this.stage;
    for (const m of this.party) m.humanoid.root.visible = this.stage;
    // (yours hides only while the stage shows the joined squad)
    this.humanoid.root.visible = !(this.stage && this.withoutMe);
    this.width = 0;   // re-read the box's size and its CSS knobs next tick
    if (!this.stage) { this.yaw = REST_YAW; this.pitch = REST_PITCH; }
  }

  /* The party beside you: [{ id, name, face, body (a TROLLS token, 0 the
     stick) }], three at most, in slot order. A member's operator is rebuilt
     only when their look changes. `withoutMe`: a joined squad's four
     instead (user, 2026-10-30: the arrows between the squads), on every
     pad, yours hidden. */
  setParty(list, { withoutMe = false } = {}) {
    this.withoutMe = withoutMe;
    this.humanoid.root.visible = !(this.stage && withoutMe);
    const first = withoutMe ? 0 : 1, want = list.slice(0, SLOTS.length - first);
    const keep = [];
    for (const m of this.party) {
      const i = want.findIndex((w) => w.id === m.id);
      const w = want[i];
      if (w && m.key === `${w.face}|${w.body}` && m.slot === i + first) { keep.push(m); continue; }
      this.rig.remove(m.humanoid.root);
    }
    this.party = want.map((w, i) => {
      const had = keep.find((m) => m.id === w.id);
      if (had) return had;
      const h = buildHumanoid(OPERATOR_MATERIAL, { height: 1.8, gun: false });
      h.noIdleGlance = true;
      h.face = w.face;
      // no TROLLS body: the stick rig with the NPCs' 3D head (user, 2026-10-30)
      if (w.body) wearBlocky(h, w.body); else setReliefFace(h);
      const [x, z, yaw] = SLOTS[i + first];
      h.root.position.set(x, 0, z);
      aimRig(h, FACING + yaw, 0, { snap: true });
      h.root.visible = this.stage;
      this.rig.add(h.root);
      return { id: w.id, slot: i + first, humanoid: h, key: `${w.face}|${w.body}`, t: Math.random() * 6 };
    });
  }

  /* Where each slot's head and feet land in the canvas (CSS px): the name
     tags and the invite bubbles stand on these (lobby.js). */
  anchors() {
    const out = [];
    const toPx = (x, y, z) => {
      this._v.set(x, y, z).applyMatrix4(this.rig.matrixWorld).project(this.camera);
      return { x: (this._v.x + 1) / 2 * this.width, y: (1 - this._v.y) / 2 * this.height };
    };
    for (const [x, z] of SLOTS) {
      const head = toPx(x, 2.02, z), feet = toPx(x, 0, z);
      out.push({ x: head.x, head: head.y, feet: feet.y });
    }
    return out;
  }

  bindInput() {
    const pointers = new Map();
    let pinchStart = 0;
    let pinchZoom = 1;

    const canvas = this.canvas;

    canvas.addEventListener("pointerdown", (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.autoSpin = false;
      this.dragging = true;
      if (pointers.size === 2) {
        pinchStart = this.pinchDistance(pointers);
        pinchZoom = this.zoomTarget;
      }
    });

    canvas.addEventListener("pointermove", (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size >= 2) {
        const spread = this.pinchDistance(pointers);
        if (pinchStart > 4 && spread > 4) this.setZoom(pinchZoom * (pinchStart / spread));
        return;
      }

      this.yaw -= dx * 0.01;
      this.pitch = Math.max(-0.6, Math.min(0.6, this.pitch + dy * 0.006));
      e.preventDefault();
    });

    const release = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = 0;
      if (!pointers.size) { this.dragging = false; this.idleT = 0; }
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("pointerleave", release);

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.autoSpin = false;
      this.setZoom(this.zoomTarget * Math.exp(e.deltaY * 0.0012));
    }, { passive: false });

    canvas.addEventListener("dblclick", () => {
      this.zoomTarget = 1;
      this.yaw = REST_YAW;
      this.pitch = REST_PITCH;
      this.spinT = 0;
    });
  }

  /* The weapon the operator carries: your equipped primary, attachments
     and skin included. Rebuilt only when any of those change. */
  setWeapon(def) {
    const key = def ? `${def.id}:${JSON.stringify(def.attachments || {})}` : null;
    if (key === this.heldKey) return;
    this.heldKey = key;
    if (this.held) {
      this.held.parent?.remove(this.held);
      this.held.traverse((o) => {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
        if (o.material) o.material.dispose?.();
      });
      this.held = null;
    }
    if (!def) return;
    this.held = buildWeaponMesh(def);
    mountHeldWeapon(this.humanoid, this.held);
    this.hasGun = def.cls !== "sidearm";
  }

  pinchDistance(pointers) {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /* Plays EMOTES[idx] once (duo emotes: the lead's half). */
  playEmote(idx) {
    this.emote = { code: emoteCode(idx), t: 0, secs: emoteSeconds(idx) };
  }

  setZoom(value) {
    this.zoomTarget = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
  }

  /* A match frees this preview's GPU memory (its WebGL context: lobby.js
     sleepMenuGl, at startGame); the next tick back on the menu restores it
     and three uploads the scene again. */
  sleep() { if (this.asleep) return; this.asleep = true; this.renderer.forceContextLoss(); }
  wake() { if (!this.asleep) return; this.asleep = false; this.renderer.forceContextRestore(); }

  tick(dt) {
    this.wake();
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;                    // panel is hidden — nothing to draw
    if (w !== this.width || h !== this.height) {
      this.width = w;
      this.height = h;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      // --char-shift (style.css): slide the operator right of the box's
      // middle, as a share of its width, so a box wide enough not to cut
      // it still stands it clear of what's on its left (the roster)
      const css = getComputedStyle(this.canvas);
      const shift = parseFloat(css.getPropertyValue("--char-shift")) || 0;
      // --char-dist: how much further back the camera stands in a box too
      // small for the full-size operator (the portrait phone layout)
      this.distMult = parseFloat(css.getPropertyValue("--char-dist")) || 1;
      // --stage-fit: the share of the box's half width the stage may fill
      // either side of its middle (the Play page: the columns over its edges)
      this.stageFit = parseFloat(css.getPropertyValue("--stage-fit")) || 1;
      if (shift) this.camera.setViewOffset(w, h, -shift * w, 0, w, h);
      else this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
    }

    if (this.autoSpin) {
      this.spinT += dt;
      this.yaw = REST_YAW + Math.sin(this.spinT * 0.3) * 0.35;
    } else if (!this.dragging && (this.idleT = (this.idleT || 0) + dt) > 2.5) {
      // Let go and, after a moment to look, the view eases back to the
      // straight-on front shot.
      const k = Math.min(1, dt * 2.5);
      this.yaw += (REST_YAW - this.yaw) * k;
      this.pitch += (REST_PITCH - this.pitch) * k;
    }
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 9);

    // The operator stands ready with the loadout's gun, both hands on it —
    // the same pose, hands and head the match draws — unless it's playing
    // an emote picked off the menu's emote wheel (gun away meanwhile).
    this.breathT += dt;
    aimRig(this.humanoid, FACING, dt);
    if (this.emote) {
      this.emote.t += dt;
      if (this.emote.t > this.emote.secs) this.emote = null;
    }
    // on the Play page's stage nobody holds a gun (user, 2026-10-29:
    // "players should not be seen holding weapons in the main menu"); the
    // Locker and Cosmetics still show it
    const armed = !!this.held && !this.stage;
    if (this.held) this.held.visible = armed && !this.emote;
    if (!this.emote || !poseEmoteCode(this.humanoid, this.emote.code, this.emote.t)) {
      // A slow breath in the aim keeps the ready stance from reading as a
      // frozen frame.
      // Standing straight at port arms (aimed square at the camera the rifle
      // read as a stick), the head taken back to level so the face stays
      // centred on the lens.
      const breath = Math.sin(this.breathT * 1.3) * 0.012;
      poseHumanoid(this.humanoid, {
        moving: false, pitch: LOW_READY + breath, dt,
        hold: armed ? "gun" : "none", hasGun: armed && this.hasGun,
        carryYaw: PORT_YAW, carryRoll: PORT_ROLL,
      });
      const p = this.humanoid.parts;
      // (the head follows the aim pitch with + up since 9497923, so the
      // level takes it back down: adding it tipped the face over backwards)
      p.neckPivot.rotation.x -= (LOW_READY + breath) * 0.25;
      p.headPivot.rotation.x -= (LOW_READY + breath) * 0.6;
      this.humanoid.body.update();
    }

    // the party: at ease, breathing, each on its own clock
    for (const m of this.party) {
      if (!m.humanoid.root.visible) continue;
      m.t += dt;
      aimRig(m.humanoid, FACING + SLOTS[m.slot][2], dt);
      poseHumanoid(m.humanoid, { moving: false, pitch: Math.sin(m.t * 1.3) * 0.015, dt, hold: "none" });
      m.humanoid.body?.update?.();
    }
    // your pad breathes (not with Animations off)
    if (this.stage) {
      const still = document.body.classList.contains("tf-anim-off");
      const { shine, column } = this.pads[0].userData;
      shine.material.opacity = still ? 0.6 : 0.52 + 0.12 * Math.sin(this.breathT * 2.1);
      column.material.opacity = still ? 0.22 : 0.18 + 0.06 * Math.sin(this.breathT * 2.1);
    }

    let dist = this.baseDist * (this.distMult || 1) * this.zoom;
    // the stage: its pads centred, and the camera back far enough that the
    // outermost stays in frame (a party of four on a phone). The fourth pad
    // shows once the two either side of you are taken (a joined squad: its
    // fourth is on it).
    this.rig.position.x = 0;
    if (this.stage) {
      this.pads[3].visible = this.party.length >= (this.withoutMe ? 4 : 2);
      const on = SLOTS.filter((s, i) => this.pads[i].visible);
      const xs = on.map(([x]) => x), off = -(Math.min(...xs) + Math.max(...xs)) / 2;
      this.rig.position.x = off;
      const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * this.camera.aspect * (this.stageFit || 1);
      for (const [x, z] of on) dist = Math.max(dist, (Math.abs(x + off) + STAGE_MARGIN) / tanH + z);
    }
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      Math.sin(this.yaw) * cp * dist,
      Math.sin(this.pitch) * dist + 0.15,
      Math.cos(this.yaw) * cp * dist
    );
    // aimed a touch below the middle, so the feet clear the Emote pill under them
    this.camera.position.y += LOOK_Y;
    this.camera.lookAt(0, LOOK_Y, 0);

    this.renderer.render(this.scene, this.camera);
    drawInkOverlay(this.renderer, this.scene, this.camera);   // a TROLLS body's edge ink
    if (this.stage) this.onAnchors?.(this.anchors());
  }
}
