/* ============================================================================
   TROLL RACER — main engine.

   Racing on a circuit whose centreline is the classic trollface: the lap runs
   the head silhouette over the brow, then cuts back through the middle along
   the grin. Two grin-corner hairpins bookend the infield section.

   Sections:
     1. bootstrap + renderer/post stack
     2. environment (sky, sun, env map, scenery)
     3. vehicle physics
     4. AI drivers
     5. race director (lights, laps, timing, standings)
     6. camera + HUD + input
   ============================================================================ */
// "three" resolves through the importmap in troll-racer.html; the addons are
// relative to THIS file (assets/games/troll-racer/) and import "three" too, so
// they share the one vendored copy rather than pulling a second instance.
import * as THREE from "three";
import { EffectComposer } from "../../vendor/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../../vendor/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../../vendor/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "../../vendor/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "../../vendor/addons/shaders/FXAAShader.js";
import { OutputPass } from "../../vendor/addons/postprocessing/OutputPass.js";

(() => {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const PI2 = Math.PI * 2;
  const angDiff = (a, b) => { let d = (a - b) % PI2; if (d > Math.PI) d -= PI2; if (d < -Math.PI) d += PI2; return d; };

  const el = {
    shell: $("#tr-shell"),
    canvas: $("#tr-canvas"),
    boot: $("#tr-boot"),
    bootBar: $("#tr-boot-bar span"),
    bootSub: $("#tr-boot-sub"),
    hud: $("#tr-hud"),
    lap: $("#tr-lap"),
    lapTotal: $("#tr-lap-total"),
    pos: $("#tr-pos"),
    posTotal: $("#tr-pos-total"),
    cur: $("#tr-cur"),
    best: $("#tr-best"),
    last: $("#tr-last"),
    delta: $("#tr-delta"),
    speed: $("#tr-speed"),
    gear: $("#tr-gear"),
    rev: $("#tr-rev"),
    revBar: $("#tr-rev span"),
    banner: $("#tr-banner"),
    warn: $("#tr-warn"),
    mapDot: $("#tr-map-dot"),
    mapAi: $("#tr-map-ai"),
    setup: $("#tr-setup"),
    results: $("#tr-results"),
    resultsBody: $("#tr-results-body"),
    resultsTitle: $("#tr-results-title"),
    resultsSub: $("#tr-results-sub"),
    touch: $("#tr-touch"),
    pause: $("#tr-pause"),
  };

  /* =========================================================== 1. bootstrap */
  const LAPS_BY_LEN = { 2: 2, 3: 3, 5: 5 };
  const state = {
    phase: "menu",          // menu | countdown | racing | finished | paused
    laps: 3,
    difficulty: "pro",
    color: 0x4dff73,
    started: 0,
    t: 0,
  };

  let renderer, scene, camera, composer, fxaaPass, bloomPass, clock;
  let track, envMap;
  let player = null;
  const cars = [];
  let sun, sunTarget;

  const setBoot = (pct, msg) => {
    if (el.bootBar) el.bootBar.style.width = pct + "%";
    if (msg && el.bootSub) el.bootSub.textContent = msg;
  };

  // Phones can't carry a 2048² shadow map, bloom and a 2x buffer at once. Pick
  // a tier up front from the device, then let the adaptive governor below walk
  // it down further if frames are actually slow.
  const isPhone = matchMedia("(pointer: coarse)").matches && Math.min(innerWidth, innerHeight) < 900;
  const QUALITY = isPhone
    ? { dpr: 1.4, shadow: 1024, bloom: false, trees: 120 }
    : { dpr: 2.0, shadow: 2048, bloom: true, trees: 260 };

  function initRenderer() {
    renderer = new THREE.WebGLRenderer({
      canvas: el.canvas, antialias: false, powerPreference: "high-performance",
      stencil: false,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, QUALITY.dpr));
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    // Distant haze only — the circuit spans ~1000 units, so fog must start well
    // beyond it or the whole track greys out from the air.
    scene.fog = new THREE.Fog(0xaec6de, 900, 3000);

    camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.35, 3000);
    camera.position.set(0, 8, -16);

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    if (QUALITY.bloom) {
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.72, 0.88
      );
      composer.addPass(bloomPass);
    }

    fxaaPass = new ShaderPass(FXAAShader);
    composer.addPass(fxaaPass);
    composer.addPass(new OutputPass());

    sizeToWindow();
    clock = new THREE.Clock();
  }

  function sizeToWindow() {
    const w = innerWidth, h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, QUALITY.dpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (fxaaPass) {
      fxaaPass.material.uniforms.resolution.value.set(1 / (w * dpr), 1 / (h * dpr));
    }
    if (bloomPass) bloomPass.setSize(w, h);
  }
  addEventListener("resize", () => { if (renderer) sizeToWindow(); });

  /* ========================================================= 2. environment */
  function skyTexture() {
    // Vertical gradient sky, rendered once to a canvas and used both as the
    // background and (via PMREM) as the environment map for car paint.
    const c = document.createElement("canvas");
    c.width = 16; c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.00, "#2d5f9e");
    grad.addColorStop(0.36, "#7ba6d6");
    grad.addColorStop(0.62, "#cddcec");
    grad.addColorStop(0.78, "#e8e2d4");
    grad.addColorStop(1.00, "#8b9099");
    g.fillStyle = grad;
    g.fillRect(0, 0, 16, 256);
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function buildEnvironment() {
    const sky = skyTexture();
    scene.background = sky;

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    envMap = pmrem.fromEquirectangular(sky).texture;
    scene.environment = envMap;
    pmrem.dispose();

    // key light — low afternoon sun, long shadows
    sun = new THREE.DirectionalLight(0xfff1d8, 3.1);
    sun.position.set(-180, 210, 140);
    sun.castShadow = true;
    sun.shadow.mapSize.set(QUALITY.shadow, QUALITY.shadow);
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 700;
    const S = 150;
    sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
    sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
    sun.shadow.bias = -0.0009;
    sun.shadow.normalBias = 0.03;
    sunTarget = new THREE.Object3D();
    scene.add(sunTarget);
    sun.target = sunTarget;
    scene.add(sun);

    scene.add(new THREE.HemisphereLight(0xbcd6f2, 0x3c4a34, 0.85));

    // ground plane well under the track
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x33482c, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.12;
    ground.receiveShadow = true;
    scene.add(ground);
  }

  function buildScenery() {
    // Trees + grandstands scattered outside the barriers, following the track
    // so the circuit feels enclosed without hand-placing hundreds of objects.
    const P = track.path;
    const treeGeo = new THREE.ConeGeometry(2.6, 8.5, 7);
    const trunkGeo = new THREE.CylinderGeometry(0.34, 0.44, 2.2, 6);
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x2c4a26, roughness: 0.95 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 });

    const TREE_MAX = QUALITY.trees;
    const trees = new THREE.InstancedMesh(treeGeo, treeMat, TREE_MAX);
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE_MAX);
    trees.castShadow = true;
    const m4 = new THREE.Matrix4();
    let n = 0;
    for (let i = 0; i < P.N && n < TREE_MAX; i += 2) {
      for (const sgn of [1, -1]) {
        if (n >= TREE_MAX) break;
        if (((i * 7 + (sgn > 0 ? 3 : 5)) % 11) > 5) continue;
        const off = P.half[i] + 12 + (((i * 13) % 9)) * 2.4;
        const jx = (((i * 31) % 17) - 8) * 0.5;
        const x = P.pts[i].x + P.nor[i].x * sgn * off + jx;
        const z = P.pts[i].z + P.nor[i].z * sgn * off;
        const s = 0.75 + ((i * 17) % 10) / 12;
        m4.makeScale(s, s, s);
        m4.setPosition(x, 4.2 * s, z);
        trees.setMatrixAt(n, m4);
        m4.makeScale(s, s, s);
        m4.setPosition(x, 1.1 * s, z);
        trunks.setMatrixAt(n, m4);
        n++;
      }
    }
    trees.count = n; trunks.count = n;
    trees.instanceMatrix.needsUpdate = true;
    trunks.instanceMatrix.needsUpdate = true;
    scene.add(trees, trunks);

    // grandstand near start/finish
    const standMat = new THREE.MeshStandardMaterial({ color: 0xd9dde4, roughness: 0.8 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x2b3f8c, roughness: 0.9 });
    for (const sgn of [1]) {
      const i = 6;
      const p = P.pts[i], nor = P.nor[i], tan = P.tan[i];
      const off = P.half[i] + 22;
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(64, 9, 16), standMat);
      base.position.y = 4.5; base.castShadow = true; base.receiveShadow = true;
      g.add(base);
      for (let r = 0; r < 5; r++) {
        const row = new THREE.Mesh(new THREE.BoxGeometry(62, 0.7, 2.2), seatMat);
        row.position.set(0, 5.6 + r * 1.5, -5.4 + r * 2.4);
        g.add(row);
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(68, 0.8, 19), standMat);
      roof.position.set(0, 14.2, 1.5); roof.castShadow = true;
      g.add(roof);
      g.position.set(p.x + nor.x * sgn * off, 0, p.z + nor.z * sgn * off);
      g.rotation.y = Math.atan2(tan.x, tan.z);
      scene.add(g);
    }

    // start gantry
    {
      const i = 0;
      const p = P.pts[i], tan = P.tan[i];
      const g = new THREE.Group();
      const post = new THREE.BoxGeometry(1.1, 11, 1.1);
      const pm = new THREE.MeshStandardMaterial({ color: 0x22252c, roughness: 0.6, metalness: 0.5 });
      const a = new THREE.Mesh(post, pm); a.position.set(P.half[i] + 2.2, 5.5, 0); a.castShadow = true;
      const b = new THREE.Mesh(post, pm); b.position.set(-(P.half[i] + 2.2), 5.5, 0); b.castShadow = true;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(P.half[i] * 2 + 6, 1.7, 1.4), pm);
      beam.position.y = 11.4; beam.castShadow = true;
      g.add(a, b, beam);
      // start lights
      startLights = [];
      for (let k = 0; k < 5; k++) {
        const lm = new THREE.MeshStandardMaterial({
          color: 0x2a0d0f, emissive: 0x000000, emissiveIntensity: 0, roughness: 0.4,
        });
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 12), lm);
        l.position.set((k - 2) * 1.7, 11.4, -0.85);
        g.add(l);
        startLights.push(lm);
      }
      g.position.set(p.x, 0, p.z);
      g.rotation.y = Math.atan2(tan.x, tan.z);
      scene.add(g);
    }
  }
  let startLights = [];

  /* ====================================================== 3. vehicle physics */
  // Arcade-sim model: longitudinal engine/brake/drag + lateral grip with slip.
  // Tuned so the car is stable enough to be fun on a gamepad-less keyboard but
  // still rewards braking before the hairpins.
  const GEARS = [3.9, 2.6, 1.86, 1.42, 1.14, 0.94];
  const FINAL = 3.3;
  const REDLINE = 7600;
  const IDLE = 1150;

  function makeCar(opts) {
    const built = window.TrollRacerCar.build(THREE, {
      color: opts.color, envMap, number: opts.number,
    });
    scene.add(built.group);
    const start = startSlot(opts.slot);
    return {
      ...opts,
      mesh: built.group,
      wheels: built.wheels,
      tailMat: built.tailMat,
      x: start.x, z: start.z,
      heading: start.heading,
      vx: 0, vz: 0,
      speed: 0,
      steer: 0,
      gear: 1, rpm: IDLE,
      throttle: 0, brake: 0,
      wheelSpin: 0,
      lap: 0, lastNode: 0, progress: 0,
      lapStart: 0, lastLap: 0, bestLap: 0, lapTimes: [],
      finished: false, finishTime: 0,
      offTrack: false, wrongWay: false,
      slipF: 0, slipR: 0,
      recover: 0,
      // per-node split timing, player only (drives the live delta readout)
      splits: opts.isPlayer ? new Array(track.path.N).fill(null) : null,
      bestSplits: null,
    };
  }

  // Grid slots staggered behind the line, alternating sides like a real grid.
  function startSlot(i) {
    const P = track.path;
    const back = 9 + i * 8.5;
    // walk backwards along the centreline from the start node
    let d = 0, idx = 0;
    while (d < back) {
      const prev = (idx - 1 + P.N) % P.N;
      d += Math.hypot(P.pts[prev].x - P.pts[idx].x, P.pts[prev].z - P.pts[idx].z);
      idx = prev;
    }
    const side = i % 2 === 0 ? 1 : -1;
    const lat = side * 3.1;
    return {
      x: P.pts[idx].x + P.nor[idx].x * lat,
      z: P.pts[idx].z + P.nor[idx].z * lat,
      heading: Math.atan2(P.tan[idx].x, P.tan[idx].z),
      idx,
    };
  }

  function stepCar(c, dt, input) {
    const loc = track.locate(c.x, c.z, c.lastNode);
    const onRoad = Math.abs(loc.lateral) < loc.half;
    const onKerb = !onRoad && Math.abs(loc.lateral) < loc.half + 1.6;
    c.offTrack = !onRoad && !onKerb;

    // grip by surface
    let grip = onRoad ? 1 : onKerb ? 0.82 : 0.44;

    // --- longitudinal -------------------------------------------------------
    const throttle = input.throttle, brake = input.brake;
    const spd = c.speed;

    // engine force from gear + rpm curve
    const ratio = GEARS[c.gear - 1] * FINAL;
    const wheelRadius = 0.44;
    c.rpm = Math.max(IDLE, Math.abs(spd) / wheelRadius * ratio * 9.549);
    // auto shift
    if (c.rpm > REDLINE * 0.94 && c.gear < GEARS.length) { c.gear++; }
    else if (c.rpm < 2900 && c.gear > 1) { c.gear--; }
    c.rpm = clamp(c.rpm, IDLE, REDLINE);

    // torque curve: peaky, falls off near redline
    const rn = c.rpm / REDLINE;
    const torque = (0.55 + 1.5 * rn - 1.05 * rn * rn);
    const drive = throttle * torque * ratio * 3.05 * grip;

    const drag = 0.0027 * spd * spd;
    const roll = 9.2 + (c.offTrack ? 26 : 0);
    const braking = brake * 46 * grip;

    let acc = drive - drag - (spd > 0.4 ? roll : 0) - (spd > 0 ? braking : 0);
    if (spd < 0.2 && brake > 0.1 && throttle < 0.05) acc = -14;   // reverse
    c.speed = clamp(spd + acc * dt, -11, 132);

    // wheelspin feedback (visual + grip loss on power out of slow corners)
    c.slipR = clamp(throttle * (1 - Math.min(1, spd / 26)) * 1.4 - brake * 0.4, 0, 1);

    // --- steering -----------------------------------------------------------
    const speedFactor = 1 / (1 + Math.abs(c.speed) * 0.035);
    const maxSteer = 0.55 * speedFactor;
    const target = input.steer * maxSteer;
    const rate = 6.5;
    c.steer += (target - c.steer) * Math.min(1, rate * dt);

    // bicycle-model yaw
    const wheelbase = 2.9;
    if (Math.abs(c.speed) > 0.25) {
      const turnRadius = wheelbase / Math.tan(Math.abs(c.steer) + 1e-5);
      let yawRate = (c.speed / turnRadius) * Math.sign(c.steer) * grip;
      // understeer at the limit
      const latAcc = Math.abs(yawRate * c.speed);
      const limit = 21 * grip;
      if (latAcc > limit) yawRate *= limit / latAcc;
      c.heading += yawRate * dt;
      c.slipF = clamp((latAcc - limit * 0.8) / limit, 0, 1);
    } else c.slipF = 0;

    // --- integrate ----------------------------------------------------------
    const dirX = Math.sin(c.heading), dirZ = Math.cos(c.heading);
    c.x += dirX * c.speed * dt;
    c.z += dirZ * c.speed * dt;

    // barrier containment: push back inside the run-off
    const lim = loc.half + 1.5 + 9;   // kerb + runoff
    if (Math.abs(loc.lateral) > lim) {
      const P = track.path;
      const n = P.nor[loc.i];
      const over = Math.abs(loc.lateral) - lim;
      const s = Math.sign(loc.lateral);
      c.x -= n.x * s * over;
      c.z -= n.z * s * over;
      c.speed *= 0.55;                                  // scrub off speed
      // deflect heading along the barrier
      const along = Math.atan2(loc.tanX, loc.tanZ);
      c.heading = lerp(c.heading, along, 0.35);
    }

    // --- progress + laps ----------------------------------------------------
    const prevNode = c.lastNode;
    c.lastNode = loc.i;
    c.progress = loc.dist;
    // record this lap's split at each node (player only, for the delta display)
    if (c === player && state.phase === "racing" && c.splits) {
      c.splits[loc.i] = state.t - c.lapStart;
    }
    // wrong way: heading vs track tangent
    const dot = Math.sin(c.heading) * loc.tanX + Math.cos(c.heading) * loc.tanZ;
    c.wrongWay = dot < -0.25 && Math.abs(c.speed) > 4;

    // crossed the line? (node wraps from high index to low)
    if (prevNode > track.path.N * 0.82 && loc.i < track.path.N * 0.18) {
      onLapComplete(c);
    } else if (prevNode < track.path.N * 0.18 && loc.i > track.path.N * 0.82) {
      c.lap = Math.max(0, c.lap - 1);   // went backwards over the line
    }

    // --- visuals ------------------------------------------------------------
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    // body roll + squat
    const roll2 = clamp(-c.steer * Math.min(1, c.speed / 40) * 0.16, -0.16, 0.16);
    c.mesh.rotation.z = lerp(c.mesh.rotation.z, roll2, 0.16);
    c.mesh.rotation.x = lerp(c.mesh.rotation.x, clamp((brake * 0.03 - throttle * 0.018), -0.05, 0.05), 0.14);

    c.wheelSpin += (c.speed / 0.44) * dt * (1 + c.slipR * 1.6);
    c.wheels.forEach(w => {
      w.spin.rotation.x = c.wheelSpin;
      if (w.steer) w.pivot.rotation.y = c.steer;
    });
    if (c.tailMat) c.tailMat.emissiveIntensity = 0.55 + brake * 2.6;

    return loc;
  }

  /* ============================================================== 4. AI */
  // Racing-line follower: aims at a lookahead point on the centreline, offset
  // toward the inside of the coming corner, and brakes for corner radius.
  const AI_PROFILE = {
    rookie: { speed: 0.80, aim: 1.20, err: 1.5, brake: 0.80 },
    pro:    { speed: 0.92, aim: 1.00, err: 0.7, brake: 0.92 },
    ace:    { speed: 1.00, aim: 0.88, err: 0.25, brake: 1.0 },
  };

  function aiInput(c, dt) {
    const P = track.path;
    const prof = AI_PROFILE[state.difficulty] || AI_PROFILE.pro;
    const loc = track.locate(c.x, c.z, c.lastNode);

    // lookahead scales with speed
    const ahead = clamp(7 + c.speed * 0.55 * prof.aim, 9, 46);
    let d = 0, idx = loc.i;
    while (d < ahead) {
      const nxt = (idx + 1) % P.N;
      d += Math.hypot(P.pts[nxt].x - P.pts[idx].x, P.pts[nxt].z - P.pts[idx].z);
      idx = nxt;
    }
    // aim offset: hug the inside of the corner
    const turn = crossTurn(idx);
    const offset = clamp(-turn * 6000, -P.half[idx] * 0.72, P.half[idx] * 0.72);
    const wob = Math.sin(state.t * 0.7 + c.slot * 2.1) * prof.err;
    const tx = P.pts[idx].x + P.nor[idx].x * (offset + wob);
    const tz = P.pts[idx].z + P.nor[idx].z * (offset + wob);

    const want = Math.atan2(tx - c.x, tz - c.z);
    const err = angDiff(want, c.heading);
    const steer = clamp(err * 2.1, -1, 1);

    // corner speed target from the tightest radius in the braking zone
    let minR = Infinity, dd = 0, j = loc.i;
    const zone = 18 + c.speed * 1.5;
    while (dd < zone) {
      const nxt = (j + 1) % P.N;
      dd += Math.hypot(P.pts[nxt].x - P.pts[j].x, P.pts[nxt].z - P.pts[j].z);
      j = nxt;
      minR = Math.min(minR, window.TROLL_RACER_TRACK.radii[j] * track.S);
    }
    // v = sqrt(a_lat * r)
    const vTarget = clamp(Math.sqrt(19 * Math.max(6, minR)) * prof.speed, 12, 128);

    let throttle = 0, brake = 0;
    if (c.speed < vTarget - 1.5) throttle = 1;
    else if (c.speed > vTarget + 1.5) brake = clamp((c.speed - vTarget) / 16, 0, 1) * prof.brake;
    else throttle = 0.45;

    // avoid the car directly ahead
    for (const o of cars) {
      if (o === c) continue;
      const dx = o.x - c.x, dz = o.z - c.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 13) continue;
      const fwd = (dx * Math.sin(c.heading) + dz * Math.cos(c.heading));
      if (fwd > 1 && dist < 11) {
        throttle *= 0.35; brake = Math.max(brake, 0.28);
      }
    }
    return { steer, throttle, brake };
  }

  function crossTurn(i) {
    const P = track.path, N = P.N;
    const a = P.tan[(i - 2 + N) % N], b = P.tan[(i + 2) % N];
    return a.x * b.z - a.z * b.x;
  }

  /* =================================================== 5. race director */
  const fmtTime = (s) => {
    if (!s || s <= 0) return "--:--.---";
    const m = Math.floor(s / 60);
    const sec = s - m * 60;
    return m + ":" + (sec < 10 ? "0" : "") + sec.toFixed(3);
  };
  const fmtDelta = (d) => (d > 0 ? "+" : "") + d.toFixed(3);

  function onLapComplete(c) {
    if (state.phase !== "racing" || c.finished) return;
    const now = state.t;
    if (c.lap > 0) {
      const lapTime = now - c.lapStart;
      c.lastLap = lapTime;
      c.lapTimes.push(lapTime);
      if (!c.bestLap || lapTime < c.bestLap) {
        c.bestLap = lapTime;
        // this lap becomes the reference the delta is measured against
        if (c.splits) c.bestSplits = c.splits.slice();
      }
    }
    if (c.splits) c.splits = new Array(track.path.N).fill(null);
    c.lapStart = now;
    c.lap++;
    if (c.lap > state.laps) {
      c.finished = true;
      c.finishTime = now;
      if (c === player) finishRace();
    } else if (c === player) {
      banner(c.lap === state.laps ? "FINAL LAP" : "LAP " + c.lap, 1400);
    }
  }

  function standings() {
    return cars.slice().sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.lap !== b.lap) return b.lap - a.lap;
      return b.progress - a.progress;
    });
  }

  let bannerTimer = 0;
  function banner(text, ms) {
    el.banner.innerHTML = text;
    el.banner.classList.add("is-on");
    bannerTimer = (ms || 1200) / 1000;
  }

  function startCountdown() {
    state.phase = "countdown";
    let step = 0;
    startLights.forEach(m => { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; m.color.setHex(0x2a0d0f); });
    const tick = () => {
      if (state.phase !== "countdown") return;
      if (step < 5) {
        const m = startLights[step];
        m.color.setHex(0x3a0f12);
        m.emissive.setHex(0xff1c26);
        m.emissiveIntensity = 2.6;
        banner(String(5 - step), 700);
        step++;
        setTimeout(tick, 1000);
      } else {
        startLights.forEach(m => {
          m.emissive.setHex(0x27ff5a); m.emissiveIntensity = 3.2; m.color.setHex(0x0e2c14);
        });
        banner("GO", 900);
        state.phase = "racing";
        state.t = 0;
        cars.forEach(c => { c.lapStart = 0; c.lap = 1; });
        setTimeout(() => {
          startLights.forEach(m => { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; m.color.setHex(0x14161a); });
        }, 2600);
      }
    };
    setTimeout(tick, 700);
  }

  function finishRace() {
    state.phase = "finished";
    const order = standings();
    const pos = order.indexOf(player) + 1;
    banner(pos === 1 ? "WINNER" : "P" + pos, 2600);

    // report to the shared weekly ladder
    if (window.TrollLeaderboard && player.bestLap) {
      window.TrollLeaderboard.record("troll-racer", {
        bestLap: player.bestLap,
        position: pos,
        win: pos === 1 ? 1 : 0,
        laps: player.lapTimes.length,
      });
    }

    setTimeout(() => showResults(order, pos), 2400);
  }

  function showResults(order, pos) {
    el.resultsTitle.textContent = pos === 1 ? "Victory" : "Race complete";
    el.resultsSub.textContent =
      "P" + pos + " of " + cars.length + " · best lap " + fmtTime(player.bestLap);
    el.resultsBody.innerHTML = order.map((c, i) => {
      const gap = c.finished && order[0].finished && i > 0
        ? "+" + (c.finishTime - order[0].finishTime).toFixed(2) + "s"
        : c.finished ? fmtTime(c.finishTime) : "DNF";
      return '<tr class="' + (c === player ? "is-you" : "") + '">' +
        '<td class="tr-pos">' + (i + 1) + "</td>" +
        "<td>" + c.name + "</td>" +
        "<td>" + fmtTime(c.bestLap) + "</td>" +
        "<td>" + gap + "</td></tr>";
    }).join("");
    el.results.hidden = false;
  }

  /* ================================================= 6. camera + HUD + input */
  const input = { steer: 0, throttle: 0, brake: 0, look: 0 };
  const keys = Object.create(null);
  const KEYMAP = {
    ArrowUp: "up", KeyW: "up",
    ArrowDown: "down", KeyS: "down",
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    Space: "hand", ShiftLeft: "hand",
  };
  addEventListener("keydown", e => {
    const k = KEYMAP[e.code];
    if (k) { keys[k] = true; e.preventDefault(); }
    if (e.code === "KeyC") camMode = (camMode + 1) % 3;
    if (e.code === "KeyR" && state.phase === "racing") respawn(player);
    if (e.code === "Escape") togglePause();
  });
  addEventListener("keyup", e => { const k = KEYMAP[e.code]; if (k) { keys[k] = false; e.preventDefault(); } });
  addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

  // touch
  function bindTouch(sel, key) {
    const b = $(sel);
    if (!b) return;
    const on = e => { e.preventDefault(); keys[key] = true; b.classList.add("is-held"); };
    const off = e => { e.preventDefault(); keys[key] = false; b.classList.remove("is-held"); };
    b.addEventListener("pointerdown", on);
    b.addEventListener("pointerup", off);
    b.addEventListener("pointercancel", off);
    b.addEventListener("pointerleave", off);
  }
  bindTouch("#tr-t-left", "left");
  bindTouch("#tr-t-right", "right");
  bindTouch("#tr-t-gas", "up");
  bindTouch("#tr-t-brake", "down");

  function readInput(dt) {
    const want = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    input.steer += (want - input.steer) * Math.min(1, 9 * dt);
    input.throttle = keys.up ? 1 : 0;
    input.brake = keys.down ? 1 : 0;
    if (keys.hand) input.brake = Math.max(input.brake, 0.85);
    return input;
  }

  function respawn(c) {
    const P = track.path;
    const loc = track.locate(c.x, c.z, c.lastNode);
    c.x = P.pts[loc.i].x; c.z = P.pts[loc.i].z;
    c.heading = Math.atan2(P.tan[loc.i].x, P.tan[loc.i].z);
    c.speed = Math.min(c.speed, 16);
  }

  let camMode = 0;   // 0 chase, 1 bonnet, 2 far chase
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();

  function updateCamera(dt) {
    const c = player;
    // the menu flyover repoints `up` to -Z for its top-down framing; restore
    // the normal world up before driving or the chase view comes out rolled.
    if (camera.up.y !== 1) camera.up.set(0, 1, 0);
    const dirX = Math.sin(c.heading), dirZ = Math.cos(c.heading);
    let want, lookAt;
    const sp = Math.abs(c.speed);

    if (camMode === 1) {
      want = new THREE.Vector3(c.x + dirX * 0.5, 1.16, c.z + dirZ * 0.5);
      lookAt = new THREE.Vector3(c.x + dirX * 26, 1.3, c.z + dirZ * 26);
    } else {
      const back = camMode === 2 ? 15.5 : 9.2;
      const high = camMode === 2 ? 5.4 : 3.5;
      want = new THREE.Vector3(c.x - dirX * back, high, c.z - dirZ * back);
      lookAt = new THREE.Vector3(c.x + dirX * 9, 1.5, c.z + dirZ * 9);
    }
    // spring follow — snappier at speed so the car doesn't outrun the camera
    const k = camMode === 1 ? 1 : clamp(dt * (5.5 + sp * 0.06), 0, 1);
    camPos.lerp(want, k);
    camLook.lerp(lookAt, clamp(dt * 7, 0, 1));
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    // speed FOV — the classic sense-of-speed trick
    const fov = 62 + clamp(sp / 132, 0, 1) * 18;
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * Math.min(1, dt * 3.4);
      camera.updateProjectionMatrix();
    }
    // subtle shake off-track
    if (c.offTrack && sp > 8) {
      camera.position.x += (Math.random() - 0.5) * 0.16;
      camera.position.y += (Math.random() - 0.5) * 0.12;
    }
  }

  // Menu backdrop: a slow, high orbit of the whole circuit. High enough that
  // the trollface the track is drawn in actually reads from the air.
  let flyT = 0;
  function flyover(dt) {
    flyT += dt * 0.12;
    const P = track.path;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of P.pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    }
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    // Frame the whole circuit from above. The face is wide and short, so fit
    // BOTH axes: width against the horizontal FOV, depth against the vertical,
    // and take whichever needs more height. Looking straight down makes "up"
    // ambiguous, so pin it to -Z — that maps world X to screen X and keeps the
    // face upright instead of on its side.
    const vFov = camera.fov * Math.PI / 180;
    const hNeededZ = (maxZ - minZ) / (2 * Math.tan(vFov / 2));
    const hNeededX = (maxX - minX) / (2 * Math.tan(vFov / 2) * camera.aspect);
    const h = Math.max(hNeededX, hNeededZ) * 1.16;
    const r = h * 0.06;
    camera.up.set(0, 0, -1);
    camera.position.set(cx + Math.cos(flyT) * r, h, cz + Math.sin(flyT) * r);
    camera.lookAt(cx, 0, cz);
    if (camera.fov !== 62) { camera.fov = 62; camera.updateProjectionMatrix(); }
    sun.position.set(cx - 180, 260, cz + 140);
    sunTarget.position.set(cx, 0, cz);
  }

  /* -------------------------------------------------------------- minimap */
  function buildMinimap() {
    const P = track.path;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    P.pts.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    });
    const w = maxX - minX, h = maxZ - minZ;
    const pad = 6;
    const vb = [minX - pad, minZ - pad, w + pad * 2, h + pad * 2];
    const svg = $("#tr-map svg");
    svg.setAttribute("viewBox", vb.join(" "));
    const d = P.pts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.z.toFixed(1)).join(" ") + " Z";
    $("#tr-map-path").setAttribute("d", d);
    mapScale = { minX, minZ, w, h };
  }
  let mapScale = null;

  function updateMinimap() {
    if (!mapScale) return;
    el.mapDot.setAttribute("cx", player.x.toFixed(1));
    el.mapDot.setAttribute("cy", player.z.toFixed(1));
    let s = "";
    cars.forEach(c => {
      if (c === player) return;
      s += '<circle cx="' + c.x.toFixed(1) + '" cy="' + c.z.toFixed(1) +
        '" r="9" fill="#ff5470"/>';
    });
    el.mapAi.innerHTML = s;
  }

  /* ------------------------------------------------------------------ HUD */
  let hudAcc = 0;
  function updateHUD(dt) {
    hudAcc += dt;
    if (hudAcc < 0.05) return;
    hudAcc = 0;

    const kph = Math.abs(player.speed) * 3.6;
    el.speed.textContent = Math.round(kph);
    el.gear.textContent = player.speed < -0.5 ? "R" : player.gear;
    const rev = clamp((player.rpm - IDLE) / (REDLINE - IDLE), 0, 1);
    el.revBar.style.width = (rev * 100).toFixed(1) + "%";
    el.rev.classList.toggle("is-redline", rev > 0.93);

    el.lap.textContent = Math.min(player.lap, state.laps);
    const order = standings();
    el.pos.textContent = order.indexOf(player) + 1;

    const cur = state.phase === "racing" && !player.finished ? state.t - player.lapStart : 0;
    el.cur.textContent = fmtTime(cur);
    el.best.textContent = fmtTime(player.bestLap);

    // Delta vs your best lap: compare elapsed time at the same track position.
    // bestSplits[] records the clock at each node during the best lap, so the
    // comparison is like-for-like rather than raw elapsed time.
    if (player.bestSplits && player.lap > 1 && !player.finished) {
      const ref = player.bestSplits[player.lastNode];
      if (ref != null && cur > 0.5) {
        const d = cur - ref;
        el.delta.textContent = fmtDelta(d);
        el.delta.classList.toggle("is-up", d > 0);
        el.delta.classList.toggle("is-down", d <= 0);
      }
    } else {
      el.delta.textContent = "";
      el.delta.classList.remove("is-up", "is-down");
    }
    el.warn.hidden = !player.wrongWay;
    updateMinimap();
  }

  /* ------------------------------------------------------------- main loop */
  // Physics runs on a FIXED timestep, accumulating real elapsed time. A plain
  // per-frame dt would make the car handle differently on a 30Hz phone than a
  // 144Hz monitor, and clamping a long frame would silently run the race in
  // slow motion. Rendering still happens once per animation frame.
  const FIXED = 1 / 120;
  const MAX_STEPS = 8;          // beyond this we drop time rather than spiral
  let accumulator = 0;
  let raf = 0;

  function loop() {
    raf = requestAnimationFrame(loop);
    const frame = Math.min(clock.getDelta(), 0.25);
    if (state.phase === "paused") { composer.render(); return; }

    if (bannerTimer > 0) {
      bannerTimer -= frame;
      if (bannerTimer <= 0) el.banner.classList.remove("is-on");
    }

    // Before the first race there is no player yet — fly the camera around the
    // circuit so the menu sits over a live view of the track instead of a
    // frozen frame.
    if (!player) {
      flyover(frame);
      composer.render();
      return;
    }

    // The race clock advances with REAL elapsed time, never with the number of
    // physics steps actually run. On a device too slow to keep up, MAX_STEPS
    // drops simulation time — if the clock were driven by steps, lap times
    // would silently come out faster than the wall clock and be meaningless.
    if (state.phase === "racing") state.t += frame;

    accumulator += frame;
    let steps = 0;
    while (accumulator >= FIXED && steps < MAX_STEPS) {
      simulate(FIXED);
      accumulator -= FIXED;
      steps++;
    }
    if (steps === MAX_STEPS) accumulator = 0;   // too far behind; resync

    governQuality(frame);
    updateCamera(frame);
    updateHUD(frame);

    // keep the sun's shadow frustum centred on the player
    sun.position.set(player.x - 180, 210, player.z + 140);
    sunTarget.position.set(player.x, 0, player.z);

    composer.render();
  }

  // Adaptive quality: if the average frame time stays bad, shed the expensive
  // things in order of cost-to-looks — buffer resolution, then bloom, then the
  // shadow map. One-way (never upgrades mid-race) so it can't oscillate.
  let govAcc = 0, govFrames = 0, govLevel = 0;
  function governQuality(frame) {
    if (govLevel >= 3) return;
    govAcc += frame; govFrames++;
    if (govAcc < 2.5) return;                 // sample over 2.5s windows
    const avg = govAcc / govFrames;
    govAcc = 0; govFrames = 0;
    if (avg < 1 / 40) return;                 // comfortably fast enough
    govLevel++;
    if (govLevel === 1) {
      // lower the tier itself, or the next sizeToWindow() (a resize, or this
      // call) would restore the original pixel ratio and undo the downgrade
      QUALITY.dpr = 1.0;
      sizeToWindow();
    } else if (govLevel === 2 && bloomPass) {
      bloomPass.enabled = false;
    } else if (govLevel === 3) {
      sun.castShadow = false;
    }
  }

  // One fixed physics tick: input, player, AI, contacts.
  // (state.t is advanced by the render loop from real time, not from here.)
  function simulate(dt) {
    const canDrive = state.phase === "racing";
    const pin = canDrive ? readInput(dt) : { steer: 0, throttle: 0, brake: 1 };
    stepCar(player, dt, pin);
    for (const c of cars) {
      if (c === player) continue;
      const ai = canDrive && !c.finished ? aiInput(c, dt) : { steer: 0, throttle: 0, brake: 1 };
      stepCar(c, dt, ai);
    }
    resolveCollisions();
  }

  // simple circular push-apart so cars don't inhabit each other
  function resolveCollisions() {
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = 3.4;
        if (d > min || d < 1e-4) continue;
        const push = (min - d) / 2;
        const nx = dx / d, nz = dz / d;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
        // exchange a little speed
        const avg = (a.speed + b.speed) / 2;
        a.speed = lerp(a.speed, avg, 0.3);
        b.speed = lerp(b.speed, avg, 0.3);
      }
    }
  }

  /* ------------------------------------------------------------- lifecycle */
  const AI_NAMES = ["GRINWALD", "COAL ROLLER", "NULLFACE", "PEPE-3", "STONKS", "DOGE-9", "WOJAK"];
  const AI_COLORS = [0xff3b6b, 0x4deeff, 0xffd84d, 0x9a5cff, 0xff8c1a, 0xe8e8ec, 0x22c55e];

  function startRace() {
    // clear any previous race
    cars.forEach(c => scene.remove(c.mesh));
    cars.length = 0;

    const field = 6;
    player = makeCar({ name: "YOU", color: state.color, slot: 0, number: 1, isPlayer: true });
    cars.push(player);
    for (let i = 1; i < field; i++) {
      cars.push(makeCar({
        name: AI_NAMES[(i - 1) % AI_NAMES.length],
        color: AI_COLORS[(i - 1) % AI_COLORS.length],
        slot: i, number: i + 1,
      }));
    }
    // face the grid the right way
    cars.forEach(c => { c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.heading; });

    el.setup.hidden = true;
    el.results.hidden = true;
    el.hud.hidden = false;
    el.lapTotal.textContent = state.laps;
    el.posTotal.textContent = cars.length;
    camPos.set(player.x, 4, player.z - 12);
    camLook.set(player.x, 1.4, player.z);
    startCountdown();
  }

  function togglePause() {
    if (state.phase === "racing") { state.phase = "paused"; el.pause.hidden = false; }
    else if (state.phase === "paused") { state.phase = "racing"; el.pause.hidden = true; clock.getDelta(); }
  }

  /* ------------------------------------------------------------------ menu */
  function wireMenu() {
    document.querySelectorAll("[data-laps]").forEach(b => {
      b.addEventListener("click", () => {
        document.querySelectorAll("[data-laps]").forEach(x => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        state.laps = +b.dataset.laps;
      });
    });
    document.querySelectorAll("[data-diff]").forEach(b => {
      b.addEventListener("click", () => {
        document.querySelectorAll("[data-diff]").forEach(x => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        state.difficulty = b.dataset.diff;
      });
    });
    document.querySelectorAll("[data-color]").forEach(b => {
      b.style.background = b.dataset.color;
      b.addEventListener("click", () => {
        document.querySelectorAll("[data-color]").forEach(x => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        state.color = parseInt(b.dataset.color.slice(1), 16);
      });
    });
    $("#tr-start").addEventListener("click", startRace);
    $("#tr-again").addEventListener("click", () => { el.results.hidden = true; el.setup.hidden = false; });
    $("#tr-resume").addEventListener("click", togglePause);

    // touch controls on coarse pointers
    if (matchMedia("(pointer: coarse)").matches) el.touch.classList.add("is-on");
  }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    try {
      setBoot(12, "Starting engine…");
      initRenderer();
      setBoot(34, "Building the grin…");
      buildEnvironment();
      setBoot(56, "Laying asphalt…");
      track = window.TrollRacerTrack.build(THREE);
      scene.add(track.group);
      setBoot(76, "Planting the paddock…");
      buildScenery();
      buildMinimap();
      setBoot(92, "Warming the tyres…");
      wireMenu();
      setBoot(100, "Ready");
      setTimeout(() => { el.boot.hidden = true; el.setup.hidden = false; }, 320);
      loop();
    } catch (err) {
      console.error("[troll-racer] boot failed", err);
      el.bootSub.textContent = "Couldn't start the race: " + err.message;
      el.bootSub.style.color = "#ff5470";
    }
  }

  if (document.readyState === "loading") addEventListener("DOMContentLoaded", boot);
  else boot();
})();
