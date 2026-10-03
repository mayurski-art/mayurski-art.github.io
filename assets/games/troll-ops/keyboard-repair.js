// Troll Forces — the Keyboard Warrior's shield, and what happens when it
// takes one round too many (user, 2026-10-03): "a funny animation where it
// tries to repair the keyboard … include some computer gear for repair,
// before coming back to the default keyboard sword holding stance".
//
// Holding aim with the keyboard raises it flat across the body, keys out.
// A few consecutive hits (game.js kbShield) and it breaks: keycaps pop
// off, the keyboard comes down onto your lap and gets a quick flip onto its
// back (user: "a small flip face the backside and then the rest of the
// animation"). The off hand backs the four screws out of the back panel,
// lifts the lid off the circuit board, solders it, plugs a USB cable into
// the edge, and a little tablet reports on the reboot. The lid goes back
// on, it flips over again and comes back up into the stance.
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

function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* The keyboard's back, in its own frame: the case's underside is the plane
   y = -BACK_Y, facing -Y. A lid held on by four screws covers the circuit
   board. */
// The case's underside is at 0.019, but its own recessed back plate
// (gear.js buildKeyboardSword) stands 4 mm proud of that: build on top of it.
const BACK_Y = 0.023;
const PANEL = { w: 0.25, l: 0.5, z: -0.58 };
const SCREWS = [[0.105, -0.36], [-0.105, -0.36], [-0.105, -0.8], [0.105, -0.8]];
function backPanel() {
  const g = new THREE.Group();
  // The circuit board: green, gold traces, silkscreen.
  const pcbTex = canvasTexture(256, 512, (x, W, H) => {
    x.fillStyle = "#156b35"; x.fillRect(0, 0, W, H);
    x.strokeStyle = "#d9b45a"; x.lineWidth = 3;
    for (let i = 0; i < 26; i++) {
      x.beginPath();
      let px = 10 + Math.random() * (W - 20), py = 10 + Math.random() * (H - 20);
      x.moveTo(px, py);
      for (let j = 0; j < 3; j++) { if (j % 2) px = 10 + Math.random() * (W - 20); else py = 10 + Math.random() * (H - 20); x.lineTo(px, py); }
      x.stroke();
    }
    x.fillStyle = "#e8eef0";
    x.font = "bold 18px monospace";
    x.save(); x.translate(W / 2, H / 2); x.rotate(-Math.PI / 2);
    x.textAlign = "center";
    x.fillText("TROLL-KB  REV 1.337", 0, -70);
    x.fillText("U MAD BRO? (tm)", 0, 90);
    x.restore();
  });
  // A thin slab standing just off the case (a plane on the case's own face
  // lost the depth test to it).
  const pcb = part(new THREE.BoxGeometry(PANEL.w - 0.02, 0.002, PANEL.l - 0.02), new THREE.MeshStandardMaterial({ map: pcbTex, emissiveMap: pcbTex, emissive: 0xffffff, emissiveIntensity: 0.14, roughness: 0.6, metalness: 0 }), 0, -BACK_Y - 0.002, PANEL.z);
  g.add(pcb);
  // chips and a little RGB controller
  for (const [cx, cz, w, l, col] of [[0.03, -0.66, 0.05, 0.06, 0x16161a], [-0.05, -0.48, 0.04, 0.04, 0x16161a], [0.05, -0.42, 0.03, 0.05, 0x22222a], [-0.04, -0.72, 0.035, 0.035, 0x3a1060]]) {
    g.add(part(new THREE.BoxGeometry(w, 0.004, l), mat(col), cx, -BACK_Y - 0.005, cz));
  }
  // The lid, with its warranty sticker and the four screws.
  const lid = new THREE.Group();
  // Flush with the case and deep enough to hold the board and chips inside it.
  lid.add(part(new THREE.BoxGeometry(PANEL.w, 0.011, PANEL.l), mat(0x1c1c20, { roughness: 0.7 }), 0, 0, 0));
  const stickerTex = canvasTexture(256, 128, (x, W, H) => {
    x.fillStyle = "#f1f1ea"; x.fillRect(0, 0, W, H);
    x.fillStyle = "#c81e1e"; x.textAlign = "center";
    x.font = "bold 24px sans-serif"; x.fillText("WARRANTY VOID", W / 2, 48);
    x.fillText("IF REMOVED", W / 2, 78);
    x.fillStyle = "#333"; x.font = "15px sans-serif"; x.fillText("Made in Grinland", W / 2, 108);
  });
  // Sticker on the outer face (-Y), reading up the screen in the lap pose.
  const sticker = part(new THREE.PlaneGeometry(0.11, 0.055), new THREE.MeshStandardMaterial({ map: stickerTex, roughness: 0.6 }), 0, -0.0058, 0.05);
  sticker.quaternion.copy(BACK_FACE_Q);
  lid.add(sticker);
  lid.position.set(0, -BACK_Y - 0.0075, PANEL.z);
  g.add(lid);
  const screws = SCREWS.map(([sx, sz]) => {
    const sc = new THREE.Group();
    sc.add(part(new THREE.CylinderGeometry(0.0075, 0.0075, 0.003, 12), mat(0xb8bcc4, { metalness: 0.85, roughness: 0.3 })));
    sc.add(part(new THREE.BoxGeometry(0.011, 0.0012, 0.002), mat(0x2a2a2a), 0, -0.0016, 0));
    sc.userData.home = new THREE.Vector3(sx, -BACK_Y - 0.0145, sz);
    sc.position.copy(sc.userData.home);
    g.add(sc);
    return sc;
  });
  return { group: g, lid, screws, lidHome: lid.position.clone() };
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
// Keyboard frame, flipped onto its back: -X is up the screen, -Y toward you.
const TOOL_LEAN = new THREE.Vector3(-0.55, -0.7, 0.45).normalize();
const FLIP_AXIS = new THREE.Vector3(0, 0, 1);
const _flipQ = new THREE.Quaternion();
const _toolQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
const _negZ = new THREE.Vector3(0, 0, -1), _dir = new THREE.Vector3(), _hand = new THREE.Vector3();
// Face out of the back (-Y), text up the screen (-X).
const TABLET_Q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0)));
const BACK_FACE_Q = TABLET_Q;

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
    built = { tools, caps, sparks, monitor: screen(), back: backPanel() };
  }

  /* Pull everything off whatever it was attached to. */
  function stow() {
    if (!built) return;
    for (const t of Object.values(built.tools)) t.parent?.remove(t);
    for (const c of built.caps) c.mesh.parent?.remove(c.mesh);
    for (const s of built.sparks) s.mesh.parent?.remove(s.mesh);
    built.monitor.parent?.remove(built.monitor);
    built.back.group.parent?.remove(built.back.group);
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

      // Down onto the lap, a quick flip onto its back, the work, a flip
      // back over and up into the stance.
      const into = sm(0, 0.08, k), outOf = sm(0.9, 1, k);
      const w = into * (1 - outOf);
      const flip = sm(0.07, 0.15, k) - sm(0.84, 0.91, k);       // 0 keys up, 1 on its back
      const flipping = Math.sin(Math.PI * Math.min(1, Math.max(0, k < 0.5 ? (k - 0.07) / 0.08 : (k - 0.84) / 0.07)));
      const restPos = mesh.position.clone(), restQuat = mesh.quaternion.clone();
      mesh.position.lerpVectors(restPos, KB_REPAIR.pos, w);
      mesh.position.y += flipping * 0.07;                         // tossed up a little to turn it
      mesh.quaternion.slerpQuaternions(restQuat, KB_REPAIR.quat, w);
      mesh.quaternion.multiply(_flipQ.setFromAxisAngle(FLIP_AXIS, flip * Math.PI));
      // the shot-up shudder at the start, the satisfied twirl at the end
      const shudder = (1 - sm(0, 0.06, k)) * 0.03;
      mesh.position.x += Math.sin(st.t * 70) * shudder;
      mesh.rotateZ(Math.sin(st.t * 55) * shudder * 4 + Math.sin(outOf * Math.PI) * 0.6);
      if (flip > 0.02 && flip < 0.98 && !st.cued.has(k < 0.5 ? "flip" : "flip2")) cue(k < 0.5 ? "flip" : "flip2", 0);

      // Keycaps fly off the front as it breaks.
      cue("clatter", 0);
      if (k < 0.3) {
        caps.forEach((c) => {
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

      // The back panel: on the board for the whole act.
      const { back } = built;
      if (back.group.parent !== mesh) mesh.add(back.group);
      // Screws come out one by one under the screwdriver (0.15-0.37) and go
      // back in a blink when the lid does (0.84).
      const SCREW0 = 0.15, SCREW_STEP = 0.055;
      back.screws.forEach((sc, i) => {
        const a = SCREW0 + i * SCREW_STEP;
        const out = k < 0.84 ? sm(a + 0.02, a + SCREW_STEP, k) : 0;
        sc.visible = out < 0.999;
        sc.position.copy(sc.userData.home);
        sc.position.y -= out * 0.03;
        sc.position.x -= out * out * 0.12;            // flicked away up the screen
        sc.rotation.y = out * 25;
      });
      // The lid lifts off and away (0.37-0.43), and back on (0.82-0.86).
      const lidOff = sm(0.37, 0.43, k) - sm(0.8, 0.85, k);
      back.lid.position.copy(back.lidHome);
      back.lid.position.y -= lidOff * 0.06;
      back.lid.position.x -= lidOff * 0.32;
      back.lid.rotation.z = lidOff * 0.5;
      back.lid.visible = lidOff < 0.98;
      if (lidOff > 0.05 && k < 0.5) cue("lid", 0);

      // The off hand's job, in the keyboard's own frame: which tool, and
      // where its tip is working.
      let tool = null;
      const spot = new THREE.Vector3();
      if (k >= SCREW0 && k < SCREW0 + SCREW_STEP * 4) {
        tool = tools.screw;
        const i = Math.min(3, Math.floor((k - SCREW0) / SCREW_STEP));
        cue("screw" + i, 0);
        const [sx, sz] = SCREWS[i];
        const a = st.t * 9;
        spot.set(sx + Math.cos(a) * 0.004, -BACK_Y - 0.016, sz + Math.sin(a) * 0.004);
      } else if (k >= 0.44 && k < 0.64) {
        tool = tools.iron;
        cue("solder", T * 0.45); cue("solder2", T * 0.55);
        // two dabs on the board, a little lift between
        const dab = Math.abs(Math.sin(st.t * 6));
        spot.set(k < 0.54 ? 0.03 : -0.05, -BACK_Y - 0.008 - dab * 0.03, k < 0.54 ? -0.66 : -0.48);
      } else if (k >= 0.64 && k < 0.8) {
        tool = tools.usb;
        cue("plug", T * 0.68);
        // into the port on the edge nearest you (the arm stays clear of the
        // tablet at the far end)
        const p = sm(0.64, 0.7, k);
        spot.set(0.15 + (1 - p) * 0.06, -0.005, -0.36);
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
        } else if (k > 0.12 && k < 0.84) {
          // between tools: hovering over the open back
          support.position.lerp(_hand.set(-0.12, -0.14, -0.5), 1 - Math.exp(-dt * 8));
        }
      }

      // Solder sparks off the iron's tip, out of the back toward you.
      if (tool === tools.iron && tools.iron.userData.tip) {
        const tipW = new THREE.Vector3();
        tools.iron.userData.tip.getWorldPosition(tipW);
        mesh.worldToLocal(tipW);
        for (const sp of sparks) {
          if (sp.life <= 0 && Math.random() < 0.35) {
            if (!sp.mesh.parent) mesh.add(sp.mesh);
            sp.mesh.position.copy(tipW);
            sp.v.set((Math.random() - 0.7) * 0.6, -0.3 - Math.random() * 0.5, (Math.random() - 0.5) * 0.6);
            sp.life = 0.2 + Math.random() * 0.2;
          }
          if (sp.life > 0) {
            sp.life -= dt;
            sp.v.x += 2.5 * dt;                         // down the screen
            sp.mesh.position.addScaledVector(sp.v, dt);
            sp.mesh.visible = sp.life > 0;
          }
        }
      } else for (const sp of sparks) { sp.life = 0; sp.mesh.parent?.remove(sp.mesh); }

      // The diagnostic tablet, propped on the far end of the back.
      if (k > 0.14 && k < 0.88) {
        if (monitor.parent !== mesh) mesh.add(monitor);
        monitor.position.set(0.0, -BACK_Y - 0.05, -0.95);
        monitor.quaternion.copy(TABLET_Q);
        monitor.scale.setScalar(sm(0.14, 0.2, k) * (1 - sm(0.84, 0.88, k)) || 0.001);
        if (k < 0.43) monitor.userData.draw("keyboard.exe\nhas stopped\nworking", -1, true);
        else if (k < 0.64) monitor.userData.draw("Updating drivers\n(do not rage quit)", sm(0.43, 0.64, k) * 0.6, false);
        else if (k < 0.78) monitor.userData.draw("Installing\nRGB.dll", 0.6 + sm(0.64, 0.78, k) * 0.4, false);
        else { monitor.userData.draw("Problem?\nFixed.", -1, false); cue("chime", T * 0.78); }
      } else monitor.parent?.remove(monitor);
      return true;
    },
  };
}
