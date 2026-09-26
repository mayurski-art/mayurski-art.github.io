// Troll Forces — viewmodel animation debug lab (DESIGN-ARMS.md Phase 0).
//
// Dev-only readout + manual triggers for tuning the layered viewmodel
// animation system without playing a full match to reach each state. Gated
// behind ?tohooks=1 the same way window.__trollOps is, so normal play never
// builds or shows this.

export class AnimDebugLab {
  constructor() {
    this.enabled = false;
    this.el = null;
    this.rows = {};
    this.sourceFn = null;
  }

  /* `sourceFn` returns a plain {label: value} object each frame — kept as a
     single callback rather than wiring every field individually so game.js
     doesn't have to import/touch this module beyond one call per frame. */
  mount(sourceFn) {
    this.sourceFn = sourceFn;
    const el = document.createElement("div");
    el.id = "to-anim-debug";
    el.style.cssText = [
      "position:fixed", "top:8px", "right:8px", "z-index:9999",
      "font:11px/1.4 'DM Mono', ui-monospace, monospace",
      "background:rgba(10,10,12,0.82)", "color:#6dff4a",
      "padding:8px 10px", "border-radius:8px", "border:1px solid rgba(109,255,74,0.35)",
      "pointer-events:none", "white-space:pre", "max-width:280px",
    ].join(";");
    document.body.appendChild(el);
    this.el = el;
    this.enabled = true;
  }

  unmount() {
    this.el?.remove();
    this.el = null;
    this.enabled = false;
  }

  toggle() {
    if (this.enabled) this.unmount();
    else this.mount(this.sourceFn);
  }

  /* Call once per frame from animate() while gameState === "playing". */
  update() {
    if (!this.enabled || !this.el || !this.sourceFn) return;
    const data = this.sourceFn();
    let out = "";
    for (const k in data) out += `${k}: ${data[k]}\n`;
    this.el.textContent = out;
  }
}
