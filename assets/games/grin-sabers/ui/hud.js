// Grin Sabers — the in-match HUD: health and block points, round pips,
// the clock, the reticle on the opponent (red = where their swing comes
// from, white = where you aim), callouts and banners.

import * as THREE from "three";
import { zoneFor, zoneFromAim } from "../combat/swings.js?v=gs1";

const $ = (id) => document.getElementById(id);
const _p = new THREE.Vector3();

export class Hud {
  constructor() {
    this.root = $("gs-hud");
    this.el = {
      hpYou: $("gs-hp-you"), hpThem: $("gs-hp-them"), bpYou: $("gs-bp-you"), bpThem: $("gs-bp-them"),
      nameYou: $("gs-name-you"), nameThem: $("gs-name-them"), pipsYou: $("gs-pips-you"), pipsThem: $("gs-pips-them"),
      clock: $("gs-clock"), reticle: $("gs-reticle"), callout: $("gs-callout"), banner: $("gs-banner"),
      clashbar: $("gs-clashbar"), clashfill: $("gs-clashfill"),
    };
    this.wedges = Object.fromEntries([...this.el.reticle.querySelectorAll(".gs-wedge")].map((w) => [w.dataset.zone, w]));
    this.cache = {};
    this.bannerT = 0;
  }

  show(on) { this.root.hidden = !on; }

  setNames(you, them, colourYou, colourThem) {
    this.el.nameYou.textContent = you;
    this.el.nameThem.textContent = them;
    document.documentElement.style.setProperty("--gs-you", colourYou);
    document.documentElement.style.setProperty("--gs-them", colourThem);
  }

  setPips(you, them, need) {
    const draw = (el, n) => { el.innerHTML = Array.from({ length: need }, (_, i) => `<span class="${i < n ? "won" : ""}"></span>`).join(""); el.setAttribute("aria-label", `Rounds won: ${n} of ${need}`); };
    draw(this.el.pipsYou, you);
    draw(this.el.pipsThem, them);
  }

  set(key, el, prop, v) {
    if (this.cache[key] === v) return;
    this.cache[key] = v;
    el.style[prop] = v;
  }

  update(me, them, clock, camera, aim, dt) {
    const e = this.el;
    this.set("hpy", e.hpYou, "width", `${me.hp}%`);
    this.set("hpt", e.hpThem, "width", `${them.hp}%`);
    this.set("bpy", e.bpYou, "width", `${me.bp.toFixed(0)}%`);
    this.set("bpt", e.bpThem, "width", `${them.bp.toFixed(0)}%`);
    e.bpYou.parentElement.classList.toggle("low", me.bp < 25);
    e.bpThem.parentElement.classList.toggle("low", them.bp < 25);
    e.hpYou.parentElement.setAttribute("aria-valuenow", Math.round(me.hp));
    e.hpThem.parentElement.setAttribute("aria-valuenow", Math.round(them.hp));
    const c = String(Math.max(0, Math.ceil(clock)));
    if (this.cache.clock !== c) { this.cache.clock = c; e.clock.textContent = c; }

    // reticle on their chest
    _p.set(them.pos.x, them.pos.y + 1.3, them.pos.z).project(camera);
    const vis = _p.z < 1 && them.alive && me.alive;
    e.reticle.style.display = vis ? "" : "none";
    if (vis) {
      const x = (_p.x * 0.5 + 0.5) * innerWidth, y = (-_p.y * 0.5 + 0.5) * innerHeight;
      e.reticle.style.left = `${x.toFixed(1)}px`;
      e.reticle.style.top = `${y.toFixed(1)}px`;
    }
    const incoming = them.state === "swing" && them.swing.phase !== "recover" ? zoneFor(them.swing.dir) : null;
    const heavy = incoming && them.swing.heavy;
    const aimZone = zoneFromAim(aim.x, aim.y);
    for (const [z, w] of Object.entries(this.wedges)) {
      w.classList.toggle("incoming", z === incoming);
      w.classList.toggle("heavy", z === incoming && !!heavy);
      w.classList.toggle("guard", z === (me.state === "guard" ? me.guardZone : aimZone));
    }

    // clash bar
    const cl = me.clash;
    e.clashbar.hidden = !cl;
    if (cl) {
      const mine = cl.a === me ? cl.mashA : cl.mashB, theirs = cl.a === me ? cl.mashB : cl.mashA;
      const k = (mine + 1) / (mine + theirs + 2);
      e.clashfill.style.setProperty("--k", `${(k * 100).toFixed(0)}%`);
    }

    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) e.banner.classList.remove("on"); }
  }

  callout(text, colour = "#fff") {
    const el = this.el.callout;
    el.textContent = text;
    el.style.color = colour;
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
  }

  banner(text, sub = "", sec = 1.6) {
    const el = this.el.banner;
    el.innerHTML = sub ? `${text}<small>${sub}</small>` : text;
    el.classList.add("on");
    this.bannerT = sec;
  }
}
