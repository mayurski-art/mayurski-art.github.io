// Troll Ops — the Lightning Strike targeting tablet, Black Ops 2 style.
//
// Calling the strike raises a rugged tablet into your hands showing the map
// from straight overhead (a real render of this map, taken the moment it
// opens). You steer a reticle over it and mark three spots; each one becomes
// its own bombing pass. Until the third is marked nothing is spent, and Esc
// (or dying) puts the tablet away with the streak still banked.
//
// The overhead picture: one orthographic render of the live scene into a
// render target, copied out to a 2D canvas. Render targets skip the
// renderer's tone mapping and sRGB output, so the copy re-applies a plain
// gamma curve by hand; fog is switched off for the shot (from 200 m up the
// map would otherwise be solid fog colour).

import * as THREE from "three";

export const STRIKE_TARGETS = 3;
const SNAP = 512;                 // overhead render size, px (square)
const CONFIRM_HOLD = 0.75;        // seconds on "STRIKE CONFIRMED" before it lowers
const STICK_SPEED = 330;          // px/s of reticle at full stick

export class StrikeTablet {
  constructor({ host, renderer, scene }) {
    this.renderer = renderer;
    this.scene = scene;
    this.isOpen = false;
    this.targets = [];            // { x, z } world
    this.cursor = { u: 0.5, v: 0.5 };
    this.confirmT = 0;

    const root = document.createElement("div");
    root.className = "to-tablet";
    root.hidden = true;
    root.innerHTML = `
      <div class="to-tablet-body" role="dialog" aria-label="Lightning Strike targeting">
        <div class="to-tablet-head">
          <span class="to-tablet-title">LIGHTNING STRIKE</span>
          <span class="to-tablet-slots" aria-live="polite"></span>
        </div>
        <div class="to-tablet-screen"><canvas width="${SNAP}" height="${SNAP}"></canvas><div class="to-tablet-scan"></div></div>
        <div class="to-tablet-foot">
          <span class="to-tablet-hint"></span>
          <button type="button" class="to-tablet-undo" aria-label="Undo last target">UNDO</button>
          <button type="button" class="to-tablet-cancel" aria-label="Cancel Lightning Strike">CANCEL</button>
        </div>
      </div>`;
    host.appendChild(root);
    this.root = root;
    this.canvas = root.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.slotsEl = root.querySelector(".to-tablet-slots");
    this.hintEl = root.querySelector(".to-tablet-hint");

    // Touch / mouse without pointer lock: tap the map to mark it.
    this.canvas.addEventListener("pointerdown", (e) => {
      if (!this.isOpen || document.pointerLockElement) return;
      e.preventDefault();
      const r = this.canvas.getBoundingClientRect();
      this.cursor.u = (e.clientX - r.left) / r.width;
      this.cursor.v = (e.clientY - r.top) / r.height;
      this.place();
    });
    root.querySelector(".to-tablet-undo").addEventListener("pointerdown", (e) => { e.preventDefault(); this.undo(); });
    root.querySelector(".to-tablet-cancel").addEventListener("pointerdown", (e) => { e.preventDefault(); this.cancel(); });

    this.rt = null;
    this.snapCanvas = document.createElement("canvas");
    this.snapCanvas.width = this.snapCanvas.height = SNAP;
  }

  /* opts: { bounds, me: {x, z, yaw}, blips: () => [{x, z, friendly}],
     hint, onConfirm(targets), onCancel() } */
  open(opts) {
    this.opts = opts;
    const b = opts.bounds;
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + 8;
    this.view = { cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2, span };
    this.targets = [];
    this.confirmT = 0;
    this.closing = false;
    const [u, v] = this.toUV(opts.me.x, opts.me.z);
    this.cursor.u = u;
    this.cursor.v = v;
    this.snapshot();
    this.hintEl.textContent = opts.hint || "";
    this.isOpen = true;
    this.root.hidden = false;
    this.root.classList.remove("is-up", "is-down", "is-confirmed");
    void this.root.offsetWidth;          // restart the raise transition
    this.root.classList.add("is-up");
    this.renderSlots();
  }

  toUV(x, z) {
    const { cx, cz, span } = this.view;
    return [(x - cx) / span + 0.5, (z - cz) / span + 0.5];
  }

  toWorld(u, v) {
    const { cx, cz, span } = this.view;
    return { x: cx + (u - 0.5) * span, z: cz + (v - 0.5) * span };
  }

  snapshot() {
    const { cx, cz, span } = this.view;
    const h = span / 2;
    const cam = new THREE.OrthographicCamera(-h, h, h, -h, 1, 400);
    cam.position.set(cx, 220, cz);
    cam.up.set(0, 0, -1);                // -z at the top, same as the minimap
    cam.lookAt(cx, 0, cz);
    cam.updateMatrixWorld();
    if (!this.rt) this.rt = new THREE.WebGLRenderTarget(SNAP, SNAP);
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const fog = this.scene.fog;
    this.scene.fog = null;
    try {
      r.setRenderTarget(this.rt);
      r.clear();
      r.render(this.scene, cam);
      const px = new Uint8Array(SNAP * SNAP * 4);
      r.readRenderTargetPixels(this.rt, 0, 0, SNAP, SNAP, px);
      const img = this.snapCanvas.getContext("2d").createImageData(SNAP, SNAP);
      // Linear -> display, a touch of exposure, then the tablet's cold,
      // desaturated satellite grade. Rows flip (GL is bottom-up).
      const lut = new Uint8ClampedArray(256);
      for (let i = 0; i < 256; i++) lut[i] = 255 * Math.pow(Math.min(1, (i / 255) * 1.35), 1 / 2.2);
      for (let y = 0; y < SNAP; y++) {
        for (let x = 0; x < SNAP; x++) {
          const s = ((SNAP - 1 - y) * SNAP + x) * 4, d = (y * SNAP + x) * 4;
          const R = lut[px[s]], G = lut[px[s + 1]], B = lut[px[s + 2]];
          const l = R * 0.3 + G * 0.59 + B * 0.11;
          img.data[d] = l * 0.55 + R * 0.3;
          img.data[d + 1] = l * 0.62 + G * 0.35;
          img.data[d + 2] = l * 0.6 + B * 0.32;
          img.data[d + 3] = 255;
        }
      }
      this.snapCanvas.getContext("2d").putImageData(img, 0, 0);
    } catch {
      // No overhead picture (context lost etc.): the grid alone still works.
      const g = this.snapCanvas.getContext("2d");
      g.fillStyle = "#18221a";
      g.fillRect(0, 0, SNAP, SNAP);
    } finally {
      r.setRenderTarget(prevTarget);
      this.scene.fog = fog;
    }
  }

  /* Mouse deltas (screen px) or stick (-1..1) move the reticle. */
  moveCursor(dx, dy) {
    if (!this.isOpen || this.confirmT > 0) return;
    const w = this.canvas.getBoundingClientRect().width || SNAP;
    this.cursor.u = Math.max(0, Math.min(1, this.cursor.u + dx / w));
    this.cursor.v = Math.max(0, Math.min(1, this.cursor.v + dy / w));
  }

  stick(x, y, dt) {
    this.moveCursor(x * STICK_SPEED * dt, y * STICK_SPEED * dt);
  }

  place() {
    if (!this.isOpen || this.confirmT > 0 || this.targets.length >= STRIKE_TARGETS) return;
    this.targets.push(this.toWorld(this.cursor.u, this.cursor.v));
    this.placedAt = performance.now();
    this.opts.onPlace?.(this.targets.length);
    this.renderSlots();
    if (this.targets.length >= STRIKE_TARGETS) {
      this.confirmT = CONFIRM_HOLD;
      this.root.classList.add("is-confirmed");
    }
  }

  undo() {
    if (!this.isOpen || this.confirmT > 0) return;
    if (!this.targets.length) { this.cancel(); return; }
    this.targets.pop();
    this.renderSlots();
  }

  cancel() {
    if (!this.isOpen) return;
    const cb = this.opts.onCancel;
    this.lower();
    cb?.();
  }

  /* Put it away without any callbacks (death, match end). */
  lower() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.remove("is-up");
    this.root.classList.add("is-down");
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => { if (!this.isOpen) this.root.hidden = true; }, 380);
  }

  renderSlots() {
    let s = "";
    for (let i = 0; i < STRIKE_TARGETS; i++) {
      s += `<i class="${i < this.targets.length ? "is-set" : ""}">${i + 1}</i>`;
    }
    this.slotsEl.innerHTML = s;
    this.root.classList.toggle("has-targets", this.targets.length > 0);
  }

  update(dt) {
    if (!this.isOpen) return;
    if (this.confirmT > 0) {
      this.confirmT -= dt;
      if (this.confirmT <= 0) {
        const pts = this.targets.slice();
        const cb = this.opts.onConfirm;
        this.lower();
        cb?.(pts);
        return;
      }
    }
    this.draw();
  }

  draw() {
    const g = this.ctx, W = SNAP;
    const t = performance.now() / 1000;
    g.drawImage(this.snapCanvas, 0, 0);
    // Grid, like a map display rather than a photo.
    g.strokeStyle = "rgba(140,255,150,.12)";
    g.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const p = Math.round((i / 8) * W) + 0.5;
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, W); g.stroke();
      g.beginPath(); g.moveTo(0, p); g.lineTo(W, p); g.stroke();
    }

    // Friendlies (and anyone the UAV is showing) as blips.
    for (const b of this.opts.blips?.() || []) {
      const [u, v] = this.toUV(b.x, b.z);
      g.fillStyle = b.friendly ? "#6fd3ff" : "#ff4b3a";
      g.beginPath(); g.arc(u * W, v * W, 5, 0, Math.PI * 2); g.fill();
    }
    // You: an arrow.
    const me = this.opts.me;
    const [mu, mv] = this.toUV(me.x, me.z);
    g.save();
    g.translate(mu * W, mv * W);
    g.rotate(-me.yaw);
    g.fillStyle = "#ffe066";
    g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill();
    g.restore();

    // Marked targets: blast circle + number, pulsing.
    const rPx = (this.opts.radius || 8) / this.view.span * W;
    this.targets.forEach((p, i) => {
      const [u, v] = this.toUV(p.x, p.z);
      const x = u * W, y = v * W;
      const fresh = i === this.targets.length - 1 ? Math.max(0, 1 - (performance.now() - this.placedAt) / 300) : 0;
      g.fillStyle = "rgba(255,70,50,.22)";
      g.strokeStyle = "#ff4632";
      g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, rPx * (1 + fresh * 0.6), 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = "#fff";
      g.font = "bold 18px Oswald, sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(i + 1), x, y);
    });

    // The reticle.
    if (this.confirmT <= 0 && this.targets.length < STRIKE_TARGETS) {
      const x = this.cursor.u * W, y = this.cursor.v * W;
      const pulse = 1 + Math.sin(t * 7) * 0.08;
      g.strokeStyle = "#ff4632";
      g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, rPx * pulse, 0, Math.PI * 2); g.stroke();
      g.beginPath();
      g.moveTo(x - rPx - 10, y); g.lineTo(x - 5, y);
      g.moveTo(x + 5, y); g.lineTo(x + rPx + 10, y);
      g.moveTo(x, y - rPx - 10); g.lineTo(x, y - 5);
      g.moveTo(x, y + 5); g.lineTo(x, y + rPx + 10);
      g.stroke();
    } else if (this.confirmT > 0) {
      g.fillStyle = "rgba(10,14,10,.6)";
      g.fillRect(0, W / 2 - 26, W, 52);
      g.fillStyle = "#ff5a44";
      g.font = "bold 28px Oswald, sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("STRIKE CONFIRMED", W / 2, W / 2);
    }
  }

  dispose() {
    this.rt?.dispose();
    this.root.remove();
  }
}
