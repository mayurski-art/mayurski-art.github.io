// Troll Forces — procedural weapon view models.
//
// One builder reads each weapon's `model` spec instead of the old hardcoded
// if-chain, so a bullpup PDW, a drum-fed LMG and a snub pistol all come out of
// the same code path looking like themselves.

import * as THREE from "three";
import { buildGripHand, buildSupportHand } from "./hand-model.js";
import {
  OPTIC_BUILDERS, BARREL_BUILDERS, UNDER_BUILDERS,
  buildIronRear, buildIronFront, railSection,
} from "./attachment-models.js?v=fg1";
import { build416 } from "./weapon-416.js?v=cg1";
import { buildRevolverPair } from "./revolvers.js?v=rv2";
import { finishDef } from "./skins.js?v=p5";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MATS = {
  body:   () => new THREE.MeshStandardMaterial({ color: 0x4a4f48, roughness: 0.4, metalness: 0.7 }),
  dark:   () => new THREE.MeshStandardMaterial({ color: 0x2a2c28, roughness: 0.55, metalness: 0.5 }),
  accent: () => new THREE.MeshStandardMaterial({ color: 0x6b7a5e, roughness: 0.4, metalness: 0.6 }),
  wood:   () => new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.75, metalness: 0.05 }),
  brass:  () => new THREE.MeshStandardMaterial({ color: 0xb08d3e, roughness: 0.35, metalness: 0.85 }),
  glow:   () => new THREE.MeshBasicMaterial({ color: 0x6dff4a }),
  glowTube: () => new THREE.MeshStandardMaterial({ color: 0x4ee62f, emissive: 0x4ee62f, emissiveIntensity: 1.4, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.92 }),
};

/* ---- Green Candles: the detailed Blender model ------------------------
   models/build_greencandles.blender.py exports it in game coordinates. It
   streams in (preloadWeaponModels); until it lands, buildTankLauncher
   below stands in. The side tank is the magazine (magMesh), so the PF
   reload pulls it off like a mag. Per-instance glow materials are handed
   to game.js in userData.gc so the candle, hose and gauge can react. */
const GC_URL = new URL("./models/greencandles.glb?v=gc1", import.meta.url).href;
const GC_SCALE = 0.8;
const GC_GLOW = ["GC_CandleCore", "GC_CandleShell", "GC_Wick", "GC_HoseGlow", "GC_Gauge", "GC_Led"];
const GC_TUNE = {
  // The view-model lights are blue (weaponScene's ambient + rim): a warmer
  // grey here lands on the render's neutral matte grey.
  GC_Body:        { color: 0x5b5550 },
  GC_TankShell:   { color: 0x69635d },
  GC_CandleCore:  { color: 0x5cff2a, emissive: 0x46e81c, emissiveIntensity: 1.35 },
  GC_CandleShell: { color: 0x2f9e18, emissive: 0x2fb814, emissiveIntensity: 0.55, opacity: 0.58 },
  GC_Wick:        { color: 0x7dff4a, emissive: 0x5cf22a, emissiveIntensity: 1.2 },
  GC_HoseGlow:    { color: 0x2f9e18, emissive: 0x3fd01e, emissiveIntensity: 0.8, opacity: 0.88 },
  GC_Gauge:       { color: 0x5cff2a, emissive: 0x46e81c, emissiveIntensity: 1.4 },
  GC_Led:         { color: 0x7dff4a, emissive: 0x5cff2a, emissiveIntensity: 2.2 },
};
let gcTemplate = null;
let gcLoading = null;
let weaponEnvMap = null;

/* A reflection map for the detailed models' metals (brass and steel read
   black without one). game.js makes it once the renderer exists. */
export function setWeaponEnvMap(tex) { weaponEnvMap = tex; }

export function preloadWeaponModels() {
  if (!gcLoading) {
    const gc = new GLTFLoader().loadAsync(GC_URL).then((gltf) => {
      gcTemplate = prepGreenCandles(gltf.scene);
      return true;
    }).catch((e) => { console.warn("[weapons] green candles model failed", e); return false; });
    const gm = new GLTFLoader().loadAsync(GM_URL).then((gltf) => {
      gmTemplate = prepGrinmington(gltf.scene);
      return true;
    }).catch((e) => { console.warn("[weapons] grinmington model failed", e); return false; });
    const dt = Object.entries(DETAILED).map(([id, cfg]) => new GLTFLoader().loadAsync(cfg.url).then((gltf) => {
      detailedTemplates.set(id, prepDetailed(gltf.scene, cfg));
      return true;
    }).catch((e) => { console.warn(`[weapons] ${id} model failed`, e); return false; }));
    gcLoading = Promise.all([gc, gm, ...dt]).then((r) => r.some(Boolean));
  }
  return gcLoading;
}

/* Weapons whose first-person model streams in (game.js rebuilds the gun in
   hand once it lands). */
export function hasDetailedModel(def) {
  return def?.model?.stock === "tank" || def?.id === "grinmington" || !!DETAILED[def?.id];
}

/* ---- Detailed rifles: one loader for the Blender-built guns that reload
   with a magazine (THE BEAST, the Colt LMG). Each build script
   (models/build_<id>.blender.py, helpers in models/gunkit.py) exports, in
   game coordinates, under its prefix P:
     P_Body, P_Mag (pivot = the mag point), P_IronRear / P_IronFront (hidden
     under an optic), the muzzle device `device` (hidden under a barrel
     attachment), and empties P_Grip / P_Support / P_Muzzle / P_Aim /
     P_Under / P_Rail.
   `glow` materials pulse gently; `rake` is the grip's lean (the grip
   hand matches); `railY` is the top of the rail an optic sits on. */
const DETAILED = {
  beast: {
    url: new URL("./models/beast.glb?v=be3", import.meta.url).href,
    p: "BE", device: "BE_Brake", rake: -0.35, railY: 0.038, adsDistance: 0.24,
    glow: ["BE_Core", "BE_Vein"],
  },
  coltlmg: {
    url: new URL("./models/coltlmg.glb?v=cl2", import.meta.url).href,
    p: "CL", device: "CL_Hider", rake: -0.37, railY: 0.0465, adsDistance: null,
    glow: [],
  },
};
const detailedTemplates = new Map();

function prepDetailed(scene, cfg) {
  scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry.userData.shared = true;
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  return scene;
}

function buildDetailed(def, cfg, template) {
  const P = cfg.p;
  const src = template.clone(true);
  const root = new THREE.Group();
  const at = (n) => src.getObjectByName(`${P}_${n}`)?.position.clone();
  const grip = at("Grip"), support = at("Support"), muzzle = at("Muzzle");
  const aim = at("Aim"), under = at("Under"), rail = at("Rail");
  const empties = new Set(["Grip", "Support", "Muzzle", "Aim", "Under", "Rail"].map((n) => `${P}_${n}`));
  for (const c of [...src.children]) if (!empties.has(c.name)) root.add(c);

  // Own materials per gun (the game disposes them on a swap), with studio
  // reflections for the metals; the glow materials breathe.
  const clones = new Map();
  const glows = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    let m = clones.get(o.material);
    if (!m) {
      m = o.material.clone();
      if (weaponEnvMap && m.isMeshStandardMaterial) {
        m.envMap = weaponEnvMap;
        m.envMapIntensity = m.metalness > 0.5 ? 1.0 : 0.45;
      }
      if (cfg.glow.includes(m.name)) glows.push({ m, base: m.emissiveIntensity || 1 });
      clones.set(o.material, m);
    }
    o.material = m;
  });
  if (glows.length) {
    const body = root.getObjectByName(`${P}_Body`);
    body.onBeforeRender = () => {
      const k = 0.78 + 0.22 * Math.sin(performance.now() * 0.0031);
      for (const g of glows) g.m.emissiveIntensity = g.base * k;
    };
  }

  const u = root.userData;
  const mag = root.getObjectByName(`${P}_Mag`);
  u.magMesh = mag;
  u.magazinePoint = mag.position.clone();
  u.magRestRotationX = mag.rotation.x;

  // Hidden hand meshes: the PF arms / gloves and the third-person rig aim at them.
  const hand = buildGripHand(1);
  hand.userData.hand = true;
  hand.position.copy(grip);
  hand.rotation.x = cfg.rake;
  root.add(hand);
  const sup = buildSupportHand(1.5);
  sup.userData.hand = true;
  sup.position.copy(support);
  root.add(sup);
  u.supportHandPos = support.clone();
  u.pfAnchors = [hand, sup];
  u.pfSupportDrop = 0.05;
  u.gripPos = grip;

  // Sights: the irons unless glass goes on the rail.
  const irons = [root.getObjectByName(`${P}_IronRear`), root.getObjectByName(`${P}_IronFront`)];
  const opticKey = def.attachments?.optic
    || (def.sight === "scope" ? "acog" : def.sight === "reddot" ? "reflex" : "iron");
  const opticBuild = OPTIC_BUILDERS[opticKey];
  u.aimPoint = aim;
  u.adsDistance = cfg.adsDistance;
  u.adsWeaponFov = null;
  u.sight = null;
  if (opticBuild) {
    const optic = opticBuild();
    const railY = cfg.railY + 0.004;
    const aimY = railY + (optic.userData.aimOffsetY ?? 0.05);
    const aimZ = rail.z + (optic.userData.lengthZ > 0.12 ? -0.02 : 0.01);
    const sight = new THREE.Group();
    sight.add(optic);
    sight.position.set(0, aimY, aimZ);
    root.add(sight);
    for (const i of irons) if (i) i.visible = false;
    u.sight = sight;
    u.aimPoint = new THREE.Vector3(0, aimY, aimZ);
    u.adsDistance = optic.userData.adsDistance ?? null;
    u.adsWeaponFov = optic.userData.adsWeaponFov ?? null;
  }

  // Muzzle: the gun's own device unless a barrel attachment replaces it.
  u.muzzleZ = muzzle.z;
  const devBuild = BARREL_BUILDERS[def.attachments?.barrel];
  if (devBuild) {
    const device = root.getObjectByName(cfg.device);
    const dz = device ? new THREE.Box3().setFromObject(device).max.z : muzzle.z;
    const dev = devBuild(0.011);
    const devLen = dev.userData.lengthZ ?? 0.05;
    dev.position.set(0, muzzle.y, dz - devLen / 2);
    root.add(dev);
    if (device) device.visible = false;
    u.muzzleZ = dz - devLen;
  }

  // Underbarrel on the handguard's belly.
  const ub = def.attachments?.underbarrel;
  const ubBuild = UNDER_BUILDERS[ub];
  if (ubBuild) {
    const unit = ubBuild();
    unit.position.copy(under);
    if (ub === "laser") unit.position.y += 0.012;
    root.add(unit);
    if (ub === "laser") {
      const em = unit.userData.emitter || new THREE.Vector3();
      const origin = unit.position.clone().add(em);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.85, depthWrite: false });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 1, 6), beamMat);
      beam.rotation.x = Math.PI / 2;
      beam.position.copy(origin);
      beam.visible = false;
      root.add(beam);
      u.laserBeam = beam;
      u.laserOrigin = origin.clone();
    }
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return root;
}

/* ---- Grinmington 870: the detailed Blender model ---------------------
   models/build_grinmington.blender.py, BO2's 870 MCS in game coordinates.
   Until it streams in, the procedural pump gun below stands in. The pump
   node slides on z (game.js placePump), the loose shell rides the reload
   (placeReloadShell), and the attachments hang off the same spots the
   procedural gun used: optics on the rail, a device on the muzzle (the
   breacher comes off), underbarrels on the pump so they ride with it. */
const GM_URL = new URL("./models/grinmington.glb?v=gm2", import.meta.url).href;
const GM_RAIL_TOP = 0.036;
const GM_BARREL_END = -0.601;
const GM_BORE_Y = 0.010;
const GM_GRIP_RAKE = -0.315;      // the pistol grip leans back: the grip hand matches
const GM_EMPTIES = new Set(["GM_Grip", "GM_Support", "GM_Muzzle", "GM_Aim", "GM_Port", "GM_Under", "GM_Rail"]);
const GM_TUNE = {
  GM_Lens: { emissiveIntensity: 0.35 },
  GM_Dot: { emissiveIntensity: 0.9 },
};
let gmTemplate = null;

function prepGrinmington(scene) {
  scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry.userData.shared = true;
      o.castShadow = false;
      o.receiveShadow = false;
    }
    const m = o.material;
    if (!m) return;
    const t = GM_TUNE[m.name];
    if (t) Object.assign(m, t);
  });
  return scene;
}

function buildGrinmington(def) {
  const src = gmTemplate.clone(true);
  const root = new THREE.Group();
  const node = (n) => src.getObjectByName(n);
  const at = (n) => node(n).position.clone();
  const grip = at("GM_Grip"), support = at("GM_Support"), muzzle = at("GM_Muzzle");
  const aim = at("GM_Aim"), port = at("GM_Port"), under = at("GM_Under"), rail = at("GM_Rail");
  for (const c of [...src.children]) if (!GM_EMPTIES.has(c.name)) root.add(c);

  // Own materials per gun (the game disposes them on a swap), with the
  // studio reflections the metals need.
  const clones = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    let m = clones.get(o.material);
    if (!m) {
      m = o.material.clone();
      if (weaponEnvMap && m.isMeshStandardMaterial) {
        m.envMap = weaponEnvMap;
        m.envMapIntensity = m.metalness > 0.5 ? 1.0 : 0.45;
      }
      clones.set(o.material, m);
    }
    o.material = m;
  });

  const pump = root.getObjectByName("GM_Pump");
  const shell = root.getObjectByName("GM_Shell");
  const breacher = root.getObjectByName("GM_Breacher");
  const irons = [root.getObjectByName("GM_IronRear"), root.getObjectByName("GM_IronFront")];
  shell.visible = false;

  // Hidden hand meshes: the PF arms / gloves and the third-person rig aim
  // at them. The support hand rides the pump, so the arm follows a rack.
  const hand = buildGripHand(1);
  hand.userData.hand = true;
  hand.position.copy(grip);
  hand.rotation.x = GM_GRIP_RAKE;
  root.add(hand);
  const pumpSupport = buildSupportHand(1.5);
  pumpSupport.userData.hand = true;
  pumpSupport.position.copy(support).sub(pump.position);
  pump.add(pumpSupport);

  const u = root.userData;
  u.pumpMesh = pump;
  u.pumpRestZ = pump.position.z;
  u.supportHandPos = support.clone();
  u.pfAnchors = [hand, pumpSupport];
  u.pfSupportDrop = 0.05;            // anchor on the pump top -> under its belly
  u.loadPort = port;
  u.shellMesh = shell;
  u.gripPos = grip;

  // Sights: the ghost ring and post unless glass goes on the rail.
  const opticKey = def.attachments?.optic
    || (def.sight === "scope" ? "acog" : def.sight === "reddot" ? "reflex" : "iron");
  const opticBuild = OPTIC_BUILDERS[opticKey];
  u.aimPoint = aim;
  // The ghost ring sits at the back of the receiver: brought close to the
  // eye so the stock stays behind the camera instead of filling the view.
  u.adsDistance = 0.3;
  u.adsWeaponFov = null;
  u.sight = null;
  if (opticBuild) {
    const optic = opticBuild();
    const railY = GM_RAIL_TOP + 0.004;
    const aimY = railY + (optic.userData.aimOffsetY ?? 0.05);
    const aimZ = rail.z + (optic.userData.lengthZ > 0.12 ? -0.02 : 0.01);
    const sight = new THREE.Group();
    sight.add(optic);
    sight.position.set(0, aimY, aimZ);
    root.add(sight);
    for (const i of irons) if (i) i.visible = false;
    u.sight = sight;
    u.aimPoint = new THREE.Vector3(0, aimY, aimZ);
    u.adsDistance = optic.userData.adsDistance ?? null;
    u.adsWeaponFov = optic.userData.adsWeaponFov ?? null;
  }

  // Muzzle: the breacher unless a barrel device replaces it.
  u.muzzleZ = muzzle.z;
  const devBuild = BARREL_BUILDERS[def.attachments?.barrel];
  if (devBuild) {
    const dev = devBuild(0.0105);
    const devLen = dev.userData.lengthZ ?? 0.05;
    dev.position.set(0, GM_BORE_Y, GM_BARREL_END - devLen / 2);
    root.add(dev);
    if (breacher) breacher.visible = false;
    u.muzzleZ = GM_BARREL_END - devLen;
  }

  // Underbarrel: on the pump's belly, so it racks with it.
  const ub = def.attachments?.underbarrel;
  const ubBuild = UNDER_BUILDERS[ub];
  if (ubBuild) {
    const unit = ubBuild();
    unit.position.copy(under).sub(pump.position);
    if (ub === "laser") unit.position.y += 0.012;
    pump.add(unit);
    if (ub === "laser") {
      const em = unit.userData.emitter || new THREE.Vector3();
      const origin = unit.position.clone().add(pump.position).add(em);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.85, depthWrite: false });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 1, 6), beamMat);
      beam.rotation.x = Math.PI / 2;
      beam.position.copy(origin);
      beam.visible = false;
      root.add(beam);
      u.laserBeam = beam;
      u.laserOrigin = origin.clone();
    }
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return root;
}

function prepGreenCandles(scene) {
  // Bake the view-model scale into the vertices and node positions once,
  // so every userData point below is in the root's own (unscaled) space,
  // the space the reload/arm code works in.
  scene.traverse((o) => {
    if (o === scene) return;
    o.position.multiplyScalar(GC_SCALE);
    if (o.isMesh) {
      // The hose's uv.x runs 0 at the tank to 1 at the body: copied into
      // its own attribute for the shot pulse (no texture, so three.js
      // wouldn't pass uv through).
      const uv = o.geometry.attributes.uv;
      if (o.material?.name === "GC_HoseGlow" && uv) {
        const t = new Float32Array(uv.count);
        for (let i = 0; i < uv.count; i++) t[i] = uv.getX(i);
        o.geometry.setAttribute("hoseT", new THREE.BufferAttribute(t, 1));
      }
      o.geometry.scale(GC_SCALE, GC_SCALE, GC_SCALE);
      o.geometry.userData.shared = true;
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  scene.traverse((o) => {
    const m = o.material;
    if (!m) return;
    if (m.transparent) {
      m.depthWrite = false;
      o.renderOrder = m.name === "GC_Glass" ? 3 : 2;
    }
    // Blender's emission strengths are for Cycles; under the game's ACES
    // at 1.5 exposure they blow out to white, so the glow is set here.
    const tune = GC_TUNE[m.name];
    if (tune) Object.assign(m, tune);
    if (tune?.color) m.color = new THREE.Color(tune.color);
    if (tune?.emissive) m.emissive = new THREE.Color(tune.emissive);
    m.userData.baseEmissive = m.emissiveIntensity ?? 0;
  });
  return scene;
}

let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.18, "rgba(255,255,255,0.55)");
  r.addColorStop(0.5, "rgba(255,255,255,0.12)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

function buildGreenCandles() {
  const src = gcTemplate.clone(true);
  const root = new THREE.Group();
  const byName = (n) => src.getObjectByName(n);
  const tank = byName("GC_Tank");
  const gaugeFill = byName("GC_GaugeFill");
  const grip = byName("GC_Grip").position.clone();
  const support = byName("GC_Support").position.clone();
  const muzzle = byName("GC_Muzzle").position.clone();
  const aim = byName("GC_Aim").position.clone();
  for (const c of [...src.children]) root.add(c);

  // Own copies of every material: the glow ones animate per gun, and the
  // game disposes a gun's materials when it swaps weapons.
  const clones = new Map();
  const glow = {};
  root.traverse((o) => {
    if (!o.isMesh) return;
    let m = clones.get(o.material);
    if (!m) {
      m = o.material.clone();
      m.userData.baseEmissive = o.material.userData.baseEmissive;
      if (weaponEnvMap && m.isMeshStandardMaterial) {
        m.envMap = weaponEnvMap;
        m.envMapIntensity = m.metalness > 0.5 ? 1.0 : 0.45;
      }
      clones.set(o.material, m);
      if (GC_GLOW.includes(m.name)) glow[m.name] = m;
    }
    o.material = m;
  });

  // Hose pulse: a band of extra glow at uPulse (0 tank .. 1 body).
  const hose = glow.GC_HoseGlow;
  if (hose) {
    const u = { uPulse: { value: -1 }, uPulseAmp: { value: 0 } };
    hose.userData.pulse = u;
    hose.customProgramCacheKey = () => "gc-hose";
    hose.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = "attribute float hoseT;\nvarying float vHoseT;\n"
        + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vHoseT = hoseT;");
      sh.fragmentShader = "uniform float uPulse;\nuniform float uPulseAmp;\nvarying float vHoseT;\n"
        + sh.fragmentShader.replace("#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\n  totalEmissiveRadiance *= 1.0 + uPulseAmp * exp(-pow((vHoseT - uPulse) * 7.0, 2.0));");
    };
  }

  // Hidden hand meshes: the PF arms and the third-person rig aim at them.
  const hand = buildGripHand(1.2);
  hand.userData.hand = true;
  hand.position.copy(grip);
  hand.rotation.x = 0.28;
  root.add(hand);
  const supportHand = buildSupportHand(1.5);
  supportHand.userData.hand = true;
  supportHand.position.copy(support);
  root.add(supportHand);

  root.userData.gripPos = grip;
  root.userData.supportHandPos = support.clone();
  root.userData.pfAnchors = [hand, supportHand];
  root.userData.pfSupportDrop = 0;     // the anchor already IS the foregrip
  root.userData.supportStyle = "foregrip";   // gloves fist it (glove-model.js)
  root.userData.magMesh = tank;
  root.userData.magazinePoint = tank.position.clone();
  root.userData.magRestRotationX = 0;
  root.userData.sight = null;
  // Iron sights: the rear notch is the aim point, the green bead on the
  // collar sits in it with the candle glowing below.
  root.userData.aimPoint = aim;
  root.userData.adsDistance = 0.46;
  root.userData.hipOffset = new THREE.Vector3(0.02, 0.0, 0.08);
  root.userData.hipYaw = 0.26;
  root.userData.muzzleZ = muzzle.z;
  // Glow halos: the view model has no bloom, so the candle's light is sold
  // with two soft additive sprites (round the candle, at the wick) that
  // game.js swells with the charge and flashes on a shot.
  const halo = (z, size, opacity) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0x3fd81e, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity,
    }));
    s.position.set(0, 0, z);
    s.scale.setScalar(size);
    s.renderOrder = 4;
    s.userData.base = { size, opacity };
    root.add(s);
    return s;
  };
  const halos = [halo(-0.285 * GC_SCALE, 0.2, 0.28), halo(-0.37 * GC_SCALE, 0.08, 0.55)];

  root.userData.gc = { glow, gaugeFill, tank, halos };
  return root;
}

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cyl(rt, rb, h, mat, seg = 10) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); }

function buildTankLauncher(def, spec, len) {
  // A robotic arm-extension weapon: the horn+cell "candle" stack runs
  // forward along -Z, level with the grip, like a barrel — not standing
  // up off a housing. It should read as a straight extension of the arm.
  const group = new THREE.Group();
  const darkMat = MATS.dark();
  const brassMat = MATS.brass();
  const bodyH = 0.09;

  // --- housing (holds grip/trigger, sits behind the horn)
  const housingLen = len * 0.5;
  const housing = box(0.09, bodyH * 1.3, housingLen, darkMat);
  housing.position.set(0, 0, len * 0.16);
  group.add(housing);

  // --- horn body: tapers forward from the housing into the brass collar,
  // muzzle end pointing down -Z (the weapon's forward axis).
  const hornLen = len * 0.62;
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.088, hornLen, 14), darkMat);
  horn.rotation.x = Math.PI / 2;
  horn.position.set(0, bodyH * 0.1, -hornLen / 2 - housingLen * 0.15);
  group.add(horn);
  const hornTipZ = horn.position.z - hornLen / 2;

  // --- brass collar band, sits at the horn's muzzle-end neck
  const brass = cyl(0.052, 0.062, 0.05, brassMat, 14);
  brass.rotation.x = Math.PI / 2;
  brass.position.set(0, bodyH * 0.1, hornTipZ - 0.025);
  group.add(brass);

  // --- glowing green fuel cylinder, running forward alongside the horn
  // on top, like a barrel shroud — the "candle" itself points forward.
  const cellR = 0.045;
  const cellLen = len * 0.42;
  const cellZ = hornTipZ - 0.05 - cellLen / 2;
  const cellGroup = new THREE.Group();
  cellGroup.position.set(0, bodyH * 0.1, cellZ);
  const cell = cyl(cellR, cellR, cellLen, MATS.glowTube(), 14);
  cell.rotation.x = Math.PI / 2;
  cellGroup.add(cell);
  const nub = cyl(cellR * 0.3, cellR * 0.3, cellLen * 0.16, MATS.glowTube(), 8);
  nub.rotation.x = Math.PI / 2;
  nub.position.z = -(cellLen / 2 + cellLen * 0.08);
  cellGroup.add(nub);
  group.add(cellGroup);
  const glowLight = new THREE.PointLight(0x4ee62f, 1.1, 1.4, 2);
  glowLight.position.set(0, bodyH * 0.1, cellZ);
  group.add(glowLight);
  const muzzleTipZ = cellZ - cellLen / 2 - cellLen * 0.16;

  // --- side tank ("Green Candles"), fed by a hose forward into the horn
  const tankLen = len * 0.34;
  const tank = box(0.05, 0.075, tankLen, darkMat);
  tank.position.set(-0.1, -bodyH * 0.2, len * 0.14);
  group.add(tank);
  const tankStripe = box(0.006, 0.078, tankLen * 0.62, MATS.glowTube());
  tankStripe.position.set(-0.1 - 0.028, -bodyH * 0.2, len * 0.14);
  group.add(tankStripe);

  const hoseMat = MATS.glowTube();
  const hose = cyl(0.009, 0.009, len * 0.22, hoseMat, 8);
  hose.rotation.x = Math.PI / 5;
  hose.position.set(-0.075, bodyH * 0.55, len * 0.02);
  group.add(hose);
  const hoseElbow = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.009, 6, 10, Math.PI * 0.6), hoseMat);
  hoseElbow.position.set(-0.05, bodyH * 0.35, -len * 0.06);
  hoseElbow.rotation.set(0, Math.PI / 2, Math.PI * 0.15);
  group.add(hoseElbow);

  // --- pistol grip + trigger under the housing
  const grip = box(0.05, 0.16, 0.06, darkMat);
  grip.position.set(0, -bodyH * 1.4, len * 0.3);
  grip.rotation.x = 0.28;
  group.add(grip);
  const hand = buildGripHand(bodyH / 0.07);
  hand.userData.hand = true;
  hand.position.copy(grip.position);
  hand.rotation.copy(grip.rotation);
  group.add(hand);
  // Where the third-person rig puts its trigger hand (see _gripSupport).
  group.userData.gripPos = grip.position.clone();
  const trigger = box(0.03, 0.05, 0.04, darkMat);
  trigger.position.set(0, -bodyH * 0.7, len * 0.2);
  group.add(trigger);

  // --- vent slit + control button on the housing, matching the reference
  const vent = box(0.006, 0.045, 0.05, MATS.glow());
  vent.position.set(0.046, -bodyH * 0.15, len * 0.12);
  group.add(vent);
  const button = cyl(0.012, 0.012, 0.01, darkMat, 10);
  button.rotation.z = Math.PI / 2;
  button.position.set(0.046, 0.03, len * 0.28);
  group.add(button);

  // The horn+cell stack, held level as an arm extension, reads well
  // without needing the big rescale the old vertical build required —
  // just a mild trim so it sits in the corner like other weapons.
  const wrap = new THREE.Group();
  wrap.add(group);
  const holdScale = 0.75;
  wrap.scale.setScalar(holdScale);

  const muzzleZ = muzzleTipZ * holdScale;
  // No sight on a tank launcher — aim straight down the horn/cell axis.
  const aimY = bodyH * 0.1 * holdScale;
  const aimZ = muzzleZ * 0.6;
  wrap.userData.sight = null;
  wrap.userData.aimPoint = new THREE.Vector3(0, aimY, aimZ);
  wrap.userData.muzzleZ = muzzleZ;
  wrap.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return wrap;
}

/* `skin` defaults to the one chosen with the loadout (def.attachments.skin);
   remote players pass theirs explicitly. Only the Problem 416 wears skins,
   and it has its own panelled model to wear them on (weapon-416.js). */
/* Drop any lights a model carries (the Green Candles cell glow). Only the
   first-person viewmodel keeps them: it renders in its own weaponScene. A
   light on a third-person gun in the world scene changes the light count
   and recompiles every lit shader (light-pool.js). */
export function stripLights(obj) {
  const lights = [];
  obj.traverse((n) => { if (n.isLight) lights.push(n); });
  for (const l of lights) l.parent.remove(l);
  return obj;
}

export function buildWeaponMesh(def, { skin } = {}) {
  // A gun with its own finish (the Prestige 7 gold gun) always wears it.
  const fin = finishDef(def.ownFinish || (skin ?? def.attachments?.skin ?? null));
  if (!fin) return buildBaseMesh(def, skin);
  // A finish goes over the factory gun ("" = no banner skin).
  return applyFinish(buildBaseMesh(def, ""), fin);
}

/* ---- Finishes (skins.js FINISHES) ----------------------------------------
   Ghost Glass: every surface turns to clear glass with its edges drawn in
   white, and the small hardware (sights, pins, trigger, bolts) goes frosted
   white so the gun still reads. Hands, glows, lenses and beams are left
   alone. Edge lines are cached per geometry (the detailed models share
   theirs between builds). */
const _edgeCache = new WeakMap();
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
function glassMats() {
  return {
    glass: new THREE.MeshStandardMaterial({
      color: 0xeaf2ff, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.2,
      depthWrite: false, envMap: weaponEnvMap, envMapIntensity: 1.6,
    }),
    frost: new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.3, metalness: 0.05, envMap: weaponEnvMap, envMapIntensity: 0.6 }),
    edge: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }),
  };
}
function edgesOf(o, mat) {
  let eg = _edgeCache.get(o.geometry);
  if (!eg) {
    eg = new THREE.EdgesGeometry(o.geometry, 32);
    if (o.geometry.userData.shared) eg.userData.shared = true;
    _edgeCache.set(o.geometry, eg);
  }
  const lines = new THREE.LineSegments(eg, mat);
  lines.renderOrder = 3;
  lines.userData.finishEdge = true;
  o.add(lines);
}

/* How light a part's own paint is, 0..1: dark furniture stays darker than
   the receiver under a metal finish. */
function toneOf(o) {
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  const c = m?.color;
  if (!c) return 0.5;
  return Math.min(1, (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) * 2.2);
}

/* Prestige metals (Bronze, Silver, Gold Grin): polished metal, the gun's
   dark parts in the metal's shadow tone. Four tone steps, one material each. */
/* Polished metal is all reflection, and a dim map (or the thumbnail room)
   gives it nothing bright to reflect, so it goes black or flat. The metals
   carry their own little photo studio instead: a dark room with soft light
   bands, drawn once on a canvas (three.js prefilters it like any env map). */
let _metalStudio = null;
function metalStudio() {
  if (_metalStudio) return _metalStudio;
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, "#5a5f66"); sky.addColorStop(0.45, "#1c1f23"); sky.addColorStop(1, "#08090a");
  g.fillStyle = sky; g.fillRect(0, 0, 512, 256);
  const band = (y, h, a) => {
    const b = g.createLinearGradient(0, y - h, 0, y + h);
    b.addColorStop(0, "rgba(255,255,255,0)"); b.addColorStop(0.5, `rgba(255,255,255,${a})`); b.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = b; g.fillRect(0, y - h, 512, h * 2);
  };
  band(70, 16, 0.95); band(120, 8, 0.55); band(170, 22, 0.25);
  // two softboxes for the sharp highlights that run along a polished part
  g.fillStyle = "rgba(255,255,255,0.9)";
  g.fillRect(90, 40, 40, 70); g.fillRect(330, 50, 30, 60);
  _metalStudio = new THREE.CanvasTexture(c);
  _metalStudio.mapping = THREE.EquirectangularReflectionMapping;
  _metalStudio.colorSpace = THREE.SRGBColorSpace;
  _metalStudio.userData.shared = true;
  return _metalStudio;
}

function metalMats(fin) {
  const base = new THREE.Color(fin.metal[0]), shadow = new THREE.Color(fin.metal[1]);
  // The gun's flat panels each reflect one direction, so on top of the
  // studio a slow sheen slides along the metal and the upper edges catch
  // light: it reads as polished from any angle, in any map.
  return [0, 1, 2, 3].map((i) => {
    const c = shadow.clone().lerp(base, i / 3);
    return withFx(new THREE.MeshStandardMaterial({
      color: c, metalness: 0.9, roughness: fin.rough + (3 - i) * 0.04,
      envMap: metalStudio(), envMapIntensity: 1.4,
    }), "tf-metal", `
      float sheen = smoothstep(0.78, 1.0, sin(vFxPos.z * 7.0 + vFxPos.y * 11.0 - uFxTime * 0.9));
      float lift = smoothstep(-0.04, 0.06, vFxPos.y);
      totalEmissiveRadiance += diffuseColor.rgb * (0.16 + 0.12 * lift + 0.45 * sheen);
    `);
  });
}

/* A material whose emissive gets extra GLSL, in object space (vFxPos) with a
   shared clock (uFxTime): the Diamond glints and the Dark Matter nebula. */
const FX_TIME = { value: 0 };
const fxTick = () => { FX_TIME.value = performance.now() / 1000; };
function withFx(m, key, glsl) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFxTime = FX_TIME;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFxPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFxPos = position;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
      varying vec3 vFxPos;
      uniform float uFxTime;
      float fxHash(vec3 c) { return fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      // a twinkling point in some cells of a 3D grid
      float fxStars(vec3 p, float density, float size, float speed) {
        vec3 cell = floor(p);
        float h = fxHash(cell);
        float d = length(fract(p) - 0.5);
        return step(1.0 - density, h) * smoothstep(size, 0.0, d) * (0.5 + 0.5 * sin(uFxTime * speed + h * 60.0));
      }`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n{\n${glsl}\n}`);
  };
  m.customProgramCacheKey = () => key;
  return m;
}

/* Diamond Grin: icy crystal with a rainbow sheen, cut-glass edges in blue,
   and glints that flash across it. */
function diamondMats() {
  return {
    body: withFx(new THREE.MeshPhysicalMaterial({
      color: 0xbfe6ff, metalness: 0.35, roughness: 0.06, flatShading: true,
      clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [200, 900],
      emissive: 0x16384f, envMap: weaponEnvMap, envMapIntensity: 2.6,
    }), "tf-diamond", `
      vec3 p = vFxPos * 38.0;
      float g = fxStars(p, 0.05, 0.42, 5.0) + fxStars(p * 0.55 + 7.3, 0.04, 0.4, 3.3);
      float band = smoothstep(0.92, 1.0, sin(vFxPos.z * 9.0 + vFxPos.y * 6.0 - uFxTime * 1.6));
      totalEmissiveRadiance += vec3(0.85, 0.95, 1.0) * g * 2.2 + vec3(0.35, 0.6, 0.8) * band * 0.5;
    `),
    edge: new THREE.LineBasicMaterial({ color: 0x3fb8ff, transparent: true, opacity: 0.85, depthWrite: false }),
  };
}

/* Dark Matter: black metal with a slow purple nebula and twinkling stars
   moving through it, after BO2's. One shared clock for every gun wearing it,
   ticked by whichever of them draws first each frame. */
function darkMatterMat() {
  return withFx(new THREE.MeshStandardMaterial({ color: 0x050208, metalness: 0.75, roughness: 0.2, envMap: weaponEnvMap, envMapIntensity: 1.0 }), "tf-darkmatter", `
      vec3 p = vFxPos * 22.0;
      float t = uFxTime * 0.35;
      float n = sin(p.x * 1.3 + t * 2.0 + sin(p.y * 2.1 - t)) * sin(p.z * 1.1 - t * 1.4 + sin(p.x * 0.9 + t * 0.6));
      n += 0.5 * sin(p.x * 3.1 - t * 1.2 + sin(p.z * 2.7 + t)) * sin(p.y * 2.9 + t * 0.8);
      n = n * 0.33 + 0.5;
      float wisp = smoothstep(0.58, 0.95, n);
      vec3 neb = mix(vec3(0.03, 0.0, 0.07), vec3(0.42, 0.08, 0.85), wisp) * 0.55;
      neb += vec3(0.05, 0.3, 0.9) * smoothstep(0.85, 1.0, n) * 0.35;
      float s = fxStars(vFxPos * 60.0, 0.06, 0.38, 6.0) + fxStars(vFxPos * 110.0 + 3.1, 0.05, 0.4, 9.0) * 0.7;
      totalEmissiveRadiance += neb + vec3(0.9, 0.85, 1.0) * s * 2.0;
  `);
}

function applyFinish(root, fin) {
  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.hand) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    // Glows, reticles, lenses and the laser keep their look.
    if (mats.some((m) => m.isMeshBasicMaterial || (m.transparent && m.opacity < 0.95) || (m.emissiveIntensity > 0.3 && m.emissive?.getHex()))) return;
    meshes.push(o);
  });
  if (fin.finish === "metal") {
    const M = metalMats(fin);
    for (const o of meshes) { o.material = M[Math.min(3, Math.round(toneOf(o) * 3))]; o.onBeforeRender = fxTick; }
  } else if (fin.finish === "diamond") {
    const M = diamondMats();
    for (const o of meshes) { o.material = M.body; o.onBeforeRender = fxTick; edgesOf(o, M.edge); }
  } else if (fin.finish === "darkmatter") {
    const m = darkMatterMat();
    for (const o of meshes) { o.material = m; o.onBeforeRender = fxTick; }
  }
  if (fin.finish !== "glass") { root.userData.finish = fin.id; return root; }
  const M = glassMats();
  for (const o of meshes) {
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    _box.copy(o.geometry.boundingBox).getSize(_size).multiply(o.getWorldScale(new THREE.Vector3()));
    const small = _size.length() < 0.045;
    o.material = small ? M.frost : M.glass;
    o.renderOrder = small ? 0 : 2;
    edgesOf(o, M.edge);
  }
  root.userData.finish = fin.id;
  return root;
}

function buildBaseMesh(def, skin) {
  if (def.id === "problem416") return build416(def, skin ?? def.attachments?.skin ?? null);
  // a pair of revolvers, one per hand (revolvers.js)
  if (def.akimbo) return buildRevolverPair(def, { env: weaponEnvMap || metalStudio() });
  const spec = def.model || {};
  if (spec.stock === "tank") return gcTemplate ? buildGreenCandles(def) : buildTankLauncher(def, spec, spec.len || 0.5);
  if (def.id === "grinmington" && gmTemplate) return buildGrinmington(def);
  if (DETAILED[def.id] && detailedTemplates.has(def.id)) return buildDetailed(def, DETAILED[def.id], detailedTemplates.get(def.id));
  const len = spec.len || 0.5;
  const heavy = !!spec.heavy;
  const bodyH = (heavy ? 0.085 : 0.07) * (def.cls === "sidearm" ? 0.85 : 1);
  const bodyW = (heavy ? 0.075 : 0.06) * (def.cls === "sidearm" ? 0.8 : 1);

  const group = new THREE.Group();
  const bodyMat = MATS.body();
  const darkMat = MATS.dark();
  const accentMat = MATS.accent();
  const furnitureMat = spec.wood ? MATS.wood() : darkMat;

  const bullpup = spec.stock === "bullpup";
  const isPistol = spec.stock === "none";

  // --- receiver
  const receiverLen = len * (bullpup ? 0.78 : 0.55);
  const body = box(bodyW, bodyH, receiverLen, bodyMat);
  body.position.z = -len * (bullpup ? 0.02 : 0.12);
  group.add(body);

  // --- barrel
  const barrelLen = len * 0.5 * (spec.barrel || 1);
  const barrelR = heavy ? 0.024 : 0.016;
  const barrel = cyl(barrelR, barrelR * 1.1, barrelLen, darkMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, bodyH * 0.1, -len * 0.62 - (barrelLen - len * 0.5) * 0.5);
  group.add(barrel);
  const muzzleZ = barrel.position.z - barrelLen / 2;

  // --- pump forend (spec.pump): a ribbed slide riding the magazine tube.
  // It carries the support hand, so game.js placePump moving it back and
  // forward takes the hand (and the PF arm rod) with it.
  let pumpSupport = null;
  if (spec.pump) {
    const tubeY = -bodyH * 0.52;
    const forend = new THREE.Group();
    const fLen = len * 0.3;
    forend.position.set(0, tubeY, -len * 0.5);
    const sleeve = cyl(bodyW * 0.62, bodyW * 0.62, fLen, furnitureMat, 12);
    sleeve.rotation.x = Math.PI / 2;
    sleeve.scale.set(1, 1, 0.82);     // a touch flatter than round
    forend.add(sleeve);
    // Grip ribs: raised rings down the slide.
    for (let i = 0; i < 7; i++) {
      const rib = cyl(bodyW * 0.66, bodyW * 0.66, 0.008, darkMat, 12);
      rib.rotation.x = Math.PI / 2;
      rib.scale.set(1, 1, 0.82);
      rib.position.z = -fLen * 0.36 + i * fLen * 0.12;
      forend.add(rib);
    }
    // Action bars back into the receiver (the part that visibly slides in).
    for (const x of [-1, 1]) {
      const bar = box(0.006, 0.01, len * 0.22, darkMat);
      bar.position.set(x * bodyW * 0.42, bodyH * 0.12, fLen * 0.5 + len * 0.1);
      forend.add(bar);
    }
    group.add(forend);
    group.userData.pumpMesh = forend;
    group.userData.pumpRestZ = forend.position.z;

    pumpSupport = buildSupportHand((bodyH / 0.07) * 1.5);
    pumpSupport.userData.hand = true;
    pumpSupport.position.set(0, bodyH * 0.72, -fLen * 0.2);
    forend.add(pumpSupport);
    group.userData.supportHandPos = new THREE.Vector3(0, tubeY + bodyH * 0.72, forend.position.z - fLen * 0.2);

    // The loading port under the receiver, and the shell the reload feeds.
    group.userData.loadPort = new THREE.Vector3(0, -bodyH * 0.62, -len * 0.08);
    const shell = new THREE.Group();
    const hull = cyl(0.011, 0.011, 0.058, new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.55, metalness: 0.1 }), 10);
    hull.rotation.x = Math.PI / 2;
    shell.add(hull);
    const head = cyl(0.0125, 0.0125, 0.012, MATS.brass(), 10);
    head.rotation.x = Math.PI / 2;
    head.position.z = 0.034;
    shell.add(head);
    shell.visible = false;
    group.add(shell);
    group.userData.shellMesh = shell;
  }

  // --- handguard / furniture over the barrel
  if (!isPistol && !spec.pump) {
    const hg = box(bodyW * 1.05, bodyH * 0.55, len * 0.32 * (spec.barrel || 1), spec.wood ? furnitureMat : accentMat);
    hg.position.set(0, -bodyH * 0.05, -len * 0.4);
    group.add(hg);

    // Support hand claws down over the FRONT face of the handguard,
    // centred on it in X and offset forward in Z so the fingers hang
    // down in front of — not sunk inside — the handguard's own solid
    // box. buildSupportHand's local origin sits above where its fingers
    // hang (-Y), so it's placed above the handguard's top surface with
    // enough clearance for the whole claw to read in front of it.
    // Every non-pistol weapon is carried two-handed. Scaled the same way
    // the trigger hand is, against the standard bodyH of 0.07.
    // Scaled up beyond the trigger hand's own bodyH/0.07 factor — the claw
    // is a much more minimal shape (5 boxes, no forearm bulk) and reads as
    // a stray detail rather than a hand at that size from normal gameplay
    // viewing distance, confirmed by an in-game screenshot at the smaller
    // scale.
    const hgTopY = hg.position.y + bodyH * 0.275;
    const hgFrontZ = hg.position.z - len * 0.16 * (spec.barrel || 1);
    const supportHand = buildSupportHand((bodyH / 0.07) * 1.5);
    supportHand.userData.hand = true;
    const supportHandPos = new THREE.Vector3(0, hgTopY + bodyH * 0.4, hgFrontZ + 0.04);
    supportHand.position.copy(supportHandPos);
    group.add(supportHand);
    // Exposed so the third-person rig can point its own off-hand at the
    // same spot on a peer's weapon mesh, instead of duplicating this offset.
    group.userData.supportHandPos = supportHandPos;
  }

  // --- stock
  if (spec.stock === "fixed") {
    const stock = box(bodyW * 0.72, bodyH * 0.8, len * 0.34, furnitureMat);
    stock.position.set(0, -bodyH * 0.06, len * 0.3);
    group.add(stock);
    const comb = box(bodyW * 0.7, bodyH * 0.45, len * 0.2, furnitureMat);
    comb.position.set(0, bodyH * 0.4, len * 0.22);
    group.add(comb);
  } else if (spec.stock === "folding") {
    const rail = box(bodyW * 0.34, bodyH * 0.2, len * 0.3, darkMat);
    rail.position.set(0, bodyH * 0.05, len * 0.28);
    group.add(rail);
    const pad = box(bodyW * 0.8, bodyH * 0.85, len * 0.06, darkMat);
    pad.position.set(0, -bodyH * 0.02, len * 0.44);
    group.add(pad);
  } else if (bullpup) {
    const pad = box(bodyW * 0.9, bodyH * 1.1, len * 0.07, darkMat);
    pad.position.set(0, -bodyH * 0.05, len * 0.36);
    group.add(pad);
  }

  // --- pistol grip
  const grip = box(0.05, isPistol ? 0.13 : 0.15, 0.055, darkMat);
  grip.position.set(0, -bodyH * (isPistol ? 1.1 : 1.3), isPistol ? len * 0.18 : len * 0.02);
  grip.rotation.x = 0.32;
  group.add(grip);
  // Scale=1 is tuned against the standard (non-heavy, non-pistol) bodyH of
  // 0.07 — every other weapon's hand scales proportionally to its own grip.
  const hand = buildGripHand(bodyH / 0.07);
  hand.userData.hand = true;
  hand.position.copy(grip.position);
  hand.rotation.copy(grip.rotation);
  group.add(hand);
  // Where the third-person rig puts its trigger hand (character.js
  // _gripSupport). Without it the body fell back to a one-handed forearm
  // mount (user: "the gun is only being held with one hand").
  group.userData.gripPos = grip.position.clone();
  if (isPistol) group.userData.pistol = true;
  // The support hand rides the forend, not the group, so the PF arm lookup
  // (direct children) can't find it: hand it over up front.
  if (pumpSupport) group.userData.pfAnchors = [hand, pumpSupport];

  // --- magazine
  // Detachable types (box/curved/drum/long/topbox) store their mesh and rest
  // transform on userData so Phase 3 reload choreography (game.js) can pull
  // the mag out and swap in a fresh one instead of it being a permanently
  // baked-in child — tube (shell-fed) and the "none" weapons intentionally
  // don't expose this, since they don't reload with a mag swap at all.
  const magZ = bullpup ? len * 0.18 : -len * 0.14;
  if (spec.mag === "box" || spec.mag === "long") {
    const magLen = spec.mag === "long" ? 0.28 : 0.19;
    const mag = box(0.042, magLen, 0.06, darkMat);
    mag.position.set(0, -bodyH * 1.6 - (magLen - 0.19) * 0.5, isPistol ? len * 0.18 : magZ);
    mag.rotation.x = isPistol ? 0.32 : -0.12;
    group.add(mag);
    group.userData.magMesh = mag;
    group.userData.magazinePoint = mag.position.clone();
    group.userData.magRestRotationX = mag.rotation.x;
  } else if (spec.mag === "curved") {
    const mag = box(0.044, 0.22, 0.062, darkMat);
    mag.position.set(0, -bodyH * 1.75, magZ);
    mag.rotation.x = -0.34;
    group.add(mag);
    group.userData.magMesh = mag;
    group.userData.magazinePoint = mag.position.clone();
    group.userData.magRestRotationX = mag.rotation.x;
  } else if (spec.mag === "drum") {
    const drum = cyl(0.075, 0.075, 0.05, darkMat, 14);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, -bodyH * 1.9, magZ);
    group.add(drum);
    group.userData.magMesh = drum;
    group.userData.magazinePoint = drum.position.clone();
    group.userData.magRestRotationX = drum.rotation.z;
  } else if (spec.mag === "tube") {
    const tube = cyl(0.018, 0.018, len * 0.55, darkMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -bodyH * 0.55, -len * 0.45);
    group.add(tube);
    if (spec.pump) {
      // Longer tube out to the muzzle with an end cap, and a barrel clamp.
      tube.scale.y = 1.3;
      tube.position.z = -len * 0.54;
      const cap = cyl(0.021, 0.021, 0.02, bodyMat, 10);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(0, -bodyH * 0.55, -len * 0.54 - len * 0.55 * 0.65);
      group.add(cap);
      const clamp = box(bodyW * 0.5, bodyH * 0.75, 0.022, darkMat);
      clamp.position.set(0, -bodyH * 0.22, cap.position.z + 0.04);
      group.add(clamp);
    }
  } else if (spec.mag === "topbox") {
    const mag = box(0.05, 0.032, len * 0.42, darkMat);
    mag.position.set(0, bodyH * 0.62, -len * 0.1);
    group.add(mag);
    group.userData.magMesh = mag;
    group.userData.magazinePoint = mag.position.clone();
    group.userData.magRestRotationX = mag.rotation.x;
  }

  // --- sight, and the aim point that ADS aligns to
  const sight = new THREE.Group();
  let aimY = bodyH * 0.7;
  let aimZ = -len * 0.15;
  let railMountedOptic = null;
  const topOfMag = spec.mag === "topbox" ? bodyH * 0.62 + 0.032 : bodyH * 0.5;

  // The chosen optic decides the shape, not the broad `def.sight` family —
  // otherwise Reflex/Coyote and ACOG/8x each collapse into one mesh and half
  // the Customize screen changes nothing you can see. Falls back to the
  // family when a weapon ships with glass but carries no attachment record
  // (bot loadouts and dropped pickups both take that path).
  const opticKey = def.attachments?.optic
    || (def.sight === "scope" ? "acog" : def.sight === "reddot" ? "reflex" : "iron");
  const opticBuild = OPTIC_BUILDERS[opticKey];

  if (opticBuild) {
    const optic = opticBuild();
    sight.add(optic);
    // Rail surface sits just above the receiver; the optic's own
    // `aimOffsetY` lifts the glass from there, so a tall scope rides high
    // and a micro dot sits low without a per-sight constant here.
    const railY = topOfMag + 0.004;
    aimY = railY + (optic.userData.aimOffsetY ?? 0.05);
    // Sat over the rail that carries it, straddling the receiver/handguard
    // joint the way a real optic does. Long glass is pulled a touch further
    // forward so the eyepiece doesn't overhang the stock, short glass a
    // touch back so its mount still lands on the rail.
    aimZ = -len * (optic.userData.lengthZ > 0.12 ? 0.34 : 0.3);
    // Sub-groups measure from the glass centre, but the mount legs are
    // drawn downward from it, so nothing else needs shifting.
    railMountedOptic = optic;
  } else {
    // Iron sights: rear aperture on the receiver, hooded post on the barrel.
    // These sit in weapon space (the group is never offset for irons), so
    // they're placed absolutely, exactly as before.
    const rear = buildIronRear();
    rear.position.set(0, topOfMag + 0.016, -len * 0.15);
    const front = buildIronFront();
    front.position.set(0, topOfMag + 0.015, muzzleZ + 0.03);
    sight.add(rear, front);
    aimY = topOfMag + 0.022;
    aimZ = -len * 0.15;
  }

  // Only a rail-mounted optic is moved as a unit — iron sights were already
  // placed in weapon space above, and offsetting the group would double it.
  if (railMountedOptic) sight.position.set(0, aimY, aimZ);
  group.add(sight);
  // A mounted optic wants a rail under it, or it floats above the receiver.
  if (railMountedOptic && !isPistol) {
    // Long enough to run under the optic's whole footprint plus a little
    // spare either end, and centred on the optic — a fixed-length rail at a
    // fixed Z left the 8x's front ring hanging over bare receiver.
    const railLen = Math.max(len * 0.3, (railMountedOptic.userData.lengthZ ?? 0.09) + 0.04);
    const rail = railSection(railLen, bodyW * 0.62, MATS.dark());
    rail.position.set(0, topOfMag, aimZ);
    group.add(rail);
  }
  group.userData.sight = sight;
  group.userData.aimPoint = new THREE.Vector3(0, aimY, aimZ);
  // Tube optics bring the eyepiece up to the eye when aimed (see
  // attachment-models.js adsDistance); open sights keep the default.
  group.userData.adsDistance = railMountedOptic?.userData.adsDistance ?? null;
  group.userData.adsWeaponFov = railMountedOptic?.userData.adsWeaponFov ?? null;
  group.userData.muzzleZ = muzzleZ;

  // --- suppressor / muzzle device
  const barrelAtt = def.attachments?.barrel;
  const barrelBuild = BARREL_BUILDERS[barrelAtt];
  if (barrelBuild) {
    const dev = barrelBuild(barrelR);
    const devLen = dev.userData.lengthZ ?? 0.05;
    // Butted against the crown rather than a fixed offset, so a long
    // suppressor and a stubby brake both sit flush on the muzzle.
    dev.position.set(0, bodyH * 0.1, muzzleZ - devLen / 2);
    group.add(dev);
    // The flash now leaves the device's own muzzle, not the bare barrel's.
    group.userData.muzzleZ = muzzleZ - devLen;
  }

  // --- underbarrel
  const under = def.attachments?.underbarrel;
  const underBuild = UNDER_BUILDERS[under];
  if (underBuild) {
    const unit = underBuild();
    // Hung off the handguard's real underside rather than a bodyH fraction —
    // the handguard's own height varies with `heavy`, so a constant offset
    // left grips floating in a visible gap under light-barrelled guns.
    // Grips clamp to the bottom rail; the laser rides the side rail a little
    // higher, tucked against the handguard's flank.
    const hgBottomY = -bodyH * 0.05 - bodyH * 0.275;
    const unitY = under === "laser" ? hgBottomY + 0.012 : hgBottomY;
    const unitZ = -len * (under === "laser" ? 0.44 : 0.42);
    unit.position.set(0, unitY, unitZ);
    group.add(unit);

    if (under === "laser") {
      // Beam starts at the emitter bezel, converted from the unit's local
      // space into weapon space so it leaves the lens rather than the middle
      // of the housing.
      const em = unit.userData.emitter || new THREE.Vector3();
      const originZ = unitZ + em.z;
      const origin = new THREE.Vector3(em.x, unitY + em.y, originZ);

      // The beam itself: a thin, always-facing-forward cylinder the game code
      // rescales to the raycast distance and shows only while aiming, so it
      // reads as an activated sight rather than a cosmetic glued to the rail.
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.85, depthWrite: false });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 1, 6), beamMat);
      beam.rotation.x = Math.PI / 2;   // cylinder's height axis runs along +Z after this
      beam.position.copy(origin);
      beam.visible = false;
      group.add(beam);
      group.userData.laserBeam = beam;
      group.userData.laserOrigin = origin.clone();
    }
  }

  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}
