// Troll Forces — the Tactical Nuke's detonation (TACTICAL-NUKE doc, phase 2).
//
// Everything here is a pure function of the clock (`t`, seconds from zero,
// negative while the missile is still coming) and the map's centre and
// size, so every client draws the same blast with no traffic.
//
//   t -3 .. 0   the missile: in high from the map edge, a smoke trail behind
//   t  0        the flash: a white sphere of light, the ground ring starts
//   t  0 .. 12  the cloud: a stem of smoke climbing, a cap that rolls outward
//               on itself, a fire core cooling from white through orange to
//               dark red to smoke, a dust skirt, and the ground ring racing
//               out through the map. The trollface reads in the cap's smoke.
//
// All sprites; none of it collides or casts. Fog is off on every material:
// the cloud stands far taller than the fog was tuned for.

import * as THREE from "three";

const face = new Image();
face.src = new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;

/* A lumpy smoke puff: a few soft blobs, not one clean circle. */
let smokeTex = null;
function smokeTexture() {
  if (smokeTex) return smokeTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * 26;
    const x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, r = 22 + rnd() * 20;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,.55)");
    grad.addColorStop(0.6, "rgba(255,255,255,.25)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  smokeTex = new THREE.CanvasTexture(c);
  smokeTex.colorSpace = THREE.SRGBColorSpace;
  return smokeTex;
}

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,.6)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

/* The trollface's ink only (its white face made clear), so it shows as
   shadowed lines in the smoke rather than a sticker. Never the emoji. */
function faceInkTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    const g = c.getContext("2d");
    const s = Math.min(256 / face.naturalWidth, 256 / face.naturalHeight);
    const w = face.naturalWidth * s, h = face.naturalHeight * s;
    g.drawImage(face, (256 - w) / 2, (256 - h) / 2, w, h);
    const img = g.getImageData(0, 0, 256, 256), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (d[i] + d[i + 1] + d[i + 2]) / 765;
      d[i + 3] = Math.round(d[i + 3] * Math.max(0, 1 - lum * 1.25));
      d[i] = d[i + 1] = d[i + 2] = 0;
    }
    g.putImageData(img, 0, 0);
    tex.needsUpdate = true;
  };
  if (face.complete && face.naturalWidth) draw(); else face.addEventListener("load", draw, { once: true });
  return tex;
}

const _c = new THREE.Color();
const FIRE = [new THREE.Color(0xfff4d0), new THREE.Color(0xffb04a), new THREE.Color(0xe0521c), new THREE.Color(0x7a2a14)];
/* heat 1 white-hot .. 0 cold, as a fire colour. */
function fireColor(heat, out) {
  const k = Math.max(0, Math.min(1, 1 - heat)) * (FIRE.length - 1);
  const i = Math.min(FIRE.length - 2, Math.floor(k));
  return out.copy(FIRE[i]).lerp(FIRE[i + 1], k - i);
}
const SMOKE_HOT = new THREE.Color(0x8a4a2e);
const SMOKE_COLD = new THREE.Color(0x5e504a);

function sprite(tex, { additive = false } = {}) {
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, fog: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
}

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)) >>> 0) / 4294967296;
}

export const MISSILE_TIME = 3;    // seconds the missile is in the air before zero

export class NukeBlast {
  /* centre: the map's middle at ground height; span: half the map's width;
     yaw: where the missile comes in from (radians round the centre). */
  constructor(scene, { center, span, yaw = 0, seed = 1 }) {
    this.scene = scene;
    this.center = center.clone();
    this.S = Math.max(0.8, Math.min(2.6, span / 34));
    this.yaw = yaw;
    this.root = new THREE.Group();
    this.root.position.copy(this.center);
    scene.add(this.root);
    const r = rng(seed);
    const S = this.S;

    // ---- missile
    this.missile = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4.2, 10), new THREE.MeshStandardMaterial({ color: 0xd8d6cc, roughness: 0.5, metalness: 0.3, fog: false }));
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 10), new THREE.MeshStandardMaterial({ color: 0x3c4030, roughness: 0.6, fog: false }));
    nose.rotation.x = Math.PI / 2;   // lookAt points +Z at the target: the nose leads
    nose.position.z = 2.7;
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.9), body.material);
      fin.position.set(0, 0, -1.7);
      fin.rotation.z = (i * Math.PI) / 2;
      fin.geometry.translate(0, 0.45, 0);
      this.missile.add(fin);
    }
    const flame = sprite(glowTexture(), { additive: true });
    flame.material.color.set(0xffc070);
    flame.scale.setScalar(4);
    flame.position.z = -2.6;
    this.missile.add(body, nose, flame);
    this.missile.visible = false;
    this.root.add(this.missile);
    this.trail = [];
    this.trailAt = -Infinity;
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    this.mFrom = dir.clone().multiplyScalar(span * 2.2 + 60).setY(150 * S);
    this.mTo = new THREE.Vector3(0, 1, 0);

    // ---- flash
    this.flash = sprite(glowTexture(), { additive: true });
    this.flash.material.color.set(0xfff6e0);
    this.flash.visible = false;
    this.root.add(this.flash);
    this.fireball = [];
    for (let i = 0; i < 14; i++) {
      const s = sprite(glowTexture(), { additive: true });
      const a = r() * Math.PI * 2, d = r();
      s.userData = { a, d, size: (18 + r() * 14) * S };
      s.visible = false;
      this.fireball.push(s);
      this.root.add(s);
    }

    // ---- ground ring and the dust it throws up
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 96), new THREE.MeshBasicMaterial({
      color: 0xffc890, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.4;
    this.ring.visible = false;
    this.root.add(this.ring);
    this.dust = [];
    for (let i = 0; i < 56; i++) {
      const s = sprite(smokeTexture());
      s.userData = { a: (i / 56) * Math.PI * 2 + r() * 0.1, j: r(), size: (5 + r() * 5) * S };
      s.visible = false;
      this.dust.push(s);
      this.root.add(s);
    }

    // ---- the cloud: stem, skirt, cap (a rolling torus) and its dome
    this.stem = [];
    for (let i = 0; i < 46; i++) {
      const s = sprite(smokeTexture());
      s.userData = { k: i / 46, a: r() * Math.PI * 2, j: r(), size: (6 + r() * 5) * S, spin: (r() - 0.5) * 0.4 };
      s.visible = false;
      this.stem.push(s);
      this.root.add(s);
    }
    this.skirt = [];
    for (let i = 0; i < 26; i++) {
      const s = sprite(smokeTexture());
      s.userData = { a: (i / 26) * Math.PI * 2 + r() * 0.2, j: r(), size: (10 + r() * 6) * S };
      s.visible = false;
      this.skirt.push(s);
      this.root.add(s);
    }
    this.cap = [];
    for (let i = 0; i < 84; i++) {
      const s = sprite(smokeTexture());
      s.userData = { phi: r() * Math.PI * 2, th: r() * Math.PI * 2, j: r(), size: (15 + r() * 10) * S, spin: (r() - 0.5) * 0.3 };
      s.visible = false;
      this.cap.push(s);
      this.root.add(s);
    }
    this.dome = [];
    for (let i = 0; i < 22; i++) {
      const s = sprite(smokeTexture());
      s.userData = { a: r() * Math.PI * 2, d: Math.sqrt(r()), j: r(), size: (16 + r() * 10) * S };
      s.visible = false;
      this.dome.push(s);
      this.root.add(s);
    }
    this.core = [];
    for (let i = 0; i < 18; i++) {
      const s = sprite(glowTexture(), { additive: true });
      s.userData = { phi: r() * Math.PI * 2, th: r() * Math.PI * 2, j: r(), size: (16 + r() * 12) * S, stem: i < 6 };
      s.visible = false;
      this.core.push(s);
      this.root.add(s);
    }
    this.face = sprite(faceInkTexture());
    this.face.material.color.set(0x2a140c);
    this.face.visible = false;
    this.root.add(this.face);
  }

  /* The cap's height and size at t (seconds after zero). */
  capHeight(t) { return 78 * this.S * (1 - Math.exp(-Math.max(0, t) / 2.4)) + 6 * this.S; }
  capRadius(t) { return 30 * this.S * (1 - Math.exp(-Math.max(0, t) / 2.0)) + 6 * this.S; }
  /* Where a camera should look to frame it (local to the map centre). */
  focus(t, out) { return out.set(0, this.capHeight(t) * 0.62, 0).add(this.center); }

  update(t, dt) {
    this.updateMissile(t, dt);
    if (t < 0) return;
    const S = this.S;
    const h = this.capHeight(t), R = this.capRadius(t), rr = R * 0.5;
    const heat = Math.max(0, 1 - t / 6.5);             // the fire cooling
    const smokeIn = Math.min(1, t / 0.6);

    // Flash: a white sphere of light, gone in a second and a half.
    const fk = Math.max(0, 1 - t / 1.5);
    this.flash.visible = fk > 0;
    this.flash.scale.setScalar((60 + t * 380) * S);
    this.flash.position.set(0, 14 * S + t * 10 * S, 0);
    this.flash.material.opacity = fk * fk;

    // Fireball: the first seconds' white-orange ball, rising into the cap.
    for (const s of this.fireball) {
      const u = s.userData;
      const k = Math.max(0, 1 - t / 4.5);
      s.visible = k > 0;
      if (!s.visible) continue;
      const rad = (8 + t * 6) * S * u.d;
      s.position.set(Math.cos(u.a) * rad, Math.min(h, 10 * S + t * 22 * S) + Math.sin(u.a * 3) * rad * 0.5, Math.sin(u.a) * rad);
      s.scale.setScalar(u.size * (0.6 + Math.min(1, t * 2) * 0.6));
      fireColor(heat * 1.1, s.material.color);
      s.material.opacity = k * 0.9;
    }

    // Ground ring racing out, dust thrown up behind it.
    const ringR = 150 * S * (1 - Math.exp(-t / 1.4));
    const rk = Math.max(0, 1 - t / 4.2);
    this.ring.visible = rk > 0;
    this.ring.scale.setScalar(Math.max(1, ringR));
    this.ring.material.opacity = rk * 0.85;
    for (const s of this.dust) {
      const u = s.userData;
      const dk = Math.min(1, t * 3) * Math.max(0, 1 - (t - 2.5) / 5);
      s.visible = dk > 0;
      if (!s.visible) continue;
      const rad = ringR * (0.93 + u.j * 0.07);
      s.position.set(Math.cos(u.a) * rad, (1.5 + u.j * 3) * S, Math.sin(u.a) * rad);
      s.scale.setScalar(u.size * (1 + t * 0.3));
      s.material.color.copy(SMOKE_COLD).lerp(_c.set(0xb08a62), 0.6);
      s.material.opacity = dk * 0.75;
    }

    // Stem: puffs climbing the column, narrower up top, hot at the base early.
    for (const s of this.stem) {
      const u = s.userData;
      const k = (u.k + t * 0.06) % 1;
      const y = k * h * 0.86;
      const rad = (4.5 - 1.8 * k) * S * (0.4 + u.j * 0.6);
      s.visible = true;
      s.position.set(Math.cos(u.a + t * 0.2) * rad, y, Math.sin(u.a + t * 0.2) * rad);
      s.scale.setScalar(u.size * (0.7 + 0.3 * smokeIn));
      s.material.rotation += u.spin * dt;
      const hot = heat * (1 - k) * 0.9;
      s.material.color.copy(SMOKE_COLD).lerp(SMOKE_HOT, heat * 0.8);
      if (hot > 0.2) s.material.color.lerp(fireColor(hot + 0.2, _c), hot);
      s.material.opacity = smokeIn * 0.92 * Math.min(1, k * 8 + 0.4);
    }

    // Skirt: the dust ring round the stem's foot, spreading and settling.
    for (const s of this.skirt) {
      const u = s.userData;
      const rad = (10 + t * 3.2) * S * (0.8 + u.j * 0.4);
      s.visible = true;
      s.position.set(Math.cos(u.a) * rad, (3 + u.j * 3) * S, Math.sin(u.a) * rad);
      s.scale.setScalar(u.size * (1 + t * 0.12));
      s.material.color.copy(SMOKE_COLD).lerp(_c.set(0x9a7656), 0.5);
      s.material.opacity = smokeIn * 0.8;
    }

    // Cap: a torus rolling outward on itself (the top moves out, the
    // underside comes back in under it), fire inside, smoke outside.
    for (const s of this.cap) {
      const u = s.userData;
      const th = u.th + t * 0.55;
      const ring = R + rr * Math.cos(th) * (0.7 + u.j * 0.4);
      s.visible = true;
      s.position.set(Math.cos(u.phi) * ring, h + rr * Math.sin(th) * 0.6, Math.sin(u.phi) * ring);
      s.scale.setScalar(u.size * (0.5 + 0.5 * smokeIn) * (0.75 + R / (32 * S) * 0.35));
      s.material.rotation += u.spin * dt;
      const inner = Math.max(0, -Math.cos(th));              // the side tucked under, toward the core
      const hot = heat * (0.45 + inner * 0.55);
      s.material.color.copy(SMOKE_COLD).lerp(SMOKE_HOT, Math.min(1, heat * 1.2));
      if (hot > 0.15) s.material.color.lerp(fireColor(hot, _c), Math.min(1, hot * 1.3));
      // Shadowed underneath, lit on top: what makes the cap read as a cap.
      s.material.color.multiplyScalar(0.62 + 0.38 * (0.5 + 0.5 * Math.sin(th)));
      s.material.opacity = smokeIn * 0.95;
    }
    for (const s of this.dome) {
      const u = s.userData;
      const rad = R * 0.85 * u.d;
      s.visible = true;
      s.position.set(Math.cos(u.a) * rad, h + rr * (0.55 + (1 - u.d) * 0.6), Math.sin(u.a) * rad);
      s.scale.setScalar(u.size * (0.5 + 0.5 * smokeIn) * (0.75 + R / (32 * S) * 0.35));
      s.material.color.copy(SMOKE_COLD).lerp(SMOKE_HOT, heat);
      s.material.opacity = smokeIn * 0.95;
    }
    // Fire core glowing through the smoke, cooling.
    for (const s of this.core) {
      const u = s.userData;
      const k = Math.max(0, heat);
      s.visible = k > 0.02;
      if (!s.visible) continue;
      if (u.stem) s.position.set(Math.cos(u.phi) * 3 * S, (0.15 + u.j * 0.5) * h, Math.sin(u.phi) * 3 * S);
      else {
        const th = u.th + t * 0.55;
        s.position.set(Math.cos(u.phi) * (R + rr * 0.3 * Math.cos(th)), h + rr * 0.3 * Math.sin(th), Math.sin(u.phi) * (R + rr * 0.3 * Math.cos(th)));
      }
      s.scale.setScalar(u.size * (0.8 + R / (32 * S) * 0.4));
      fireColor(k, s.material.color);
      s.material.opacity = Math.min(1, k * 1.4) * 0.8;
    }

    // The trollface in the cap's smoke: there once the cap has formed,
    // shadowed, never a crisp sticker.
    const fv = Math.max(0, Math.min(1, (t - 2.2) / 2.5));
    this.face.visible = fv > 0;
    this.face.position.set(0, h + rr * 0.15, 0);
    this.face.scale.setScalar(R * 1.55);
    this.face.material.opacity = fv * 0.32;
    this.face.renderOrder = 2;
  }

  updateMissile(t, dt) {
    const k = (t + MISSILE_TIME) / MISSILE_TIME;
    this.missile.visible = k >= 0 && k < 1;
    if (this.missile.visible) {
      const e = k * k;                                       // speeding up into the dive
      const p = this.missile.position.lerpVectors(this.mFrom, this.mTo, e);
      p.y += Math.sin(k * Math.PI) * 12 * this.S;
      const ahead = new THREE.Vector3().lerpVectors(this.mFrom, this.mTo, Math.min(1, e + 0.02));
      ahead.y += Math.sin(Math.min(1, k + 0.02) * Math.PI) * 12 * this.S;
      this.missile.lookAt(ahead.add(this.center));
      this.missile.scale.setScalar(1.6 * this.S);
      if (t - this.trailAt > 0.035) {
        this.trailAt = t;
        const s = sprite(smokeTexture());
        s.position.copy(p);
        s.userData = { born: t, size: (2.2 + Math.random()) * this.S };
        s.material.color.set(0xe8e2da);
        this.trail.push(s);
        this.root.add(s);
      }
    }
    for (const s of this.trail) {
      const age = t - s.userData.born;
      s.scale.setScalar(s.userData.size * (1 + age * 1.6));
      s.material.opacity = Math.max(0, 0.75 * (1 - age / 5));
      s.visible = s.material.opacity > 0;
    }
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.material) o.material.dispose();
      if (o.geometry && !(o instanceof THREE.Sprite)) o.geometry.dispose();
    });
    this.face.material.map?.dispose();
  }
}
