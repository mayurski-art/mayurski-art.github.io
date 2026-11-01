// Troll Forces Zombies: wall buys (design doc "Zombies economy", phase 2;
// claude.ai/artifact/CX7UuR3ybkeUvvNrbk9muS). Call of Duty's: you spawn
// with your melee and no gun, and the chalk outlines on the walls sell
// them. The Starter wall in the starting area sells your hub-kiosk gun
// (credits.js), free the first time. Hold X at a gun you already carry and
// it's ammo instead, for half the price. Two guns at once; a third takes the
// place of the one in your hands. The Frags wall sells grenades: none at
// the start, and it tops you up to four.
//
// Where they hang is maps/zombie-buys.js. The X hold is the swap button's
// (combat/weapons.js updateSwapButton reads match.zombieBuy). Buys are
// personal: nothing goes on the wire.

import * as THREE from "three";
import { game, match } from "../../core/state.js?v=st1";
import { WeaponState } from "../../weapons/weapons.js?v=p5bm-wst-hf1-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4";
import { buildWeaponMesh, stripLights } from "../../weapons/weapon-model.js?v=p5-em1-wst-hf1-wb1-ar1-ar2-fj1-br1-or1-rt1-ut1-rb4-hp1-bx1-mg1-sp1-lz1-ret1-ret2-mrg1-hd1-rt2-fd1-ars1-mrg3-p416-mt2-sk1-hb4-tn13";
import { resolveWeapon, defaultLoadoutFor } from "../../weapons/attachments.js?v=cg1-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4";
import { updateGearHud } from "../../combat/weapons.js?v=wp1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-ar0-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2-jx3-jx4-jx5-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h-tn12-tn13-rdf2-kbc3-zft1-pqs1";
import { spend } from "./economy.js?v=zr5-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-zd1-wb1-mt2-sk1-hb4-lu1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-nft2531-nft2531h-tn13-kbc3";
import { equippedGun, gunLevel, gunAtLevel, owns } from "./credits.js?v=zc1-zc2-zf1-wb1-mt2-hb4-gc1";
import { upgradeState, tieredDef } from "./upgrades.js?v=zr5-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-ar0-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h-tn13-rdf2-kbc3-zft1-pqs1";
import { SALE } from "./kits.js?v=zr6-zr9-zr10-zd1-wb1-tn13";
import { buildThrowable } from "../../combat/throwable-models.js?v=tm1-th2";
import { ZOMBIE_BUYS, WALL_PRICES, STARTER_PRICE, STARTER_AMMO, FRAG_PRICE, FRAG_MAX, ammoPrice } from "../../maps/zombie-buys.js?v=zx2-tn13";

const REACH = 1.7;        // metres out from the wall you can buy from
const FLOOR_GAP = 1.4;    // ...and how far above or below its floor
const SNAP = 3.5;         // how far along its facing a spot looks for the wall
const OFF_WALL = 0.03;    // the chalk sits this far proud of the wall
const CARD_W = 1.5, CARD_H = 0.85, CARD_Y = 1.45;   // the outline, its centre's height

const walls = [];
const st = { freeUsed: false, map: null, buys: 0 };   // buys: a count, for tests

/* ------------------------------------------------------------ the guns */

/* The def a wall sells: your kiosk level if you own the gun at the hub. */
function wallDef(gunId) {
  const base = resolveWeapon(gunId, defaultLoadoutFor(gunId));
  return owns(gunId) ? gunAtLevel(base, gunLevel(gunId)) : base;
}

const carried = (gunId) => !game.player.gunless && !!game.player.weapons[gunId];

/* What holding X here does, and its price. */
export function offerFor(w) {
  const o = listOffer(w);
  // Fire Sale (drops.js): half price; `was` is the full one, struck through
  if (SALE.mult < 1 && o.price > 0) { o.was = o.price; o.price = Math.round((o.price * SALE.mult) / 5) * 5; }
  return o;
}
function listOffer(w) {
  if (w.frags) return { kind: "frags", name: "Frags", price: FRAG_PRICE, full: (game.player.gear?.lethal | 0) >= FRAG_MAX };
  const gunId = w.gunId;
  if (carried(gunId)) {
    return { kind: "ammo", gunId, name: w.def.name, price: w.starter ? STARTER_AMMO : ammoPrice(gunId) };
  }
  if (w.starter && !st.freeUsed) return { kind: "gun", gunId, name: w.def.name, price: 0 };
  return { kind: "gun", gunId, name: w.def.name, price: w.starter ? STARTER_PRICE : WALL_PRICES[gunId] ?? STARTER_PRICE };
}

/* No gun in your hands until a wall gives you one: the kiosk gun stays as
   the primary's placeholder, empty, and the loadout's secondary goes. */
function goGunless() {
  const p = game.player;
  if (p.secondaryId && p.secondaryId !== p.weaponId) {
    delete p.weapons[p.secondaryId];
    delete upgradeState.base[p.secondaryId];
  }
  p.secondaryId = null;
  for (const w of Object.values(p.weapons)) { w.ammoInMag = 0; w.ammoReserve = 0; }
  p.gunless = true;
  game.currentWeaponSlot = "primary";
  game.setHolding("melee");
  updateGearHud();
}

/* `gunId` into your hands: the empty slot, else in place of the one you
   hold. At the run's gun tier (upgrades.js). */
function giveGun(gunId, base) {
  const p = game.player;
  const def = tieredDef(base, upgradeState.gunTier);
  const ws = new WeaponState(def);
  let slot;
  if (p.gunless) {
    if (p.weaponId !== gunId) { delete p.weapons[p.weaponId]; delete upgradeState.base[p.weaponId]; }
    p.weaponId = gunId;
    p.gunless = false;
    slot = "primary";
  } else if (!p.secondaryId) {
    p.secondaryId = gunId;
    slot = "secondary";
  } else {
    slot = game.currentWeaponSlot === "secondary" ? "secondary" : "primary";
    const old = slot === "secondary" ? p.secondaryId : p.weaponId;
    delete p.weapons[old];
    delete upgradeState.base[old];
    if (slot === "secondary") p.secondaryId = gunId; else p.weaponId = gunId;
  }
  upgradeState.base[gunId] = base;
  p.weapons[gunId] = ws;
  game.currentWeaponSlot = slot;
  game.setActiveWeaponMesh(def);
  if (p.holding !== "gun") game.setHolding("gun");
  else if (game.activeWeaponMesh) game.activeWeaponMesh.visible = true;
  updateGearHud();
}

/* A full mag and reserve for a gun you carry. */
export function refillGun(gunId) {
  const w = game.player.weapons[gunId];
  if (!w || game.player.gunless) return;
  w.ammoInMag = w.def.magSize;
  w.ammoReserve = w.def.reserveMax - w.def.magSize;
  updateGearHud();
}

/* Hold X done at wall `w`. True if it went through. */
export function buyAt(w) {
  if (!w || !game.player.alive || game.player.downed) return false;
  const o = offerFor(w);
  if (o.full) return false;
  if (o.price > 0 && !spend(o.price)) { game.audio.zombieBuy?.(false); return false; }
  if (o.kind === "frags") { game.player.gear.lethal = FRAG_MAX; updateGearHud(); }
  else if (o.kind === "ammo") refillGun(o.gunId);
  else {
    if (w.starter && !st.freeUsed) st.freeUsed = true;
    giveGun(o.gunId, wallDef(o.gunId));
  }
  st.buys++;
  game.audio.zombieBuy?.(true);
  game.audio.reload?.();
  return true;
}

/* -------------------------------------------------------------- the walls */

/* The nearest collider face straight behind (x, y, z) along -n, or null. */
function snapToWall(x, y, z, n) {
  const ox = x + n.x * SNAP / 2, oz = z + n.z * SNAP / 2;
  const dx = -n.x, dz = -n.z;
  let best = null;
  for (const c of game.colliders || []) {
    if (c.deploy || c.zdoor || y < c.min.y - 0.01 || y > c.max.y + 0.01) continue;
    let t0 = 0, t1 = SNAP * 1.5;
    let ok = true;
    for (const [o, d, lo, hi] of [[ox, dx, c.min.x, c.max.x], [oz, dz, c.min.z, c.max.z]]) {
      if (Math.abs(d) < 1e-6) { if (o < lo || o > hi) ok = false; continue; }
      let a = (lo - o) / d, b = (hi - o) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    if (ok && t0 <= t1 && t0 > 0.01 && (!best || t0 < best)) best = t0;
  }
  return best == null ? null : { x: ox + dx * best, z: oz + dz * best };
}

/* The chalk: a hand-drawn frame, the gun's name over it, the price under. */
function chalkTexture(w) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 290;
  const g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = "rgba(240,242,232,0.92)";
  g.fillStyle = "rgba(240,242,232,0.95)";
  g.lineCap = "round"; g.lineJoin = "round";
  // a seeded wobble, so each outline is drawn the same every run
  let s = 0;
  for (const ch of w.gunId) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const line = (x0, y0, x1, y1) => {
    for (let pass = 0; pass < 2; pass++) {
      g.lineWidth = 5 - pass * 2;
      g.beginPath();
      g.moveTo(x0 + (rnd() - 0.5) * 4, y0 + (rnd() - 0.5) * 4);
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        g.lineTo(x0 + (x1 - x0) * k + (rnd() - 0.5) * 3, y0 + (y1 - y0) * k + (rnd() - 0.5) * 3);
      }
      g.stroke();
    }
  };
  const L = 34, T = 62, R = 478, B = 228;
  // a rub of chalk inside the frame, so a dark gun shows on a dark wall
  g.fillStyle = "rgba(240,242,232,0.14)";
  g.fillRect(L, T, R - L, B - T);
  g.fillStyle = "rgba(240,242,232,0.95)";
  line(L, T, R, T); line(R, T, R, B); line(R, B, L, B); line(L, B, L, T);
  g.textAlign = "center"; g.textBaseline = "middle";
  // Oswald: the HUD's own face (troll-ops.html loads it)
  g.font = "600 40px Oswald, 'Arial Narrow', sans-serif";
  g.fillText(w.def.name.toUpperCase(), 256, 32);
  g.font = "600 34px Oswald, 'Arial Narrow', sans-serif";
  if (w.frags) g.fillText(`${FRAG_PRICE}   ·   UP TO ${FRAG_MAX}`, 256, 262);
  else {
    const price = w.starter ? "FREE" : (WALL_PRICES[w.gunId] ?? STARTER_PRICE).toLocaleString();
    const ammo = w.starter ? STARTER_AMMO : ammoPrice(w.gunId);
    g.fillText(`${price}   ·   AMMO ${ammo.toLocaleString()}`, 256, 262);
  }
  // a little dust where the chalk was rubbed
  for (let i = 0; i < 260; i++) {
    g.globalAlpha = rnd() * 0.12;
    g.fillRect(L + rnd() * (R - L), T + rnd() * (B - T), 2, 2);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildWall(spot) {
  const starter = spot.gun === "starter", frags = spot.gun === "frags";
  const gunId = starter ? equippedGun() : spot.gun;
  const n = new THREE.Vector3(Math.sin(spot.face), 0, Math.cos(spot.face));
  const at = snapToWall(spot.x, spot.y + CARD_Y, spot.z, n);
  const pos = new THREE.Vector3(at ? at.x : spot.x, spot.y, at ? at.z : spot.z).addScaledVector(n, OFF_WALL);
  const def = frags ? { name: "Frags" } : wallDef(gunId);
  const w = { spot, starter, frags, gunId, def, pos, n, snapped: !!at, mesh: null };

  const g = new THREE.Group();
  g.position.copy(pos);
  g.rotation.y = spot.face;
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W, CARD_H),
    new THREE.MeshBasicMaterial({ map: chalkTexture(w), transparent: true, depthWrite: false }),
  );
  card.position.y = CARD_Y;
  card.renderOrder = 1;
  g.add(card);
  if (frags) {
    // three frags in a row, standing on the outline's floor, twice life size
    for (let i = -1; i <= 1; i++) {
      const f = buildThrowable("frag", { pin: true });
      f.scale.setScalar(2);
      f.position.set(i * 0.34, CARD_Y - 0.18, 0.07);
      f.rotation.y = 0.4 + i * 0.5;
      g.add(f);
    }
    g.userData.wallBuy = w;
    game.scene.add(g);
    w.mesh = g;
    return w;
  }
  // the gun itself, hung on two pegs inside the outline
  const gun = stripLights(buildWeaponMesh(w.def, { lod: 1 }));
  gun.traverse((o) => { if (o.userData.hand) o.visible = false; });   // no hands on a wall
  const box = new THREE.Box3().setFromObject(gun);
  const size = box.getSize(new THREE.Vector3());
  // a pistol hangs bigger than life, so it reads from across the room
  const k = Math.min(1.8, (CARD_W * 0.78) / Math.max(size.x, size.z, 0.01), (CARD_H * 0.6) / Math.max(size.y, 0.01));
  gun.scale.setScalar(k);
  const centre = box.getCenter(new THREE.Vector3()).multiplyScalar(k);
  const hang = new THREE.Group();
  // guns are built pointing down -z: turn the barrel along the wall
  hang.rotation.y = Math.PI / 2;
  gun.position.sub(centre);
  hang.add(gun);
  hang.position.set(0, CARD_Y - 0.02, 0.09);
  g.add(hang);
  g.userData.wallBuy = w;
  game.scene.add(g);
  w.mesh = g;
  return w;
}

/* The run starts: the map's walls go up and your hands are empty. */
export function startWallBuys() {
  clearWallBuys();
  st.freeUsed = false;
  const name = game.builtMap?.map?.name;
  st.map = name;
  // the Pentagrin's old decorative wall buys (maps/props.js) give way
  game.builtMap?.root?.traverse((o) => { if (o.userData.wallBuyProp) o.visible = false; });
  for (const spot of ZOMBIE_BUYS[name]?.walls || []) walls.push(buildWall(spot));
  // one X hold for walls and doors (doors.js puts its own on match.zombieDoors)
  match.zombieBuy = {
    near: () => nearWall() || match.zombieDoors?.near() || null,
    buy: (it) => (it.spot ? buyAt(it) : !!match.zombieDoors?.buy(it)),
    offer: (it) => (it.spot ? offerFor(it) : match.zombieDoors.offer(it)),
  };
  // frags only, and none till the Frags wall: whatever your class carries
  match.throwKind = "lethal";
  if (game.player.gear) game.player.gear.lethal = game.player.gear.tactical = 0;
  goGunless();
}

export function clearWallBuys() {
  for (const w of walls) {
    w.mesh.parent?.remove(w.mesh);
    w.mesh.traverse((o) => {
      if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
      if (o.material && !o.material.userData?.shared) { o.material.map?.dispose(); o.material.dispose?.(); }
    });
  }
  walls.length = 0;
  game.player && (game.player.gunless = false);
  match.zombieBuy = null;
  match.throwKind = null;
}

/* The wall you're standing at, facing it or not: in front of it, within
   REACH, on its floor. */
export function nearWall() {
  const p = game.player, feet = game.move?.pos;
  if (!feet || !p?.alive || p.downed) return null;
  let best = null, bestD = REACH;
  for (const w of walls) {
    if (Math.abs(feet.y - w.spot.y) > FLOOR_GAP) continue;
    const dx = feet.x - w.pos.x, dz = feet.z - w.pos.z;
    const out = dx * w.n.x + dz * w.n.z;           // in front of the wall
    const along = Math.abs(dx * w.n.z - dz * w.n.x);   // along it, from the outline's middle
    if (out < 0 || along > CARD_W) continue;
    const d = Math.hypot(dx, dz);
    if (d < bestD) { bestD = d; best = w; }
  }
  return best;
}

/* Tests (__trollOps.zrun().walls). */
export function wallBuysDebug() {
  return { walls, st, offerFor, buyAt, nearWall, refillGun };
}
