// Troll Warfare weapon camos (docs/DESIGN-SKINS.md §3): a camo paints only
// what a real paint job would cover, on top of a kit gun's baked maps.
//
// The kit's fourth map, <id>-msk.webp (models/bake_kit.py), says where:
//   R paint zone (1 cerakote, 0.5 polymer, 0 bare metal, rubber, brass)
//   G wear (the same chips the base colour already wears to metal)
//   B shade (the AO x grain the base colour is multiplied by)
// The pattern comes from a seamless tile (skins/tiles/<tile>.png: R tone
// 0..3, G detail), coloured here by the camo's palette and projected
// triplanar in gun space, so it never shows the atlas's seams and the parts
// agree where they meet. Chips keep the baked metal, the normal map stays,
// and paint gets its own roughness and metalness.

import * as THREE from "three";

const TILE_URL = (tile) => new URL(`../skins/tiles/${tile}.png?v=ct1`, import.meta.url).href;

/* One coloured tile per camo, shared by every gun wearing it: rgb is the
   palette colour of the tile's tone (sRGB), alpha the detail channel. */
const tiles = new Map();
function camoTile(camo) {
  let t = tiles.get(camo.id);
  if (t) return t;
  // 1x1 until the tile is in (Grinwrap's is 1024², the rest 512²)
  t = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.userData.shared = true;
  tiles.set(camo.id, t);
  const pal = camo.palette.map((h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255]);
  const img = new Image();
  img.onload = () => {
    const N = img.naturalWidth;
    const data = new Uint8Array(N * N * 4);
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, N, N);
    const src = g.getImageData(0, 0, N, N).data;
    for (let i = 0; i < N * N; i++) {
      const p = pal[Math.min(3, Math.round(src[i * 4] / 85))];
      data[i * 4] = p[0]; data[i * 4 + 1] = p[1]; data[i * 4 + 2] = p[2];
      data[i * 4 + 3] = src[i * 4 + 1];
    }
    t.image = { data, width: N, height: N };
    t.needsUpdate = true;
    t.userData.ready = true;
  };
  img.src = TILE_URL(camo.tile);
  return t;
}

/* The gun-space rest position and normal of every vertex, as attributes
   (camoPos, camoNrm), so a moving part (the mag, the carrier) carries its
   paint with it and still matches its neighbours at rest. Computed once per
   geometry: the templates share theirs between builds. `root` is the gun as
   built, before anything moves. */
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _n = new THREE.Matrix3();
const _v = new THREE.Vector3();
export function camoAttributes(root) {
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    if (g.attributes.camoPos) return;
    _m.multiplyMatrices(_inv, o.matrixWorld);
    _n.getNormalMatrix(_m);
    const P = g.attributes.position, N = g.attributes.normal;
    const pos = new Float32Array(P.count * 3), nrm = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(_m);
      pos[i * 3] = _v.x; pos[i * 3 + 1] = _v.y; pos[i * 3 + 2] = _v.z;
      if (N) _v.fromBufferAttribute(N, i).applyMatrix3(_n).normalize();
      else _v.set(0, 1, 0);
      nrm[i * 3] = _v.x; nrm[i * 3 + 1] = _v.y; nrm[i * 3 + 2] = _v.z;
    }
    g.setAttribute("camoPos", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("camoNrm", new THREE.BufferAttribute(nrm, 3));
  });
}

const FX_TIME = { value: 0 };
const fxTick = () => { FX_TIME.value = performance.now() / 1000; };

/* The kit material with the camo painted on: a clone of `kit` (same baked
   maps) plus the mask and the tile. Cached by `key` and shared. With no
   mask and no key (an older gun's flat material) it is that build's own. */
const mats = new Map();
export function camoMaterial(kit, mask, camo, key) {
  let m = key && mats.get(key);
  if (m) return m;
  m = kit.clone();
  m.name = kit.name;
  const U = {
    uCamoMask: { value: mask },
    uCamoTile: { value: camoTile(camo) },
    uCamoScale: { value: 1 / (camo.scale ?? 0.22) },     // tiles a metre (one tile ~22 cm: 4 repeats down a rifle)
    uCamoValue: { value: camo.value ?? 0.72 },            // paint is darker than its swatch: a lit gun, not a flag
    uCamoWear: { value: camo.wear ?? 1 },
    uCamoRough: { value: camo.rough ?? 0.6 },
    uCamoMetal: { value: camo.metal ?? 0 },
    uCamoSheen: { value: camo.sheen ? new THREE.Color(camo.sheen) : new THREE.Color(0) },
    uFxTime: FX_TIME,
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
      attribute vec3 camoPos;
      attribute vec3 camoNrm;
      varying vec3 vCamoPos;
      varying vec3 vCamoNrm;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
      vCamoPos = camoPos;
      vCamoNrm = camoNrm;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
      uniform sampler2D uCamoMask;
      uniform sampler2D uCamoTile;
      uniform float uCamoScale, uCamoValue, uCamoWear, uCamoRough, uCamoMetal, uFxTime;
      uniform vec3 uCamoSheen;
      varying vec3 vCamoPos;
      varying vec3 vCamoNrm;
      float fxHash(vec3 c) { return fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float fxStars(vec3 p, float density, float size, float speed) {
        vec3 cell = floor(p);
        float h = fxHash(cell);
        float d = length(fract(p) - 0.5);
        return step(1.0 - density, h) * smoothstep(size, 0.0, d) * (0.5 + 0.5 * sin(uFxTime * speed + h * 60.0));
      }
      float camoPaint;
      vec4 camoTex;`)
      .replace("#include <map_fragment>", `#include <map_fragment>
      {
        // triplanar in gun space: three samples blended by the normal
        vec3 p = vCamoPos * uCamoScale;
        vec3 w = pow(abs(normalize(vCamoNrm)), vec3(6.0));
        w /= (w.x + w.y + w.z);
        camoTex = texture2D(uCamoTile, p.zy) * w.x + texture2D(uCamoTile, p.xz) * w.y + texture2D(uCamoTile, p.xy) * w.z;
        ${mask ? "vec4 msk = texture2D(uCamoMask, vMapUv);"
          // an older gun has no bake: all paint, chipped where the tile's
          // detail peaks, no shade
          : "vec4 msk = vec4(1.0, smoothstep(0.86, 0.95, camoTex.a), 1.0, 1.0);"}
        // painted zones (cerakote and polymer), chipped back to the bake's
        // metal where it wears; a camo may wear harder than factory
        float zone = smoothstep(0.2, 0.4, msk.r);
        // (a chip is a hard edge: the mask's soft mid values would leak the
        // factory colour into the paint)
        camoPaint = zone * (1.0 - smoothstep(0.5, 0.62, msk.g * uCamoWear));
        // the bake's cavities and grain stay in the paint
        // plus a faint speckle from the detail channel (cerakote is never flat)
        vec3 camo = camoTex.rgb * msk.b * uCamoValue * (0.93 + camoTex.a * 0.14);
        // a chip shows the metal under the paint: the bake's colour there is
        // part factory paint, so it goes grey (no olive under a camo)
        vec3 bare = vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))) * 1.08;
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(bare, camo, camoPaint), zone);
      }`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, clamp(uCamoRough + (camoTex.a - 0.35) * 0.18, 0.05, 1.0), camoPaint);`)
      .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>
      metalnessFactor = mix(metalnessFactor, uCamoMetal, camoPaint);`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      {
        // mastery sheen: a slow band runs down the gun every few seconds,
        // lighting the bright tones of the paint only
        float band = fract(vCamoPos.z * 1.6 + uFxTime * 0.22);
        float sweep = smoothstep(0.0, 0.08, band) * smoothstep(0.2, 0.08, band);
        float lum = dot(camoTex.rgb, vec3(0.299, 0.587, 0.114));
        totalEmissiveRadiance += uCamoSheen * sweep * smoothstep(0.35, 0.6, lum) * camoPaint;
      }
      ${camo.fx ? `{
        // a prestige finish's own light (weapon-model.js FINISH_FX), on the paint only
        vec3 vFxPos = vCamoPos;
        vec3 fxBefore = totalEmissiveRadiance;
        ${camo.fx.glsl}
        totalEmissiveRadiance = fxBefore + (totalEmissiveRadiance - fxBefore) * camoPaint;
      }` : ""}`);
  };
  m.customProgramCacheKey = () => `tf-camo${mask ? "" : "-flat"}${camo.fx ? "-" + camo.fx.key : ""}`;
  m.userData.shared = !!key;
  m.userData.camo = camo.id;
  m.userData.fxTick = camo.sheen || camo.fx ? fxTick : null;
  // true once the mask and the coloured tile are in (the arms sheet waits on it)
  m.userData.camoReady = () => !!((!mask || mask.image) && U.uCamoTile.value.userData.ready);
  if (key) mats.set(key, m);
  return m;
}

/* An older gun (no bake): the camo goes on every opaque, unlit, non-steel
   material of the build, the body colours; steel, black parts, brass,
   glass, glows and the hands keep theirs (docs/DESIGN-SKINS.md §3.4). */
export function camoFlat(root, camo) {
  camoAttributes(root);
  const done = new Map();
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.hand) return;
    const src = o.material;
    if (!src.isMeshStandardMaterial || src.transparent || src.map) return;
    if (src.metalness >= 0.8 || (src.emissiveIntensity > 0.3 && src.emissive?.getHex())) return;
    const c = src.color;
    if (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 0.012) return;
    let m = done.get(src);
    if (!m) { m = camoMaterial(src, null, camo, null); done.set(src, m); }
    o.material = m;
    if (m.userData.fxTick) o.onBeforeRender = m.userData.fxTick;
  });
  root.userData.camo = camo.id;
  return root;
}
