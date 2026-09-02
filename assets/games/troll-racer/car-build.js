/* ============================================================================
   TROLL RACER — car construction.

   A GT-style racer built from primitives: layered body, cabin greenhouse,
   splitter/diffuser, wing, wheels. Paint uses MeshPhysicalMaterial with a
   clearcoat lobe so it picks up the env map the way real car paint does —
   that reflective sheen is most of what makes a racing game look "AAA".

   window.TrollRacerCar.build(THREE, { color, driver }) -> { group, wheels, ... }
   ============================================================================ */
(() => {
  "use strict";

  // Rounded box via a scaled/beveled extrusion is expensive; instead we stack
  // boxes with slightly different widths, which reads as a moulded body once
  // the clearcoat catches the light.
  function paintMat(THREE, color, envMap) {
    return new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.62,
      roughness: 0.26,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMap,
      envMapIntensity: 1.35,
    });
  }

  function build(THREE, opts) {
    const o = opts || {};
    const color = o.color != null ? o.color : 0x4dff73;
    const envMap = o.envMap || null;
    const group = new THREE.Group();

    const paint = paintMat(THREE, color, envMap);
    const dark = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.62, metalness: 0.3 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x0a0d14, metalness: 0, roughness: 0.06,
      transmission: 0.55, thickness: 0.4, envMap, envMapIntensity: 1.1,
      transparent: true, opacity: 0.86,
    });
    const carbon = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.38, metalness: 0.55, envMap });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x0d0e11, roughness: 0.95 });
    const rim = new THREE.MeshStandardMaterial({ color: 0xd8dbe2, roughness: 0.28, metalness: 0.9, envMap });

    const add = (geo, mat, x, y, z, ry) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (ry) m.rotation.y = ry;
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      return m;
    };

    // ---- main tub (car points down +Z)
    add(new THREE.BoxGeometry(1.86, 0.42, 4.24), paint, 0, 0.46, 0);
    // lower sill / side pods, slightly narrower for a moulded shoulder
    add(new THREE.BoxGeometry(1.98, 0.26, 3.5), paint, 0, 0.3, -0.05);
    // nose wedge
    const nose = add(new THREE.BoxGeometry(1.72, 0.3, 1.15), paint, 0, 0.42, 2.16);
    nose.rotation.x = -0.09;
    // rear haunches
    add(new THREE.BoxGeometry(1.94, 0.46, 1.35), paint, 0, 0.52, -1.5);

    // ---- greenhouse
    const cab = add(new THREE.BoxGeometry(1.44, 0.44, 1.9), paint, 0, 0.86, -0.28);
    cab.scale.z = 1;
    // windscreen + side glass
    const ws = add(new THREE.BoxGeometry(1.36, 0.42, 0.12), glass, 0, 0.88, 0.68);
    ws.rotation.x = 0.42;
    add(new THREE.BoxGeometry(0.06, 0.34, 1.6), glass, 0.71, 0.88, -0.3);
    add(new THREE.BoxGeometry(0.06, 0.34, 1.6), glass, -0.71, 0.88, -0.3);
    // roof
    add(new THREE.BoxGeometry(1.3, 0.08, 1.5), paint, 0, 1.08, -0.42);
    // rear screen
    const rs = add(new THREE.BoxGeometry(1.28, 0.4, 0.1), glass, 0, 0.86, -1.16);
    rs.rotation.x = -0.5;

    // ---- aero
    add(new THREE.BoxGeometry(2.06, 0.06, 0.62), carbon, 0, 0.17, 2.34);      // splitter
    add(new THREE.BoxGeometry(1.96, 0.28, 0.5), carbon, 0, 0.28, -2.16);       // diffuser
    // rear wing
    add(new THREE.BoxGeometry(1.9, 0.07, 0.46), carbon, 0, 1.06, -2.06);
    add(new THREE.BoxGeometry(0.07, 0.42, 0.34), carbon, 0.82, 0.86, -2.04);
    add(new THREE.BoxGeometry(0.07, 0.42, 0.34), carbon, -0.82, 0.86, -2.04);
    // mirrors
    add(new THREE.BoxGeometry(0.2, 0.1, 0.1), dark, 0.92, 0.92, 0.5);
    add(new THREE.BoxGeometry(0.2, 0.1, 0.1), dark, -0.92, 0.92, 0.5);

    // ---- lights
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xfff6de, emissive: 0xfff2d0, emissiveIntensity: 1.5, roughness: 0.3,
    });
    add(new THREE.BoxGeometry(0.44, 0.14, 0.08), headMat, 0.56, 0.5, 2.66);
    add(new THREE.BoxGeometry(0.44, 0.14, 0.08), headMat, -0.56, 0.5, 2.66);
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff2438, emissive: 0xff1830, emissiveIntensity: 1.1, roughness: 0.35,
    });
    const tl = add(new THREE.BoxGeometry(0.5, 0.12, 0.07), tailMat, 0.6, 0.6, -2.2);
    const tr = add(new THREE.BoxGeometry(0.5, 0.12, 0.07), tailMat, -0.6, 0.6, -2.2);
    add(new THREE.BoxGeometry(1.7, 0.34, 0.09), dark, 0, 0.52, 2.62);          // grille

    // ---- wheels
    const wheels = [];
    const tyreGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.34, 22);
    const rimGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.36, 12);
    const discGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.38, 16);
    const discMat = new THREE.MeshStandardMaterial({ color: 0x35383f, roughness: 0.5, metalness: 0.8 });
    const WPOS = [
      [ 0.94, 0.44,  1.42, "fr"], [-0.94, 0.44,  1.42, "fl"],
      [ 0.98, 0.44, -1.46, "rr"], [-0.98, 0.44, -1.46, "rl"],
    ];
    WPOS.forEach(([x, y, z, id]) => {
      const pivot = new THREE.Group();       // steering pivot (Y)
      pivot.position.set(x, y, z);
      const spin = new THREE.Group();        // rolling (X)
      const t = new THREE.Mesh(tyreGeo, rubber);
      t.rotation.z = Math.PI / 2;
      t.castShadow = true;
      const r = new THREE.Mesh(rimGeo, rim);
      r.rotation.z = Math.PI / 2;
      const d = new THREE.Mesh(discGeo, discMat);
      d.rotation.z = Math.PI / 2;
      spin.add(t, r, d);
      pivot.add(spin);
      group.add(pivot);
      wheels.push({ pivot, spin, id, steer: id === "fr" || id === "fl", x, z });
    });

    // ---- number roundel on the doors so cars read apart at distance
    if (o.number != null) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d");
      g.fillStyle = "#f4f4f6"; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#101216";
      g.font = "900 82px DM Sans, system-ui, sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(o.number), 64, 70);
      const tex = new THREE.CanvasTexture(c);
      const rm = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5 });
      const pl = new THREE.PlaneGeometry(0.72, 0.72);
      const a = new THREE.Mesh(pl, rm);
      a.position.set(1.0, 0.62, -0.15); a.rotation.y = Math.PI / 2;
      group.add(a);
      const b = new THREE.Mesh(pl, rm);
      b.position.set(-1.0, 0.62, -0.15); b.rotation.y = -Math.PI / 2;
      group.add(b);
    }

    return { group, wheels, paint, tailLights: [tl, tr], tailMat };
  }

  window.TrollRacerCar = { build, paintMat };
})();
