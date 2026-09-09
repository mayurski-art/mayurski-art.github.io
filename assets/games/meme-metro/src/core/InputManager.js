// Keyboard + touch-swipe input. Emits semantic actions via handler callbacks:
// left / right / jump / slide / pause.

import { createGamepadDebug } from '../../../shared/gamepad-debug.js';

const SWIPE_MIN_PX = 26;
const GP_DEADZONE = 0.5; // lane switches are edge-triggered, so this is a "tilted far enough" threshold, not a stick deadzone

export class InputManager {
  constructor(touchTarget, handlers) {
    this.handlers = handlers;
    this.touchStart = null;

    this.gpIndex = null;
    this.gpPrev = { left: false, right: false, jump: false, slide: false, pause: false };
    this.gpDebug = createGamepadDebug();
    window.addEventListener('gamepadconnected', (e) => { this.gpIndex = e.gamepad.index; });
    window.addEventListener('gamepaddisconnected', (e) => { if (e.gamepad.index === this.gpIndex) this.gpIndex = null; });

    this.onKeyDown = (e) => {
      if (e.repeat) return;
      // `inert` (see site-lock.js) blocks pointer/focus targeting but not
      // this global window-level keydown listener, so an already-open run
      // could otherwise keep steering through a site lock.
      if (window.TrollrunnerSiteLock?.getComputedRecord?.()?.mode === 'locked') return;
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': e.preventDefault(); handlers.left(); break;
        case 'ArrowRight': case 'KeyD': e.preventDefault(); handlers.right(); break;
        case 'ArrowUp': case 'KeyW': case 'Space': e.preventDefault(); handlers.jump(); break;
        case 'ArrowDown': case 'KeyS': e.preventDefault(); handlers.slide(); break;
        case 'Escape': case 'KeyP': handlers.pause(); break;
      }
    };

    this.onTouchStart = (e) => {
      const t = e.changedTouches[0];
      this.touchStart = { x: t.clientX, y: t.clientY };
    };

    this.onTouchEnd = (e) => {
      if (!this.touchStart) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - this.touchStart.x;
      const dy = t.clientY - this.touchStart.y;
      this.touchStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        (dx > 0 ? handlers.right : handlers.left)();
      } else {
        (dy > 0 ? handlers.slide : handlers.jump)();
      }
    };

    // Swipes only bind to the canvas so UI buttons stay tappable.
    this.onTouchMove = (e) => e.preventDefault();

    window.addEventListener('keydown', this.onKeyDown);
    touchTarget.addEventListener('touchstart', this.onTouchStart, { passive: true });
    touchTarget.addEventListener('touchmove', this.onTouchMove, { passive: false });
    touchTarget.addEventListener('touchend', this.onTouchEnd, { passive: true });
  }

  // D-pad or left stick left/right = lane switch, A = jump, B = slide,
  // Start = pause. Edge-triggered like keyboard/swipe, so hold doesn't repeat.
  pollGamepad() {
    if (window.TrollrunnerSiteLock?.getComputedRecord?.()?.mode === 'locked') return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = this.gpIndex != null ? pads[this.gpIndex] : null;
    if (!gp) gp = Array.from(pads).find((p) => p && p.connected) || null;
    this.gpDebug.render(gp);
    if (!gp) return;
    this.gpIndex = gp.index;

    const axisX = gp.axes[0] || 0;
    const left = !!gp.buttons[14]?.pressed || axisX < -GP_DEADZONE;
    const right = !!gp.buttons[15]?.pressed || axisX > GP_DEADZONE;
    const jump = !!gp.buttons[0]?.pressed || !!gp.buttons[12]?.pressed;
    const slide = !!gp.buttons[1]?.pressed || !!gp.buttons[13]?.pressed;
    const pause = !!gp.buttons[9]?.pressed;

    if (left && !this.gpPrev.left) this.handlers.left();
    if (right && !this.gpPrev.right) this.handlers.right();
    if (jump && !this.gpPrev.jump) this.handlers.jump();
    if (slide && !this.gpPrev.slide) this.handlers.slide();
    if (pause && !this.gpPrev.pause) this.handlers.pause();

    this.gpPrev = { left, right, jump, slide, pause };
  }
}
