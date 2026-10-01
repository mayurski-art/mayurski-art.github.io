// Troll Forces — controller layout card for the Settings / Esc menu.
//
// The controller bindings used to be a text list mixing PlayStation and
// Xbox names (L1 next to A), with nothing to look at (user: "no visuals on
// controller settings for controller devices"). This draws the pad as a
// blueprint: a line drawing of the user's own Voyee controller (a Switch
// Pro-style pad: left stick high, D-pad low, face buttons high, right stick
// low, the - + T O Home cluster between them), every binding called out
// beside the button it lives on in the connected pad's own names (Xbox
// A/B/X/Y, PlayStation shapes, Switch letters), and each button lights up
// while it's held.
//
// Bindings follow the W3C "standard" gamepad mapping pollGamepad in
// game.js reads (button index = position on the pad, not the letter).
// Emotes are both sticks clicked together (user; the Voyee's T is a
// hardware turbo the browser never hears); one stick alone is the swivel.
// A single emote button can be set here instead (padEmoteButton).

const NS = "http://www.w3.org/2000/svg";
const EMOTE_KEY = "trollops:padEmote";

/* The emote button's index, or -1 for the default: L3 + R3 together
   (game.js reads that chord itself). */
export function padEmoteButton() {
  try {
    const v = localStorage.getItem(EMOTE_KEY);
    return v == null ? -1 : (Number.isFinite(+v) ? +v : -1);
  } catch { return -1; }
}
function setPadEmoteButton(i) {
  try { localStorage.setItem(EMOTE_KEY, String(i)); } catch { /* private mode */ }
}
/* Did the emote button go down this frame? `edge(i)` = pressed now, not before. */
export function padEmotePressed(gp, edge) {
  const b = padEmoteButton();
  return b >= 0 && edge(b);
}

/* What each standard-mapping button does in a match. Keep in step with
   pollGamepad / pollGamepadMenu in game.js. `EMOTE` stands in for the
   rebindable emote button. */
const EMOTE = "emote";
const BINDINGS = [
  { i: 7,  side: "R", action: "Fire" },
  { i: 5,  side: "R", action: "Throwable (hold to cook)" },
  { i: 3,  side: "R", action: "Switch weapon" },
  { i: 1,  side: "R", action: "Crouch · slide" },
  { i: 0,  side: "R", action: "Jump · vault" },
  { i: 2,  side: "R", action: "Quick melee" },
  { i: 9,  side: "R", action: "Menu" },
  { i: 11, side: "R", action: "Look · click: swivel right", stick: "R" },
  { i: 6,  side: "L", action: "Aim down sights" },
  { i: 4,  side: "L", action: "Reload" },
  { i: 10, side: "L", action: "Move · click: swivel left", stick: "L" },
  { i: 8,  side: "L", action: "Third person" },
  { i: EMOTE, side: "L", action: "Emote wheel" },
  { i: 12, side: "L", action: "Inspect weapon" },
  { i: 14, side: "L", action: "Throwable" },
  { i: 15, side: "L", action: "Use streak · hold: pick up / end streak" },
  { i: 13, side: "L", action: "Next scorestreak" },
];

/* Button names per pad family, by standard-mapping index. */
const DPAD = { 12: "D-pad up", 13: "D-pad down", 14: "D-pad left", 15: "D-pad right" };
const GLYPHS = {
  xbox: { 0: "A", 1: "B", 2: "X", 3: "Y", 4: "LB", 5: "RB", 6: "LT", 7: "RT", 8: "View", 9: "Menu", 10: "LS", 11: "RS", 16: "Home", 17: "Share", ...DPAD },
  ps: { 0: "✕", 1: "○", 2: "□", 3: "△", 4: "L1", 5: "R1", 6: "L2", 7: "R2", 8: "Create", 9: "Options", 10: "L3", 11: "R3", 16: "PS", 17: "Pad", ...DPAD },
  // Nintendo swaps the letters, not the positions: the bottom button is B.
  switch: { 0: "B", 1: "A", 2: "Y", 3: "X", 4: "L", 5: "R", 6: "ZL", 7: "ZR", 8: "−", 9: "+", 10: "LS", 11: "RS", 16: "Home", 17: "O", ...DPAD },
};
const FAMILY_NAMES = { xbox: "Xbox controller", ps: "PlayStation controller", switch: "Switch / Voyee controller" };

export function padFamily(gp) {
  const id = String(gp?.id || "").toLowerCase();
  if (/054c|playstation|dualsense|dualshock|wireless controller/.test(id)) return "ps";
  if (/057e|nintendo|pro controller|joy-con|voyee|switch/.test(id)) return "switch";
  return "xbox";   // XInput and most generic pads use Xbox names
}

function firstPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  return Array.from(pads).find((p) => p && p.connected) || null;
}

function el(tag, attrs = {}, parent = null) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

/* The drawing lives in its own 640 x 330 space, shifted right by PAD_X in
   an 860-wide view: a label column either side of it. */
const VIEW_W = 860, PAD_X = 110;
/* Where each control sits on the blueprint (Voyee / Switch Pro layout). */
const SPOTS = {
  0: [424, 170], 1: [450, 144], 2: [398, 144], 3: [424, 118],     // face: B A Y X
  4: [222, 66], 5: [418, 66], 6: [222, 40], 7: [418, 40],         // L R ZL ZR
  8: [288, 104], 9: [352, 104],                                    // - +
  10: [222, 142], 11: [372, 214],                                  // sticks
  12: [282, 192], 13: [282, 236], 14: [260, 214], 15: [304, 214],  // D-pad
  16: [320, 156], 17: [346, 128],                                  // Home, O
  T: [294, 128],
  chord: [297, 178],   // between the sticks: both clicked together
};

export class ControllerLayout {
  /* `host`: the element the card is built into. */
  constructor(host) {
    this.host = host;
    this.family = null;
    this.parts = new Map();   // button index (or "T") -> [svg nodes to light]
    this.labels = new Map();  // button index -> <text> glyph nodes
    this.rebinding = false;
    host.classList.add("to-pad-card");
    host.replaceChildren();

    const head = document.createElement("div");
    head.className = "to-pad-head";
    this.title = document.createElement("span");
    this.title.className = "to-pad-name";
    this.status = document.createElement("span");
    this.status.className = "to-pad-status";
    head.append(this.title, this.status);
    this.picker = document.createElement("div");
    this.picker.className = "to-pad-picker";
    this.picker.setAttribute("role", "group");
    this.picker.setAttribute("aria-label", "Button names");
    for (const f of ["switch", "xbox", "ps"]) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.family = f;
      b.textContent = f === "ps" ? "PlayStation" : f === "xbox" ? "Xbox" : "Switch";
      b.addEventListener("click", () => { this.manual = f; this.setFamily(f); });
      this.picker.appendChild(b);
    }
    head.appendChild(this.picker);
    host.appendChild(head);

    this.svg = el("svg", { viewBox: `0 0 ${VIEW_W} 330`, class: "to-pad-svg", role: "img" });
    host.appendChild(this.svg);
    this.build();

    // The emote button: which one, and a rebind that takes the next press.
    const bind = document.createElement("div");
    bind.className = "to-pad-bind";
    this.bindText = document.createElement("span");
    this.bindBtn = document.createElement("button");
    this.bindBtn.type = "button";
    this.bindBtn.className = "to-set-btn";
    this.bindBtn.textContent = "Set emote button";
    this.bindBtn.addEventListener("click", () => this.startRebind());
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "to-set-btn to-pad-reset";
    reset.textContent = "Use both sticks";
    reset.addEventListener("click", () => { setPadEmoteButton(-1); this.rebinding = false; this.paintBind(); });
    bind.append(this.bindText, this.bindBtn, reset);
    host.appendChild(bind);

    this.list = document.createElement("div");
    this.list.className = "to-key-list to-pad-list";
    host.appendChild(this.list);

    this.manual = null;
    this.setFamily(padFamily(firstPad()));
    this.paintBind();
    // Narrow (the lobby's side panel, a phone): the callout columns would be
    // too small to read, so show just the pad and the bindings as a list.
    const fit = () => {
      const narrow = host.clientWidth > 0 && host.clientWidth < 720;
      host.classList.toggle("is-narrow", narrow);
      this.svg.setAttribute("viewBox", narrow ? `${PAD_X + 100} 18 440 316` : `0 0 ${VIEW_W} 330`);
    };
    if (window.ResizeObserver) new ResizeObserver(fit).observe(host);
    fit();
    this.loop = this.loop.bind(this);
    this.prev = {};
    requestAnimationFrame(this.loop);
  }

  build() {
    const s = el("g", { transform: `translate(${PAD_X} 0)` }, this.svg);
    const light = (i, node) => {
      if (!this.parts.has(i)) this.parts.set(i, []);
      this.parts.get(i).push(node);
      return node;
    };
    // Blueprint sheet: a grid behind the drawing.
    const grid = el("g", { class: "pad-grid" }, s);
    for (let x = 100; x <= 540; x += 20) el("line", { x1: x, y1: 20, x2: x, y2: 320 }, grid);
    for (let y = 20; y <= 320; y += 20) el("line", { x1: 100, y1: y, x2: 540, y2: y }, grid);
    // Triggers and bumpers behind the shell.
    light(6, el("path", { d: "M186 52 Q190 30 222 28 Q254 30 258 52 Z", class: "pad-btn pad-trig" }, s));
    light(7, el("path", { d: "M382 52 Q386 30 418 28 Q450 30 454 52 Z", class: "pad-btn pad-trig" }, s));
    light(4, el("path", { d: "M170 78 Q176 58 222 56 Q262 58 270 72 L270 80 Z", class: "pad-btn" }, s));
    light(5, el("path", { d: "M370 72 Q378 58 418 56 Q464 58 470 78 L370 80 Z", class: "pad-btn" }, s));
    // The shell: a Pro-style body, the centre plate raised as a V between the
    // sticks, long grips, the Voyee's coloured grip bands drawn as panel lines.
    el("path", {
      class: "pad-shell",
      d: "M210 76 C250 68 390 68 430 76 C476 84 500 104 510 140 C522 186 540 250 530 286 C522 312 490 318 470 298 C452 280 440 254 420 246 L220 246 C200 254 188 280 170 298 C150 318 118 312 110 286 C100 250 118 186 130 140 C140 104 164 84 210 76 Z",
    }, s);
    el("path", { class: "pad-panel", d: "M262 84 L378 84 L352 176 L288 176 Z" }, s);          // centre plate
    el("path", { class: "pad-panel", d: "M132 176 Q170 196 206 238 M508 176 Q470 196 434 238" }, s);   // grip bands
    el("path", { class: "pad-panel", d: "M128 226 Q160 246 184 280 M512 226 Q480 246 456 280" }, s);
    // Dimension line along the bottom, like a drawing sheet.
    el("path", { class: "pad-dim", d: "M110 318 L530 318 M110 312 L110 324 M530 312 L530 324" }, s);
    el("text", { x: 320, y: 314, class: "pad-dimtext", "text-anchor": "middle" }, s).textContent = "VOYEE PRO · 152 mm";
    // Sticks: left high, right low.
    el("circle", { cx: 222, cy: 142, r: 28, class: "pad-well" }, s);
    this.stickL = light(10, el("circle", { cx: 222, cy: 142, r: 19, class: "pad-btn pad-stick" }, s));
    el("circle", { cx: 222, cy: 142, r: 12, class: "pad-knurl" }, s);
    el("circle", { cx: 372, cy: 214, r: 28, class: "pad-well" }, s);
    this.stickR = light(11, el("circle", { cx: 372, cy: 214, r: 19, class: "pad-btn pad-stick" }, s));
    el("circle", { cx: 372, cy: 214, r: 12, class: "pad-knurl" }, s);
    // D-pad, low left.
    el("rect", { x: 270, y: 202, width: 24, height: 24, class: "pad-dcore" }, s);
    for (const [i, x, y, w, h] of [[12, 272, 180, 20, 24], [13, 272, 224, 20, 24], [14, 248, 204, 24, 20], [15, 292, 204, 24, 20]]) {
      light(i, el("rect", { x, y, width: w, height: h, rx: 4, class: "pad-btn" }, s));
    }
    // Face buttons, high right.
    for (const i of [0, 1, 2, 3]) {
      const [x, y] = SPOTS[i];
      light(i, el("circle", { cx: x, cy: y, r: 13, class: "pad-btn pad-face" }, s));
      this.labels.set(i, el("text", { x, y: y + 4.5, class: "pad-glyph", "text-anchor": "middle" }, s));
    }
    // The centre cluster: - + up top, T and O below, Home in the V.
    for (const i of [8, 9, 17, "T", 16]) {
      const [x, y] = SPOTS[i];
      light(i, el("circle", { cx: x, cy: y, r: i === 16 ? 10 : 8, class: "pad-btn pad-small" }, s));
      const t = el("text", { x, y: y + 3.5, class: `pad-glyph pad-glyph-sm${i === 16 ? " pad-glyph-xs" : ""}`, "text-anchor": "middle" }, s);
      if (i === "T") t.textContent = "T";
      else this.labels.set(i, t);
    }
    // LED strip.
    el("rect", { x: 300, y: 252, width: 40, height: 9, rx: 4.5, class: "pad-dcore" }, s);
    for (let k = 0; k < 4; k++) el("circle", { cx: 307 + k * 8.7, cy: 256.5, r: 1.8, class: "pad-led" }, s);
    // Names on the shoulders, so the drawing alone reads.
    for (const [i, x, y] of [[6, 222, 46], [7, 418, 46], [4, 222, 73], [5, 418, 73]]) {
      this.labels.set(i, el("text", { x, y, class: "pad-glyph pad-glyph-sm", "text-anchor": "middle" }, s));
    }

    // Callouts: a column each side, a leader from the label to its button.
    this.callouts = new Map();
    const col = { L: [], R: [] };
    for (const b of BINDINGS) col[b.side].push(b);
    for (const side of ["L", "R"]) {
      const list = col[side];
      const top = 22, gap = (306 - top) / Math.max(1, list.length - 1);
      list.forEach((b, n) => {
        const y = top + n * gap;
        const tx = side === "L" ? 6 : VIEW_W - 6;
        const lx = side === "L" ? 214 : VIEW_W - 214;
        const spot = SPOTS[b.i === EMOTE ? (padEmoteButton() >= 0 ? padEmoteButton() : "chord") : b.i] || SPOTS.chord;
        const bx = spot[0] + PAD_X, by = spot[1];
        const g = el("g", { class: "pad-callout" }, this.svg);
        el("polyline", { points: `${lx},${y} ${side === "L" ? lx + 14 : lx - 14},${y} ${bx},${by}`, class: "pad-lead" }, g);
        const t = el("text", { x: tx, y: y + 4, class: "pad-call", "text-anchor": side === "L" ? "start" : "end" }, g);
        const glyph = el("tspan", { class: "pad-call-key" }, t);
        const act = el("tspan", {}, t);
        act.textContent = " " + b.action;
        this.callouts.set(b.i, { g, glyph, act, side });
        if (b.i !== EMOTE) light(b.i, g);
        else this.emoteCallout = g;
      });
    }
  }

  refreshFamily() {
    if (this.manual) return;
    this.setFamily(padFamily(firstPad()));
  }

  /* Name of the emote button in the current family. */
  emoteName() {
    const b = padEmoteButton();
    const g = GLYPHS[this.family];
    return b < 0 ? `${g[10]} + ${g[11]}` : g[b] || `Button ${b}`;
  }

  setFamily(f) {
    this.family = f;
    const names = GLYPHS[f];
    const pad = firstPad();
    this.title.textContent = FAMILY_NAMES[f];
    this.status.textContent = pad ? (padFamily(pad) === f ? "Connected — press a button" : "Connected") : "No controller connected";
    this.status.classList.toggle("is-live", !!pad);
    for (const b of this.picker.children) b.setAttribute("aria-pressed", String(b.dataset.family === f));
    const nameOf = (i) => (i === EMOTE ? this.emoteName() : names[i]);
    this.svg.setAttribute("aria-label", `${FAMILY_NAMES[f]} layout: ` + BINDINGS.map((b) => `${nameOf(b.i)} ${b.action}`).join(", "));
    for (const [i, t] of this.labels) t.textContent = names[i] || "";
    for (const [i, c] of this.callouts) {
      c.glyph.textContent = i === 10 ? "L-stick" : i === 11 ? "R-stick" : nameOf(i);
    }
    // The same bindings as a plain list, for screen readers and small screens.
    this.list.replaceChildren();
    for (const b of BINDINGS) {
      const row = document.createElement("div");
      const k = document.createElement("kbd");
      k.textContent = b.stick ? `${b.stick}-stick` : nameOf(b.i);
      k.dataset.i = b.i;
      const span = document.createElement("span");
      span.textContent = b.action;
      row.append(k, span);
      this.list.appendChild(row);
    }
    this.paintBind?.();
  }

  paintBind() {
    if (!this.bindText) return;
    this.bindText.textContent = this.rebinding ? "Press the button you want for emotes…" : `Emotes: ${this.emoteName()}${padEmoteButton() < 0 ? " (click both sticks together)" : ""}`;
    this.bindBtn.disabled = this.rebinding;
    const c = this.callouts.get(EMOTE);
    if (c) c.glyph.textContent = this.emoteName();
    const k = this.list.querySelector(`kbd[data-i="${EMOTE}"]`);
    if (k) k.textContent = this.emoteName();
  }

  startRebind() {
    this.rebinding = true;
    this.prev = {};
    const gp = firstPad();
    if (gp) gp.buttons.forEach((b, i) => { this.prev[i] = b.pressed; });
    this.paintBind();
  }

  /* Light what's held; lean the sticks the way they're pushed; take the
     next press while rebinding. Only while the card is on screen. */
  loop() {
    requestAnimationFrame(this.loop);
    if (!this.host.isConnected || this.host.offsetParent === null) return;
    const gp = firstPad();
    const had = this.hadPad;
    this.hadPad = !!gp;
    if (had !== this.hadPad) {
      if (this.manual) this.setFamily(this.family);
      else this.refreshFamily();
    }
    if (this.rebinding && gp) {
      for (let i = 0; i < gp.buttons.length; i++) {
        const down = gp.buttons[i].pressed;
        if (down && !this.prev[i]) {
          setPadEmoteButton(i);
          this.rebinding = false;
          this.paintBind();
          break;
        }
        this.prev[i] = down;
      }
    }
    const emoteIdx = padEmoteButton();
    const emoteOn = !!gp && (emoteIdx >= 0 ? !!gp.buttons[emoteIdx]?.pressed : !!(gp.buttons[10]?.pressed && gp.buttons[11]?.pressed));
    this.emoteCallout?.classList.toggle("is-on", emoteOn);
    for (const [i, nodes] of this.parts) {
      if (i === "T") continue;
      let on = false;
      if (gp) {
        const b = gp.buttons[i];
        on = !!(b && (b.pressed || b.value > 0.15));
        if (i === 10 || i === 11) {
          const ax = gp.axes[i === 10 ? 0 : 2] || 0, ay = gp.axes[i === 10 ? 1 : 3] || 0;
          if (Math.hypot(ax, ay) > 0.2) on = true;
          const stick = i === 10 ? this.stickL : this.stickR;
          stick.setAttribute("transform", `translate(${(ax * 7).toFixed(1)} ${(ay * 7).toFixed(1)})`);
        }
      }
      for (const n of nodes) n.classList.toggle("is-on", on);
      const k = this.list.querySelector(`kbd[data-i="${i}"]`);
      if (k) k.classList.toggle("is-on", on);
    }
  }
}
