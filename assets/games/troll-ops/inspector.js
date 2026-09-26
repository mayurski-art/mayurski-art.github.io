// Troll Forces — lobby weapon inspector.
//
// Phantom Forces lets you turn the gun over in the loadout screen, so this
// renders the same procedural view model the match uses into its own little
// canvas: drag to spin it, scroll (or pinch) to zoom, and it idles with a
// slow turn until you touch it.
//
// It runs a second, deliberately tiny WebGL context rather than borrowing the
// arena renderer — the weapon overlay there is composed against the player's
// camera and lives inside the post-processing chain, and untangling that just
// to draw a menu prop would cost more than one more context.

import * as THREE from "three";
import { buildWeaponMesh } from "./weapon-model.js";
import { buildMeleeMesh } from "./gear.js";
import { loadModel } from "./battlefield-props.js";

/* The glb each scorestreak flies in the match (see streak-entities.js). */
const STREAK_MODELS = {
  uav: "recon-drone", carepackage: "care-package", drone: "hunter-drone",
  airstrike: "strike-jet", helicopter: "helicopter",
};

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2.4;
const REST_YAW = -0.75;      // three-quarter view, muzzle to the left

export class WeaponInspector {
  /* `thumb`: a fixed-angle thumbnail (no drag/zoom) that frames the gun's
     resting silhouette tightly instead of its whole bounding sphere. */
  constructor(canvas, { thumb = false } = {}) {
    this.canvas = canvas;
    this.thumb = thumb;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.7;

    this.scene = new THREE.Scene();
    this.rig = new THREE.Group();
    this.scene.add(this.rig);

    const key = new THREE.DirectionalLight(0xfff2d8, 4.2);
    key.position.set(1.2, 1.6, 1.4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd0ff, 1.3);
    rim.position.set(-1.4, 0.5, -1.2);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xc8ffb8, 0.9);
    fill.position.set(0, -1, 0.6);
    this.scene.add(fill);
    this.scene.add(new THREE.AmbientLight(0xaebccd, 1.3));

    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.01, 40);

    this.mesh = null;
    this.baseDist = 1;
    this.halfHeight = 0.1;
    this.halfWidth = 0.25;
    this.radius = 0.28;
    this.zoom = 1;
    this.zoomTarget = 1;
    this.yaw = REST_YAW;
    this.pitch = 0.22;
    this.autoSpin = true;
    this.spinT = 0;
    this.width = 0;
    this.height = 0;

    if (!thumb) this.bindInput();
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
      this.pitch = Math.max(-1.15, Math.min(1.15, this.pitch + dy * 0.008));
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
      this.pitch = 0.22;
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

  /* Swap in a weapon and frame it. */
  show(def) {
    this.pending = null;
    const mesh = def.model?.kind ? buildMeleeMesh(def, false) : buildWeaponMesh(def);
    // The first-person hands built onto a gun belong to the viewmodel.
    mesh.traverse((o) => { if (o.userData.hand) o.visible = false; });
    this.setMesh(mesh);
  }

  /* A scorestreak's model. Loaded async (and cached by loadModel); a newer
     show()/showStreak() while it loads wins. */
  showStreak(id) {
    const name = STREAK_MODELS[id];
    if (!name || this.streakId === id) return;
    const token = this.pending = {};
    loadModel(name).then((obj) => {
      if (this.pending !== token) return;
      // Clones share the cached geometry: never dispose it on swap.
      obj.traverse((o) => { if (o.geometry) o.geometry.userData.shared = true; });
      this.setMesh(obj);
      this.streakId = id;
    }).catch(() => {});
  }

  /* Centre a mesh on its own bounding box and frame it, so a pistol, an LMG
     and a helicopter all sit dead centre and fill the stage. */
  setMesh(mesh) {
    this.streakId = null;
    if (this.mesh) {
      this.rig.remove(this.mesh);
      this.mesh.traverse((o) => {
        if (!o.geometry?.userData.shared) o.geometry?.dispose?.();
        if (o.material) for (const m of [].concat(o.material)) m.dispose?.();
      });
    }

    this.mesh = mesh;
    this.mesh.position.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(this.mesh);
    const centre = box.getCenter(new THREE.Vector3());
    this.mesh.position.sub(centre);
    this.rig.add(this.mesh);

    const size = box.getSize(new THREE.Vector3());
    this.halfHeight = Math.max(0.02, size.y / 2);
    this.halfWidth = Math.max(0.02, Math.max(size.x, size.z) / 2);
    this.radius = Math.max(0.02, size.length() / 2);
    this.frame();
  }

  frame() {
    const vHalf = (this.camera.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect);
    // Fit the weapon's bounding sphere, not its resting box: dragged to any
    // yaw or pitch, a long gun's length can point at any edge of the frame,
    // and only the sphere is the same size from every angle.
    const half = Math.min(vHalf, hHalf);
    this.baseDist = (this.radius / Math.sin(half)) * 1.04;
    if (this.thumb) {
      // Only ever seen near the rest angle: fit height and length directly.
      this.baseDist = Math.max(this.halfHeight / Math.tan(vHalf), this.halfWidth / Math.tan(hHalf)) * 1.15 + this.halfWidth * 0.8;
    }
  }

  tick(dt) {
    if (!this.mesh) return;

    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;                    // panel is hidden — nothing to draw
    if (w !== this.width || h !== this.height) {
      this.width = w;
      this.height = h;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.frame();          // a wider panel wants a closer camera
    }

    if (this.autoSpin) {
      this.spinT += dt;
      this.yaw = REST_YAW + Math.sin(this.spinT * 0.4) * 0.5;
    }
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 9);

    const dist = this.baseDist * this.zoom;
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      Math.sin(this.yaw) * cp * dist,
      Math.sin(this.pitch) * dist,
      Math.cos(this.yaw) * cp * dist
    );
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  }
}
