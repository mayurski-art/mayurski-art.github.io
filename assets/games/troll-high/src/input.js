/* Troll High — keyboard + touch input.
   axis() returns {x, y} in [-1, 1]; interact is edge-triggered. */

import { createGamepadDebug } from "../../shared/gamepad-debug.js";

const isTyping = el => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
const GP_DEADZONE = 0.2;

export class Input {
  constructor() {
    this.keys = new Set();
    this._interactQueued = false;
    this.touch = { active: false, x: 0, y: 0 };
    this.gp = { x: 0, y: 0 };
    this.gpIndex = null;
    this.gpPrevA = false;
    this.gpDebug = createGamepadDebug();
    addEventListener("gamepadconnected", e => { this.gpIndex = e.gamepad.index; });
    addEventListener("gamepaddisconnected", e => { if (e.gamepad.index === this.gpIndex) this.gpIndex = null; });

    addEventListener("keydown", e => {
      if (isTyping(e.target)) return; // chat/name inputs handle their own keys
      if (e.repeat) return;
      this.keys.add(e.code);
      // KeyE only — every overlay's hint/help text says "E" (never
      // "Space"), and Space needs to stay free for minigames that use it
      // as their own action key (tetherball, kickball, PACER test); it
      // used to double as interact too, which silently closed those
      // minigames on their own Space presses.
      if (e.code === "KeyE") {
        this._interactQueued = true;
      }
    });
    addEventListener("keyup", e => { if (!isTyping(e.target)) this.keys.delete(e.code); });
    addEventListener("blur", () => this.keys.clear());
  }

  /* Wire the on-screen stick + button once the DOM exists. */
  attachTouch(stickEl, nubEl, actBtn) {
    const radius = 42;
    let pointerId = null;

    const move = e => {
      const rect = stickEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const len = Math.hypot(dx, dy) || 1;
      const capped = Math.min(len, radius);
      dx = (dx / len) * capped; dy = (dy / len) * capped;
      nubEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      // dead zone so resting a thumb doesn't drift
      const norm = capped / radius;
      this.touch.active = norm > 0.18;
      this.touch.x = this.touch.active ? dx / capped * norm : 0;
      this.touch.y = this.touch.active ? dy / capped * norm : 0;
    };
    const end = () => {
      pointerId = null;
      this.touch.active = false; this.touch.x = 0; this.touch.y = 0;
      nubEl.style.transform = "translate(-50%, -50%)";
    };

    stickEl.addEventListener("pointerdown", e => {
      pointerId = e.pointerId;
      stickEl.setPointerCapture(pointerId);
      move(e);
    });
    stickEl.addEventListener("pointermove", e => { if (e.pointerId === pointerId) move(e); });
    stickEl.addEventListener("pointerup", end);
    stickEl.addEventListener("pointercancel", end);

    actBtn.addEventListener("click", () => { this._interactQueued = true; });
  }

  axis() {
    if (this.touch.active) return { x: this.touch.x, y: this.touch.y };
    let x = 0, y = 0;
    if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) x -= 1;
    if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) x += 1;
    if (this.keys.has("ArrowUp") || this.keys.has("KeyW")) y -= 1;
    if (this.keys.has("ArrowDown") || this.keys.has("KeyS")) y += 1;
    if (x === 0 && y === 0 && (this.gp.x || this.gp.y)) return { x: this.gp.x, y: this.gp.y };
    if (x && y) { const s = Math.SQRT1_2; x *= s; y *= s; }
    return { x, y };
  }

  /* Left stick move + A interact. Chat/typing already short-circuits keydown
     above; same not-typing guard applies here via isTyping(document.activeElement)
     so a controller can't fire interact while the chat/name input has focus. */
  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = this.gpIndex != null ? pads[this.gpIndex] : null;
    if (!gp) gp = Array.from(pads).find(p => p && p.connected) || null;
    this.gpDebug.render(gp);
    if (!gp) { this.gp.x = 0; this.gp.y = 0; this.gpPrevA = false; return; }
    this.gpIndex = gp.index;
    if (isTyping(document.activeElement)) return;

    const dz = v => (Math.abs(v) < GP_DEADZONE ? 0 : v);
    this.gp.x = dz(gp.axes[0] || 0);
    this.gp.y = dz(gp.axes[1] || 0);
    const a = !!gp.buttons[0]?.pressed;
    if (a && !this.gpPrevA) this._interactQueued = true;
    this.gpPrevA = a;
  }

  /* True once per press. */
  interactPressed() {
    if (!this._interactQueued) return false;
    this._interactQueued = false;
    return true;
  }
}
