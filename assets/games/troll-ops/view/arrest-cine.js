/* Troll City: the town's arrest, filmed (TROLL-CITY-RP2.md, phase 2b).
   modes/social-sheriff.js runs it (the sheriff NPC, our body, the clock);
   this owns the camera and the overlay. Letterboxed, on its own clock:

     walk   side on, wide: the sheriff walks up behind you.
     cuffs  close, from the side: your hands behind your back, his on your
            wrists, the click. His line comes up.
     black  a fade to black.
     cot    first person, flat on your back on the cot in a cell, looking
            at the ceiling as your eyes open; then you sit up and stand,
            facing the bars. Control back. */

import * as THREE from "three";
import { arrestCine, npcName, SHERIFF } from "../modes/social-sheriff.js?v=sh1";
import { cellsOf } from "../modes/social-jail.js?v=sj1-sh1";
import { raycastWorld } from "../ballistics.js?v=cg1-wst-hf1-fu1b7-wb1-ar1-ar2";
import { game } from "../core/state.js?v=st1";

const smooth = (x) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
export const arrestCineOn = () => !!arrestCine();

const _up = new THREE.Vector3(0, 1, 0);
const _cam = new THREE.Vector3(), _at = new THREE.Vector3(), _m = new THREE.Matrix4();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _eu = new THREE.Euler(0, 0, 0, "YXZ");
function aim(camera, pos, at) {
  camera.position.copy(pos);
  _m.lookAt(pos, at, _up);
  camera.quaternion.setFromRotationMatrix(_m);
}

/* The camera on a bearing round us (0 = straight behind, π/2 = side on,
   to the right when side is 1), pulled in short of anything in between. */
const _from = new THREE.Vector3(), _dir = new THREE.Vector3();
function shotAt(P, fx, fz, rx, rz, side, bearing, dist, h) {
  const bx = -fx * Math.cos(bearing) + side * rx * Math.sin(bearing);
  const bz = -fz * Math.cos(bearing) + side * rz * Math.sin(bearing);
  _from.set(P.x, P.y + h, P.z);
  _dir.set(bx, 0, bz).normalize();
  const d = Math.max(1.2, Math.min(dist, raycastWorld(game.colliders, _from, _dir, dist) - 0.25));
  _cam.set(P.x + bx * d, P.y + h, P.z + bz * d);
}
/* Right or left: whichever has more room for both shots. */
function clearSide(P, fx, fz, rx, rz) {
  const room = (side) => [[1.25, 4.6, 1.9], [0.75, 3.1, 1.75]].reduce((m, [bearing, dist, h]) => {
    _from.set(P.x, P.y + h, P.z);
    _dir.set(-fx * Math.cos(bearing) + side * rx * Math.sin(bearing), 0, -fz * Math.cos(bearing) + side * rz * Math.sin(bearing)).normalize();
    return Math.min(m, raycastWorld(game.colliders, _from, _dir, dist) / dist);
  }, 1);
  return room(-1) > room(1) + 0.05 ? -1 : 1;
}

/* Each frame while it plays (view/player-update.js). Returns whether our
   own body is in the shot. */
export function placeArrestCine(camera) {
  const C = arrestCine(), S = SHERIFF.cine, t = C.t;
  ui.show(t, C);
  const P = C.P;
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);   // our forward
  const rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);    // our right
  if (t < S.cut) {
    // Around us, from behind (the sheriff's side): a bearing off our back,
    // to whichever side has room (picked once), pulled in short of walls.
    if (C.side == null) C.side = clearSide(P, fx, fz, rx, rz);
    let bearing, dist, h, atBack, atY;
    if (t < S.walk) {
      // walk: wide, mostly side on, the sheriff coming up behind
      const k = smooth(t / S.walk);
      bearing = 1.25; dist = 4.6 - 0.6 * k; h = 1.9; atBack = 1.4 - 1.0 * k; atY = 1.35;
      camera.zoom = 1;
    } else {
      // cuffs: closer, three-quarters from behind: his face over your
      // shoulder, your hands behind your back. (The trollface heads are flat:
      // side on they're a sliver. The rigs stand ~2.3 m: far enough back to
      // keep both heads in.)
      const k = smooth((t - S.walk) / (S.fade - S.walk));
      bearing = 0.75; dist = 3.1 - 0.35 * k; h = 1.75 - 0.1 * k; atBack = 0.35; atY = 1.3;
      camera.zoom = 1.05;
    }
    shotAt(P, fx, fz, rx, rz, C.side, bearing, dist, h);
    _at.set(P.x - fx * atBack, P.y + atY, P.z - fz * atBack);
    aim(camera, _cam, _at);
    camera.updateProjectionMatrix();
    return true;
  }
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  // cot: first person on the cot, then up on your feet facing the bars
  const c = cellsOf()?.cells[C.cell ?? 0];
  if (!c) return false;
  const lie = { x: c.cot.x, y: c.cot.y + 0.28, z: c.cot.z + 0.75 };
  const stand = { x: c.x, y: c.y + 1.68, z: c.z };
  _q1.setFromEuler(_eu.set(1.25, Math.PI, 0.12));       // flat on the back, looking up, feet toward -z
  _q2.setFromEuler(_eu.set(0, c.yaw, 0));                // stood, facing the bars
  const k = smooth((t - S.wake) / (S.up - S.wake) * 0.6 + Math.max(0, t - S.up) / (S.end - S.up) * 0.4);
  camera.position.set(lie.x + (stand.x - lie.x) * k, lie.y + (stand.y - lie.y) * k, lie.z + (stand.z - lie.z) * k);
  camera.quaternion.slerpQuaternions(_q1, _q2, k);
  return false;
}

/* --------------------------------------------------------------- overlay */

const ui = {
  el: null, cap: null, black: null, said: "",
  mount() {
    if (this.el) return;
    injectCss();
    this.el = document.createElement("div");
    this.el.className = "arrest-cine";
    this.el.setAttribute("aria-live", "polite");
    this.el.innerHTML = `
      <div class="arrest-cine-bar arrest-cine-t" aria-hidden="true"></div>
      <div class="arrest-cine-bar arrest-cine-b" aria-hidden="true"></div>
      <div class="arrest-cine-black" aria-hidden="true"></div>
      <p class="arrest-cine-cap"></p>`;
    (game.els.hud || document.body).appendChild(this.el);
    this.cap = this.el.querySelector(".arrest-cine-cap");
    this.black = this.el.querySelector(".arrest-cine-black");
  },
  show(t, C) {
    this.mount();
    const S = SHERIFF.cine;
    document.body.classList.add("arrest-cine-on");
    this.el.hidden = false;
    this.el.classList.add("is-on");
    this.el.classList.toggle("is-opening", t >= S.up);
    // black: in over the fade, held, out as your eyes open (a blink or two)
    let b = 0;
    if (t >= S.fade && t < S.cut) b = smooth((t - S.fade) / (S.cut - S.fade));
    else if (t >= S.cut && t < S.wake) b = 1;
    else if (t >= S.wake) b = 1 - smooth((t - S.wake) / 0.45) + Math.max(0, Math.sin((t - S.wake - 0.5) * 9)) * 0.35 * (t - S.wake < 0.85 ? 1 : 0);
    this.black.style.opacity = String(Math.max(0, Math.min(1, b)));
    const who = npcName();
    const cap = t > S.walk + 0.15 && t < S.fade ? `${who}: "${C.why} That's a minute in the cells, partner."`
      : t > S.wake + 0.2 && t < S.end ? "Troll City jail." : "";
    if (cap !== this.said) {
      this.said = cap;
      this.cap.textContent = cap;
      this.cap.classList.remove("is-on"); void this.cap.offsetWidth;
      if (cap) this.cap.classList.add("is-on");
    }
  },
  hide() {
    document.body.classList.remove("arrest-cine-on");
    if (game.camera && game.camera.zoom !== 1) { game.camera.zoom = 1; game.camera.updateProjectionMatrix(); }
    if (!this.el) return;
    this.el.hidden = true;
    this.el.classList.remove("is-on", "is-opening");
    this.cap.textContent = "";
    this.said = "";
    this.black.style.opacity = "0";
  },
};
export function hideArrestCine() { if (ui.el && !ui.el.hidden) ui.hide(); }

function injectCss() {
  if (document.getElementById("arrest-cine-css")) return;
  const s = document.createElement("style");
  s.id = "arrest-cine-css";
  s.textContent = `
.arrest-cine-on #to-hud > *:not(.arrest-cine) { visibility: hidden !important; }
.arrest-cine-on #to-hud::before { display: none; }
.arrest-cine-on #to-touch { visibility: hidden; }
.arrest-cine { position: absolute; inset: 0; pointer-events: none; z-index: 40; overflow: hidden; }
.arrest-cine-bar { position: absolute; left: 0; right: 0; height: 11.5%; background: #000; transition: transform .45s cubic-bezier(.3,.7,.2,1); }
.arrest-cine-t { top: 0; transform: translateY(-100%); }
.arrest-cine-b { bottom: 0; transform: translateY(100%); }
.arrest-cine.is-on .arrest-cine-bar { transform: translateY(0); }
.arrest-cine.is-on.is-opening .arrest-cine-t { transform: translateY(-100%); }
.arrest-cine.is-on.is-opening .arrest-cine-b { transform: translateY(100%); }
.arrest-cine-black { position: absolute; inset: 0; background: #000; opacity: 0; }
.arrest-cine-cap { position: absolute; left: 50%; bottom: 14%; margin: 0; transform: translateX(-50%); width: min(880px, 88vw); text-align: center;
  font-size: clamp(18px, 2.6vw, 32px); font-weight: 800; color: #f4e8cf; opacity: 0;
  text-shadow: 0 2px 0 #000, 0 0 18px rgba(224,173,79,.55); }
.arrest-cine-cap.is-on { animation: arrest-cine-cap .35s cubic-bezier(.2,.9,.3,1.2) forwards; }
@keyframes arrest-cine-cap { from { opacity: 0; transform: translate(-50%, 12px) scale(.97); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
`;
  document.head.appendChild(s);
}
