// Scavenger (perks.js): an enemy you kill drops an ammo pack where they
// fell. Walk over it for a magazine's worth of reserve for each gun you
// carry (the FHJ-18: two missiles) and one more of your throwable, as in BO2. Only you see your packs
// (they're yours to collect), they last 30 s, and a dozen at most are out.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { hasPerk, PERK_TUNE } from "../progression/perks.js?v=pk1-cl1-bp1-fj1-zc1-zc2-nf1-or1-sbolt1";

const PICKUP_R = 1.6;
const LIFE = 30;
const packs = [];
let geo = null, mats = null;

function buildPack() {
  if (!geo) {
    geo = { box: new THREE.BoxGeometry(0.42, 0.24, 0.3), band: new THREE.BoxGeometry(0.44, 0.06, 0.32) };
    mats = {
      box: new THREE.MeshStandardMaterial({ color: 0x4f5b36, roughness: 0.7, metalness: 0.1 }),
      band: new THREE.MeshStandardMaterial({ color: 0xe5b234, emissive: 0x6a4a08, emissiveIntensity: 0.6, roughness: 0.5 }),
    };
  }
  const g = new THREE.Group();
  const box = new THREE.Mesh(geo.box, mats.box);
  const band = new THREE.Mesh(geo.band, mats.band);
  band.position.y = 0.03;
  g.add(box, band);
  return g;
}

/* A kill of ours at `pos` (combat/scoring.js registerDeath). */
export function scavengerDrop(pos) {
  if (!hasPerk("scavenger") || !pos) return;
  while (packs.length >= PERK_TUNE.scavengerMax) removePack(0);
  const mesh = buildPack();
  mesh.position.set(pos.x, (pos.y || 0) + 0.2, pos.z);
  game.scene.add(mesh);
  packs.push({ mesh, t: 0, base: mesh.position.y });
}

function removePack(i) {
  game.scene.remove(packs[i].mesh);
  packs.splice(i, 1);
}

export function clearScavenger() {
  while (packs.length) removePack(0);
}

/* Every frame (view/player-update.js): spin, expire, collect. */
export function updateScavenger(dt) {
  if (!packs.length) return;
  if (game.gameState === "menu") { clearScavenger(); return; }
  const me = game.player.pos;
  for (let i = packs.length - 1; i >= 0; i--) {
    const p = packs[i];
    p.t += dt;
    p.mesh.rotation.y += dt * 1.6;
    p.mesh.position.y = p.base + Math.sin(p.t * 3) * 0.05;
    if (p.t > LIFE) { removePack(i); continue; }
    if (game.player.alive && Math.hypot(me.x - p.mesh.position.x, me.z - p.mesh.position.z) < PICKUP_R
        && Math.abs(me.y - p.mesh.position.y) < 2.4) {
      collect();
      removePack(i);
    }
  }
}

function collect() {
  for (const w of Object.values(game.player.weapons || {})) {
    const max = Math.max(0, w.def.reserveMax - w.def.magSize);
    // A magazine's worth, or what the gun says (the FHJ-18: two missiles).
    w.ammoReserve = Math.min(max, (w.ammoReserve || 0) + (w.def.scavenge ?? w.def.magSize));
  }
  const L = game.loadout, kind = L?.throwKind;
  if (kind && game.player.gear) game.player.gear[kind] = Math.min(L.carried(kind), (game.player.gear[kind] || 0) + 1);
  game.updateGearHud?.();
  game.audio?.reloadComplete?.();
  game.showWaveBanner?.("Scavenged", 900);
}
