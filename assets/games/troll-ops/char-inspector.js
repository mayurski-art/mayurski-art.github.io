// Troll Ops — lobby operator (character locker) inspector.
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
import { buildHumanoid, poseHumanoid } from "./character.js";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.2;
const REST_YAW = -0.45;

const OPERATOR_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xe8e6df, roughness: 0.55, metalness: 0.05,
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
    // The rig's root sits at the feet (y=0) with the crown at `height` -
    // recentre it on its own midpoint so it doesn't swing off-screen when
    // orbited, same reasoning as WeaponInspector's bounding-box centring.
    this.rig.position.y = -0.9;

    this.baseDist = 4.4;
    this.zoom = 1;
    this.zoomTarget = 1;
    this.yaw = REST_YAW;
    this.pitch = 0.14;
    this.autoSpin = true;
    this.spinT = 0;
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
      this.pitch = 0.14;
      this.spinT = 0;
      this.autoSpin = true;
    });
  }

  pinchDistance(pointers) {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
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
    }
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 9);

    // A relaxed idle: a slow weight-shift from foot to foot rather than a
    // locked-still T-pose, so the operator reads as alive while waiting
    // to deploy. Feeding a slowly oscillating `strafe` into poseHumanoid
    // (rather than standing it still) gets the whole lean/neck-lead
    // system doing the work for free instead of hand-rolling a separate
    // sway here.
    const idleShift = Math.sin(this.spinT * 0.55);
    poseHumanoid(this.humanoid, {
      phase: this.spinT * 0.9,
      moving: false,
      pitch: 0,
      lower: 0,
      strafe: idleShift * 0.4,
      dt,
    });

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
