import { createGamepadDebug } from '../../../shared/gamepad-debug.js';

const LOOK_SENSITIVITY = 0.0022;
const TOUCH_LOOK_SENSITIVITY = 0.006;
const GP_LOOK_SENSITIVITY = 0.045;
const GP_DEADZONE = 0.18;

// Keyboard + mouse (pointer lock) + touch (joystick/look-pad/buttons) input,
// polled each frame by Game for movement and edge-triggered for actions.
export class InputManager {
  constructor(canvas, touchRoot, callbacks = {}) {
    this.canvas = canvas;
    this.touchRoot = touchRoot;
    this.callbacks = callbacks;
    this.keys = new Set();
    this.lookDX = 0;
    this.lookDY = 0;
    this.touchMove = { x: 0, z: 0 };
    this.jumpHeld = false;
    this.digHeld = false;

    this.gpIndex = null;
    this.gpMove = { x: 0, z: 0 };
    this.gpJumpHeld = false;
    this.gpPrev = {};
    this.gpDebug = createGamepadDebug();
    window.addEventListener('gamepadconnected', (e) => { this.gpIndex = e.gamepad.index; });
    window.addEventListener('gamepaddisconnected', (e) => { if (e.gamepad.index === this.gpIndex) this.gpIndex = null; });

    this._bindKeyboard();
    this._bindMouse();
    this._bindTouch();
  }

  // Left stick digs/mines(hold), right stick looks, A jumps, X places,
  // Y opens inventory, B backs out of a screen. Polled once per frame from
  // Game._loop rather than event-driven, matching how movement keys work.
  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = this.gpIndex != null ? pads[this.gpIndex] : null;
    if (!gp) gp = Array.from(pads).find((p) => p && p.connected) || null;
    this.gpDebug.render(gp);
    if (!gp) { this.gpMove.x = 0; this.gpMove.z = 0; this.gpJumpHeld = false; return; }
    this.gpIndex = gp.index;

    const dz = (v) => (Math.abs(v) < GP_DEADZONE ? 0 : v);
    this.gpMove.x = dz(gp.axes[0] || 0);
    this.gpMove.z = -dz(gp.axes[1] || 0);
    const lookX = dz(gp.axes[2] || 0);
    const lookY = dz(gp.axes[3] || 0);
    this.lookDX += lookX * GP_LOOK_SENSITIVITY;
    this.lookDY += lookY * GP_LOOK_SENSITIVITY;

    const btn = (i) => !!gp.buttons[i]?.pressed;
    const edge = (i) => btn(i) && !this.gpPrev[i];
    this.gpJumpHeld = btn(0); // A

    if (btn(7)) { this.digHeld = true; if (edge(7)) this.callbacks.onDig?.(); } // R2 mine
    else if (!btn(7) && this.gpPrev[7]) this.digHeld = false;
    if (edge(2)) this.callbacks.onPlace?.(); // X place
    if (edge(3)) this.callbacks.onInventory?.(); // Y inventory
    if (edge(1)) this.callbacks.onEscape?.(); // B back/pause

    this.gpPrev = {};
    for (let i = 0; i < gp.buttons.length; i++) this.gpPrev[i] = btn(i);
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const alreadyHeld = this.keys.has(e.code);
      this.keys.add(e.code);
      if (e.code === 'Space') this.jumpHeld = true;
      if (e.code === 'Escape') this.callbacks.onEscape?.();
      if (e.code === 'KeyE') this.callbacks.onInventory?.();
      // Edge-triggered (ignore OS key-repeat) — frees the mouse cursor to
      // click HUD buttons (backpack, map, etc.) without opening the pause
      // menu; pressing it again (or clicking the canvas) re-locks it.
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !alreadyHeld) this.callbacks.onToggleCursor?.();
      const digit = e.code.match(/^Digit([1-9])$/);
      if (digit) this.callbacks.onHotbar?.(Number(digit[1]) - 1);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space') this.jumpHeld = false;
    });
  }

  _bindMouse() {
    this.canvas.addEventListener('click', () => {
      if (document.pointerLockElement !== this.canvas) this.requestPointerLock();
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.canvas) return;
      this.lookDX += e.movementX * LOOK_SENSITIVITY;
      this.lookDY += e.movementY * LOOK_SENSITIVITY;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== this.canvas) return;
      // digHeld drives block-breaking progress (see Game._tickMining) —
      // held down over time, Minecraft-style, rather than instant per
      // click. onDig still fires once immediately too, for entity attacks
      // (those stay click-based with their own cooldown, unaffected).
      if (e.button === 0) { this.digHeld = true; this.callbacks.onDig?.(); }
      if (e.button === 2) this.callbacks.onPlace?.();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.digHeld = false;
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas) this.digHeld = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  requestPointerLock() {
    this.canvas.requestPointerLock?.();
  }

  exitPointerLock() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
  }

  _bindTouch() {
    if (!this.touchRoot) return;
    const joy = this.touchRoot.querySelector('#tr3-joy-move');
    const knob = joy?.querySelector('.tr3-joystick-knob');
    const lookPad = this.touchRoot.querySelector('#tr3-look-pad');
    const btnJump = this.touchRoot.querySelector('#tr3-btn-jump');
    const btnDig = this.touchRoot.querySelector('#tr3-btn-dig');
    const btnPlace = this.touchRoot.querySelector('#tr3-btn-place');

    if (joy) {
      let joyId = null;
      const radius = 42;
      const setKnob = (dx, dz) => {
        if (knob) knob.style.transform = `translate(${dx * 20}px, ${dz * 20}px)`;
      };
      joy.addEventListener('pointerdown', (e) => {
        joyId = e.pointerId;
        joy.setPointerCapture(joyId);
      });
      joy.addEventListener('pointermove', (e) => {
        if (e.pointerId !== joyId) return;
        const rect = joy.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        let dx = (e.clientX - cx) / radius;
        let dz = (e.clientY - cy) / radius;
        const len = Math.hypot(dx, dz);
        if (len > 1) { dx /= len; dz /= len; }
        this.touchMove.x = dx;
        this.touchMove.z = -dz;
        setKnob(dx, dz);
      });
      const release = (e) => {
        if (e.pointerId !== joyId) return;
        joyId = null;
        this.touchMove.x = 0;
        this.touchMove.z = 0;
        setKnob(0, 0);
      };
      joy.addEventListener('pointerup', release);
      joy.addEventListener('pointercancel', release);
    }

    if (lookPad) {
      let lookId = null, lastX = 0, lastY = 0;
      lookPad.addEventListener('pointerdown', (e) => {
        lookId = e.pointerId; lastX = e.clientX; lastY = e.clientY;
        lookPad.setPointerCapture(lookId);
      });
      lookPad.addEventListener('pointermove', (e) => {
        if (e.pointerId !== lookId) return;
        this.lookDX += (e.clientX - lastX) * TOUCH_LOOK_SENSITIVITY;
        this.lookDY += (e.clientY - lastY) * TOUCH_LOOK_SENSITIVITY;
        lastX = e.clientX; lastY = e.clientY;
      });
      const release = (e) => { if (e.pointerId === lookId) lookId = null; };
      lookPad.addEventListener('pointerup', release);
      lookPad.addEventListener('pointercancel', release);
    }

    btnJump?.addEventListener('pointerdown', () => { this.jumpHeld = true; });
    btnJump?.addEventListener('pointerup', () => { this.jumpHeld = false; });
    btnJump?.addEventListener('pointercancel', () => { this.jumpHeld = false; });
    btnDig?.addEventListener('pointerdown', () => { this.digHeld = true; this.callbacks.onDig?.(); });
    btnDig?.addEventListener('pointerup', () => { this.digHeld = false; });
    btnDig?.addEventListener('pointercancel', () => { this.digHeld = false; });
    btnPlace?.addEventListener('pointerdown', () => this.callbacks.onPlace?.());
  }

  get moveVector() {
    let x = this.touchMove.x + this.gpMove.x, z = this.touchMove.z + this.gpMove.z;
    if (this.keys.has('KeyW')) z += 1;
    if (this.keys.has('KeyS')) z -= 1;
    if (this.keys.has('KeyD')) x += 1;
    if (this.keys.has('KeyA')) x -= 1;
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    return { x, z };
  }

  get jumpOrGpHeld() {
    return this.jumpHeld || this.gpJumpHeld;
  }

  consumeLook() {
    const d = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0;
    this.lookDY = 0;
    return d;
  }
}
