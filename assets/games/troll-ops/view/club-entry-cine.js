/* Trolling Loud's door: the kick-out, filmed (CLUB-ENTRY.md phase 3).
   modes/club-entry.js runs it (the bouncers, our body, the clock); this
   owns the camera and the overlay. Letterboxed like the match intro, four
   shots on the cinematic's clock:

     nah    over your shoulder, pushing in on your bouncer shaking his head.
     carry  side on, dollying with the three of you across the alley, your
            legs kicking.
     toss   low by the curb under the scaffold: the swing, the throw, slow
            on the landing. The trollface art stamps in (the artwork, never
            the emoji).
     curb   first person, sat on the curb looking back at the door, as the
            bars open and the bouncers walk back to their posts.

   Never skippable (user, 2026-10-08). */

import * as THREE from "three";
import { club, KICK, kickBody, CURB_EYE } from "../modes/club-entry.js?v=ce1c1c2-wb1m1uc4-tc3-cup1";
import { game } from "../core/state.js?v=st1";

const STAMP = new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
const smooth = (x) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };

export const clubCineOn = () => !!(club.live && club.kick);

const _up = new THREE.Vector3(0, 1, 0), _fwd = new THREE.Vector3(0, 0, -1);
const _cam = new THREE.Vector3(), _at = new THREE.Vector3(), _d = new THREE.Vector3(), _r = new THREE.Vector3(), _e = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _eu = new THREE.Euler(0, 0, 0, "YXZ");
const _b = { x: 0, y: 0, z: 0, yaw: 0, lie: 0 };
function aim(camera, pos, at, roll = 0) {
  camera.position.copy(pos);
  _m.lookAt(pos, at, _up);
  camera.quaternion.setFromRotationMatrix(_m);
  if (roll) camera.quaternion.multiply(_q.setFromAxisAngle(_fwd, roll));
}

/* Each frame while it plays (view/player-update.js, in place of the usual
   camera). Returns whether our own body is in the shot. */
export function placeClubCine(camera) {
  const K = club.kick, tc = K.tc;
  ui.show(tc);
  // The side the camera films from: away from the line (it's to the west).
  const cs = K.B0.x < 0 ? 1 : -1;
  if (tc < KICK.grab) {
    // nah: over your shoulder onto his face, pushing in.
    const n = club.lanes[K.li]?.b;
    _e.set(K.B0.x, 1.6, K.B0.z);
    if (n) n.rig.parts.head.getWorldPosition(_at); else _at.set(K.B0.x, 1.7, K.B0.z - 1);
    _d.set(_e.x - _at.x, 0, _e.z - _at.z).normalize();
    _r.set(-_d.z, 0, _d.x);
    if (_r.x * cs < 0) _r.negate();   // over the shoulder away from the line
    const k = smooth(tc / KICK.grab);
    _cam.copy(_e).addScaledVector(_d, 1.25 - 0.3 * k).addScaledVector(_r, 0.85 - 0.08 * k);
    _cam.y += 0.16 - 0.04 * k;
    _at.y -= 0.04;
    aim(camera, _cam, _at);
    camera.zoom = 1.55;   // a long lens (game.js keeps the fov; zoom is ours)
    return false;         // our own head out of the way: his face fills it
  }
  if (tc < KICK.swing) {
    // carry: head on, out in the alley ahead of the three of you, backing
    // off as they come (the trollface heads only read from the front).
    const b = kickBody(K, tc, _b);
    _at.set(b.x, b.y + 0.95, b.z);
    _cam.set(b.x + cs * 0.7, 1.45, b.z + 2.9);
    aim(camera, _cam, _at);
    camera.zoom = 1.15;
    return true;
  }
  if (tc < KICK.cut) {
    // toss: from under the scaffold, the club behind them: thrown at the
    // lens, over onto your back at its feet; a slow drift down.
    const P1 = K.P1;
    const k = smooth((tc - KICK.swing) / (KICK.land - KICK.swing));
    const dr = (tc - KICK.swing) * 0.08;
    _cam.set(P1.x - cs * (0.7 + dr), 1.7 - dr, P1.z + 4.2);
    _at.set(P1.x, 1.2 - 0.45 * k, P1.z + 0.3 + 0.8 * k);
    aim(camera, _cam, _at, 0.04 * -cs);
    camera.zoom = 1.3;
    return true;
  }
  camera.zoom = 1;
  // curb: first person, sat where you came round, the door ahead.
  const P1 = K.P1;
  const k = (tc - KICK.cut) / (KICK.end - KICK.cut);
  camera.position.set(P1.x, CURB_EYE, P1.z + 1.1);
  _eu.set(0.06 + Math.sin(tc * 2.1) * 0.015 * (1 - k), Math.sin(tc * 1.4) * 0.03 * (1 - k), Math.sin(tc * 1.7) * 0.03 * (1 - k));
  camera.quaternion.setFromEuler(_eu);
  return false;
}

/* --------------------------------------------------------------- overlay */

const ui = {
  el: null, cap: null, stamp: null, shot: "",
  mount() {
    if (this.el) return;
    injectCss();
    this.el = document.createElement("div");
    this.el.className = "club-cine";
    this.el.setAttribute("aria-live", "polite");
    this.el.innerHTML = `
      <div class="club-cine-bar club-cine-bar-t" aria-hidden="true"></div>
      <div class="club-cine-bar club-cine-bar-b" aria-hidden="true"></div>
      <img class="club-cine-stamp" alt="" src="${STAMP}">
      <p class="club-cine-cap"></p>
      <div class="club-cine-blink" aria-hidden="true"></div>`;
    (game.els.hud || document.body).appendChild(this.el);
    this.cap = this.el.querySelector(".club-cine-cap");
    this.stamp = this.el.querySelector(".club-cine-stamp");
  },
  show(tc) {
    this.mount();
    document.body.classList.add("club-cine-on");
    this.el.hidden = false;
    // Bars in on the first frame, out over the last shot.
    this.el.classList.add("is-on");
    this.el.classList.toggle("is-opening", tc >= KICK.cut);
    const shot = tc < KICK.grab ? "nah" : tc < KICK.swing ? "carry" : tc < KICK.cut ? "toss" : "curb";
    if (shot !== this.shot) {
      this.el.dataset.shot = this.shot = shot;
      // The alley's dark and the bodies are ink: a lift on the grade so
      // they read against it (back to normal for the last, first-person shot).
      const cv = game.renderer?.domElement;
      if (cv) cv.style.filter = shot === "curb" ? "" : "brightness(1.35) contrast(1.06) saturate(1.1)";
      // A blink on each cut.
      const bl = this.el.querySelector(".club-cine-blink");
      bl.classList.remove("is-on"); void bl.offsetWidth; bl.classList.add("is-on");
    }
    const cap = tc > 0.35 && tc < KICK.grab - 0.1 ? "Nah."
      : tc > KICK.land - 0.04 && tc < KICK.cut ? "Come back when you're 18." : "";
    if (this.cap.textContent !== cap) {
      this.cap.textContent = cap;
      this.cap.classList.remove("is-on"); void this.cap.offsetWidth;
      if (cap) this.cap.classList.add("is-on");
    }
    this.stamp.classList.toggle("is-on", tc > KICK.land + 0.12 && tc < KICK.cut);
  },
  hide() {
    document.body.classList.remove("club-cine-on");
    if (game.camera && game.camera.zoom !== 1) { game.camera.zoom = 1; game.camera.updateProjectionMatrix(); }
    const cv = game.renderer?.domElement;
    if (cv?.style.filter) cv.style.filter = "";
    if (!this.el) return;
    this.el.hidden = true;
    this.el.classList.remove("is-on", "is-opening");
    this.stamp.classList.remove("is-on");
    this.cap.textContent = "";
    this.shot = "";
  },
};
club.cineHide = () => ui.hide();

function injectCss() {
  if (document.getElementById("club-cine-css")) return;
  const s = document.createElement("style");
  s.id = "club-cine-css";
  s.textContent = `
.club-cine-on #to-hud > *:not(.club-cine) { visibility: hidden !important; }
.club-cine-on #to-hud::before { display: none; }
.club-cine-on #to-touch { visibility: hidden; }
.club-cine { position: absolute; inset: 0; pointer-events: none; z-index: 40; overflow: hidden; }
.club-cine-bar { position: absolute; left: 0; right: 0; height: 11.5%; background: #000; transition: transform .45s cubic-bezier(.3,.7,.2,1); }
.club-cine-bar-t { top: 0; transform: translateY(-100%); }
.club-cine-bar-b { bottom: 0; transform: translateY(100%); }
.club-cine.is-on .club-cine-bar { transform: translateY(0); }
.club-cine.is-on.is-opening .club-cine-bar-t { transform: translateY(-100%); }
.club-cine.is-on.is-opening .club-cine-bar-b { transform: translateY(100%); }
.club-cine-cap { position: absolute; left: 50%; bottom: 15%; margin: 0; transform: translateX(-50%); white-space: nowrap;
  font-size: clamp(22px, 3.6vw, 44px); font-weight: 800; letter-spacing: .01em; color: #fff; opacity: 0;
  text-shadow: 0 2px 0 #000, 0 0 22px rgba(255,63,180,.55); }
.club-cine-cap.is-on { animation: club-cine-cap .35s cubic-bezier(.2,.9,.3,1.2) forwards; }
@keyframes club-cine-cap { from { opacity: 0; transform: translate(-50%, 14px) scale(.96); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
.club-cine-stamp { position: absolute; right: 7%; top: 16%; width: min(21vw, 230px); opacity: 0; transform: rotate(-14deg) scale(2.4);
  filter: drop-shadow(0 6px 0 rgba(0,0,0,.6)) drop-shadow(0 0 18px rgba(255,63,180,.45)); }
.club-cine-stamp.is-on { animation: club-cine-stamp .32s cubic-bezier(.5,0,.6,1.4) forwards; }
@keyframes club-cine-stamp { 0% { opacity: 0; transform: rotate(-24deg) scale(2.6); } 70% { opacity: 1; transform: rotate(-11deg) scale(.92); } 100% { opacity: 1; transform: rotate(-12deg) scale(1); } }
.club-cine-blink { position: absolute; inset: 0; background: #000; opacity: 0; }
.club-cine-blink.is-on { animation: club-cine-blink .16s ease-out; }
@keyframes club-cine-blink { from { opacity: .85; } to { opacity: 0; } }
.club-cine[data-shot="toss"]::after { content: ""; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 55%, transparent 45%, rgba(0,0,0,.5)); }
@media (max-width: 760px) { .club-cine-cap { bottom: 14%; white-space: normal; text-align: center; width: 88vw; } .club-cine-stamp { width: 30vw; top: 15%; } }
`;
  document.head.appendChild(s);
}
