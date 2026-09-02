/* ============================================================================
   TROLL RACER — track mesh construction.

   Turns the trollface centreline (track-data.js) into real geometry:
   road ribbon, kerbs, run-off, barriers, start/finish line, plus the
   spatial lookup the physics + AI use to know where the road is.

   Exposes window.TrollRacerTrack.build(THREE) -> { group, path, ... }
   ============================================================================ */
(() => {
  "use strict";

  const DATA = window.TROLL_RACER_TRACK;
  if (!DATA) { console.error("[troll-racer] track data missing"); return; }

  // World scale: track-data units -> metres.
  const S = 0.42;
  const ROAD_HALF = 9.2;     // metres from centreline to white line
  const KERB_W = 1.5;
  const RUNOFF_W = 9;

  /* ------------------------------------------------------------------ path */
  // Build the centreline in world space plus per-point tangent/normal and the
  // cumulative distance, so physics can map a car onto "how far round am I".
  function buildPath() {
    const pts = DATA.points.map(p => ({ x: p[0] * S, z: p[1] * S }));
    const N = pts.length;
    const cum = new Float32Array(N + 1);
    for (let i = 0; i < N; i++) {
      const a = pts[i], b = pts[(i + 1) % N];
      cum[i + 1] = cum[i] + Math.hypot(b.x - a.x, b.z - a.z);
    }
    const total = cum[N];

    // tangents via central difference (smooth, no kinks at the seam)
    const tan = [], nor = [];
    for (let i = 0; i < N; i++) {
      const a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N];
      let tx = b.x - a.x, tz = b.z - a.z;
      const l = Math.hypot(tx, tz) || 1;
      tx /= l; tz /= l;
      tan.push({ x: tx, z: tz });
      nor.push({ x: -tz, z: tx });   // left-hand normal
    }

    // Track half-width varies with corner radius: wider on straights so the
    // circuit reads like a real venue rather than a constant ribbon.
    const half = DATA.radii.map(r => {
      const t = Math.min(1, Math.max(0, (r - 60) / 500));
      return ROAD_HALF * (0.86 + 0.24 * t);
    });

    return { pts, tan, nor, cum, total, N, half };
  }

  const P = buildPath();

  /* ------------------------------------------ nearest-point spatial lookup */
  // Uniform grid over centreline indices -> O(1) "which bit of track am I on".
  const CELL = 26;
  const grid = new Map();
  const key = (cx, cz) => cx + "," + cz;
  for (let i = 0; i < P.N; i++) {
    const cx = Math.floor(P.pts[i].x / CELL), cz = Math.floor(P.pts[i].z / CELL);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const k = key(cx + dx, cz + dz);
      let a = grid.get(k); if (!a) grid.set(k, a = []);
      a.push(i);
    }
  }

  // Returns { i, t, lateral, dist, tanX, tanZ } for a world position.
  function locate(x, z, hintIdx) {
    let best = -1, bestD = Infinity;
    const cand = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    const scan = (i) => {
      const p = P.pts[i];
      const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d < bestD) { bestD = d; best = i; }
    };
    if (cand) cand.forEach(scan);
    if (best < 0) {
      // fall back to a window around the hint, else full scan
      if (hintIdx != null) {
        for (let k = -14; k <= 14; k++) scan((hintIdx + k + P.N * 2) % P.N);
      }
      if (best < 0) for (let i = 0; i < P.N; i++) scan(i);
    }
    // refine onto the segment between best and its neighbours
    let bi = best, bt = 0, bd2 = Infinity;
    for (const off of [-1, 0]) {
      const i0 = (best + off + P.N) % P.N, i1 = (i0 + 1) % P.N;
      const a = P.pts[i0], b = P.pts[i1];
      const vx = b.x - a.x, vz = b.z - a.z;
      const len2 = vx * vx + vz * vz || 1;
      let t = ((x - a.x) * vx + (z - a.z) * vz) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + vx * t, pz = a.z + vz * t;
      const d2 = (px - x) * (px - x) + (pz - z) * (pz - z);
      if (d2 < bd2) { bd2 = d2; bi = i0; bt = t; }
    }
    const i0 = bi, i1 = (bi + 1) % P.N;
    const a = P.pts[i0], b = P.pts[i1];
    const cx2 = a.x + (b.x - a.x) * bt, cz2 = a.z + (b.z - a.z) * bt;
    const n = P.nor[i0], t0 = P.tan[i0], t1 = P.tan[i1];
    let tanX = t0.x + (t1.x - t0.x) * bt, tanZ = t0.z + (t1.z - t0.z) * bt;
    const tl = Math.hypot(tanX, tanZ) || 1; tanX /= tl; tanZ /= tl;
    const lateral = (x - cx2) * n.x + (z - cz2) * n.z;
    const segLen = P.cum[i0 + 1] - P.cum[i0];
    return {
      i: i0, t: bt, lateral,
      dist: P.cum[i0] + segLen * bt,
      half: P.half[i0] + (P.half[i1] - P.half[i0]) * bt,
      radius: DATA.radii[i0],
      tanX, tanZ, cx: cx2, cz: cz2,
    };
  }

  /* ------------------------------------------------------------- geometry */
  function ribbon(THREE, inner, outer, y, uvRepeat) {
    // inner/outer: arrays of {x,z} of length N (closed). Builds a quad strip.
    const N = inner.length;
    const pos = new Float32Array(N * 2 * 3);
    const uv = new Float32Array(N * 2 * 2);
    const idx = [];
    let run = 0;
    for (let i = 0; i < N; i++) {
      const a = inner[i], b = outer[i];
      pos[i * 6 + 0] = a.x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = a.z;
      pos[i * 6 + 3] = b.x; pos[i * 6 + 4] = y; pos[i * 6 + 5] = b.z;
      if (i > 0) {
        const p = inner[i - 1];
        run += Math.hypot(a.x - p.x, a.z - p.z);
      }
      const v = run / uvRepeat;
      uv[i * 4 + 0] = 0; uv[i * 4 + 1] = v;
      uv[i * 4 + 2] = 1; uv[i * 4 + 3] = v;
    }
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const a = i * 2, b = i * 2 + 1, c = j * 2, d = j * 2 + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  const offsetRing = (d) => P.pts.map((p, i) => ({
    x: p.x + P.nor[i].x * (typeof d === "function" ? d(i) : d),
    z: p.z + P.nor[i].z * (typeof d === "function" ? d(i) : d),
  }));

  /* ------------------------------------------------------------- textures */
  function asphaltTexture(THREE) {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d");
    g.fillStyle = "#2a2c31";
    g.fillRect(0, 0, 512, 512);
    // aggregate speckle
    const img = g.getImageData(0, 0, 512, 512), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 34;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    // faint longitudinal wear from racing traffic
    g.globalAlpha = 0.07;
    g.fillStyle = "#15171b";
    for (let i = 0; i < 34; i++) {
      const x = Math.random() * 512;
      g.fillRect(x, 0, 1 + Math.random() * 3, 512);
    }
    g.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }

  function kerbTexture(THREE) {
    const c = document.createElement("canvas");
    c.width = 8; c.height = 64;
    const g = c.getContext("2d");
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? "#e8e8ec" : "#d02637";
      g.fillRect(0, i * 8, 8, 8);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }

  function grassTexture(THREE) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#20361d";
    g.fillRect(0, 0, 256, 256);
    const img = g.getImageData(0, 0, 256, 256), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      d[i] += n * 0.6; d[i + 1] += n; d[i + 2] += n * 0.5;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(60, 60);
    t.anisotropy = 8;
    return t;
  }

  /* ----------------------------------------------------------------- build */
  function build(THREE) {
    const group = new THREE.Group();

    // ---- road surface
    const inner = offsetRing(i => P.half[i]);
    const outer = offsetRing(i => -P.half[i]);
    const roadGeo = ribbon(THREE, inner, outer, 0.02, 9);
    const asphalt = asphaltTexture(THREE);
    asphalt.repeat.set(1, 1);
    const roadMat = new THREE.MeshStandardMaterial({
      map: asphalt, roughness: 0.92, metalness: 0.0, color: 0xffffff,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.receiveShadow = true;
    group.add(road);

    // ---- white edge lines
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f4, roughness: 0.75 });
    [1, -1].forEach(sgn => {
      const a = offsetRing(i => sgn * (P.half[i] - 0.16));
      const b = offsetRing(i => sgn * (P.half[i] - 0.42));
      const g = ribbon(THREE, a, b, 0.035, 4);
      const m = new THREE.Mesh(g, lineMat);
      m.receiveShadow = true;
      group.add(m);
    });

    // ---- kerbs, only where it actually corners
    const kerbTex = kerbTexture(THREE);
    const kerbMat = new THREE.MeshStandardMaterial({ map: kerbTex, roughness: 0.6 });
    [1, -1].forEach(sgn => {
      // Segment the ring into runs of "this is a corner" and build one strip each.
      let runStart = -1;
      const flush = (end) => {
        if (runStart < 0) return;
        const len = end - runStart;
        if (len > 3) {
          const ia = [], ib = [];
          for (let k = runStart; k <= end; k++) {
            const i = k % P.N;
            const n = P.nor[i], p = P.pts[i];
            const d0 = sgn * P.half[i], d1 = sgn * (P.half[i] + KERB_W);
            ia.push({ x: p.x + n.x * d0, z: p.z + n.z * d0 });
            ib.push({ x: p.x + n.x * d1, z: p.z + n.z * d1 });
          }
          // open strip (not closed) — build manually
          const N2 = ia.length;
          const pos = new Float32Array(N2 * 2 * 3), uv = new Float32Array(N2 * 2 * 2);
          const idx = [];
          let run = 0;
          for (let i = 0; i < N2; i++) {
            pos[i * 6] = ia[i].x; pos[i * 6 + 1] = 0.055; pos[i * 6 + 2] = ia[i].z;
            pos[i * 6 + 3] = ib[i].x; pos[i * 6 + 4] = 0.085; pos[i * 6 + 5] = ib[i].z;
            if (i > 0) run += Math.hypot(ia[i].x - ia[i - 1].x, ia[i].z - ia[i - 1].z);
            const v = run / 2.2;
            uv[i * 4] = 0; uv[i * 4 + 1] = v; uv[i * 4 + 2] = 1; uv[i * 4 + 3] = v;
          }
          for (let i = 0; i < N2 - 1; i++) {
            const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
            idx.push(a, c, b, b, c, d);
          }
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
          g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
          g.setIndex(idx); g.computeVertexNormals();
          const m = new THREE.Mesh(g, kerbMat);
          m.receiveShadow = true;
          group.add(m);
        }
        runStart = -1;
      };
      for (let k = 0; k < P.N + 8; k++) {
        const i = k % P.N;
        // kerb on the inside of the corner: sign of turn vs this side
        const turn = crossAt(i);
        const isCorner = DATA.radii[i] < 260;
        const insideThisSide = sgn > 0 ? turn > 0 : turn < 0;
        if (isCorner && insideThisSide) { if (runStart < 0) runStart = k; }
        else flush(k - 1);
      }
      flush(P.N + 7);
    });

    // ---- run-off / grass verge
    const grassMat = new THREE.MeshStandardMaterial({ map: grassTexture(THREE), roughness: 1 });
    [1, -1].forEach(sgn => {
      const a = offsetRing(i => sgn * (P.half[i] + KERB_W));
      const b = offsetRing(i => sgn * (P.half[i] + KERB_W + RUNOFF_W));
      const g = ribbon(THREE, a, b, -0.03, 26);
      const m = new THREE.Mesh(g, grassMat);
      m.receiveShadow = true;
      group.add(m);
    });

    // ---- armco barriers
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0xc9ccd2, roughness: 0.42, metalness: 0.72,
    });
    [1, -1].forEach(sgn => {
      const d = i => sgn * (P.half[i] + KERB_W + RUNOFF_W);
      const a = offsetRing(d);
      const N2 = a.length;
      const pos = new Float32Array(N2 * 2 * 3), uv = new Float32Array(N2 * 2 * 2);
      const idx = [];
      for (let i = 0; i < N2; i++) {
        pos[i * 6] = a[i].x; pos[i * 6 + 1] = 0.15; pos[i * 6 + 2] = a[i].z;
        pos[i * 6 + 3] = a[i].x; pos[i * 6 + 4] = 1.05; pos[i * 6 + 5] = a[i].z;
        uv[i * 4] = i / 6; uv[i * 4 + 1] = 0; uv[i * 4 + 2] = i / 6; uv[i * 4 + 3] = 1;
      }
      for (let i = 0; i < N2; i++) {
        const j = (i + 1) % N2;
        const p = i * 2, q = i * 2 + 1, r = j * 2, s = j * 2 + 1;
        idx.push(p, r, q, q, r, s);
        idx.push(q, r, p, s, r, q); // double-sided
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      group.add(new THREE.Mesh(g, barrierMat));
    });

    // ---- start/finish line
    {
      const i = 0;
      const p = P.pts[i], n = P.nor[i], t = P.tan[i];
      const w = P.half[i] * 2;
      const c = document.createElement("canvas");
      c.width = 64; c.height = 8;
      const g2 = c.getContext("2d");
      for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) {
        g2.fillStyle = (x + y) % 2 ? "#f4f4f6" : "#15161a";
        g2.fillRect(x * 8, y * 4, 8, 4);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 1);
      const geo = new THREE.PlaneGeometry(w, 2.4);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.atan2(t.x, t.z);
      m.position.set(p.x, 0.045, p.z);
      m.receiveShadow = true;
      group.add(m);
    }

    return {
      group, path: P, locate, S,
      startPos: { x: P.pts[0].x, z: P.pts[0].z },
      startHeading: Math.atan2(P.tan[0].x, P.tan[0].z),
      lapLength: P.total,
    };
  }

  // signed turn direction at index i (>0 = turning left)
  function crossAt(i) {
    const a = P.tan[(i - 1 + P.N) % P.N], b = P.tan[(i + 1) % P.N];
    return a.x * b.z - a.z * b.x;
  }

  window.TrollRacerTrack = { build, locate, path: P, S, data: DATA };
})();
