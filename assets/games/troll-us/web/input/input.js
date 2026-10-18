// Troll Us web: input for walking in first person. Desktop locks the pointer on a click (mouse looks, WASD or
// arrows walk, Esc lets go). Phones get a floating stick under the left thumb and drag-to-look on the right 60% of
// the screen, the same split as Studio. The rates match Studio: 0.25° per mouse pixel, 0.32° per touch pixel.
import '../../../../js/automation-pointer-lock.js';

const MOUSE_RAD = 0.25 * Math.PI / 180;
const TOUCH_RAD = 0.32 * Math.PI / 180;
const STICK_MAX = 48;    // px from the stick's centre to full speed
const STICK_DEAD = 0.12; // thumb wobble that doesn't count

export const input = {
  moveX: 0, moveY: 0,   // -1..1, right and back are positive
  lookDX: 0, lookDY: 0, // radians since the last frame; the player takes them and zeroes them
  locked: false, touch: false,
  sensitivity: 1,
};

const keys = new Set();
const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };

let stickX = 0, stickY = 0;

// keyboard and stick combined, read once a frame
export function readMove() {
  let x = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0);
  let y = (keys.has('b') ? 1 : 0) - (keys.has('f') ? 1 : 0);
  if (x || y) { const l = Math.hypot(x, y); x /= l; y /= l; } else { x = stickX; y = stickY; }
  input.moveX = x; input.moveY = y;
  return input;
}

export function takeLook() {
  const out = [input.lookDX, input.lookDY];
  input.lookDX = 0; input.lookDY = 0;
  return out;
}

export function initInput(canvas, ui) {
  // ---------- desktop ----------
  window.addEventListener('keydown', (e) => {
    const k = KEYMAP[e.code];
    if (!k) return;
    keys.add(k);
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys.delete(k); });
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('click', () => {
    if (input.touch || document.pointerLockElement === canvas) return;
    canvas.requestPointerLock?.()?.catch?.(() => {});
  });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
    if (!input.locked) keys.clear();
    ui.onLock?.(input.locked);
  });
  document.addEventListener('mousemove', (e) => {
    if (!input.locked) return;
    input.lookDX += e.movementX * MOUSE_RAD * input.sensitivity;
    input.lookDY += e.movementY * MOUSE_RAD * input.sensitivity;
  });

  // ---------- touch ----------
  const { stick, nub } = ui;
  let stickId = null, sx = 0, sy = 0;
  const looks = new Map(); // pointerId -> last {x, y}
  const restStick = () => {
    stickId = null; stickX = stickY = 0;
    stick.classList.remove('is-active');
    stick.style.left = stick.style.top = '';
    nub.style.transform = '';
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    if (!input.touch) { input.touch = true; ui.onTouch?.(); }
    e.preventDefault();
    if (e.clientX < window.innerWidth * 0.4 && stickId == null) {
      // the stick jumps to the thumb
      stickId = e.pointerId; sx = e.clientX; sy = e.clientY;
      stick.style.left = `${sx}px`; stick.style.top = `${sy}px`;
      stick.classList.add('is-active');
    } else {
      looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  }, { passive: false });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') return;
    if (e.pointerId === stickId) {
      let dx = e.clientX - sx, dy = e.clientY - sy;
      const d = Math.hypot(dx, dy);
      if (d > STICK_MAX) { dx *= STICK_MAX / d; dy *= STICK_MAX / d; }
      nub.style.transform = `translate(${dx}px, ${dy}px)`;
      const m = Math.min(1, d / STICK_MAX);
      const live = m < STICK_DEAD ? 0 : (m - STICK_DEAD) / (1 - STICK_DEAD);
      stickX = d ? (dx / Math.min(d, STICK_MAX)) * live : 0;
      stickY = d ? (dy / Math.min(d, STICK_MAX)) * live : 0;
      return;
    }
    const last = looks.get(e.pointerId);
    if (!last) return;
    input.lookDX += (e.clientX - last.x) * TOUCH_RAD * input.sensitivity;
    input.lookDY += (e.clientY - last.y) * TOUCH_RAD * input.sensitivity;
    last.x = e.clientX; last.y = e.clientY;
  });
  const end = (e) => {
    if (e.pointerType !== 'touch') return;
    if (e.pointerId === stickId) restStick();
    looks.delete(e.pointerId);
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}
