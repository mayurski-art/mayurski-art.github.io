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
import { buildHumanoid, poseHumanoid, aimRig, mountHeldWeapon } from "./character.js?v=to-hb4-em1-fc1-wst-soc1-ww1";
import { buildWeaponMesh } from "./weapon-model.js?v=p5-em1-wst-hf1";
import { poseEmoteCode, emoteCode, emoteSeconds } from "./emotes.js?v=hb4-em1-wst-soc1-lc3";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.2;
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

export class CharacterInspector {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
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
    this.baseDist = 5.4;
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

    this.bindInput();
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

  tick(dt) {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;                    // panel is hidden — nothing to draw
    if (w !== this.width || h !== this.height) {
      this.width = w;
      this.height = h;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
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
    if (this.held) this.held.visible = !this.emote;
    if (!this.emote || !poseEmoteCode(this.humanoid, this.emote.code, this.emote.t)) {
      // A slow breath in the aim keeps the ready stance from reading as a
      // frozen frame.
      // Standing straight at port arms (aimed square at the camera the rifle
      // read as a stick), the head taken back to level so the face stays
      // centred on the lens.
      const breath = Math.sin(this.breathT * 1.3) * 0.012;
      poseHumanoid(this.humanoid, {
        moving: false, pitch: LOW_READY + breath, dt,
        hold: this.held ? "gun" : "none", hasGun: !!this.held && this.hasGun,
        carryYaw: PORT_YAW, carryRoll: PORT_ROLL,
      });
      const p = this.humanoid.parts;
      p.neckPivot.rotation.x += (LOW_READY + breath) * 0.25;
      p.headPivot.rotation.x += (LOW_READY + breath) * 0.6;
      this.humanoid.body.update();
    }

    const dist = this.baseDist * this.zoom;
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      Math.sin(this.yaw) * cp * dist,
      Math.sin(this.pitch) * dist + 0.15,
      Math.cos(this.yaw) * cp * dist
    );
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  }
}
