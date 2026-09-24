// Troll Ops — the Problem 416, modelled to wear a skin.
//
// The generic builder in weapon-model.js makes every gun from boxes. A box
// can hold a flat colour, but banner art wrapped round one stretches across
// faces of every shape at once. So this rifle is built from panels: each
// part (upper and lower receiver, handguard, stock, grip, magazine) is its
// real side profile, extruded to its thickness with a small bevel. The two
// flat sides of every panel map to that part's own rectangle in the skin
// atlas (skins.js), at the part's true proportions, so artwork lands on it
// unstretched and reads the right way round from either side. The bevelled
// edges map to a trim swatch, which is what gives a skinned gun its
// "painted panel on anodised metal" look.
//
// The layout keeps every anchor the game relies on from the generic build
// — sight rail, aim point, muzzle, magazine reload transform, hand
// positions, attachment mounts — so it drops into the viewmodel, the
// third-person rig and remote players unchanged.

import * as THREE from "three";
import { buildGripHand, buildSupportHand } from "./hand-model.js";
import { OPTIC_BUILDERS, BARREL_BUILDERS, UNDER_BUILDERS, buildIronRear, buildIronFront, railSection } from "./attachment-models.js";
import { skinAtlasTexture, SKIN_ATLAS, skinDef } from "./skins.js";

/* Side profiles in weapon space, as [z, y] points (z forward is negative,
   y up), plus each part's thickness across x. The baker draws its panel
   art against the same outlines. */
function curve(p0, c, p2, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1]]);
  }
  return out;
}

export const PANELS_416 = {
  upper: {
    width: 0.05,
    pts: [[0.070, 0.004], [0.070, 0.031], [0.062, 0.035], [-0.198, 0.035], [-0.206, 0.027], [-0.206, 0.004]],
  },
  lower: {
    width: 0.047,
    pts: [[0.068, 0.004], [-0.140, 0.004], [-0.147, -0.008], [-0.119, -0.030], [-0.114, -0.062], [-0.042, -0.062],
      [-0.038, -0.034], [0.036, -0.034], [0.060, -0.028], [0.068, -0.016]],
  },
  handguard: {
    width: 0.056,
    pts: [[-0.198, 0.030], [-0.392, 0.030], [-0.403, 0.019], [-0.403, -0.015], [-0.392, -0.025], [-0.198, -0.025]],
  },
  stock: {
    width: 0.046,
    pts: [[0.098, 0.020], [0.232, 0.031], [0.254, 0.031], [0.260, 0.022], [0.260, -0.050], [0.250, -0.061],
      [0.206, -0.045], [0.132, -0.025], [0.098, -0.014]],
  },
  grip: {
    width: 0.034,
    pts: [[-0.004, -0.034], [0.034, -0.034], [0.051, -0.110], [0.047, -0.124], [0.032, -0.131], [0.016, -0.129],
      [0.004, -0.084], [-0.006, -0.048]],
  },
  mag: {
    width: 0.027,
    pts: [
      ...curve([-0.046, -0.058], [-0.052, -0.150], [-0.094, -0.230], 6),
      [-0.098, -0.242], [-0.158, -0.236],
      ...curve([-0.156, -0.224], [-0.118, -0.148], [-0.110, -0.058], 6),
    ],
  },
};

// Where the magazine hangs: its reload transform pivots here.
const MAG_POINT = new THREE.Vector3(0, -0.15, -0.1);

export function panelBounds(key) {
  const pts = PANELS_416[key].pts;
  let z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [z, y] of pts) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { z0, z1, y0, y1 };
}

const BEVEL = 0.0018;

/* One panel: its profile extruded across x, sides UV'd into the part's
   atlas region, bevels and edges into the trim swatch. */
function panelGeometry(key) {
  const { width, pts } = PANELS_416[key];
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width - BEVEL * 2, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL * 0.8,
    bevelSegments: 1, curveSegments: 4,
  });
  // Shape x -> weapon z, extrusion -> across x, centred.
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2 - BEVEL, 0, 0);
  const b = panelBounds(key);
  const side = SKIN_ATLAS.regions[key];
  const trim = SKIN_ATLAS.regions.trim;
  const pos = geo.attributes.position, nrm = geo.attributes.normal, uv = geo.attributes.uv;
  const W = SKIN_ATLAS.width, H = SKIN_ATLAS.height;
  const toUv = (r, s, t) => [
    (r.x + Math.max(0, Math.min(1, s)) * r.w) / W,
    1 - (r.y + (1 - Math.max(0, Math.min(1, t))) * r.h) / H,
  ];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), nx = nrm.getX(i);
    let s = (z - b.z0) / (b.z1 - b.z0);
    const t = (y - b.y0) / (b.y1 - b.y0);
    let u;
    if (Math.abs(nx) > 0.85) {
      // Art side. Seen from the left (-x, the side the first-person view
      // shows) the stock is to the right; seen from the right it's to the
      // left — flip so the art reads unmirrored from both.
      if (nx > 0) s = 1 - s;
      u = toUv(side, s, t);
    } else {
      // Edge: a strip of trim, laid along the part.
      u = toUv(trim, s, (x / width) + 0.5);
    }
    uv.setXY(i, u[0], u[1]);
  }
  uv.needsUpdate = true;
  return geo;
}

const GEO_CACHE = new Map();
function cachedPanel(key) {
  if (!GEO_CACHE.has(key)) {
    const geo = panelGeometry(key);
    // Shared by every Problem 416 in the game: never disposed with one gun.
    geo.userData.shared = true;
    GEO_CACHE.set(key, geo);
  }
  return GEO_CACHE.get(key);
}

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cyl(rt, rb, h, mat, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.rotation.x = Math.PI / 2;
  return m;
}

/* Materials. With a skin, every panel shares one atlas material and the
   hardware takes the skin's metal and accent colours; without one, the
   factory finish: a grey receiver and black furniture. */
function materials(skin, texture) {
  const pal = skin?.palette || {};
  const metal = new THREE.MeshStandardMaterial({ color: pal.metal ?? 0x2a2c28, roughness: 0.42, metalness: 0.7 });
  const accent = new THREE.MeshStandardMaterial({ color: pal.accent ?? 0x1c1d1b, roughness: 0.5, metalness: 0.5 });
  if (skin) {
    const panel = new THREE.MeshStandardMaterial({ map: texture || skinAtlasTexture(skin.id), roughness: 0.52, metalness: 0.18 });
    return { panel: () => panel, metal, accent };
  }
  const recv = new THREE.MeshStandardMaterial({ color: 0x4a4f48, roughness: 0.4, metalness: 0.7 });
  const furn = new THREE.MeshStandardMaterial({ color: 0x2a2c28, roughness: 0.55, metalness: 0.45 });
  return { panel: (key) => (key === "upper" || key === "lower" ? recv : furn), metal, accent };
}

/* `texture` overrides the baked atlas — the skin baker previews its canvas. */
export function build416(def, skinId, { texture = null } = {}) {
  const skin = skinDef(skinId, def.id);
  const M = materials(skin, texture);
  const group = new THREE.Group();

  const panel = (key) => {
    const m = new THREE.Mesh(cachedPanel(key), M.panel(key));
    m.userData.panel = key;
    return m;
  };
  for (const key of ["upper", "lower", "handguard", "stock", "grip"]) group.add(panel(key));

  // --- metalwork: buffer tube, barrel, gas block, flash hider
  const tubeM = cyl(0.013, 0.013, 0.05, M.metal, 14);
  tubeM.position.set(0, 0.012, 0.086);
  group.add(tubeM);
  const barrel = cyl(0.0105, 0.0105, 0.1, M.metal, 14);
  barrel.position.set(0, 0.006, -0.452);
  group.add(barrel);
  const hider = new THREE.Group();
  const hiderBody = cyl(0.0135, 0.0125, 0.036, M.accent, 8);
  hiderBody.position.set(0, 0.006, -0.52);
  hider.add(hiderBody);
  // Slots in the flash hider, so it reads as one.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const slot = box(0.003, 0.003, 0.022, M.metal);
    slot.position.set(Math.cos(a) * 0.0128, 0.006 + Math.sin(a) * 0.0128, -0.524);
    hider.add(slot);
  }
  group.add(hider);
  let muzzleZ = -0.538;

  // --- small hardware in the accent colour
  const charging = box(0.026, 0.007, 0.014, M.metal);
  charging.position.set(0, 0.033, 0.074);
  group.add(charging);
  const port = box(0.002, 0.014, 0.058, M.accent);
  port.position.set(0.0262, 0.019, -0.09);
  group.add(port);
  const assist = cyl(0.006, 0.006, 0.014, M.accent, 8);
  assist.rotation.set(0, 0, Math.PI / 2);
  assist.position.set(0.027, 0.024, 0.03);
  group.add(assist);
  const guard = box(0.012, 0.004, 0.076, M.accent);
  guard.position.set(0, -0.055, -0.004);
  group.add(guard);
  const trigger = box(0.006, 0.02, 0.007, M.accent);
  trigger.position.set(0, -0.044, -0.014);
  trigger.rotation.x = -0.25;
  group.add(trigger);
  const selector = cyl(0.005, 0.005, 0.004, M.accent, 8);
  selector.rotation.set(0, 0, Math.PI / 2);
  selector.position.set(-0.0245, -0.012, 0.03);
  group.add(selector);
  // Rubber butt pad.
  const butt = box(0.047, 0.09, 0.008, new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9, metalness: 0 }));
  butt.position.set(0, -0.015, 0.262);
  group.add(butt);

  // --- magazine, on its own pivot for the reload
  const magGroup = new THREE.Group();
  magGroup.position.copy(MAG_POINT);
  const magMesh = panel("mag");
  magMesh.position.copy(MAG_POINT).negate();
  magGroup.add(magMesh);
  group.add(magGroup);
  group.userData.magMesh = magGroup;
  group.userData.magazinePoint = MAG_POINT.clone();
  group.userData.magRestRotationX = 0;

  // --- hands: the trigger hand on the grip, the support hand along the
  // handguard, both placed as the generic build places them.
  const hand = buildGripHand(1);
  hand.userData.hand = true;
  hand.position.set(0, -0.086, 0.02);
  hand.rotation.x = 0.32;
  group.add(hand);
  const supportHandPos = new THREE.Vector3(0, 0.058, -0.3);
  const supportHand = buildSupportHand(1.5);
  supportHand.userData.hand = true;
  supportHand.position.copy(supportHandPos);
  group.add(supportHand);
  group.userData.supportHandPos = supportHandPos;

  // --- top rail the full length, and the sight on it
  const topY = 0.035;
  const rail = railSection(0.44, 0.03, M.metal);
  rail.position.set(0, topY, -0.17);
  group.add(rail);

  const sight = new THREE.Group();
  const opticKey = def.attachments?.optic || (def.sight === "scope" ? "acog" : def.sight === "reddot" ? "reflex" : "iron");
  const opticBuild = OPTIC_BUILDERS[opticKey];
  let aimY, aimZ, optic = null;
  if (opticBuild) {
    optic = opticBuild();
    sight.add(optic);
    aimY = topY + 0.004 + (optic.userData.aimOffsetY ?? 0.05);
    aimZ = optic.userData.lengthZ > 0.12 ? -0.19 : -0.15;
    sight.position.set(0, aimY, aimZ);
  } else {
    const rear = buildIronRear();
    rear.position.set(0, topY + 0.024, 0.045);
    const front = buildIronFront();
    front.position.set(0, topY + 0.023, -0.38);
    sight.add(rear, front);
    aimY = topY + 0.03;
    aimZ = -0.15;
  }
  group.add(sight);
  group.userData.sight = sight;
  group.userData.aimPoint = new THREE.Vector3(0, aimY, aimZ);
  group.userData.adsDistance = optic?.userData.adsDistance ?? null;
  group.userData.adsWeaponFov = optic?.userData.adsWeaponFov ?? null;

  // --- muzzle device
  const barrelBuild = BARREL_BUILDERS[def.attachments?.barrel];
  if (barrelBuild) {
    hider.visible = false;
    const dev = barrelBuild(0.0105);
    const devLen = dev.userData.lengthZ ?? 0.05;
    dev.position.set(0, 0.006, -0.502 - devLen / 2);
    group.add(dev);
    muzzleZ = -0.502 - devLen;
  }
  group.userData.muzzleZ = muzzleZ;

  // --- underbarrel, on the handguard's bottom rail
  const under = def.attachments?.underbarrel;
  const underBuild = UNDER_BUILDERS[under];
  if (underBuild) {
    const unit = underBuild();
    const unitY = under === "laser" ? -0.025 + 0.012 : -0.025;
    const unitZ = under === "laser" ? -0.33 : -0.31;
    unit.position.set(0, unitY, unitZ);
    group.add(unit);
    if (under === "laser") {
      const em = unit.userData.emitter || new THREE.Vector3();
      const origin = new THREE.Vector3(em.x, unitY + em.y, unitZ + em.z);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.85, depthWrite: false });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 1, 6), beamMat);
      beam.rotation.x = Math.PI / 2;
      beam.position.copy(origin);
      beam.visible = false;
      group.add(beam);
      group.userData.laserBeam = beam;
      group.userData.laserOrigin = origin.clone();
    }
  }

  group.userData.skin = skin?.id || null;
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}
