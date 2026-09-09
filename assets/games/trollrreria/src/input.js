/* Trollrreria — keyboard + mouse state. */

import { createGamepadDebug } from "../../shared/gamepad-debug.js";

// `inert` (see site-lock.js) blocks pointer/focus targeting but NOT global
// window-level keydown listeners like the one below, so a site lock alone
// wouldn't stop an already-open game from still reading movement keys.
// Checked both on new keydowns and in down() so already-held keys stop
// registering the instant the site locks, not just new presses.
function isSiteLocked() {
  return window.TrollrunnerSiteLock?.getComputedRecord?.()?.mode === "locked";
}

const GP_DEADZONE = 0.22;
const GP_AIM_SPEED = 480; // px/sec of world-space reticle drift from the right stick

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();          // currently held (KeyboardEvent.code)
    this.pressed = new Set();       // pressed this frame
    this.mouse = { x: 0, y: 0, left: false, right: false };
    this.clicked = { left: false, right: false };
    this.wheel = 0;
    this.enabled = true;            // false while typing in DOM inputs
    this.lastActivity = performance.now(); // last real player input, for idle-autosave

    this.gpIndex = null;
    this.gpDebug = createGamepadDebug();
    window.addEventListener("gamepadconnected", e => { this.gpIndex = e.gamepad.index; });
    window.addEventListener("gamepaddisconnected", e => { if (e.gamepad.index === this.gpIndex) this.gpIndex = null; });

    window.addEventListener("keydown", e => {
      if (!this.enabled || isSiteLocked()) return;
      /* don't steal keys from text fields (co-op room code, etc.) */
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      this.markActive();
      /* keep the page from scrolling / triggering browser shortcuts */
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab", "F1"].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", e => this.keys.delete(e.code));
    window.addEventListener("blur", () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });

    canvas.addEventListener("mousemove", e => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.coarseAim = false;    // a real mouse aims precisely — no tap snap
      this.markActive();
    });
    canvas.addEventListener("mousedown", e => {
      if (e.button === 0) { this.mouse.left = true; this.clicked.left = true; }
      if (e.button === 2) { this.mouse.right = true; this.clicked.right = true; }
      this.markActive();
    });
    window.addEventListener("mouseup", e => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    canvas.addEventListener("wheel", e => {
      this.wheel += Math.sign(e.deltaY);
      this.markActive();
      e.preventDefault();
    }, { passive: false });
  }

  markActive() { this.lastActivity = performance.now(); }
  idleMs() { return performance.now() - this.lastActivity; }

  down(code) { return !isSiteLocked() && this.keys.has(code); }
  hit(code) { return !isSiteLocked() && this.pressed.has(code); }

  /* Left stick/d-pad -> the same move/jump/drop codes touch already drives;
     right stick nudges the mouse-aim reticle (same coarseAim snap touch uses)
     so mining/placing/interact work without a real pointer. A = interact,
     mirroring the touch "hand" button. */
  pollGamepad() {
    if (isSiteLocked()) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = this.gpIndex != null ? pads[this.gpIndex] : null;
    if (!gp) gp = Array.from(pads).find(p => p && p.connected) || null;
    this.gpDebug.render(gp);
    if (!gp) return;
    this.gpIndex = gp.index;

    const dz = v => (Math.abs(v) < GP_DEADZONE ? 0 : v);
    const setCode = (code, on) => {
      if (on) { if (!this.keys.has(code)) this.pressed.add(code); this.keys.add(code); }
      else this.keys.delete(code);
    };
    const axisX = dz(gp.axes[0] || 0);
    const axisY = dz(gp.axes[1] || 0);
    setCode("KeyA", axisX < 0 || !!gp.buttons[14]?.pressed);
    setCode("KeyD", axisX > 0 || !!gp.buttons[15]?.pressed);
    setCode("Space", !!gp.buttons[0]?.pressed || !!gp.buttons[12]?.pressed);
    setCode("KeyS", axisY > 0.5 || !!gp.buttons[13]?.pressed);

    const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
    if (rx || ry) {
      const dt = 1 / 60; // polled once per frame; good enough for a reticle nudge
      const w = this.canvas.width, h = this.canvas.height;
      this.mouse.x = Math.max(0, Math.min(w, this.mouse.x + rx * GP_AIM_SPEED * dt));
      this.mouse.y = Math.max(0, Math.min(h, this.mouse.y + ry * GP_AIM_SPEED * dt));
      this.coarseAim = true;
      this.markActive();
    }

    const mine = !!gp.buttons[7]?.pressed || !!gp.buttons[2]?.pressed; // R2 or X
    if (mine && !this._gpMineHeld) { this.mouse.left = true; this.clicked.left = true; }
    else if (!mine) this.mouse.left = false;
    this._gpMineHeld = mine;

    const interactBtn = !!gp.buttons[1]?.pressed; // B
    if (interactBtn && !this._gpInteractHeld) this._gpInteractQueued = true;
    this._gpInteractHeld = interactBtn;

    if (axisX || axisY || rx || ry || mine || interactBtn) this.markActive();
  }

  /* True once per press, consumed by main.js's interact handling. */
  gpInteractPressed() {
    if (!this._gpInteractQueued) return false;
    this._gpInteractQueued = false;
    return true;
  }

  /* call at end of each frame */
  flush() {
    this.pressed.clear();
    this.clicked.left = this.clicked.right = false;
    this.wheel = 0;
  }
}
