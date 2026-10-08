// Troll Forces — the emote wheel.
//
// Press H (controller: click both sticks together) and a radial wheel opens. Hover a slice (the
// mouse, locked or not, or the right stick), then click / X (controller:
// Cross/A) plays it; H, Esc or Circle/B closes it. The stick's pick stays
// put when the stick springs back, so it's still there when you press.
// Touch: the slices are plain buttons. Also opens in the main menu on the
// operator (game.js's menuEmoteWheel).
//
// The emotes live in emotes.js. Each slice is tagged by kind: 1P (first
// person), 3P (third person) or DUO. Picking a duo emote arms it (game.js:
// walk up to a teammate and hold X to send it). Duo slices are greyed out
// where there's no teammate to share one with (setDuo), e.g. solo or FFA.

import { EMOTES } from "./emotes.js?v=hb4-em1-wst-soc1-ng1c2";

export { EMOTES };

// A little travel before a slice lights up, so a twitch on open doesn't pick.
const DEADZONE = 22;
const RADIUS = 166;   // px from the centre to each slice (16 of them)
const KIND_TAG = { fp: "1P", tp: "3P", duo: "DUO" };

export class EmoteWheel {
  constructor(parent, onPick) {
    this.onPick = onPick;
    this.isOpen = false;
    this.pick = -1;
    this.dx = 0;
    this.dy = 0;
    this.duoTarget = null;
    this.duoAllowed = false;

    this.el = document.createElement("div");
    this.el.className = "to-emote-wheel";
    this.el.hidden = true;
    this.el.setAttribute("role", "menu");
    this.el.setAttribute("aria-label", "Emotes");
    const n = EMOTES.length;
    this.slices = EMOTES.map((e, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `to-emote-slice is-${e.kind}`;
      b.dataset.slot = String(i);
      b.setAttribute("role", "menuitem");
      const a = (i / n) * Math.PI * 2;   // slot 0 at the top, clockwise
      b.style.left = `calc(50% + ${Math.sin(a) * RADIUS}px)`;
      b.style.top = `calc(50% - ${Math.cos(a) * RADIUS}px)`;
      const tag = document.createElement("i");
      tag.textContent = KIND_TAG[e.kind];
      const name = document.createElement("span");
      name.textContent = e.name;
      b.append(tag, name);
      b.addEventListener("click", () => {
        if (this.disabled(i)) return;
        this.pick = i;
        this.close();
      });
      // A free cursor hovers a slice the way the locked mouse points at one.
      b.addEventListener("mouseenter", () => {
        if (this.disabled(i)) return;
        this.pick = i;
        this.paint();
      });
      this.el.appendChild(b);
      return b;
    });
    this.hub = document.createElement("div");
    this.hub.className = "to-emote-hub";
    this.hub.innerHTML = "<b>Emote</b><span></span>";
    this.el.appendChild(this.hub);
    parent.appendChild(this.el);
    this.paintHub();
  }

  /* Whether duo emotes can be used here at all (a teammate to share one
     with), and the teammate in reach right now, if any (for the hub). */
  setDuo(allowed, nearName = null) {
    const next = nearName || null;
    if (!!allowed === this.duoAllowed && next === this.duoTarget) return;
    this.duoAllowed = !!allowed;
    this.duoTarget = next;
    if (this.pick >= 0 && this.disabled(this.pick)) this.pick = -1;
    this.paint();
    this.paintHub();
  }

  disabled(i) { return EMOTES[i]?.kind === "duo" && !this.duoAllowed; }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.pick = -1;
    this.dx = this.dy = 0;
    this.el.hidden = false;
    this.paint();
  }

  /* Look movement while open steers the pick instead of the camera. */
  move(dx, dy) {
    this.dx = Math.max(-160, Math.min(160, this.dx + dx));
    this.dy = Math.max(-160, Math.min(160, this.dy + dy));
    this.pickFromPointer();
  }

  /* A controller stick points straight at a slice (-1..1 each axis). Back
     in the middle it keeps what it last pointed at, so the pick survives
     the stick springing back before Cross/A is pressed. */
  aim(x, y) {
    if (Math.hypot(x, y) < 0.35) return;
    this.dx = x * 160;
    this.dy = y * 160;
    this.pickFromPointer();
  }

  pickFromPointer() {
    if (Math.hypot(this.dx, this.dy) < DEADZONE) { this.pick = -1; this.paint(); return; }
    const n = EMOTES.length;
    const a = Math.atan2(this.dx, -this.dy);   // 0 at the top, clockwise
    const i = ((Math.round(a / (Math.PI * 2 / n)) % n) + n) % n;
    this.pick = this.disabled(i) ? -1 : i;
    this.paint();
  }

  toggle(canOpen = true) {
    if (this.isOpen) this.close(true);
    else if (canOpen) this.open();
  }

  /* Closes and plays the picked emote, if any. `cancel` just closes. */
  close(cancel = false) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.hidden = true;
    if (!cancel && this.pick >= 0 && !this.disabled(this.pick)) this.onPick?.(this.pick, this.duoTarget);
  }

  paint() {
    this.slices.forEach((b, i) => {
      b.classList.toggle("is-picked", i === this.pick);
      const off = this.disabled(i);
      b.classList.toggle("is-disabled", off);
      b.setAttribute("aria-disabled", String(off));
    });
  }

  paintHub() {
    this.hub.querySelector("span").textContent = !this.duoAllowed
      ? "DUO needs a teammate"
      : this.duoTarget ? `DUO: ${this.duoTarget} is close` : "DUO: pick, then hold X by a teammate";
  }
}
