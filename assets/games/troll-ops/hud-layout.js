// Troll Forces — HUD layout editor (Settings > Customize HUD layout).
//
// Every movable piece (touch buttons on a phone; minimap, streaks, gear,
// health, ammo, killfeed everywhere) keeps its normal place in the CSS and
// is moved by an offset on the CSS `translate` property, so nesting, flex
// rows and the elements' own `transform`s are untouched. Offsets are saved
// as fractions of the screen, so a layout survives rotating the phone or
// resizing the window. Phones and desktops keep separate layouts.

const STORE_KEY = (touch) => `trollops.hudLayout.${touch ? "touch" : "desk"}.v1`;

/* [element id, label]. `touch` pieces only exist on a phone. */
const SHARED = [
  ["to-minimap", "Minimap"],
  ["to-ss-hud", "Streaks"],
  ["to-hud-gear", "Gear"],
  ["hud-health", "Health"],
  ["hud-ammo", "Ammo"],
  ["to-killfeed", "Killfeed"],
];
const TOUCH = [
  ["to-touch-move", "Move stick"],
  ["to-touch-fire", "Fire"],
  ["to-touch-fire-l", "Left fire"],
  ["to-touch-ads", "Aim"],
  ["to-touch-jump", "Jump"],
  ["to-touch-reload", "Reload"],
  ["to-touch-slide", "Crouch"],
  ["to-touch-melee", "Melee"],
  ["to-touch-nade", "Lethal"],
  ["to-touch-tac", "Tactical"],
  ["to-touch-interact", "Interact"],
  ["to-touch-swap", "Swap / pick up"],
  ["to-touch-streak", "Streak"],
  ["to-touch-emote", "Emote"],
  ["to-touch-admire", "Admire"],
];

function load(touch) {
  try { return JSON.parse(localStorage.getItem(STORE_KEY(touch)) || "{}") || {}; } catch { return {}; }
}
function store(touch, data) {
  try { localStorage.setItem(STORE_KEY(touch), JSON.stringify(data)); } catch { /* private mode */ }
}

export class HudLayout {
  /* `stage`: the element the HUD fills (offsets are fractions of its size).
     `onOpen` / `onClose`: the game hides its menus and shows the HUD for
     editing, then puts everything back. */
  constructor({ stage, touch, onOpen, onClose }) {
    this.stage = stage;
    this.touch = touch;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.items = (touch ? [...SHARED, ...TOUCH] : SHARED)
      .map(([id, label]) => ({ id, label, el: document.getElementById(id) }))
      .filter((it) => it.el);
    this.offsets = load(touch);
    this.editing = false;
    this.bar = null;
    this.drag = null;
    this.apply();
    window.addEventListener("resize", () => this.apply());
    window.addEventListener("orientationchange", () => this.apply());
  }

  size() {
    const r = this.stage.getBoundingClientRect();
    return { w: r.width || window.innerWidth, h: r.height || window.innerHeight };
  }

  /* Put every saved piece where it was left. */
  apply() {
    const { w, h } = this.size();
    for (const it of this.items) {
      const o = this.offsets[it.id];
      it.el.style.translate = o ? `${Math.round(o[0] * w)}px ${Math.round(o[1] * h)}px` : "";
    }
  }

  open() {
    if (this.editing) return;
    this.editing = true;
    this.onOpen?.();
    document.body.classList.add("to-layout-edit");
    for (const it of this.items) {
      it.el.classList.add("to-layout-item");
      it.el.dataset.layoutLabel = it.label;
      // Pieces that only show sometimes (streaks, left fire...) show now.
      it.wasHidden = it.el.hidden;
      it.el.hidden = false;
    }
    this.buildBar();
    // Capture phase on window: runs before any button's own touch/mouse
    // handler, so dragging "Fire" never fires.
    this.block = (e) => {
      if (this.bar && this.bar.contains(e.target)) return;
      e.stopPropagation();
      if (e.cancelable && e.type !== "pointerdown") e.preventDefault();
    };
    for (const t of ["touchstart", "touchmove", "touchend", "mousedown", "mouseup", "click", "contextmenu"]) {
      window.addEventListener(t, this.block, { capture: true, passive: false });
    }
    this.down = (e) => this.pointerDown(e);
    this.move = (e) => this.pointerMove(e);
    this.up = () => this.pointerUp();
    window.addEventListener("pointerdown", this.down, true);
    window.addEventListener("pointermove", this.move, true);
    window.addEventListener("pointerup", this.up, true);
    window.addEventListener("pointercancel", this.up, true);
  }

  close() {
    if (!this.editing) return;
    this.editing = false;
    for (const t of ["touchstart", "touchmove", "touchend", "mousedown", "mouseup", "click", "contextmenu"]) {
      window.removeEventListener(t, this.block, { capture: true });
    }
    window.removeEventListener("pointerdown", this.down, true);
    window.removeEventListener("pointermove", this.move, true);
    window.removeEventListener("pointerup", this.up, true);
    window.removeEventListener("pointercancel", this.up, true);
    document.body.classList.remove("to-layout-edit");
    for (const it of this.items) {
      it.el.classList.remove("to-layout-item", "is-dragging");
      if (it.wasHidden) it.el.hidden = true;
    }
    this.bar?.remove();
    this.bar = null;
    store(this.touch, this.offsets);
    this.onClose?.();
  }

  reset() {
    this.offsets = {};
    store(this.touch, this.offsets);
    this.apply();
  }

  buildBar() {
    const bar = document.createElement("div");
    bar.className = "to-layout-bar";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "Customize HUD layout");
    bar.innerHTML = `<span>Drag anything to move it</span>
      <button type="button" data-act="reset">Reset</button>
      <button type="button" data-act="done" class="is-primary">Done</button>`;
    bar.querySelector('[data-act="reset"]').addEventListener("click", () => this.reset());
    bar.querySelector('[data-act="done"]').addEventListener("click", () => this.close());
    document.body.appendChild(bar);
    this.bar = bar;
  }

  itemAt(target) {
    return this.items.find((it) => it.el === target || it.el.contains(target)) || null;
  }

  pointerDown(e) {
    if (this.bar && this.bar.contains(e.target)) return;
    e.stopPropagation();
    // Hidden or zero-size pieces can still be picked by position.
    let it = this.itemAt(e.target);
    if (!it) {
      it = this.items.find((c) => {
        const r = c.el.getBoundingClientRect();
        return r.width && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      }) || null;
    }
    if (!it) return;
    const { w, h } = this.size();
    const o = this.offsets[it.id] || [0, 0];
    this.drag = { it, x0: e.clientX, y0: e.clientY, ox: o[0] * w, oy: o[1] * h, rect: it.el.getBoundingClientRect() };
    it.el.classList.add("is-dragging");
  }

  pointerMove(e) {
    const d = this.drag;
    if (!d) return;
    e.stopPropagation();
    const s = this.stage.getBoundingClientRect();
    // Keep the whole piece on screen.
    let dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    dx = Math.max(s.left - d.rect.left, Math.min(s.right - d.rect.right, dx));
    dy = Math.max(s.top - d.rect.top, Math.min(s.bottom - d.rect.bottom, dy));
    const { w, h } = this.size();
    this.offsets[d.it.id] = [(d.ox + dx) / w, (d.oy + dy) / h];
    d.it.el.style.translate = `${Math.round(d.ox + dx)}px ${Math.round(d.oy + dy)}px`;
  }

  pointerUp() {
    if (!this.drag) return;
    this.drag.it.el.classList.remove("is-dragging");
    this.drag = null;
    store(this.touch, this.offsets);
  }
}
