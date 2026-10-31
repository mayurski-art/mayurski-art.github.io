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

import { EMOTES } from "./emotes.js?v=hb4-em1-wst-soc1-ng1c2f1m1u-gt1-gt2-cw1-zr10-bf1-sr1-or1-nf2-em2-cf1-gs2-lh1-fg2-lp1-fg3-rc1-rc4-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-ht2-bx1-cg1-mg1-sp1-chg1-lu1-mb1-mb2-nft2531";

export { EMOTES };
import { mayEmoteToken, wornToken, username } from "./cosmetics.js?v=hb4-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-fj1-zr10-zc1-zc2-bf1-sr1-nf1-or1-nf2-nb1-em2-nb2-pc2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-sf1-mg1-sp1-pk1-mb1-mb2-bt1-nft33-nfh1-nfh5-nft2531";

// A little travel before a slice lights up, so a twitch on open doesn't pick.
const DEADZONE = 22;
const RADIUS = 166;   // px from the centre to each slice (one per emote)
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
    this.shown = EMOTES.map((_, i) => i);   // the slices on the wheel (layout)
    this.slices = EMOTES.map((e, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `to-emote-slice is-${e.kind}`;
      b.dataset.slot = String(i);
      b.setAttribute("role", "menuitem");
      const tag = document.createElement("i");
      tag.textContent = KIND_TAG[e.kind];
      const name = document.createElement("span");
      name.textContent = e.name;
      b.append(tag, name);
      // a picture of its prop, where it has one (emotes.js `icon`, our own markup)
      if (e.icon) tag.insertAdjacentHTML("afterend", e.icon);
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
    this.layout();
    this.paintHub();
  }

  /* Lay the slices round the wheel: every emote but a TROLLS token's own
     (emotes.js `token`), which only its wearer and the owner get (cosmetics.js
     mayEmoteToken). Checked on each open: the body or the account may have
     changed since. Slot 0 at the top, clockwise. */
  layout() {
    const worn = wornToken(), name = username();
    this.shown = EMOTES.map((_, i) => i).filter((i) => mayEmoteToken(EMOTES[i].token, worn, name));
    const n = this.shown.length;
    this.slices.forEach((b) => { b.hidden = true; });
    this.shown.forEach((i, k) => {
      const b = this.slices[i], a = (k / n) * Math.PI * 2;
      b.hidden = false;
      b.style.left = `calc(50% + ${Math.sin(a) * RADIUS}px)`;
      b.style.top = `calc(50% - ${Math.cos(a) * RADIUS}px)`;
    });
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

  disabled(i) { return (EMOTES[i]?.kind === "duo" && !this.duoAllowed) || !this.shown.includes(i); }

  open() {
    if (this.isOpen) return;
    this.layout();
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
    const n = this.shown.length;
    const a = Math.atan2(this.dx, -this.dy);   // 0 at the top, clockwise
    const i = this.shown[((Math.round(a / (Math.PI * 2 / n)) % n) + n) % n];
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
