// Troll Forces Zombies: health bars in the world, as in Zombie Rush. A bar
// over each zombie once it's been hurt (the nearest MAX_ZOMBIE_BARS), and
// over your deployables: a turret always carries its "Lvl. N" tag, and a
// bar shows on anything of yours that's taken a hit. DOM, not sprites:
// pooled divs in a layer under the rest of the zombies HUD (#to-zh),
// placed by projecting a point over each head through the game camera.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";

const MAX_ZOMBIE_BARS = 14;
const ZOMBIE_BAR_RANGE = 40;   // metres
const DEPLOY_BAR_SHOW = 4;     // seconds a deployable's bar stays up after a hit

let layer = null;
const zPool = [];
const dPool = [];
const _p = new THREE.Vector3();

function ensureLayer() {
  if (layer && layer.isConnected) return layer;
  const root = document.getElementById("to-zh");
  if (!root) return null;
  layer = document.createElement("div");
  layer.className = "zh-bars";
  layer.setAttribute("aria-hidden", "true");
  root.prepend(layer);
  return layer;
}

function bar(pool, i, cls, withTag) {
  let b = pool[i];
  if (!b) {
    const el = document.createElement("div");
    el.className = `zh-wbar ${cls}`;
    el.innerHTML = `${withTag ? '<span class="zh-wtag"></span>' : ""}<div class="zh-wbar-track"><i></i></div>`;
    layer.append(el);
    b = pool[i] = { el, fill: el.querySelector("i"), tag: el.querySelector(".zh-wtag"), track: el.querySelector(".zh-wbar-track"), shown: false, k: -1, text: "" };
  }
  return b;
}

/* World point -> screen px, or null when it's behind the camera / off screen. */
function project(x, y, z) {
  _p.set(x, y, z).project(game.camera);
  if (_p.z > 1 || _p.x < -1.1 || _p.x > 1.1 || _p.y < -1.1 || _p.y > 1.1) return null;
  return { x: (_p.x * 0.5 + 0.5) * window.innerWidth, y: (-_p.y * 0.5 + 0.5) * window.innerHeight };
}

function place(b, at, k, track = true) {
  if (!at) { if (b.shown) { b.el.style.display = "none"; b.shown = false; } return; }
  if (!b.shown) { b.el.style.display = ""; b.shown = true; }
  b.el.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) translate(-50%, -100%)`;
  const kk = Math.round(k * 100) / 100;
  if (kk !== b.k) { b.k = kk; b.fill.style.transform = `scaleX(${Math.max(0, kk)})`; }
  if (b.track) b.track.style.visibility = track ? "" : "hidden";
}

function hideFrom(pool, n) {
  for (let i = n; i < pool.length; i++) if (pool[i].shown) { pool[i].el.style.display = "none"; pool[i].shown = false; }
}

export function updateZombieBars(zombies, deployables) {
  if (!ensureLayer()) return;
  const eye = game.camera.position;

  // zombies: hurt, alive, in range; the nearest few
  const hurt = [];
  for (const z of zombies) {
    if (!z.alive || z.dying || z.riseT > 0 || z.hp >= z.maxHp) continue;
    const p = z.mesh.position;
    const d = Math.hypot(p.x - eye.x, p.z - eye.z);
    if (d < ZOMBIE_BAR_RANGE) hurt.push({ z, d });
  }
  hurt.sort((a, b) => a.d - b.d);
  const nz = Math.min(MAX_ZOMBIE_BARS, hurt.length);
  for (let i = 0; i < nz; i++) {
    const { z } = hurt[i];
    const p = z.mesh.position;
    place(bar(zPool, i, "is-zombie", false), project(p.x, z.groundY + (z.type.height || 1.8) + 0.32, p.z), z.hp / z.maxHp);
  }
  hideFrom(zPool, nz);

  // deployables: a turret's level tag always, a bar after a hit
  let nd = 0;
  for (const e of deployables) {
    if (!e.alive) continue;
    const showBar = e.hp < e.maxHp && e.hurtT < DEPLOY_BAR_SHOW;
    const tag = e.kind === "turret" ? `Lvl. ${e.level}` : "";
    if (!showBar && !tag) continue;
    const b = bar(dPool, nd++, "is-deploy", true);
    if (b.text !== tag) { b.text = tag; b.tag.textContent = tag; b.tag.style.display = tag ? "" : "none"; }
    place(b, project(e.pos.x, e.top, e.pos.z), e.hp / e.maxHp, showBar);
  }
  hideFrom(dPool, nd);
}
