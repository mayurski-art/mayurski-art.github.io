// Troll Forces — blacklight (docs/KB-CLUB-UNDERGROUND.md pick 5): inside a
// map's UV-lit room the white trollface heads glow, so a player stays easy
// to find in a near-black club. A map gives `blacklight: { box: [x0, y0,
// z0, x1, y1, z1], k, tint }`; maps.js settleMap sets it when the map goes
// live (or clears it). Any material passed to blacklit() brightens its own
// emissive inside the box: the faces in characters/character.js.

import * as THREE from "three";

const U = {
  uBlMin: { value: new THREE.Vector3(1, 1, 1) },
  uBlMax: { value: new THREE.Vector3(-1, -1, -1) },   // empty: nothing is inside
  uBlK: { value: 0 },
  uBlTint: { value: new THREE.Color(1, 1, 1) },
};

export function setBlacklight(spec) {
  if (!spec?.box) {
    U.uBlMin.value.set(1, 1, 1);
    U.uBlMax.value.set(-1, -1, -1);
    U.uBlK.value = 0;
    return;
  }
  const [x0, y0, z0, x1, y1, z1] = spec.box;
  U.uBlMin.value.set(x0, y0, z0);
  U.uBlMax.value.set(x1, y1, z1);
  U.uBlK.value = spec.k ?? 1.5;
  U.uBlTint.value.set(spec.tint ?? 0xd8c8ff);
}

/* The material's emissive, times (1 + k) and the tint, where its fragment
   is inside the box (a soft half-metre edge, so a head crossing the
   doorway fades rather than pops). */
export function blacklit(mat) {
  if (mat.userData.blacklit) return mat;
  mat.userData.blacklit = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBlWorld;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvBlWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBlWorld;\nuniform vec3 uBlMin, uBlMax, uBlTint;\nuniform float uBlK;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
  {
    vec3 bIn = min(vBlWorld - uBlMin, uBlMax - vBlWorld);
    float bl = clamp(min(min(bIn.x, bIn.y), bIn.z) / 0.5, 0.0, 1.0) * uBlK;
    totalEmissiveRadiance *= mix(vec3(1.0), uBlTint * (1.0 + uBlK), bl / max(uBlK, 1e-3));
  }`);
  };
  const key = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => `${key ? key() : ""}|bl`;
  mat.needsUpdate = true;
  return mat;
}
