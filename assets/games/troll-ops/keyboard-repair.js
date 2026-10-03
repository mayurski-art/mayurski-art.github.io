// Troll Forces — the Keyboard Warrior's shield, and what happens when it
// takes one round too many (user, 2026-10-03): "a funny animation where it
// tries to repair the keyboard … include some computer gear for repair,
// before coming back to the default keyboard sword holding stance".
//
// Holding aim with the keyboard raises it flat across the body, keys out.
// A few consecutive hits (game.js KB_SHIELD) and it breaks: keycaps pop
// off, the keyboard comes down onto your lap, and the off hand works it
// over with a screwdriver, a soldering iron and a USB cable while a little
// screen reports on the reboot. Then it comes back up into the guard.
//
// Everything here is first-person viewmodel: the keyboard mesh lives in
// the weapon rig (view space: camera at the origin looking down -Z), its own
// frame has the keys facing +Y and the blade running down -Z from the grip.
// The arms reach for the mesh's hand markers (game.js poseMeleeArms), so
// moving the support hand moves the real left arm, tool and all.

import * as THREE from "three";

export const KB_REPAIR_TIME = 3.8;

// View-space poses. The basis maps the keyboard's own axes (x, y = keys,
// z = back along the blade) into view space.
function poseQuat(x, y, z) {
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...x).normalize(), new THREE.Vector3(...y).normalize(), new THREE.Vector3(...z).normalize());
  return new THREE.Quaternion().setFromRotationMatrix(m);
}
// Shield: blade straight across the view to the left, keys facing out at
// whoever is shooting, tipped back a little so the RGB edge shows.
// Up across the body, low enough to see over, the lit keys toward you
// (the case takes the rounds).
export const KB_SHIELD = {
  pos: new THREE.Vector3(0.55, -0.27, -0.55),
  quat: poseQuat([0, 0.98, -0.2], [0, 0.2, 0.98], [1, 0, 0]),
};
// Repair: down on the lap, keys up and tilted toward you like a laptop.
export const KB_REPAIR = {
  pos: new THREE.Vector3(0.55, -0.25, -0.7),
  quat: poseQuat([0, 0.8, -0.6], [0, 0.6, 0.8], [1, 0, 0]),
};

const sm = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };

/* ---------------------------------------------------------------- tools */
function mat(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1, ...extra }); }
function part(geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; }

/* Each tool hangs down -Y from where the hand holds it, tip at y = -len. */
function screwdriver() {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.011, 0.013, 0.07, 10), mat(0xf2c21b), 0, -0.02, 0));
  g.add(part(new THREE.CylinderGeometry(0.0125, 0.0125, 0.012, 10), mat(0x161616), 0, -0.058, 0));
  g.add(part(new THREE.CylinderGeometry(0.0032, 0.0032, 0.07, 8), mat(0xc9ccd2, { metalness: 0.9, roughness: 0.3 }), 0, -0.098, 0));
  g.add(part(new THREE.BoxGeometry(0.006, 0.01, 0.0015), mat(0xc9ccd2, { metalness: 0.9, roughness: 0.3 }), 0, -0.136, 0));
  g.userData.len = 0.14;
  return g;
}
function solderingIron() {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.012, 0.012, 0.075, 10), mat(0x1f6fe0), 0, -0.02, 0));
  g.add(part(new THREE.CylinderGeometry(0.009, 0.006, 0.03, 10), mat(0x9aa0a8, { metalness: 0.8, roughness: 0.35 }), 0, -0.072, 0));
  g.add(part(new THREE.CylinderGeometry(0.0028, 0.0028, 0.045, 8), mat(0xb0b3b8, { metalness: 0.9 }), 0, -0.108, 0));
  const tip = part(new THREE.ConeGeometry(0.0034, 0.014, 8), new THREE.MeshBasicMaterial({ color: 0xff7a2a }), 0, -0.137, 0);
  tip.rotation.x = Math.PI;
  g.add(tip);
  // a coil of cord off the back
  const cord = part(new THREE.TorusGeometry(0.02, 0.0025, 6, 16, Math.PI * 1.4), mat(0x202020), 0.012, 0.03, 0);
  cord.rotation.y = Math.PI / 2;
  g.add(cord);
  g.userData.len = 0.145;
  g.userData.tip = tip;
  return g;
}
function usbCable() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.016, 0.034, 0.008), mat(0x2a2a2e), 0, -0.02, 0));
  g.add(part(new THREE.BoxGeometry(0.012, 0.016, 0.0045), mat(0xd7d9de, { metalness: 0.85, roughness: 0.3 }), 0, -0.045, 0));
  // the cable trailing up and away out of view
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(Math.sin(t * 3) * 0.03 + t * 0.05, t * 0.25, -t * 0.04)); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0035, 6), mat(0x1a1a1a)));
  g.userData.len = 0.053;
  return g;
}

/* The diagnostic tablet: a canvas texture redrawn when its text changes. */
function screen() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 160;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.17, 0.112, 0.008), mat(0x111114)));
  const face = part(new THREE.PlaneGeometry(0.156, 0.098), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), 0, 0, 0.0045);
  g.add(face);
  let last = "";
  g.userData.draw = (title, pct, blue) => {
    const key = `${title}|${Math.round(pct * 100)}|${blue}`;
    if (key === last) return;
    last = key;
    const x = c.getContext("2d");
    x.fillStyle = blue ? "#1546c8" : "#0b0d10";
    x.fillRect(0, 0, 256, 160);
    x.fillStyle = "#f2f4f8";
    x.textAlign = "center";
    const lines = title.split("\n");
    x.font = `bold ${blue ? 22 : 20}px "DM Mono", monospace`;
    lines.forEach((l, i) => x.fillText(l, 128, 46 + i * 26, 240));
    if (pct >= 0) {
      x.strokeStyle = "#f2f4f8"; x.lineWidth = 2; x.strokeRect(28, 112, 200, 16);
      x.fillStyle = "#7fe066"; x.fillRect(31, 115, 194 * pct, 10);
    }
    tex.needsUpdate = true;
  };
  return g;
}

const TOOL_SCALE = 1.5;
const TOOL_LEAN = new THREE.Vector3(0.55, 0.7, 0.45).normalize();   // keyboard frame: up-screen, toward you, right
const _toolQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
const _negZ = new THREE.Vector3(0, 0, -1), _dir = new THREE.Vector3(), _hand = new THREE.Vector3();
const TABLET_Q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)));

/* ------------------------------------------------------------- the act */
export function createKeyboardRepair({ audio } = {}) {
  let built = null;
  const st = { t: 0, active: false, cued: new Set() };

  function build() {
    const tools = { screw: screwdriver(), iron: solderingIron(), usb: usbCable() };
    const caps = [];
    const capGeo = new THREE.BoxGeometry(0.02, 0.012, 0.02);
    const capMat = mat(0x151518);
    for (let i = 0; i < 6; i++) caps.push({ mesh: new THREE.Mesh(capGeo, capMat), v: new THREE.Vector3(), w: new THREE.Vector3() });
    const sparks = [];
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 8; i++) sparks.push({ mesh: new THREE.Mesh(new THREE.SphereGeometry(0.0022, 4, 4), sparkMat), v: new THREE.Vector3(), life: 0 });
    built = { tools, caps, sparks, monitor: screen() };
  }

  /* Pull everything off whatever it was attached to. */
  function stow() {
    if (!built) return;
    for (const t of Object.values(built.tools)) t.parent?.remove(t);
    for (const c of built.caps) c.mesh.parent?.remove(c.mesh);
    for (const s of built.sparks) s.mesh.parent?.remove(s.mesh);
    built.monitor.parent?.remove(built.monitor);
  }

  function cue(name, at) {
    if (st.cued.has(name) || st.t < at) return;
    st.cued.add(name);
    audio?.kbRepairCue?.(name);
  }

  return {
    get active() { return st.active; },
    get t() { return st.t; },
    start() {
      if (!built) build();
      st.t = 0; st.active = true; st.cued.clear();
    },
    stop() { st.active = false; st.t = 0; stow(); },
    seek(t) { st.t = t; },   // tests and screenshots

    /* Pose the keyboard (`mesh`, already at its normal pose this frame)
       and its support hand. `hands` is game.js meleeHands(mesh). Returns
       false once the act is over. */
    update(dt, mesh, hands) {
      if (!st.active) return false;
      st.t += dt;
      const T = KB_REPAIR_TIME;
      const k = st.t / T;
      if (k >= 1) { this.stop(); return false; }
      const { tools, caps, sparks, monitor } = built;
      const support = hands?.[1]?.obj;

      // Down onto the lap and back up at the end, with a fumble going in.
      const into = sm(0, 0.1, k), outOf = sm(0.88, 1, k);
      const w = into * (1 - outOf);
      const restPos = mesh.position.clone(), restQuat = mesh.quaternion.clone();
      mesh.position.lerpVectors(restPos, KB_REPAIR.pos, w);
      mesh.quaternion.slerpQuaternions(restQuat, KB_REPAIR.quat, w);
      // the shot-up shudder at the start, the satisfied twirl at the end
      const shudder = (1 - sm(0, 0.08, k)) * 0.03;
      mesh.position.x += Math.sin(st.t * 70) * shudder;
      mesh.rotateZ(Math.sin(st.t * 55) * shudder * 4 + Math.sin(outOf * Math.PI) * 0.6);

      // Keycaps fly off as it breaks.
      cue("clatter", 0);
      if (k < 0.3) {
        caps.forEach((c, i) => {
          if (!c.mesh.parent) {
            mesh.add(c.mesh);
            c.mesh.position.set((Math.random() - 0.5) * 0.2, 0.04, -0.35 - Math.random() * 0.55);
            c.v.set((Math.random() - 0.5) * 0.5, 0.7 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4);
            c.w.set(Math.random() * 20, Math.random() * 20, Math.random() * 20);
          }
          c.v.y -= 3.2 * dt;
          c.mesh.position.addScaledVector(c.v, dt);
          c.mesh.rotation.x += c.w.x * dt; c.mesh.rotation.y += c.w.y * dt; c.mesh.rotation.z += c.w.z * dt;
          c.mesh.visible = c.mesh.position.y > -0.6;
        });
      } else for (const c of caps) c.mesh.parent?.remove(c.mesh);

      // The off hand's job, in the keyboard's own frame: which tool, and
      // where its tip is working.
      let tool = null;
      const spot = new THREE.Vector3();
      if (k < 0.12) {
        // grabbing: the hand comes off the case
      } else if (k < 0.4) {
        tool = tools.screw;
        cue("screw", T * 0.14); cue("screw2", T * 0.27);
        const a = st.t * 9;
        spot.set(-0.05 + Math.cos(a) * 0.012, 0.035, -0.5 + Math.sin(a) * 0.012);
      } else if (k < 0.64) {
        tool = tools.iron;
        cue("solder", T * 0.42); cue("solder2", T * 0.53);
        // two dabs, a little lift between
        const dab = Math.abs(Math.sin(st.t * 6));
        spot.set(k < 0.52 ? 0.04 : -0.07, 0.035 + dab * 0.03, k < 0.52 ? -0.72 : -0.42);
      } else if (k < 0.86) {
        tool = tools.usb;
        cue("plug", T * 0.7);
        // in from the side, into the port on the near edge (the arm stays
        // clear of the tablet at the far end)
        const p = sm(0.64, 0.72, k);
        spot.set(-0.15 - (1 - p) * 0.06, 0.012, -0.36);
      }
      for (const t of Object.values(tools)) if (t !== tool) t.parent?.remove(t);
      if (support) {
        if (tool) {
          // On the keyboard, not the hand marker: game.js hides the marker
          // every frame (the glove is drawn there instead), children and all.
          if (tool.parent !== mesh) mesh.add(tool);
          tool.scale.setScalar(TOOL_SCALE);
          const len = tool.userData.len * TOOL_SCALE;
          // The tool leans out of the work toward the top right of the view,
          // so it reads beside the fist instead of hiding behind it: the
          // hand sits up that lean, its grip axis (-Z, game.js
          // _meleeAxisDefault) pointing down the tool to the tip.
          support.position.lerp(_hand.copy(spot).addScaledVector(TOOL_LEAN, len), 1 - Math.exp(-dt * 18));
          support.quaternion.setFromUnitVectors(_negZ, _dir.copy(TOOL_LEAN).negate());
          // Same place and lean as the hand: its -Y (the tip) down the grip axis.
          tool.position.copy(support.position);
          tool.quaternion.copy(support.quaternion).multiply(_toolQ);
          if (tool === tools.screw) tool.rotateY(st.t * 14);   // twisting
        } else if (k < 0.12) {
          // reaching for the tool belt
          support.position.lerp(new THREE.Vector3(0.2, 0.12, -0.3), 1 - Math.exp(-dt * 10));
        }
      }

      // Solder sparks off the iron's tip.
      if (tool === tools.iron && tools.iron.userData.tip) {
        const tipW = new THREE.Vector3();
        tools.iron.userData.tip.getWorldPosition(tipW);
        mesh.worldToLocal(tipW);
        for (const s of sparks) {
          if (s.life <= 0 && Math.random() < 0.35) {
            if (!s.mesh.parent) mesh.add(s.mesh);
            s.mesh.position.copy(tipW);
            s.v.set((Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6);
            s.life = 0.2 + Math.random() * 0.2;
          }
          if (s.life > 0) {
            s.life -= dt;
            s.v.y -= 2.5 * dt;
            s.mesh.position.addScaledVector(s.v, dt);
            s.mesh.visible = s.life > 0;
          }
        }
      } else for (const s of sparks) { s.life = 0; s.mesh.parent?.remove(s.mesh); }

      // The diagnostic tablet, propped on the far end of the board. Its
      // face looks out along the keys (+Y, at you) and its text runs up the
      // board's x, which is up on screen in the lap pose.
      if (k > 0.08 && k < 0.95) {
        if (monitor.parent !== mesh) mesh.add(monitor);
        monitor.position.set(0.0, 0.07, -0.86);
        monitor.quaternion.copy(TABLET_Q);
        monitor.scale.setScalar(sm(0.08, 0.14, k) * (1 - sm(0.9, 0.95, k)) || 0.001);
        if (k < 0.4) monitor.userData.draw("keyboard.exe\nhas stopped\nworking", -1, true);
        else if (k < 0.64) monitor.userData.draw("Updating drivers\n(do not rage quit)", sm(0.4, 0.64, k) * 0.6, false);
        else if (k < 0.8) monitor.userData.draw("Installing\nRGB.dll", 0.6 + sm(0.64, 0.8, k) * 0.4, false);
        else { monitor.userData.draw("Problem?\nFixed.", -1, false); cue("chime", T * 0.8); }
      } else monitor.parent?.remove(monitor);
      return true;
    },
  };
}
