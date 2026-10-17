// Grin Sabers — a person's input, turned into a Fighter intent.
//
// One idea runs every device: an AIM, a point in a ring round the opponent
// (the HUD's white arrow). Your swing comes FROM the side you aim at, and
// your guard faces it. A perfect block is a guard aimed where the red arrow
// shows. A fast flick while guarding is the disarm move, and doesn't move
// the aim.
//
//   mouse      move = aim, left click = swing (hold = heavy), right click = guard
//   keyboard   WASD move, Shift dodge, Space jump, IJKL aim (keyboard only:
//              F swing, G guard)
//   gamepad    left stick move, right stick aim, RB/RT swing, LB/LT guard,
//              B dodge, A jump, Start pause
//   touch      left stick, tap = swing, swipe = swing from the side you
//              start on, GUARD/DODGE/JUMP buttons (touch guards are timed)

const AIM_GAIN = 0.0065;          // aim per pixel of mouse travel
const FLICK_SPEED = 2600;         // px/s: faster than this is a flick, not aim

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.aim = { x: 0, y: 0 };
    this.mouse = { left: false, right: false };
    this.edges = { attack: false, dodge: false, jump: false, pause: false, mute: false, flick: null };
    this.attackReleased = false;
    this.locked = false;
    this.enabled = false;
    this.touch = { stickId: null, sx: 0, sy: 0, mx: 0, my: 0, swipeId: null, swX: 0, swY: 0, swT: 0, guard: false };
    this.swipeDir = null;
    this.pad = { prev: [] };
    this.lastInput = "mouse";
    this.lastMove = performance.now();
    this.bind();
  }

  bind() {
    const c = this.canvas;
    addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k === "escape" || k === "p") this.edges.pause = true;
      if (k === "m") this.edges.mute = true;
      if (!this.enabled) return;
      this.lastInput = "keys";
      if (k === "shift") this.edges.dodge = true;
      if (k === " ") { this.edges.jump = true; e.preventDefault(); }
      if (k === "f") { this.edges.attack = true; this.mouse.left = true; }
      if (k === "i") this.setAim(0, 1);
      if (k === "k") this.setAim(0, 0);
      if (k === "j") this.setAim(-1, 0);
      if (k === "l") this.setAim(1, 0);
    });
    addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (k === "f") { this.mouse.left = false; this.attackReleased = true; }
    });
    addEventListener("blur", () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });

    c.addEventListener("contextmenu", (e) => e.preventDefault());
    c.addEventListener("mousedown", (e) => {
      if (!this.enabled) return;
      if (!this.locked && c.requestPointerLock) c.requestPointerLock();
      this.lastInput = "mouse";
      if (e.button === 0) { this.mouse.left = true; this.edges.attack = true; }
      if (e.button === 2) this.mouse.right = true;
    });
    addEventListener("mouseup", (e) => {
      if (e.button === 0) { this.mouse.left = false; this.attackReleased = true; }
      if (e.button === 2) this.mouse.right = false;
    });
    let lastT = performance.now();
    addEventListener("mousemove", (e) => {
      if (!this.enabled) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastT) / 1000;
      lastT = now;
      const dx = e.movementX || 0, dy = e.movementY || 0;
      const speed = Math.hypot(dx, dy) / dt;
      if (speed > FLICK_SPEED && Math.hypot(dx, dy) > 14) {
        const l = Math.hypot(dx, dy);
        this.edges.flick = { x: dx / l, y: -dy / l };
        return;
      }
      this.aim.x += dx * AIM_GAIN;
      this.aim.y -= dy * AIM_GAIN;
      this.clampAim();
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === c;
      if (!this.locked && this.enabled && this.wantLock) this.edges.pause = true;
    });

    // touch: stick
    const stick = document.getElementById("gs-stick");
    const knob = stick?.querySelector(".gs-knob");
    const stickMove = (t) => {
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let x = (t.clientX - cx) / (r.width / 2), y = (t.clientY - cy) / (r.height / 2);
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      this.touch.mx = x; this.touch.my = y;
      knob.style.transform = `translate(${x * 39}px, ${y * 39}px)`;
    };
    stick?.addEventListener("touchstart", (e) => { e.preventDefault(); const t = e.changedTouches[0]; this.touch.stickId = t.identifier; stickMove(t); this.lastInput = "touch"; }, { passive: false });
    stick?.addEventListener("touchmove", (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === this.touch.stickId) stickMove(t); }, { passive: false });
    const stickEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === this.touch.stickId) { this.touch.stickId = null; this.touch.mx = this.touch.my = 0; knob.style.transform = ""; } };
    stick?.addEventListener("touchend", stickEnd);
    stick?.addEventListener("touchcancel", stickEnd);

    // touch: swipe area (tap = swing, swipe = directed swing, hold = heavy)
    const sw = document.getElementById("gs-swipe");
    sw?.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      Object.assign(this.touch, { swipeId: t.identifier, swX: t.clientX, swY: t.clientY, swT: performance.now() });
      this.mouse.left = true;
      this.lastInput = "touch";
    }, { passive: false });
    sw?.addEventListener("touchmove", (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this.touch.swipeId) continue;
        const dx = t.clientX - this.touch.swX, dy = t.clientY - this.touch.swY;
        if (this.touch.guard && Math.hypot(dx, dy) > 40) {
          // a swipe while guarding: the disarm flick
          const l = Math.hypot(dx, dy);
          this.edges.flick = { x: dx / l, y: -dy / l };
          this.touch.swX = t.clientX; this.touch.swY = t.clientY;
        }
      }
    }, { passive: false });
    const swEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this.touch.swipeId) continue;
        this.touch.swipeId = null;
        this.mouse.left = false;
        if (this.touch.guard) continue;
        const dx = t.clientX - this.touch.swX, dy = t.clientY - this.touch.swY;
        const held = performance.now() - this.touch.swT;
        let dir = null;
        if (Math.hypot(dx, dy) > 30) {
          // the blade comes from where the swipe starts
          if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? "L" : "R";
          else dir = dy > 0 ? "O" : "T";
        }
        this.swipeDir = dir;
        this.swipeHeavy = held > 380 && Math.hypot(dx, dy) < 30;
        this.edges.attack = true;
        this.attackReleased = true;
      }
    };
    sw?.addEventListener("touchend", swEnd);
    sw?.addEventListener("touchcancel", swEnd);

    const btn = (id, down, up) => {
      const el = document.getElementById(id);
      el?.addEventListener("touchstart", (e) => { e.preventDefault(); el.classList.add("held"); down(); }, { passive: false });
      const end = (e) => { e.preventDefault(); el.classList.remove("held"); up?.(); };
      el?.addEventListener("touchend", end);
      el?.addEventListener("touchcancel", end);
    };
    btn("gs-tguard", () => { this.touch.guard = true; }, () => { this.touch.guard = false; });
    btn("gs-tdodge", () => { this.edges.dodge = true; });
    btn("gs-tjump", () => { this.edges.jump = true; });
  }

  setAim(x, y) { this.aim.x = x; this.aim.y = y; this.lastInput = "keys"; }
  clampAim() {
    const l = Math.hypot(this.aim.x, this.aim.y);
    if (l > 1) { this.aim.x /= l; this.aim.y /= l; }
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) return null;
    const b = (i) => !!gp.buttons[i]?.pressed;
    const prev = this.pad.prev;
    const edge = (i) => b(i) && !prev[i];
    const out = {
      mx: Math.abs(gp.axes[0]) > 0.18 ? gp.axes[0] : 0,
      mz: Math.abs(gp.axes[1]) > 0.18 ? -gp.axes[1] : 0,
      ax: gp.axes[2] || 0, ay: -(gp.axes[3] || 0),
      attack: edge(5) || edge(7), attackHeld: b(5) || b(7),
      guard: b(4) || b(6), dodge: edge(1), jump: edge(0), pause: edge(9),
    };
    this.pad.prev = gp.buttons.map((x) => x.pressed);
    if (out.attack || out.guard || Math.hypot(out.mx, out.mz) > 0.3) this.lastInput = "pad";
    // right stick sets the aim; a hard snap across while guarding is a flick
    const al = Math.hypot(out.ax, out.ay);
    if (al > 0.35) {
      const nx = out.ax / al, ny = out.ay / al;
      if (out.guard && al > 0.9 && (nx * this.aim.x + ny * this.aim.y) < -0.5 && Math.hypot(this.aim.x, this.aim.y) > 0.5) {
        this.edges.flick = { x: nx, y: ny };
      } else {
        this.aim.x = out.ax; this.aim.y = out.ay;
        this.clampAim();
      }
    }
    return out;
  }

  /* The swing side the aim picks: from the left, the right, overhead or a thrust. */
  aimDir() {
    const { x, y } = this.aim;
    if (y > 0.45 && y >= Math.abs(x)) return "O";
    if (Math.abs(x) > 0.3) return x < 0 ? "L" : "R";
    return "T";
  }

  /* Fill `fighter.intent` for this frame, then clear the edges. */
  read(fighter) {
    const it = fighter.intent;
    const k = this.keys;
    const pad = this.pollPad();
    let mx = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
    let mz = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
    if (this.touch.stickId != null) { mx = this.touch.mx; mz = -this.touch.my; }
    if (pad && (pad.mx || pad.mz)) { mx = pad.mx; mz = pad.mz; }
    it.mx = mx; it.mz = mz;
    const attack = this.edges.attack || !!pad?.attack;
    it.attack = attack;
    it.mash = attack;
    it.attackHeld = this.mouse.left || !!pad?.attackHeld;
    it.dir = this.swipeDir || this.aimDir();
    if (this.swipeDir === null && this.lastInput === "touch" && attack) it.dir = null;   // a touch tap: auto combo
    it.heavy = !!this.swipeHeavy && attack;
    it.guard = this.mouse.right || k.has("g") || this.touch.guard || !!pad?.guard;
    it.touchGuard = this.touch.guard && !this.mouse.right;
    it.aimX = this.aim.x; it.aimY = this.aim.y;
    it.flick = this.edges.flick;
    it.dodge = this.edges.dodge || !!pad?.dodge;
    it.jump = this.edges.jump || !!pad?.jump;
    if (pad?.pause) this.edges.pause = true;
    this.edges.attack = this.edges.dodge = this.edges.jump = false;
    this.edges.flick = null;
    this.swipeDir = null;
    this.swipeHeavy = false;
  }

  takePause() { const p = this.edges.pause; this.edges.pause = false; return p; }
  takeMute() { const m = this.edges.mute; this.edges.mute = false; return m; }
}
