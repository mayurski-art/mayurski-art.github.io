// Hitbox lab: localhost only, behind ?hitbox=1 (game.js loads it lazily).
//
// The user asked for a way to judge the trolls' hitboxes accurately, not by
// eye. So the lab drops you in the Test Range with a row of real troll rigs
// (the same buildHumanoid + poseHumanoid the bots and players use) and reads
// every round you fire off its true path (ballistics.js onTrace, drop and
// all). Each round is checked twice: against the hit proxies (what counts)
// and against the troll you can actually see (ink body, mitts, and the face
// board where its art is opaque). That splits every shot into:
//   hit       touched the body and counted
//   GHOST     touched the body and did NOT count — the hitbox is too small
//             there; the mark shows how many cm the hitbox missed by
//   generous  counted without touching the body — the hitbox is bigger there
//   near      missed both, within 30 cm of a hitbox
// Sliders scale the hit proxies live (head whole; body and limbs in
// thickness only, so a limb never grows past its joint) so the numbers can
// be tuned and then baked into character.js.

import * as THREE from "three";
import { buildHumanoid, poseHumanoid, aimRig, gaitPhaseRate } from "./character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2";
import { raycastWorld, segmentBlocked } from "./ballistics.js?v=cg1-wst-hf1-fu1b7";

const DISTANCES = [8, 15, 25, 40];
const LATERAL = [-1.4, 1.4, -2.6, 2.6];   // staggered so no troll hides another
const NEAR_CM = 30;
const MAX_MARKS = 80;
const KEY = "trollops:hitboxTune";
const COLORS = { hit: 0x35e06a, head: 0xff5a3c, ghost: 0xff2bd6, generous: 0x2bd8ff, near: 0xffd23a };

/* Closest points between segments p1q1 and p2q2 (Ericson, RTCD 5.1.9).
   Writes them to c1/c2 and returns the distance. */
const _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _r = new THREE.Vector3();
function segSeg(p1, q1, p2, q2, c1, c2) {
  _d1.subVectors(q1, p1); _d2.subVectors(q2, p2); _r.subVectors(p1, p2);
  const a = _d1.dot(_d1), e = _d2.dot(_d2), f = _d2.dot(_r);
  let s, t;
  if (a <= 1e-9 && e <= 1e-9) { s = 0; t = 0; }
  else if (a <= 1e-9) { s = 0; t = THREE.MathUtils.clamp(f / e, 0, 1); }
  else {
    const c = _d1.dot(_r);
    if (e <= 1e-9) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); }
    else {
      const b = _d1.dot(_d2), den = a * e - b * b;
      s = den > 1e-12 ? THREE.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((b - c) / a, 0, 1); }
    }
  }
  c1.copy(p1).addScaledVector(_d1, s);
  c2.copy(p2).addScaledVector(_d2, t);
  return c1.distanceTo(c2);
}

function partOf(m) {
  if (m.userData.isHead) return "head";
  const r = m.geometry.parameters?.radius ?? 0;
  return m.geometry.type === "SphereGeometry" || r > 0.11 ? "body" : "limbs";
}

/* A proxy as a world-space segment + radius (a sphere is a zero-length one). */
const _sc = new THREE.Vector3();
function proxyShape(m, a, b) {
  const p = m.geometry.parameters || {};
  const half = m.geometry.type === "CapsuleGeometry" ? (p.length ?? p.height ?? 0) / 2 : 0;
  a.set(0, half, 0).applyMatrix4(m.matrixWorld);
  b.set(0, -half, 0).applyMatrix4(m.matrixWorld);
  m.getWorldScale(_sc);
  return (p.radius ?? 0) * _sc.x;
}

function label(text) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 64;
  const g = c.getContext("2d");
  g.font = "600 40px 'DM Mono', monospace";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 8; g.strokeStyle = "rgba(0,0,0,.85)"; g.strokeText(text, 128, 32);
  g.fillStyle = "#ffd27a"; g.fillText(text, 128, 32);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(0.9, 0.225, 1);
  s.renderOrder = 999;
  return s;
}

class Dummy {
  constructor(scene, dist) {
    this.isLabDummy = true;
    this.dist = dist;
    this.mat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.1 });
    this.rig = buildHumanoid(this.mat, { height: 1.8, gun: true });
    this.root = this.rig.root;
    this.root.userData.labDummy = this;
    this.proxies = this.rig.hitboxMeshes;
    for (const m of this.proxies) { m.userData.labDummy = this; m.userData.hitPart = partOf(m); }
    // What you can see: everything drawn except the hit proxies and the gun
    // (CoD doesn't count the gun either).
    const gun = [this.rig.parts.gun, this.rig.parts.gunMount].filter(Boolean);
    this.visual = [];
    this.root.traverse((o) => {
      if (!o.isMesh || o.userData.isHitProxy) return;
      for (let p = o; p; p = p.parent) if (gun.includes(p)) return;
      this.visual.push(o);
    });
    this.tag = label(`${dist} m`);
    this.tag.position.y = 2.2;
    this.root.add(this.tag);
    this.marks = new THREE.Group();
    this.root.add(this.marks);
    this.base = new THREE.Vector3();
    this.side = new THREE.Vector3();
    this.phase = Math.random() * 6;
    this.t = Math.random() * 3;
    scene.add(this.root);
  }
  center(out) { return out.copy(this.root.position).setY(this.root.position.y + 1); }
  dispose(scene) { scene.remove(this.root); }
}

export function createHitboxLab(ctx) {
  const { scene, look, move } = ctx;
  const tune = { head: 1, body: 1, limbs: 1, show: true, motion: "stand" };
  try { Object.assign(tune, JSON.parse(localStorage.getItem(KEY)) || {}); } catch { /* fresh */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(tune)); } catch { /* private mode */ } };

  const wire = {
    head: new THREE.MeshBasicMaterial({ color: 0xff3355, wireframe: true, depthTest: false, transparent: true, opacity: 0.22 }),
    body: new THREE.MeshBasicMaterial({ color: 0x33ff88, wireframe: true, depthTest: false, transparent: true, opacity: 0.16 }),
    limbs: new THREE.MeshBasicMaterial({ color: 0x33aaff, wireframe: true, depthTest: false, transparent: true, opacity: 0.16 }),
  };
  const hitFill = new THREE.MeshBasicMaterial({ color: 0xff7070, transparent: true, opacity: 0.32, depthTest: false, depthWrite: false });
  const markGeo = new THREE.SphereGeometry(0.022, 8, 6);
  const markMats = {};
  for (const [k, c] of Object.entries(COLORS)) markMats[k] = new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true });
  const lineMats = {};
  for (const [k, c] of Object.entries(COLORS)) lineMats[k] = new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true });

  let dummies = [];
  let placed = false, placeDelay = 0.4;
  const allMarks = [];
  const parts = () => ({ head: 0, body: 0, limbs: 0 });
  const freshStats = () => ({ shots: 0, hit: 0, hitPart: parts(), ghost: 0, ghostCm: [], ghostPart: parts(), generous: 0, genPart: parts(), near: 0 });
  const stats = freshStats();
  let last = "Fire at a troll.";
  const live = new Map();   // bullet -> trace state

  /* -- the hit proxies, everywhere in the scene (bots too) -- */
  function applyTune() {
    scene.traverse((m) => {
      if (!m.userData.isHitProxy) return;
      const part = m.userData.hitPart ||= partOf(m);
      m.userData.hitMat ||= m.material;
      const f = tune[part];
      if (part === "head" || m.geometry.type === "SphereGeometry") m.scale.setScalar(f);
      else m.scale.set(f, 1, f);
      // The hit area itself, filled light red (user: "show me the area of
      // impact as well with a light red box"), with the part's coloured
      // outline on top so head / body / limbs still read apart.
      m.visible = tune.show;
      m.material = tune.show ? hitFill : m.userData.hitMat;
      let w = m.userData.hitWire;
      if (!w && tune.show) {
        w = m.userData.hitWire = new THREE.Mesh(m.geometry, wire[part]);
        w.raycast = () => {};   // drawn only: rounds must hit the proxy itself
        w.renderOrder = 2;
        m.add(w);
      }
      if (w) w.visible = tune.show;
    });
  }

  /* -- the row: trolls down the longest clear line of sight -- */
  const _o = new THREE.Vector3(), _f = new THREE.Vector3(), _p = new THREE.Vector3();
  function forwardOf(yaw, out) { return out.set(-Math.sin(yaw), 0, -Math.cos(yaw)); }
  function clearRun(yaw) {
    _o.set(move.pos.x, move.pos.y + 1.2, move.pos.z);
    return raycastWorld(ctx.colliders(), _o, forwardOf(yaw, _f), 60);
  }
  // A spot is good if you can see the whole troll from where you stand:
  // feet, waist and head, so cover never hides part of what you're judging.
  function seen(at) {
    _o.set(move.pos.x, move.pos.y + 1.6, move.pos.z);
    for (const h of [0.15, 0.9, 1.75]) {
      _p.set(at.x, at.y + h, at.z);
      if (segmentBlocked(ctx.colliders(), _o, _p)) return false;
    }
    return true;
  }
  // The spots a row down `yaw` would use (null where none is clear).
  function rowSpots(yaw) {
    const run = clearRun(yaw);
    forwardOf(yaw, _f);
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    return DISTANCES.map((dist, i) => {
      if (dist > run - 1.5) return null;
      for (const lat of [LATERAL[i], -LATERAL[i], 0]) {
        const at = new THREE.Vector3(move.pos.x, move.pos.y, move.pos.z).addScaledVector(_f, dist).addScaledVector(right, lat);
        if (seen(at)) return { dist, at, right };
      }
      return null;
    });
  }
  function place({ bestDirection = false } = {}) {
    for (const d of dummies) d.dispose(scene);
    dummies = [];
    allMarks.length = 0;
    let yaw = look.yaw, spots = rowSpots(yaw);
    if (bestDirection) {
      // the direction that fits the most fully visible trolls (ties: keep
      // the one you're already facing)
      const count = (s) => s.filter(Boolean).length;
      for (let i = 0; i < 36; i++) {
        const y = (i / 36) * Math.PI * 2, s = rowSpots(y);
        if (count(s) > count(spots)) { spots = s; yaw = y; }
      }
      look.yaw = yaw;
      look.pitch = 0;
    }
    for (const s of spots) {
      if (!s) continue;
      const d = new Dummy(scene, s.dist);
      d.base.copy(s.at);
      d.side.copy(s.right);
      d.root.position.copy(d.base);
      dummies.push(d);
    }
    last = dummies.length ? `${dummies.length} trolls at ${dummies.map((d) => d.dist).join(", ")} m. Fire away.` : "No clear line here: move somewhere open and press Row in front of me.";
    applyTune();
    renderPanel();
  }

  /* -- motion -- */
  const STRAFE_HALF = 2.5, RUN = 3.6;
  function poseDummy(d, dt) {
    d.t += dt;
    let moving = false, strafe = 0, lower = 0;
    d.root.position.copy(d.base);
    if (tune.motion === "strafe") {
      // a triangle wave at real run speed across +-2.5 m
      const period = (STRAFE_HALF * 4) / RUN;
      const u = (d.t % period) / period;
      const off = u < 0.5 ? -STRAFE_HALF + u * 4 * STRAFE_HALF : 3 * STRAFE_HALF - u * 4 * STRAFE_HALF;
      d.root.position.addScaledVector(d.side, off);
      moving = true; strafe = u < 0.5 ? 1 : -1;
      d.phase += dt * gaitPhaseRate(RUN);
    } else if (tune.motion === "crouch") lower = 1;
    const dx = move.pos.x - d.root.position.x, dz = move.pos.z - d.root.position.z;
    let yaw = Math.atan2(-dx, -dz);
    if (tune.motion === "side") yaw += Math.PI / 2;
    aimRig(d.rig, yaw, dt, { snap: true, moving });
    poseHumanoid(d.rig, { phase: d.phase, moving, pitch: 0, lower, strafe, forward: moving ? 0 : 1, speed: moving ? 0.85 : 0, mps: moving ? RUN : 0, dt, hasGun: true });
    d.tag.position.y = 2.2 - lower * 0.7;
  }

  /* -- reading rounds -- */
  const ray = new THREE.Raycaster();
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q1 = new THREE.Vector3(), _q2 = new THREE.Vector3();
  const _end = new THREE.Vector3(), _c = new THREE.Vector3();
  const alphaCache = new WeakMap();

  // The face board is a plane; only where its art is opaque is it "the troll"
  // (the material's alphaTest is 0.3, the same cut the renderer makes).
  function opaqueAt(mesh, uv) {
    const img = mesh.material?.map?.image;
    if (!img || !uv || !img.width) return true;
    let px = alphaCache.get(img);
    if (!px) {
      const cv = document.createElement("canvas");
      cv.width = img.width; cv.height = img.height;
      const g = cv.getContext("2d");
      g.drawImage(img, 0, 0);
      try { px = { w: cv.width, h: cv.height, d: g.getImageData(0, 0, cv.width, cv.height).data }; } catch { return true; }
      alphaCache.set(img, px);
    }
    const x = Math.min(px.w - 1, Math.max(0, Math.floor(uv.x * px.w)));
    const y = Math.min(px.h - 1, Math.max(0, Math.floor((1 - uv.y) * px.h)));
    return px.d[(y * px.w + x) * 4 + 3] / 255 >= 0.3;
  }

  /* Which bit of the troll a sight line touched: the face board, a mitt, or
     the ink line nearest to which joint. For the coverage sweep. */
  const _jp = new THREE.Vector3();
  function whereOn(d, h) {
    if (h.object === d.rig.parts.head) return "face";
    for (const side of ["L", "R"]) {
      for (let p = h.object; p; p = p.parent) if (p === d.rig.hands?.[side]?.group) return `hand${side}`;
    }
    let best = "?", bd = Infinity;
    for (const [name, j] of Object.entries(d.rig.parts)) {
      if (!j?.isObject3D || ["gun", "body", "head", "handL", "handR", "gripR", "gunMount"].includes(name)) continue;
      const dd = j.getWorldPosition(_jp).distanceTo(h.point);
      if (dd < bd) { bd = dd; best = name; }
    }
    return best;
  }

  // Raycasts ignore .visible; the rig keeps spare hand meshes hidden.
  function shown(o, root) {
    for (let p = o; p && p !== root; p = p.parent) if (!p.visible) return false;
    return true;
  }

  function onTrace(b, from, dir, len, hitObj) {
    if (b.ownerId !== "player" || b.cosmetic || !dummies.length) return;
    let st = live.get(b);
    if (!from) { if (st) { live.delete(b); finish(st); } return; }
    if (!st) { st = { near: false, vis: null, best: new Map(), hit: null }; live.set(b, st); }
    _end.copy(from).addScaledVector(dir, len);
    for (const d of dummies) {
      d.center(_c);
      // cheap reject: this step passes nowhere near this troll
      if (segSeg(from, _end, _c, _c, _q1, _q2) > 1.8) continue;
      st.near = true;
      d.root.updateWorldMatrix(true, true);
      if (!st.vis) {
        // The step stops where the round enters the hitbox, and the hitbox
        // is fatter than the ink line, so on the troll it struck, look on
        // through it: the body is never more than a body's depth behind.
        const struck = hitObj?.userData.labDummy === d;
        ray.set(from, dir); ray.near = 0; ray.far = struck ? len + 1.2 : len;
        for (const h of ray.intersectObjects(d.visual, false)) {
          if (!shown(h.object, d.root)) continue;
          if (h.object === d.rig.parts.head && !opaqueAt(h.object, h.uv)) continue;
          st.vis = { d, point: h.point.clone() };
          break;
        }
      }
      for (const m of d.proxies) {
        const r = proxyShape(m, _a, _b);
        const gap = segSeg(from, _end, _a, _b, _q1, _q2) - r;
        const cur = st.best.get(d);
        if (!cur || gap < cur.gap) {
          const surf = _q2.clone().add(_q1.clone().sub(_q2).setLength(r));
          st.best.set(d, { gap, part: m.userData.hitPart, rayPt: _q1.clone(), surf });
        }
      }
    }
    if (hitObj?.userData.labDummy) {
      st.hit = { d: hitObj.userData.labDummy, part: hitObj.userData.hitPart, point: _end.clone() };
    }
  }

  function mark(d, kind, at, to = null) {
    const g = new THREE.Group();
    const dot = new THREE.Mesh(markGeo, markMats[kind]);
    dot.renderOrder = 1000;
    g.add(dot);
    d.root.worldToLocal(dot.position.copy(at));
    if (to) {
      const geo = new THREE.BufferGeometry().setFromPoints([d.root.worldToLocal(at.clone()), d.root.worldToLocal(to.clone())]);
      const ln = new THREE.Line(geo, lineMats[kind]);
      ln.renderOrder = 1000;
      g.add(ln);
    }
    d.marks.add(g);
    allMarks.push(g);
    while (allMarks.length > MAX_MARKS) { const old = allMarks.shift(); old.parent?.remove(old); }
  }

  // A negative gap is a round inside the ideal shape that still missed: the
  // proxies are low-poly (the head is an 8x6 sphere), so their flat faces
  // sit inside the round shape they stand for.
  const cm = (m) => (m < 0 ? `0 cm (slipped past a flat facet, ${(-m * 100).toFixed(1)} cm inside the round shape)` : `${(m * 100).toFixed(1)} cm`);
  function finish(st) {
    if (!st.near) return;
    stats.shots++;
    if (st.hit) {
      const touched = st.vis && st.vis.d === st.hit.d;
      if (touched) {
        stats.hit++; stats.hitPart[st.hit.part]++;
        mark(st.hit.d, st.hit.part === "head" ? "head" : "hit", st.hit.point);
        last = `HIT · ${st.hit.part} · ${st.hit.d.dist} m`;
      } else {
        stats.generous++; stats.genPart[st.hit.part]++;
        mark(st.hit.d, "generous", st.hit.point);
        last = `COUNTED, didn't touch the body · ${st.hit.part} · ${st.hit.d.dist} m`;
      }
    } else if (st.vis) {
      const best = st.best.get(st.vis.d);
      const gap = best?.gap ?? 0;
      stats.ghost++; stats.ghostCm.push(Math.max(0, gap));
      if (best) stats.ghostPart[best.part]++;
      mark(st.vis.d, "ghost", st.vis.point, best?.surf);
      last = `GHOST · looked like a hit, didn't count · nearest ${best?.part ?? "?"} hitbox missed by ${cm(gap)} · ${st.vis.d.dist} m`;
    } else {
      let bestD = null, best = null;
      for (const [d, v] of st.best) if (!best || v.gap < best.gap) { best = v; bestD = d; }
      if (best && best.gap * 100 <= NEAR_CM) {
        stats.near++;
        mark(bestD, "near", best.rayPt, best.surf);
        last = `near miss · ${best.part} hitbox by ${cm(best.gap)} · ${bestD.dist} m`;
      } else last = "miss";
    }
    renderStats();
  }

  /* -- panel -- */
  const panel = document.createElement("div");
  panel.className = "to-hblab";
  panel.innerHTML = `
    <style>
      .to-hblab{position:fixed;top:84px;right:12px;z-index:99999;width:290px;max-height:calc(100vh - 200px);overflow:auto;background:rgba(10,10,12,.9);color:#f3ece4;font:12px/1.45 "DM Mono",monospace;padding:10px 12px;border-radius:10px;border:0.5px solid rgba(255,255,255,.2);box-sizing:border-box}
      .to-hblab h3{margin:0 0 6px;font:600 13px "DM Mono",monospace;display:flex;justify-content:space-between;align-items:center}
      .to-hblab button{font:inherit;color:inherit;background:rgba(255,255,255,.08);border:0.5px solid rgba(255,255,255,.25);border-radius:6px;padding:3px 7px;cursor:pointer}
      .to-hblab button[aria-pressed=true]{background:#ff8a1f;color:#130800;border-color:#ff8a1f}
      .to-hblab .row{display:grid;grid-template-columns:48px 1fr 44px;gap:6px;align-items:center;margin:3px 0}
      .to-hblab .btns{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 8px}
      .to-hblab .k{display:flex;gap:6px;align-items:center}
      .to-hblab .k i{width:9px;height:9px;border-radius:50%;flex:none}
      .to-hblab .last{margin:6px 0;padding:6px;border-radius:6px;background:rgba(255,255,255,.06);min-height:2.9em}
      .to-hblab .sec{margin-top:8px;padding-top:6px;border-top:0.5px solid rgba(255,255,255,.15)}
      .to-hblab.is-min > :not(h3){display:none}
    </style>
    <h3>Hitbox lab <button type="button" data-min aria-label="Minimise the hitbox lab">–</button></h3>
    <div class="last" data-last></div>
    <div data-stats></div>
    <div class="sec">Trolls
      <div class="btns" data-motion>
        <button type="button" data-m="stand">Stand</button><button type="button" data-m="crouch">Crouch</button>
        <button type="button" data-m="strafe">Strafe</button><button type="button" data-m="side">Side-on</button>
      </div>
      <div class="btns"><button type="button" data-place>Row in front of me</button><button type="button" data-clear>Clear marks</button><button type="button" data-reset-stats>Reset stats</button></div>
    </div>
    <div class="sec">Hitbox size
      ${["head", "body", "limbs"].map((k) => `<label class="row">${k[0].toUpperCase() + k.slice(1)}<input type="range" min="0.5" max="3" step="0.05" data-k="${k}" value="${tune[k]}"><output data-o="${k}">${tune[k]}x</output></label>`).join("")}
      <label class="k" style="margin:4px 0"><input type="checkbox" data-k="show" ${tune.show ? "checked" : ""}>Show hit area (light red)</label>
      <button type="button" data-reset>Reset to 1x</button>
    </div>
    <div class="sec">
      <div class="k"><i style="background:#35e06a"></i>hit (counted, on the body)</div>
      <div class="k"><i style="background:#ff5a3c"></i>headshot</div>
      <div class="k"><i style="background:#ff2bd6"></i>GHOST: on the body, didn't count (line = gap to hitbox)</div>
      <div class="k"><i style="background:#2bd8ff"></i>counted but off the body</div>
      <div class="k"><i style="background:#ffd23a"></i>near miss (line = gap to hitbox)</div>
      <div style="opacity:.6;margin-top:6px">Esc frees the mouse to use this panel.</div>
    </div>`;
  document.body.append(panel);
  const $ = (s) => panel.querySelector(s);

  function renderStats() {
    $("[data-last]").textContent = last;
    const on = stats.hit + stats.ghost;   // shots that visibly landed
    const avg = stats.ghostCm.length ? stats.ghostCm.reduce((a, b) => a + b, 0) / stats.ghostCm.length : 0;
    const worst = stats.ghostCm.length ? Math.max(...stats.ghostCm) : 0;
    const split = (p) => `<span style="opacity:.7">(head ${p.head} · body ${p.body} · limbs ${p.limbs})</span>`;
    $("[data-stats]").innerHTML = `
      <div>Shots at the trolls: <b>${stats.shots}</b></div>
      <div>Hits on the body: <b>${stats.hit}</b> ${split(stats.hitPart)}</div>
      <div style="color:#ff7be6">Ghosts (on the body, no hit): <b>${stats.ghost}</b>${on ? ` · ${Math.round((stats.ghost / on) * 100)}% of shots that landed` : ""}</div>
      ${stats.ghost ? `<div style="opacity:.8;padding-left:10px">missed by avg ${cm(avg)} · worst ${cm(worst)}<br>nearest hitbox: ${split(stats.ghostPart)}</div>` : ""}
      <div style="color:#7fe6ff">Counted off the body: <b>${stats.generous}</b> ${split(stats.genPart)}</div>
      <div style="color:#ffe27a">Near misses (&lt;${NEAR_CM} cm): <b>${stats.near}</b></div>`;
  }
  function renderPanel() {
    for (const b of panel.querySelectorAll("[data-m]")) b.setAttribute("aria-pressed", String(b.dataset.m === tune.motion));
    renderStats();
  }

  panel.addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    tune[k] = e.target.type === "checkbox" ? e.target.checked : Number(e.target.value);
    const o = panel.querySelector(`[data-o="${k}"]`);
    if (o) o.textContent = `${tune[k]}x`;
    save(); applyTune();
  });
  panel.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.m) { tune.motion = t.dataset.m; save(); renderPanel(); }
    else if (t.hasAttribute("data-place")) place();
    else if (t.hasAttribute("data-clear")) { for (const g of allMarks) g.parent?.remove(g); allMarks.length = 0; }
    else if (t.hasAttribute("data-reset-stats")) {
      Object.assign(stats, freshStats());
      last = "Stats reset."; renderStats();
    } else if (t.hasAttribute("data-reset")) {
      Object.assign(tune, { head: 1, body: 1, limbs: 1 });
      for (const k of ["head", "body", "limbs"]) { $(`[data-k="${k}"]`).value = 1; $(`[data-o="${k}"]`).textContent = "1x"; }
      save(); applyTune();
    } else if (t.hasAttribute("data-min")) {
      panel.classList.toggle("is-min");
      t.textContent = panel.classList.contains("is-min") ? "+" : "–";
    }
  });
  renderPanel();

  // Straight into the range.
  if (ctx.state() !== "playing") { ctx.setMode("range"); ctx.startGame(); }

  let tuneT = 0;
  return {
    onTrace,
    resolve: (o) => o?.userData?.labDummy || null,
    hitMeshes: () => (ctx.isRange() ? dummies.flatMap((d) => d.proxies) : []),
    update(dt) {
      // Left the range: take the row down, and lay a fresh one next time in.
      // A pause (Esc to use this panel) keeps everything where it is.
      const range = ctx.isRange();
      for (const d of dummies) d.root.visible = range;
      if (!range) { placed = false; placeDelay = 0.4; return; }
      if (ctx.state() !== "playing") return;
      if (!placed) {
        placeDelay -= dt;
        if (placeDelay > 0) return;
        placed = true;
        place({ bestDirection: true });
      }
      for (const d of dummies) poseDummy(d, dt);
      // bots and respawns get fresh proxies: keep them tuned
      if ((tuneT += dt) > 0.4) { tuneT = 0; applyTune(); }
    },
    debug: () => dummies,
    /* One sight line against one troll, for the coverage sweep: does it
       touch the visible troll, which hitbox part (if any) it hits, and for
       each part the size factor that part would need to catch it (capsules
       grow in thickness only, spheres whole, as the sliders do). */
    probe(d, origin, dir) {
      d.root.updateWorldMatrix(true, true);
      ray.set(origin, dir); ray.near = 0; ray.far = 200;
      let vis = false;
      let where = null;
      for (const h of ray.intersectObjects(d.visual, false)) {
        if (!shown(h.object, d.root)) continue;
        if (h.object === d.rig.parts.head && !opaqueAt(h.object, h.uv)) continue;
        vis = true; where = whereOn(d, h); break;
      }
      const hit = ray.intersectObjects(d.proxies, false)[0];
      _end.copy(origin).addScaledVector(dir, 200);
      const need = { head: Infinity, body: Infinity, limbs: Infinity };
      for (const m of d.proxies) {
        const part = m.userData.hitPart, f = tune[part];
        const r = proxyShape(m, _a, _b);
        const dist = segSeg(origin, _end, _a, _b, _q1, _q2);
        need[part] = Math.min(need[part], dist / (r / f));   // factor vs the 1x radius
      }
      return { vis, where, hit: hit ? hit.object.userData.hitPart : null, need };
    },
    setTune(t) { Object.assign(tune, t); applyTune(); },
    state: () => ({ tune: { ...tune }, stats: { ...stats }, last, dummies: dummies.map((d) => ({ dist: d.dist, x: d.root.position.x, y: d.root.position.y, z: d.root.position.z })) }),
  };
}
