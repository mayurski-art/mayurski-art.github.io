// Troll Forces — Hollowgrin: the witch's cauldron alive (the user: "ultra
// realistic if possible like emanating fluids"). The pot is Studio's
// (hg-cauldron.glb); this is what boils in it and runs out of it, all live:
// the brew churning in its neck, bubbles that swell and pop, the brew
// welling over the lip and running down the pot's own outside (the drips
// found by rays at the mesh once it loads), drops that bead at the drips'
// ends and fall into a glowing puddle that ripples where they land, gobs
// spat out over the rim now and then, green vapour rolling up off it.
//
// hollowgrin.js calls buildCauldronFx once hg-cauldron.glb has loaded.

import * as THREE from "three";

const BREW = { y: 1.2, r: 0.31 };          // the brew's surface, in the pot's neck
const GREEN = new THREE.Color(0x7cff3a), DEEP = new THREE.Color(0x0c3a12), FOAM = new THREE.Color(0xd8ffb0);

/* ---- shared noise for the brew, the ooze and the puddle */
const NOISE = `
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }`;

/* The brew's surface: thick liquid turning slowly round the pot, its scum
   swirling, bright where it froths and darker in the troughs. */
function brewMaterial(T) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: T, uG: { value: GREEN }, uD: { value: DEEP }, uF: { value: FOAM } },
    vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT; uniform vec3 uG, uD, uF; varying vec2 vP; ${NOISE}
      void main() {
        float r = length(vP), a = atan(vP.y, vP.x + 1e-4);
        vec2 q = vec2(cos(a + uT * 0.35 + r * 4.0), sin(a + uT * 0.35 + r * 4.0)) * r * 9.0;
        float n = fbm(q + vec2(uT * 0.4, -uT * 0.3));
        float froth = smoothstep(0.62, 0.8, fbm(q * 1.8 - uT * 0.6));
        vec3 c = mix(uD, uG * 0.8, n * 1.2) + uF * froth * 0.35;
        c *= 1.0 - smoothstep(0.22, 0.31, r) * 0.55;      // darker against the iron
        gl_FragColor = vec4(c * 0.9, 1.0);
      }`,
  });
}

/* The ooze running down the outside: a wet, glossy green lit like the
   rest of the scene, glowing from within in streaks that run down its
   length (the emissive map scrolls; the ticker moves it). */
function oozeMaterial() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 32;
  const g = c.getContext("2d");
  g.fillStyle = "#0a2a08";
  g.fillRect(0, 0, 256, 32);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60; i++) {
    const x = rnd() * 256, w = 6 + rnd() * 30, y = rnd() * 32, h = 4 + rnd() * 14;
    const gr = g.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, "rgba(90,220,40,0)");
    gr.addColorStop(0.5, `rgba(110,240,50,${0.25 + rnd() * 0.5})`);
    gr.addColorStop(1, "rgba(90,220,40,0)");
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  return new THREE.MeshStandardMaterial({ color: 0x1c5a12, roughness: 0.12, metalness: 0.0, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.85 });
}

/* The puddle the drops run into: glowing, its surface rippling out from
   wherever the last drops landed. */
function puddleMaterial(T, hits) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: T, uG: { value: GREEN }, uD: { value: DEEP }, uHits: { value: hits } },
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT; uniform vec3 uG, uD; uniform vec3 uHits[8]; varying vec2 vP; ${NOISE}
      void main() {
        float a = atan(vP.y, vP.x + 1e-4), L = length(vP);
        float edge = 0.62 + 0.2 * sin(a * 3.0 + 0.7) + 0.1 * sin(a * 7.0 + 2.1) + 0.08 * fbm(vec2(a * 3.0, 1.0));
        float alpha = smoothstep(edge, edge - 0.12, L);
        if (alpha < 0.01) discard;
        float n = fbm(vP * 5.0 + uT * 0.15);
        float rip = 0.0;
        for (int i = 0; i < 8; i++) {
          float age = uT - uHits[i].z;
          if (age < 0.0 || age > 1.6) continue;
          float d = length(vP - uHits[i].xy);
          rip += sin((d - age * 0.45) * 60.0) * exp(-abs(d - age * 0.45) * 18.0) * (1.0 - age / 1.6);
        }
        vec3 c = mix(uD * 0.8, uG * 0.5, 0.2 + n * 0.5) + vec3(0.35, 0.6, 0.3) * max(0.0, rip) * 0.35;
        c += vec3(0.25, 0.45, 0.2) * smoothstep(edge - 0.02, edge - 0.08, L) * smoothstep(edge - 0.16, edge - 0.08, L) * 0.4;   // the wet rim
        gl_FragColor = vec4(c, 0.88 * alpha);
      }`,
  });
}

/* Soft round points (vapour, droplets): each with its own size and alpha. */
function pointsMaterial(color, additive) {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) } },
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `attribute float aS; attribute float aA; varying float vA;
      void main() { vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(aS * 420.0 / -mv.z, 28.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uC; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uC, a); }`,
  });
}

function pointCloud(n, color, additive) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("aS", new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  g.setAttribute("aA", new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  const p = new THREE.Points(g, pointsMaterial(color, additive));
  p.frustumCulled = false;
  return p;
}

export function buildCauldronFx(root, pot, { x, z, ticker, seed = 13 }) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const T = { value: 0 };
  const fx = new THREE.Group();
  fx.position.set(x, 0, z);
  root.add(fx);

  // the brew's surface
  const brew = new THREE.Mesh(new THREE.CircleGeometry(BREW.r, 40), brewMaterial(T));
  brew.rotation.x = -Math.PI / 2;
  brew.position.y = BREW.y;
  fx.add(brew);

  /* ---- find the pot's outside: rays in at the axis, from the lip down */
  pot.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3();
  const hitAt = (a, y) => {
    o.set(x + Math.cos(a) * 1.4, y, z + Math.sin(a) * 1.4);
    d.set(-Math.cos(a), 0, -Math.sin(a));
    ray.set(o, d);
    const h = ray.intersectObject(pot, true)[0];
    if (!h) return null;
    const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : d.clone().negate();
    return { p: h.point.clone(), n };
  };
  // the lip: rays down from above just outside the mouth find its top
  const lipAt = (a) => {
    for (let r = 0.36; r < 0.62; r += 0.02) {
      o.set(x + Math.cos(a) * r, 2.2, z + Math.sin(a) * r);
      ray.set(o, d.set(0, -1, 0));
      const h = ray.intersectObject(pot, true)[0];
      if (h && h.point.y > 1.2) return h.point.clone();
    }
    return null;
  };

  /* ---- drips: the brew over the lip and down the iron, each its own length */
  const ooze = oozeMaterial();
  const drips = [];
  const N = 6;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rnd() * 0.5;
    const lip = lipAt(a);
    if (!lip) continue;
    const pts = [new THREE.Vector3(Math.cos(a) * (BREW.r - 0.04), BREW.y + 0.02, Math.sin(a) * (BREW.r - 0.04)), lip.clone().sub(fx.position).add(new THREE.Vector3(0, 0.025, 0))];
    const reach = 0.25 + rnd() * 0.85;                  // how far down the pot it has run
    const yEnd = Math.max(0.12, lip.y - reach * (lip.y - 0.12));
    let wander = 0;
    for (let y = lip.y - 0.04; y > yEnd; y -= 0.05) {
      wander += (rnd() - 0.5) * 0.05;
      const h = hitAt(a + wander, y);
      if (!h) break;
      const p = h.p.add(h.n.multiplyScalar(0.012)).sub(fx.position);
      if (p.distanceTo(pts[pts.length - 1]) > 0.025) pts.push(p);    // (two hits on one spot would bend the tube to NaN)
    }
    if (pts.length < 4) continue;
    const curve = new THREE.CatmullRomCurve3(pts);
    const r0 = 0.014 + rnd() * 0.012;
    const tube = new THREE.TubeGeometry(curve, pts.length * 4, r0, 6, false);
    // thicker where it pools at the lip, thinning as it runs down
    const pos = tube.attributes.position, uv = tube.attributes.uv;
    const c = new THREE.Vector3();
    for (let k = 0; k < pos.count; k++) {
      const u = uv.getX(k);
      const t = Math.min(1, u * pts.length / 2);
      curve.getPointAt(Math.min(1, u), c);
      const sc = (0.6 + 0.9 * (1 - t) * 0.6 + 0.4 * Math.sin(u * 17 + i)) * (u > 0.97 ? 1.6 : 1);
      pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * sc, c.y + (pos.getY(k) - c.y) * sc, c.z + (pos.getZ(k) - c.z) * sc);
    }
    tube.computeVertexNormals();
    if (tube.attributes.position.array.some(Number.isNaN) || tube.attributes.normal.array.some(Number.isNaN)) { tube.dispose(); continue; }
    fx.add(new THREE.Mesh(tube, ooze));
    const end = pts[pts.length - 1];
    const bead = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), ooze);
    bead.position.copy(end);
    fx.add(bead);
    drips.push({ end, bead, out: new THREE.Vector3(end.x, 0, end.z).normalize(), grow: 1.2 + rnd() * 2.5, t: rnd() * 2, fall: null, r0 });
  }

  // the brew welling over the lip all round: a swollen, uneven ring
  {
    const lipR = [], lipY = [];
    for (let k = 0; k < 24; k++) { const p = lipAt((k / 24) * Math.PI * 2); if (p) { lipR.push(Math.hypot(p.x - x, p.z - z)); lipY.push(p.y); } }
    if (lipR.length) {
      const R = lipR.reduce((m, v) => m + v, 0) / lipR.length - 0.03, Y = lipY.reduce((m, v) => m + v, 0) / lipY.length;
      const ring = new THREE.TorusGeometry(R, 0.03, 8, 64);
      const pos = ring.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const px = pos.getX(k), py = pos.getY(k), pz = pos.getZ(k);
        const ang = Math.atan2(py, px), w = 0.6 + 0.8 * Math.max(0, Math.sin(ang * 3 + 1) * Math.sin(ang * 5));
        const cx = Math.cos(ang) * R, cy = Math.sin(ang) * R;
        pos.setXYZ(k, cx + (px - cx) * w, cy + (py - cy) * w, pz * w);
      }
      ring.computeVertexNormals();
      const m = new THREE.Mesh(ring, ooze);
      m.rotation.x = -Math.PI / 2;
      m.position.y = Y + 0.01;
      fx.add(m);
    }
  }

  /* ---- the puddle round the foot */
  const hits = Array.from({ length: 8 }, () => new THREE.Vector3(0, 0, -99));
  let hitI = 0;
  {
    const pud = new THREE.Mesh(new THREE.CircleGeometry(1.05, 48), puddleMaterial(T, hits));
    pud.rotation.x = -Math.PI / 2;
    pud.position.y = 0.03;
    pud.renderOrder = 1;
    fx.add(pud);
  }
  const splash = (px, pz) => { hits[hitI].set(px, -pz, T.value); hitI = (hitI + 1) % hits.length; };

  /* ---- bubbles in the brew: swell, wobble, pop */
  const NB = 18;
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9cff5a).multiplyScalar(1.3), transparent: true, opacity: 0.9 }), NB);
  bubbles.frustumCulled = false;
  fx.add(bubbles);
  const bub = Array.from({ length: NB }, () => ({ t: -rnd() * 2, life: 0.6 + rnd() * 1.2, x: 0, z: 0, s: 0 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sv = new THREE.Vector3();

  /* ---- droplets (pops, spits, falling drops) and vapour */
  const ND = 60, drops = pointCloud(ND, 0x56c832, false);
  fx.add(drops);
  const dl = Array.from({ length: ND }, () => ({ live: false, p: new THREE.Vector3(), v: new THREE.Vector3(), s: 0 }));
  const spit = (p, vel, sz) => { const e = dl.find((x) => !x.live); if (!e) return; e.live = true; e.p.copy(p); e.v.copy(vel); e.s = sz; };
  const NV = 28, vapour = pointCloud(NV, 0x4ad87a, true);
  fx.add(vapour);
  const vp = Array.from({ length: NV }, () => ({ t: -rnd() * 4, life: 3 + rnd() * 2.5, p: new THREE.Vector3(), w: rnd() * 6 }));

  let last = performance.now() / 1000, nextSpit = 2;
  fx.add(ticker(() => {
    const now = performance.now() / 1000, dt = Math.min(0.05, now - last);
    last = now;
    T.value = now % 1000;
    ooze.emissiveMap.offset.x = -(now * 0.35) % 1;     // the streaks run down the drips

    // bubbles
    bub.forEach((b, i) => {
      b.t += dt;
      if (b.t > b.life) {
        // pop: a ring on the surface, a few flecks thrown up
        for (let k = 0; k < 2 + (i % 3); k++) spit(v.set(b.x, BREW.y + 0.02, b.z), new THREE.Vector3((rnd() - 0.5) * 0.6, 0.8 + rnd() * 0.9, (rnd() - 0.5) * 0.6), 0.012 + rnd() * 0.01);
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (BREW.r - 0.06);
        Object.assign(b, { t: 0, life: 0.5 + rnd() * 1.4, x: Math.cos(a) * r, z: Math.sin(a) * r, s: 0.02 + rnd() * 0.05 });
      }
      const k = Math.max(0, b.t / b.life), sc = b.s * Math.sin(Math.min(1, k * 1.15) * Math.PI * 0.5) * (1 + 0.08 * Math.sin(now * 20 + i));
      m4.compose(v.set(b.x, BREW.y - 0.005, b.z), q.identity(), sv.set(sc, sc * 0.75, sc));
      bubbles.setMatrixAt(i, m4);
    });
    bubbles.instanceMatrix.needsUpdate = true;

    // drips: the bead at each end swells, lets go, falls, splashes
    for (const dr of drips) {
      if (!dr.fall) {
        dr.t += dt;
        const k = Math.min(1, dr.t / dr.grow), r = dr.r0 * (1.2 + 1.6 * k);
        dr.bead.scale.set(r, r * (1 + k * 0.6), r);
        dr.bead.position.set(dr.end.x, dr.end.y - k * 0.02, dr.end.z);
        if (k >= 1) dr.fall = { p: dr.bead.position.clone().addScaledVector(dr.out, 0.02), vy: 0 };
      } else {
        dr.fall.vy -= 9.8 * dt;
        dr.fall.p.y += dr.fall.vy * dt;
        dr.bead.position.copy(dr.fall.p);
        dr.bead.scale.setScalar(dr.r0 * 2.2);
        if (dr.fall.p.y < 0.04) {
          splash(dr.fall.p.x, dr.fall.p.z);
          for (let k = 0; k < 3; k++) spit(v.set(dr.fall.p.x, 0.05, dr.fall.p.z), new THREE.Vector3((rnd() - 0.5) * 0.8, 0.6 + rnd() * 0.5, (rnd() - 0.5) * 0.8), 0.01);
          dr.fall = null;
          dr.t = 0;
          dr.grow = 1.2 + rnd() * 2.5;
        }
      }
    }

    // now and then the brew heaves and spits a gob over the rim
    nextSpit -= dt;
    if (nextSpit < 0) {
      nextSpit = 2.5 + rnd() * 4;
      const a = rnd() * Math.PI * 2;
      for (let k = 0; k < 7; k++) {
        const sp = 1.1 + rnd() * 0.9;
        spit(v.set(Math.cos(a) * 0.1, BREW.y + 0.03, Math.sin(a) * 0.1), new THREE.Vector3(Math.cos(a + (rnd() - 0.5) * 0.6) * sp * 0.55, 2.0 + rnd() * 1.4, Math.sin(a + (rnd() - 0.5) * 0.6) * sp * 0.55), 0.02 + rnd() * 0.025);
      }
    }

    // droplets in flight: up, over, down; onto the pot's lip or the puddle
    const dp = drops.geometry.attributes.position, ds = drops.geometry.attributes.aS, da = drops.geometry.attributes.aA;
    dl.forEach((e, i) => {
      if (e.live) {
        e.v.y -= 9.8 * dt;
        e.p.addScaledVector(e.v, dt);
        const r = Math.hypot(e.p.x, e.p.z);
        if (e.v.y < 0 && ((r < BREW.r && e.p.y < BREW.y) || e.p.y < 0.04)) {
          if (e.p.y < 0.05) splash(e.p.x, e.p.z);
          e.live = false;
        }
      }
      dp.setXYZ(i, e.p.x, e.p.y, e.p.z);
      ds.setX(i, e.live ? e.s : 0);
      da.setX(i, e.live ? 0.95 : 0);
    });
    dp.needsUpdate = ds.needsUpdate = da.needsUpdate = true;

    // vapour: off the brew, rolling up and out, swelling and thinning
    const vpp = vapour.geometry.attributes.position, vs = vapour.geometry.attributes.aS, va = vapour.geometry.attributes.aA;
    vp.forEach((e, i) => {
      e.t += dt;
      if (e.t > e.life || e.t < 0) {
        if (e.t > e.life) {
          const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * BREW.r * 0.8;
          e.p.set(Math.cos(a) * r, BREW.y + 0.03, Math.sin(a) * r);
          e.t = 0;
          e.life = 3 + rnd() * 2.5;
        }
      } else {
        const k = e.t / e.life;
        e.p.x += Math.sin(now * 0.7 + e.w) * 0.05 * dt + e.p.x * 0.12 * dt;
        e.p.z += Math.cos(now * 0.6 + e.w) * 0.05 * dt + e.p.z * 0.12 * dt;
        e.p.y += (0.32 - k * 0.12) * dt;
      }
      const k = Math.max(0, Math.min(1, e.t / e.life));
      vpp.setXYZ(i, e.p.x, e.p.y, e.p.z);
      vs.setX(i, e.t < 0 ? 0 : 0.14 + k * 0.6);
      va.setX(i, e.t < 0 ? 0 : 0.055 * Math.sin(k * Math.PI));
    });
    vpp.needsUpdate = vs.needsUpdate = va.needsUpdate = true;
  }));
}
