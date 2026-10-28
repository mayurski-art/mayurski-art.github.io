// News card art for the home page (HANDOFF.md, "Story art"), rendered
// from the game itself (user, 2026-10-28: "develop high quality rendered
// based images based on context and also in game appearances"): the real
// map through the game's own renderer and post chain (as
// troll-ops-lobby-reel.mjs), with the story's cast built from the game's
// own modules (the same instances the match uses, so TROLLS bodies get
// their edge ink) and posed for the story. Each story writes
//   assets/images/news/<id>.webp        the scene, SIZE x SIZE
//   assets/images/news/<id>-hero.webp   the hero alone, cut from the same
//                                       frame by a mask, transparent round it
// The card lays the hero over its curve, so the hero breaks out of the art.
//
// A private room code and no bots, Supabase blocked: never a public room.
//
//   node tools/news-art.mjs [storyId ...]
//   TRY=1   every CAMS candidate small, to .claude/news-try/, nothing written
//   (playwright from this checkout, else the main checkout's node_modules)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium;
for (const base of [ROOT, path.resolve(ROOT, "../../.."), process.cwd()]) {
  try { ({ chromium } = createRequire(path.join(base, "node_modules", "x.js"))("playwright")); break; } catch {}
}
if (!chromium) throw new Error("playwright not found");

const TRY = !!process.env.TRY;
const SIZE = TRY ? 520 : +(process.env.SIZE || 1600);
const OUT = path.join(ROOT, "assets/images/news");
const TRYDIR = path.join(ROOT, ".claude/news-try");
for (const d of [OUT, TRYDIR]) fs.mkdirSync(d, { recursive: true });

/* A story: the map, where the camera stands ([x, y, z, look x, y, z, fov],
   CAMS: candidates for TRY, the first is the one rendered), and the cast.
   A cast member: at [x, z] (the ground found under it), facing a point
   [x, z] or `yaw`, a TROLLS `token` body (0: the stick operator), a `pose`
     port     standing at port arms, the gun across the chest
     aim      shouldered, aimed where it faces
     walk     mid-stride, gun at port
     emote    an emote frame: `emote` id, `t` seconds in
   `gun` a weapon id, `skin` a finish (goldgrin ...), `hero` the one cut out.
   `props` extra things built in the page (stickers). */
const STORIES = {
  // trollrunner.net v1.0 is cooking: the Troll Runner's own TROLLS #1718
  // (the RUNNER tank) leading a squad down Culdegrin's street at sunset,
  // the lobby's own first look, toward the camera.
  "v1-forces": {
    map: "culdegrin",
    // (the left lane: the sign frame on the centre line stays out of frame)
    cams: [[-2.6, 0.7, -14.4, -3.6, 1.6, -9, 36], [-4.4, 0.75, -14.6, -3.4, 1.55, -9, 36], [-5.6, 0.85, -14.2, -3.6, 1.6, -9, 38]],
    cast: [
      { at: [-3.4, -10.6], face: [-4.6, -15], token: 1718, pose: "walk", phase: 0.6, gun: "problem416", hero: true },
      { at: [-5.0, -7.2], face: [-4.8, -15], token: 1272, pose: "port", gun: "greencandle" },
      { at: [-1.9, -6.6], face: [-4.2, -15], token: 989, pose: "walk", phase: 2.1, gun: "kek" },
    ],
  },
  // The weekly ladder, "climb it, screenshot it, rub it in": the Grinsite's
  // yard, the week's winner (TROLLS #820) on top of a shipping container
  // (the single at 26,-9, roof 2.6 m), Gold Grin rifle, pointing and
  // laughing down at the two below: one in the Sad trollface, one with the
  // L on their forehead (turned to the camera, so both read). Shot from
  // the ground on a long lens, looking up.
  "ladder-champion": {
    map: "grinsite",
    // the two below big in front, the winner crowned on the roof with the
    // gold rifle at port arms (the laugh read as a wave from down here);
    // from further back than z -1 the camera is inside the next container
    cams: [[25.2, 1.2, -0.9, 25.7, 2.2, -7.8, 46], [24.4, 1.25, -1, 25.6, 2.25, -7.8, 46], [24, 1.1, -1, 25.6, 2.3, -7.8, 48]],
    cast: [
      { at: [25.8, -8.0], face: [24.4, -1.0], token: 1262, pose: "port", gun: "problem416", skin: "goldgrin", hero: true },
      { at: [24.6, -4.6], face: [24.2, -1.0], token: 2631, pose: "emote", emote: "sad", t: 1.2 },
      { at: [26.7, -4.4], face: [24.8, -1.0], token: 820, pose: "emote", emote: "loser", t: 1.0 },
    ],
  },
  // Print, cut, slap: the panel on Culdegrin's centre line (its face at
  // x 0.035, z -2.25..2.25, y 0.2..3.5) already bombed with stickers, the
  // Troll Runner (TROLLS #1718) facing down the street, three-quarters to the
  // camera, right arm straight out to slap a fresh one on it. `reach: { x }`: the cast member slides along x until
  // the raised hand is on that plane, and the fresh sticker goes under it.
  "stickers-slap": {
    map: "culdegrin",
    cams: [[2.3, 1.3, 3.5, 0.45, 1.65, 0.5, 46], [2.9, 1.15, 2.9, 0.3, 1.75, 0.3, 46], [1.6, 1.4, 3.7, 0.5, 1.7, 0.4, 48]],
    cast: [
      { at: [0.8, 0.6], face: [0.8, 12], token: 1718, pose: "slap", hero: true, reach: { x: 0.035 } },
    ],
    props: { panel: { x: 0.035, z: [-2.1, 2.1], y: [0.45, 3.3], count: 16 } },
  },
};

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml",
  ".gif": "image/gif", ".mp4": "video/mp4", ".webm": "video/webm" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

async function openMap(id) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`${id}: ${e.message}`));
  page.on("console", (m) => { if (m.text().startsWith("NEWS")) console.log(m.text()); });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
  await page.evaluate(async (map) => {
    const T = window.__trollOps;
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.els.room.value = "PV" + Math.random().toString(36).slice(2, 5).toUpperCase();   // private, never public
    T.els.room.dispatchEvent(new Event("input"));
    T.loadout.mapId = map;
    await T.startGame();
    if (T.isStaging()) T.endStaging();
  }, id);
  await page.waitForFunction(() => !!window.__trollOps.builtMap()?.map && !window.__trollOps.loadState().open, null, { timeout: 240000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, +(process.env.WAIT || 8000)));
  // a clean picture: no first-person gun, no hurt effects, the player's own body hidden
  await page.evaluate(() => {
    const T = window.__trollOps;
    for (const p of T.composer.passes) {
      for (const k of ["uHitFlash", "uLowHp", "uAberration", "uSuppress"]) if (p.uniforms?.[k]) p.uniforms[k].value = 0;
      if (p.constructor.name === "ViewmodelPass") p.enabled = false;
    }
    if (T.localRig?.root) T.localRig.root.visible = false;
  });
  return page;
}

/* Build the cast and props in the live scene (the game's own modules). */
async function stage(page, story) {
  return page.evaluate(async (story) => {
    const T = window.__trollOps, THREE = T.THREE, scene = T.scene;
    const urlOf = (part) => performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes(part));
    const need = async (part) => { const u = urlOf(part); if (!u) throw new Error("not loaded: " + part); return import(u); };
    const C = await need("/characters/character.js");
    const E = await need("/characters/emotes.js");
    const B = await need("/characters/blocky-body.js");
    const WM = await need("/weapons/weapon-model.js");
    const W = await need("/weapons/weapons.js");

    // last take's cast out first, so the ground below isn't one of them
    window.__newsCast?.forEach((o) => o.parent?.remove(o));
    window.__newsCast = [];
    // the ground under a point: the first thing a ray down from head height hits
    const ray = new THREE.Raycaster();
    const solids = [];
    scene.traverse((o) => { if (o.isMesh && o.visible && !o.isSkinnedMesh) solids.push(o); });
    const groundAt = (x, z) => {
      ray.set(new THREE.Vector3(x, 6, z), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObjects(solids, false).find((h) => h.face && h.face.normal.y > 0.5);
      return hit ? hit.point.y : 0;
    };
    const heroMeshes = [];
    const black = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.1 });
    const LOW_READY = 1.2, PORT_YAW = 1.15, PORT_ROLL = 0.5;
    for (const m of story.cast) {
      const h = C.buildHumanoid(black, { height: 1.8, gun: false });
      if (m.token) await B.wearBlocky(h, m.token);
      let held = null;
      if (m.gun && W.WEAPON_DEFS[m.gun]) {
        held = WM.buildWeaponMesh(W.WEAPON_DEFS[m.gun], { skin: m.skin ?? null });
        C.mountHeldWeapon(h, held);
      }
      const [x, z] = m.at;
      const yaw = m.yaw ?? Math.atan2(-(m.face[0] - x), -(m.face[1] - z));
      h.root.position.set(x, groundAt(x, z), z);
      C.aimRig(h, yaw, 0, { snap: true });
      h.noIdleGlance = true;
      const emoteIdx = m.emote ? E.EMOTES.findIndex((e) => e.id === m.emote) : -1;
      for (let i = 0; i < 6; i++) {
        C.aimRig(h, yaw, 0.016);
        if (m.pose === "slap") {
          // standing easy, one arm straight out sideways at shoulder height
          // toward the reach plane: whichever arm and sign (the rig's axes
          // aren't obvious) lifts that hand highest on the plane's side
          C.poseHumanoid(h, { moving: false, pitch: 0, dt: 0.016, hold: "none" });
          if (!m._slap) {
            let best = null;
            const toward = Math.sign(m.reach.x - h.root.position.x);
            for (const arm of ["R", "L"]) for (const zs of [1, -1]) for (const xs of [1, -1]) {
              C.poseHumanoid(h, { moving: false, pitch: 0, dt: 0.016, hold: "none" });
              h.parts["arm" + arm].rotation.set(0.2 * xs, 0, 1.9 * zs);
              h.root.updateMatrixWorld(true);
              const hp = h.parts["hand" + arm].getWorldPosition(new THREE.Vector3());
              const score = hp.y + (Math.sign(hp.x - h.root.position.x) === toward ? 1 : -5) - Math.abs(hp.z - h.root.position.z) * 0.5;
              if (!best || score > best.score) best = { score, arm, zs, xs, hp };
            }
            m._slap = best;
            console.log(`NEWS slap arm${best.arm} z${best.zs} x${best.xs} hand y ${best.hp.y.toFixed(2)}`);
            C.poseHumanoid(h, { moving: false, pitch: 0, dt: 0.016, hold: "none" });
          }
          const s = m._slap;
          h.parts["arm" + s.arm].rotation.set(0.2 * s.xs, 0, 1.9 * s.zs);
          h.parts["elbow" + s.arm].rotation.set(0.25, 0, 0);
        } else if (emoteIdx >= 0) {
          if (held) held.visible = false;
          E.poseEmoteCode(h, E.emoteCode(emoteIdx), m.t ?? 0.5);
        } else {
          const port = m.pose !== "aim";
          C.poseHumanoid(h, {
            moving: m.pose === "walk", phase: m.phase ?? 0, forward: m.pose === "walk" ? 1 : 0, strafe: 0, lower: 0,
            speed: m.pose === "walk" ? 0.5 : 0, mps: m.pose === "walk" ? 1.6 : 0, dt: 0.016,
            pitch: port ? LOW_READY : 0, hold: held ? "gun" : "none", hasGun: !!held,
            ...(port && held ? { carryYaw: PORT_YAW, carryRoll: PORT_ROLL } : {}),
          });
          if (port) { h.parts.neckPivot.rotation.x -= LOW_READY * 0.25; h.parts.headPivot.rotation.x -= LOW_READY * 0.6; }
        }
        h.body?.update?.();
      }
      if (m.reach) {
        // the raised hand (the highest of the parts named hand) onto the post's skin
        h.root.updateMatrixWorld(true);
        const hands = Object.entries(h.parts).filter(([k, o]) => /hand/i.test(k) && o?.getWorldPosition)
          .map(([k, o]) => [k, o.getWorldPosition(new THREE.Vector3())]).sort((a, b) => b[1].y - a[1].y);
        console.log("NEWS hands", hands.map(([k, p]) => `${k} ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`).join(" | "));
        if (hands.length) {
          // the palm sits ~6 cm past the hand joint: stop it on the plane
          const hand = hands[0][1], side = Math.sign(hand.x - m.reach.x) || 1;
          h.root.position.x += m.reach.x + side * 0.06 - hand.x;
          window.__newsHand = { y: hand.y, z: hand.z, side };
        }
      }
      h.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(h.root);
      window.__newsCast.push(h.root);
      if (m.hero) h.root.traverse((o) => { if (o.isMesh || o.isLine || o.isPoints) heroMeshes.push(o); });
    }

    // stickers on a post: the trollface die-cut, a white border, a little gloss
    if (story.props?.panel) {
      const img = new Image();
      img.src = "/assets/images/wallpaper/trollface%20transparent.png";
      await img.decode();
      const sticker = (tilt) => {
        const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
        const g = c.getContext("2d");
        g.fillStyle = "#fff"; g.beginPath(); g.ellipse(s / 2, s / 2, s * 0.48, s * 0.44, 0, 0, Math.PI * 2); g.fill();
        g.drawImage(img, s * 0.1, s * 0.1, s * 0.8, s * 0.8);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
        // vinyl on glass, sun behind it: a little of its own light so the
        // white reads as paper, not as a grey coin
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.35, alphaTest: 0.1,
          emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.55, side: THREE.DoubleSide }));
        mesh.rotation.z = tilt;
        return mesh;
      };
      // older ones scattered over the panel (seeded, none overlapping much),
      // the fresh one under the hand
      const P = story.props.panel, hand = window.__newsHand, side = hand?.side || 1;
      let seed = 1028;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      const spots = [];
      for (let n = 0; spots.length < P.count && n < 400; n++) {
        const z = P.z[0] + rnd() * (P.z[1] - P.z[0]), y = P.y[0] + rnd() * (P.y[1] - P.y[0]), size = 0.26 + rnd() * 0.2;
        if (hand && Math.hypot(z - hand.z, y - hand.y) < 0.42) continue;
        if (spots.some((s) => Math.hypot(s.z - z, s.y - y) < (s.size + size) * 0.42)) continue;
        spots.push({ z, y, size, tilt: (rnd() - 0.5) * 0.9, worn: rnd() });
      }
      if (hand) spots.push({ z: hand.z, y: hand.y - 0.04, size: 0.36, tilt: -0.15, worn: 1, fresh: true });
      for (const s of spots) {
        const m = sticker(0);
        m.scale.setScalar(s.size / 0.2);
        m.position.set(P.x + side * (0.003 + spots.indexOf(s) * 0.0004), s.y, s.z);
        m.rotation.set(0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
        m.rotateZ(s.tilt);
        // older ones sun-faded a touch
        if (!s.fresh) m.material.color.setScalar(0.78 + s.worn * 0.2);
        scene.add(m);
        window.__newsCast.push(m);
      }
      console.log(`NEWS stickers ${spots.length}`);
    }
    window.__newsHero = heroMeshes;
    return { parts: Object.keys(story.cast.length ? {} : {}), heroMeshes: heroMeshes.length };
  }, story);
}

/* One frame through the game's composer, then the hero's mask from the
   same camera; returns { scene, hero } data URLs (hero null in TRY). */
async function render(page, cam, size, withHero) {
  return page.evaluate(async ({ v, size, withHero }) => {
    const T = window.__trollOps, R = T.renderer, Cm = T.composer, cam = T.camera, THREE = T.THREE, scene = T.scene;
    for (const rt of [Cm.renderTarget1, Cm.renderTarget2]) if (rt.samples !== 4) { rt.samples = 4; rt.dispose(); }
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    await frame(); await frame();
    const place = () => {
      cam.fov = v[6]; cam.aspect = 1; cam.near = 0.05; cam.far = 2000;
      cam.position.set(v[0], v[1], v[2]); cam.lookAt(v[3], v[4], v[5]);
      cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
      R.setPixelRatio(1); R.setSize(size, size, false);
      Cm.setPixelRatio?.(1); Cm.setSize(size, size);
    };
    const sceneUrl = await new Promise((done) => requestAnimationFrame(() => {
      place();
      for (const p of Cm.passes) for (const k of ["uHitFlash", "uLowHp", "uAberration", "uSuppress"]) if (p.uniforms?.[k]) p.uniforms[k].value = 0;
      T.townNpcs?.()?.update(0, cam.position);
      Cm.render(0.016);
      done(R.domElement.toDataURL("image/png"));
    }));
    if (!withHero) return { scene: sceneUrl, hero: null };
    // the mask: the hero white, everything else (in front of it too) black
    const hero = new Set(window.__newsHero);
    const saved = [];
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff }), blackM = new THREE.MeshBasicMaterial({ color: 0x000000 });
    scene.traverse((o) => { if (o.isMesh || o.isLine || o.isPoints || o.isSprite) { saved.push([o, o.material, o.visible]); o.material = hero.has(o) ? white : blackM; } });
    const bg = scene.background, fog = scene.fog, tm = R.toneMapping;
    scene.background = new THREE.Color(0); scene.fog = null; R.toneMapping = THREE.NoToneMapping;
    const maskUrl = await new Promise((done) => requestAnimationFrame(() => {
      place();
      R.setRenderTarget(null);
      R.render(scene, cam);
      done(R.domElement.toDataURL("image/png"));
    }));
    for (const [o, m, vis] of saved) { o.material = m; o.visible = vis; }
    scene.background = bg; scene.fog = fog; R.toneMapping = tm;
    // cut: the scene's pixels where the mask is white, grown 1px for the ink line
    const load = async (u) => { const i = new Image(); i.src = u; await i.decode(); return i; };
    const [si, mi] = await Promise.all([load(sceneUrl), load(maskUrl)]);
    const c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d");
    g.drawImage(mi, 0, 0);
    const md = g.getImageData(0, 0, size, size).data;
    const a = new Uint8ClampedArray(size * size);
    for (let i = 0; i < a.length; i++) a[i] = md[i * 4];
    const grown = new Uint8ClampedArray(a.length);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let m = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < size && xx >= 0 && xx < size) m = Math.max(m, a[yy * size + xx]);
      }
      grown[y * size + x] = m;
    }
    g.clearRect(0, 0, size, size);
    g.drawImage(si, 0, 0);
    const im = g.getImageData(0, 0, size, size);
    for (let i = 0; i < grown.length; i++) im.data[i * 4 + 3] = grown[i];
    g.putImageData(im, 0, 0);
    let x0 = size, y0 = size, x1 = 0, y1 = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (grown[y * size + x] > 30) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    console.log(`NEWS hero box ${x0},${y0} - ${x1},${y1} of ${size}`);
    // the scene and the cut out, both webp
    const sc = document.createElement("canvas"); sc.width = sc.height = size;
    sc.getContext("2d").drawImage(si, 0, 0);
    return { scene: sc.toDataURL("image/webp", 0.86), hero: c.toDataURL("image/webp", 0.9) };
  }, { v: cam, size, withHero });
}

const save = (file, data) => fs.writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));

// FIND=<map>: the map's colliders that could stage a story, posts (thin and
// tall) and containers (box, 2-3.2 m high, 5+ m long), then stop
if (process.env.FIND) {
  const page = await openMap(process.env.FIND);
  if (process.env.FIND_BOX) await page.evaluate((b) => { window.__findBox = b; }, process.env.FIND_BOX.split(",").map(Number));
  console.log(await page.evaluate(() => {
    const T = window.__trollOps, out = { posts: [], boxes: [] };
    const list = T.colliders || [];
    for (const c of list) {
      const b = c.box || c, mn = b.min, mx = b.max;
      if (!mn || !mx) continue;
      const w = mx.x - mn.x, d = mx.z - mn.z, h = mx.y - mn.y;
      const at = `${((mn.x + mx.x) / 2).toFixed(1)},${((mn.z + mx.z) / 2).toFixed(1)} y${mn.y.toFixed(1)}-${mx.y.toFixed(1)} ${w.toFixed(1)}x${d.toFixed(1)}`;
      if (w < 0.6 && d < 0.6 && h > 2.5) out.posts.push(at);
      else if (h > 2 && h < 3.4 && Math.max(w, d) > 5 && Math.min(w, d) > 1.8 && Math.min(w, d) < 3.2) out.boxes.push(at);
    }
    // FIND_BOX=x0,z0,x1,z1: every mesh over 2 m tall standing in that area
    const meshes = [];
    if (window.__findBox) {
      const [x0, z0, x1, z1] = window.__findBox;
      T.scene.traverse((o) => {
        if (!o.isMesh || !o.visible) return;
        const b = new T.THREE.Box3().setFromObject(o);
        const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
        if (cx < x0 || cx > x1 || cz < z0 || cz > z1 || b.max.y - b.min.y < 2 || b.max.y > 20) return;
        meshes.push(`${o.name || o.material?.name || "?"} ${cx.toFixed(2)},${cz.toFixed(2)} y${b.min.y.toFixed(2)}-${b.max.y.toFixed(2)} ${(b.max.x - b.min.x).toFixed(2)}x${(b.max.z - b.min.z).toFixed(2)}`);
      });
    }
    return `colliders ${list.length}\nposts:\n ${out.posts.join("\n ")}\ncontainers:\n ${out.boxes.join("\n ")}\nmeshes:\n ${meshes.join("\n ")}`;
  }));
  await browser.close(); server.close(); process.exit(0);
}
const ids = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const todo = ids.length ? ids : Object.keys(STORIES);
// one page per map, every story on it rendered in turn
const byMap = {};
for (const id of todo) (byMap[STORIES[id].map] ||= []).push(id);
for (const [map, list] of Object.entries(byMap)) {
  const t0 = Date.now();
  const page = await openMap(map);
  console.log(`${map}: open in ${Math.round((Date.now() - t0) / 1000)} s`);
  for (const id of list) {
    const story = STORIES[id];
    const cams = TRY ? story.cams : [story.cams[0]];
    for (const [i, cam] of cams.entries()) {
      await stage(page, { ...story, cam });
      const r = await render(page, cam, SIZE, !TRY);
      if (TRY) { save(path.join(TRYDIR, `${id}-${i}.png`), r.scene); console.log(`${id}-${i}`); continue; }
      save(path.join(OUT, `${id}.webp`), r.scene);
      save(path.join(OUT, `${id}-hero.webp`), r.hero);
      console.log(`wrote ${id}.webp, ${id}-hero.webp`);
    }
  }
  await page.close();
}
await browser.close();
server.close();
