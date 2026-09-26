// Troll Forces — the emote wheel.
//
// Hold H in a match: a radial wheel opens over the crosshair. With the mouse
// locked, the look movement steers a pointer round the wheel (the view holds
// still while it's open); letting go of H plays whichever slice it points at.
// Unlocked (touch, or a paused cursor) the slices are plain buttons. The
// emotes themselves are the dances in character.js — the same ones the
// lobby used to loop — so remote players can pose them from one index.

export const EMOTES = [
  { name: "Groove", dance: 0 },
  { name: "Floss", dance: 1 },
  { name: "Headbang", dance: 2 },
  { name: "Wave", dance: 3 },
];

// A little travel before a slice lights up, so a twitch on open doesn't pick.
const DEADZONE = 22;

export class EmoteWheel {
  constructor(parent, onPick) {
    this.onPick = onPick;
    this.isOpen = false;
    this.pick = -1;
    this.dx = 0;
    this.dy = 0;

    this.el = document.createElement("div");
    this.el.className = "to-emote-wheel";
    this.el.hidden = true;
    this.el.setAttribute("role", "menu");
    this.el.setAttribute("aria-label", "Emotes");
    this.slices = EMOTES.map((e, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "to-emote-slice";
      b.dataset.slot = String(i);
      b.setAttribute("role", "menuitem");
      b.textContent = e.name;
      b.addEventListener("click", () => { this.pick = i; this.close(); });
      this.el.appendChild(b);
      return b;
    });
    const hub = document.createElement("div");
    hub.className = "to-emote-hub";
    hub.innerHTML = "<b>Emote</b><span>release H</span>";
    this.el.appendChild(hub);
    parent.appendChild(this.el);
  }

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
    this.dx = Math.max(-120, Math.min(120, this.dx + dx));
    this.dy = Math.max(-120, Math.min(120, this.dy + dy));
    if (Math.hypot(this.dx, this.dy) < DEADZONE) { this.pick = -1; this.paint(); return; }
    // Slices sit top, right, bottom, left.
    const a = Math.atan2(this.dx, -this.dy);
    this.pick = ((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4;
    this.paint();
  }

  /* Closes and plays the picked emote, if any. `cancel` just closes. */
  close(cancel = false) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.hidden = true;
    if (!cancel && this.pick >= 0) this.onPick?.(this.pick);
  }

  paint() {
    this.slices.forEach((b, i) => b.classList.toggle("is-picked", i === this.pick));
  }
}
