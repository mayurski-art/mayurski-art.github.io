// Troll Ops — attachment geometry.
//
// Every optic, muzzle device and underbarrel gets its own build function here
// rather than the three generic shapes weapon-model.js used to draw from
// `def.sight` alone. That collapse was visible in the lobby: Reflex and Coyote
// were the same torus, ACOG and the 8x scope the same tube, so half the
// Customize screen changed the stats and nothing on the gun.
//
// Each builder returns a THREE.Group whose local origin is the point the eye
// looks THROUGH — the glass centre on an optic, the bore line on a muzzle
// device. weapon-model.js positions the group by that origin and reads
// `userData.aimOffsetY` / `userData.lengthZ` back out, so the ADS aim point
// and the muzzle-flash anchor follow the attachment's real dimensions instead
// of a constant guess per sight family.

import * as THREE from "three";

// Shared material factory. Attachments are aftermarket parts, so they read a
// touch darker and less polished than the receiver they clamp onto — that
// contrast is what makes a suppressor look bolted on rather than machined in.
const M = {
  housing: () => new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.52, metalness: 0.68 }),
  shell:   () => new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.44, metalness: 0.8 }),
  rail:    () => new THREE.MeshStandardMaterial({ color: 0x35383a, roughness: 0.6, metalness: 0.55 }),
  rubber:  () => new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.92, metalness: 0.04 }),
  knob:    () => new THREE.MeshStandardMaterial({ color: 0x2e3135, roughness: 0.38, metalness: 0.85 }),
};

// Optic glass: a faint blue-green coated lens. Double-sided and lightly
// transparent so you can see the tube wall behind it from an angle, which is
// what sells it as glass rather than a painted disc.
function glassMat(tint = 0x2a5c6e) {
  return new THREE.MeshStandardMaterial({
    color: tint, roughness: 0.08, metalness: 0.2,
    transparent: true, opacity: 0.55, side: THREE.DoubleSide,
  });
}

// The illuminated element. Basic + depthTest:false so the dot/chevron stays
// visible through the tube while aiming, exactly as the old red dot did.
function reticleMat(color) {
  return new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthTest: false, transparent: true });
}

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function tube(rt, rb, h, mat, seg = 16) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); }

/* A length of picatinny rail: the repeated cross-slots are what read as
   "rail" at a glance, so they're modelled rather than textured. */
function railSection(length, width, mat) {
  const g = new THREE.Group();
  const base = box(width, 0.008, length, mat);
  g.add(base);
  const slots = Math.max(2, Math.round(length / 0.018));
  for (let i = 0; i < slots; i++) {
    const t = (i + 0.5) / slots - 0.5;
    const tooth = box(width * 0.92, 0.007, length / slots * 0.55, mat);
    tooth.position.set(0, 0.0072, t * length);
    g.add(tooth);
  }
  return g;
}

/* Turret caps — the windage/elevation knobs that make a scope read as a
   scope from any angle. Ribbed so they catch the key light. */
function turret(radius, height, mat) {
  const g = new THREE.Group();
  const body = tube(radius, radius * 1.08, height, mat, 12);
  g.add(body);
  const cap = tube(radius * 0.82, radius * 0.82, height * 0.22, mat, 12);
  cap.position.y = height * 0.58;
  g.add(cap);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rib = box(0.0035, height * 0.8, 0.0035, mat);
    rib.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    g.add(rib);
  }
  return g;
}

/* Mount legs + thumbscrews clamping an optic down onto the receiver rail.
   `drop` is how far below the glass centre the rail sits. */
function opticMount(drop, width, spread, mat) {
  const g = new THREE.Group();
  for (const z of spread) {
    const leg = box(width, drop, 0.014, mat);
    leg.position.set(0, -drop / 2, z);
    g.add(leg);
    const shoe = box(width * 1.5, 0.008, 0.02, mat);
    shoe.position.set(0, -drop, z);
    g.add(shoe);
    const screw = tube(0.005, 0.005, width * 1.7, M.knob(), 8);
    screw.rotation.z = Math.PI / 2;
    screw.position.set(0, -drop + 0.004, z);
    g.add(screw);
  }
  return g;
}

/* ---------------------------------------------------------------- optics */

/* Reflex: an open-frame micro dot. No tube — a canted glass pane in a
   squared-off hood, which is what distinguishes it from the Coyote below. */
function buildReflex() {
  const g = new THREE.Group();
  const shell = M.shell();

  // Open hood: two side walls and a roof, leaving the front/back clear.
  const wallH = 0.036, wallD = 0.034;
  for (const x of [-0.019, 0.019]) {
    const wall = box(0.005, wallH, wallD, shell);
    wall.position.set(x, 0, 0);
    g.add(wall);
  }
  const roof = box(0.043, 0.005, wallD, shell);
  roof.position.y = wallH / 2;
  g.add(roof);

  // Canted glass — reflex sights lean the lens back toward the shooter.
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.032, 0.03), glassMat(0x2f6b58));
  glass.rotation.x = -0.22;
  g.add(glass);

  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0022, 12), reticleMat(0xff2a2a));
  dot.position.z = 0.004;
  dot.renderOrder = 10;
  g.add(dot);

  // Body block below the glass holds the battery + brightness rocker.
  const body = box(0.04, 0.016, 0.042, shell);
  body.position.y = -wallH / 2 - 0.006;
  g.add(body);
  const battery = tube(0.008, 0.008, 0.012, M.knob(), 10);
  battery.rotation.z = Math.PI / 2;
  battery.position.set(0.024, -wallH / 2 - 0.006, 0);
  g.add(battery);

  g.add(opticMount(0.03, 0.03, [-0.012, 0.012], M.rail()));
  g.userData.aimOffsetY = 0.048;   // glass centre above the rail surface
  g.userData.lengthZ = 0.05;
  return g;
}

/* Coyote: a closed tube dot — bigger glass, taller mount, visibly more
   optic than the Reflex even though both are "reddot" to the stat code. */
function buildCoyote() {
  const g = new THREE.Group();
  const shell = M.shell();
  const len = 0.062, r = 0.021;

  const body = tube(r, r, len, shell, 18);
  body.rotation.x = Math.PI / 2;
  g.add(body);

  // Flared objective + eyepiece rings so the tube has ends, not flat cuts.
  for (const [z, rr] of [[-len / 2, r * 1.14], [len / 2, r * 1.1]]) {
    const ring = tube(rr, rr, 0.007, shell, 18);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = z;
    g.add(ring);
  }

  const glass = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 18), glassMat(0x2b5f72));
  glass.position.z = -len / 2 + 0.004;
  g.add(glass);

  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0024, 12), reticleMat(0xff3322));
  dot.position.z = -len / 2 + 0.006;
  dot.renderOrder = 10;
  g.add(dot);

  // Brightness turret on top, killflash-style shade on the objective.
  const t = turret(0.009, 0.016, M.knob());
  t.position.set(0, r * 0.85, 0.006);
  g.add(t);
  const shade = tube(r * 1.16, r * 1.16, 0.014, shell, 18);
  shade.rotation.x = Math.PI / 2;
  shade.position.z = -len / 2 - 0.007;
  g.add(shade);

  g.add(opticMount(0.032, 0.026, [-0.016, 0.016], M.rail()));
  g.userData.aimOffsetY = 0.053;
  g.userData.lengthZ = 0.09;
  return g;
}

/* ACOG 4x: a stubby, fat prism scope with the characteristic forward taper
   and a fibre-optic light pipe along the top. Deliberately shorter and
   chunkier than the 8x so the two never read the same. */
function buildAcog() {
  const g = new THREE.Group();
  const shell = M.shell();
  const len = 0.105;

  // Tapered body — wide objective, narrow eyepiece.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.028, len, 18), shell);
  body.rotation.x = -Math.PI / 2;   // wide end forward (-Z)
  g.add(body);

  const bell = tube(0.031, 0.031, 0.012, shell, 18);
  bell.rotation.x = Math.PI / 2;
  bell.position.z = -len / 2 - 0.005;
  g.add(bell);

  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.027, 18), glassMat(0x3a6a3c));
  glass.position.z = -len / 2 - 0.009;
  g.add(glass);

  // Rubber eyecup at the rear — an ACOG tell.
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.017, 0.018, 16), M.rubber());
  cup.rotation.x = Math.PI / 2;
  cup.position.z = len / 2 + 0.008;
  g.add(cup);

  // Chevron reticle, illuminated amber like the real fibre-optic element.
  const chev = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.006, 3), reticleMat(0xffb020));
  chev.rotation.x = Math.PI / 2;
  chev.position.z = -len / 2;
  chev.renderOrder = 10;
  g.add(chev);

  // Fibre-optic light pipe: the amber stripe running along the top.
  const pipe = tube(0.0035, 0.0035, len * 0.62, new THREE.MeshStandardMaterial({
    color: 0xffb020, emissive: 0xff9500, emissiveIntensity: 0.9, roughness: 0.3,
  }), 8);
  pipe.rotation.x = Math.PI / 2;
  pipe.position.set(0, 0.024, 0.004);
  g.add(pipe);

  const t = turret(0.008, 0.013, M.knob());
  t.position.set(0.02, 0.012, len * 0.2);
  t.rotation.z = -Math.PI / 2;
  g.add(t);

  g.add(opticMount(0.034, 0.03, [-0.02, 0.022], M.rail()));
  g.userData.aimOffsetY = 0.056;
  g.userData.lengthZ = 0.14;
  return g;
}

/* Sniper scope 8x: long, slim, ringed — the silhouette people read as
   "sniper" from across the lobby. Long enough to overhang the receiver. */
function buildScope8() {
  const g = new THREE.Group();
  const shell = M.shell();
  const len = 0.19, r = 0.018;

  const body = tube(r, r, len, shell, 20);
  body.rotation.x = Math.PI / 2;
  g.add(body);

  // Objective bell at the front, eyepiece swell at the back.
  const bellLen = 0.044;
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.03, r, bellLen, 20), shell);
  bell.rotation.x = -Math.PI / 2;
  bell.position.z = -len / 2 - bellLen / 2 + 0.002;
  g.add(bell);
  const hood = tube(0.031, 0.031, 0.012, shell, 20);
  hood.rotation.x = Math.PI / 2;
  hood.position.z = -len / 2 - bellLen;
  g.add(hood);

  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.028, 20), glassMat(0x24506b));
  glass.position.z = -len / 2 - bellLen - 0.005;
  g.add(glass);

  const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.02, 0.026, 18), shell);
  eye.rotation.x = Math.PI / 2;
  eye.position.z = len / 2 + 0.012;
  g.add(eye);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 0.01, 18), M.rubber());
  cup.rotation.x = Math.PI / 2;
  cup.position.z = len / 2 + 0.03;
  g.add(cup);

  // Crosshair at the objective end, drawn over the tube.
  const cross = new THREE.Group();
  const rm = reticleMat(0x1a1a1a);
  const hLine = box(0.05, 0.0012, 0.0012, rm);
  const vLine = box(0.0012, 0.05, 0.0012, rm);
  cross.add(hLine, vLine);
  cross.position.z = -len / 2 - bellLen - 0.004;
  cross.renderOrder = 10;
  g.add(cross);

  // Magnification ring + both turrets — the details that say "8x".
  const magRing = tube(r * 1.25, r * 1.25, 0.016, M.knob(), 20);
  magRing.rotation.x = Math.PI / 2;
  magRing.position.z = len * 0.3;
  g.add(magRing);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const ridge = box(0.003, 0.003, 0.016, M.knob());
    ridge.position.set(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25, len * 0.3);
    g.add(ridge);
  }

  const elev = turret(0.011, 0.02, M.knob());
  elev.position.set(0, r + 0.008, -len * 0.05);
  g.add(elev);
  const wind = turret(0.01, 0.017, M.knob());
  wind.rotation.z = -Math.PI / 2;
  wind.position.set(r + 0.007, 0, -len * 0.05);
  g.add(wind);

  // Two-ring mount, spread wide like real scope rings.
  const drop = 0.036;
  for (const z of [-len * 0.26, len * 0.26]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.004, 0.005, 8, 18), M.rail());
    ring.position.z = z;
    g.add(ring);
  }
  g.add(opticMount(drop, 0.026, [-len * 0.26, len * 0.26], M.rail()));

  g.userData.aimOffsetY = 0.058;
  g.userData.lengthZ = len + bellLen + 0.05;
  return g;
}

/* Iron sights: a proper rear aperture + hooded front post, replacing the two
   featureless nubs. Built as one unit so the pair stays consistent, with the
   front post placed by the caller (it rides the barrel, not the receiver). */
function buildIronRear() {
  const g = new THREE.Group();
  const shell = M.shell();
  // Rear aperture: a ring on two ears, so you sight through a hole.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0065, 0.0022, 6, 14), shell);
  g.add(ring);
  for (const x of [-0.011, 0.011]) {
    const ear = box(0.004, 0.02, 0.006, shell);
    ear.position.set(x, 0.002, 0);
    g.add(ear);
  }
  const base = box(0.026, 0.006, 0.012, shell);
  base.position.y = -0.012;
  g.add(base);
  return g;
}

function buildIronFront() {
  const g = new THREE.Group();
  const shell = M.shell();
  const post = box(0.0035, 0.018, 0.004, shell);
  post.position.y = 0.002;
  g.add(post);
  // Protective wings either side of the post — the classic front-sight look.
  for (const x of [-0.009, 0.009]) {
    const wing = box(0.0035, 0.021, 0.005, shell);
    wing.position.set(x, 0.003, 0);
    g.add(wing);
  }
  const ramp = box(0.022, 0.006, 0.016, shell);
  ramp.position.y = -0.008;
  g.add(ramp);
  return g;
}

/* --------------------------------------------------------------- barrels */

/* Suppressor: a ribbed can with a visible mounting collar, instead of one
   smooth cylinder. `barrelR` keeps it proportional to the host barrel. */
function buildSuppressor(barrelR) {
  const g = new THREE.Group();
  const shell = M.shell();
  const r = barrelR * 1.95;
  const len = 0.15;

  const can = tube(r, r, len, shell, 18);
  can.rotation.x = Math.PI / 2;
  g.add(can);

  // Cooling ribs — eight bands down the body.
  for (let i = 0; i < 8; i++) {
    const rib = tube(r * 1.07, r * 1.07, 0.005, M.housing(), 18);
    rib.rotation.x = Math.PI / 2;
    rib.position.z = -len / 2 + 0.014 + i * (len - 0.028) / 7;
    g.add(rib);
  }

  // Knurled collar where it threads onto the barrel.
  const collar = tube(r * 1.2, r * 1.2, 0.018, M.knob(), 18);
  collar.rotation.x = Math.PI / 2;
  collar.position.z = len / 2 - 0.004;
  g.add(collar);

  // Recessed crown at the muzzle end so it isn't a flat disc.
  const crown = tube(r * 0.55, r * 0.9, 0.012, M.housing(), 18);
  crown.rotation.x = Math.PI / 2;
  crown.position.z = -len / 2 + 0.005;
  g.add(crown);

  g.userData.lengthZ = len;
  return g;
}

/* Compensator: top-vented, to sell "cuts vertical climb" — the ports face
   up because that's the direction of gas the device is redirecting. */
function buildCompensator(barrelR) {
  const g = new THREE.Group();
  const shell = M.shell();
  const r = barrelR * 1.5;
  const len = 0.058;

  const body = tube(r, r * 1.05, len, shell, 14);
  body.rotation.x = Math.PI / 2;
  g.add(body);

  // Three expansion chambers cut into the top.
  for (let i = 0; i < 3; i++) {
    const port = box(r * 1.1, r * 1.4, 0.006, M.housing());
    port.position.set(0, r * 0.55, -len / 2 + 0.012 + i * 0.015);
    g.add(port);
  }
  const collar = tube(r * 1.15, r * 1.15, 0.008, M.knob(), 14);
  collar.rotation.x = Math.PI / 2;
  collar.position.z = len / 2 - 0.003;
  g.add(collar);
  const crown = tube(r * 0.5, r * 0.8, 0.008, M.housing(), 14);
  crown.rotation.x = Math.PI / 2;
  crown.position.z = -len / 2 + 0.003;
  g.add(crown);

  g.userData.lengthZ = len;
  return g;
}

/* Muzzle brake: side-ported, wider than it is tall — the horizontal baffles
   are what distinguish it from the compensator at a glance. */
function buildBrake(barrelR) {
  const g = new THREE.Group();
  const shell = M.shell();
  const r = barrelR * 1.45;
  const len = 0.055;

  const body = box(r * 2.5, r * 1.9, len, shell);
  g.add(body);

  // Three baffle slots cut through each side.
  for (let i = 0; i < 3; i++) {
    const z = -len / 2 + 0.011 + i * 0.015;
    for (const x of [-r * 1.25, r * 1.25]) {
      const slot = box(0.005, r * 1.5, 0.007, M.housing());
      slot.position.set(x, 0, z);
      g.add(slot);
    }
  }
  const collar = tube(r * 1.1, r * 1.1, 0.01, M.knob(), 14);
  collar.rotation.x = Math.PI / 2;
  collar.position.z = len / 2 - 0.004;
  g.add(collar);
  const bore = tube(r * 0.5, r * 0.5, 0.01, M.housing(), 12);
  bore.rotation.x = Math.PI / 2;
  bore.position.z = -len / 2 + 0.004;
  g.add(bore);

  g.userData.lengthZ = len;
  return g;
}

/* ----------------------------------------------------------- underbarrel */

/* Vertical grip: a ribbed column with a flared base and a rail clamp, rather
   than a plain box. */
function buildVertGrip() {
  const g = new THREE.Group();
  const shell = M.shell();
  const h = 0.082;

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, h, 12), M.rubber());
  shaft.position.y = -h / 2;
  g.add(shaft);
  // Finger grooves.
  for (let i = 0; i < 4; i++) {
    const groove = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0022, 6, 12), shell);
    groove.rotation.x = Math.PI / 2;
    groove.position.y = -0.018 - i * 0.017;
    g.add(groove);
  }
  const cap = tube(0.019, 0.019, 0.008, shell, 12);
  cap.position.y = -h;
  g.add(cap);
  // Rail clamp on top.
  const clamp = box(0.028, 0.012, 0.03, M.rail());
  g.add(clamp);
  const screw = tube(0.004, 0.004, 0.032, M.knob(), 8);
  screw.rotation.z = Math.PI / 2;
  g.add(screw);
  return g;
}

/* Angled grip: a raked wedge with a textured face, canted forward. */
function buildAngledGrip() {
  const g = new THREE.Group();
  const shell = M.shell();

  const body = box(0.026, 0.05, 0.062, M.rubber());
  body.rotation.x = -0.55;
  body.position.set(0, -0.028, -0.004);
  g.add(body);
  // Grip texturing: raised ridges across the palm face.
  for (let i = 0; i < 5; i++) {
    const ridge = box(0.028, 0.003, 0.004, shell);
    ridge.rotation.x = -0.55;
    ridge.position.set(0, -0.012 - i * 0.011, 0.014 - i * 0.007);
    g.add(ridge);
  }
  const clamp = box(0.03, 0.012, 0.038, M.rail());
  g.add(clamp);
  const screw = tube(0.004, 0.004, 0.034, M.knob(), 8);
  screw.rotation.z = Math.PI / 2;
  g.add(screw);
  return g;
}

/* Laser unit: a proper housing with a pressure-switch tail and an emitter
   bezel, so the beam has something believable to come out of. */
function buildLaserUnit() {
  const g = new THREE.Group();
  const shell = M.shell();

  const body = box(0.026, 0.024, 0.06, shell);
  g.add(body);
  // Emitter bezel at the front.
  const bezel = tube(0.008, 0.008, 0.008, M.knob(), 12);
  bezel.rotation.x = Math.PI / 2;
  bezel.position.z = -0.032;
  g.add(bezel);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.0055, 12), reticleMat(0xff3b30));
  lens.position.z = -0.0365;
  lens.renderOrder = 9;
  g.add(lens);
  // Activation pad + cable tail running back along the rail.
  const pad = box(0.018, 0.008, 0.014, M.rubber());
  pad.position.set(0, -0.013, 0.02);
  g.add(pad);
  const cable = tube(0.003, 0.003, 0.03, M.rubber(), 8);
  cable.rotation.x = Math.PI / 2.4;
  cable.position.set(0, -0.006, 0.042);
  g.add(cable);
  const clamp = box(0.03, 0.01, 0.03, M.rail());
  clamp.position.y = 0.016;
  g.add(clamp);

  // Where the beam starts, in this unit's local space — weapon-model.js
  // converts it into weapon space so the beam leaves the emitter, not the
  // middle of the housing.
  g.userData.emitter = new THREE.Vector3(0, 0, -0.0365);
  return g;
}

/* ------------------------------------------------------------- registry */

export const OPTIC_BUILDERS = {
  reflex: buildReflex,
  coyote: buildCoyote,
  acog: buildAcog,
  scope8: buildScope8,
};

export const BARREL_BUILDERS = {
  suppressor: buildSuppressor,
  comp: buildCompensator,
  brake: buildBrake,
};

export const UNDER_BUILDERS = {
  vert: buildVertGrip,
  angled: buildAngledGrip,
  laser: buildLaserUnit,
};

export { buildIronRear, buildIronFront, railSection };
