// A soft rim light on the characters (stylised realism, REALISM.md).
//
// Where a surface turns edge-on to the eye it picks up a little of the
// map's sun colour, so a figure separates from the street behind it the
// way a backlit one does. It's a material term, not a light: adding a light
// would recompile every lit shader in the scene.
//
// addRim(material) is called on what the figures wear (outfits, the hero and
// blocky bodies), addInkRim(INK) on the ink stick body: still unlit flat ink,
// just catching the light along its edges. Never the face, the first-person
// hands or guns. One shared uniform carries the colour; setRim() sets it per
// map (view/sky.js applySky, from the map's sun).

import * as THREE from "three";

const RIM = { value: new THREE.Color(0x000000) };
const STRENGTH = 0.35;

export function setRim(sunColor) {
  RIM.value.set(sunColor).multiplyScalar(STRENGTH);
}

/* Adds the rim to a lit material (Standard, Toon...). Keeps any
   onBeforeCompile and program cache key it already has. Call it once per
   material, before its first render. */
export function addRim(material) {
  const before = material.onBeforeCompile;
  const key = material.customProgramCacheKey;
  material.onBeforeCompile = (sh, renderer) => {
    before.call(material, sh, renderer);
    sh.uniforms.uRim = RIM;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRim;")
      .replace("#include <opaque_fragment>", `{
  float rimF = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
  outgoingLight += uRim * rimF * rimF * rimF;
}
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `${key.call(material)}|rim`;
  material.userData.rim = true;
  return material;
}

/* The same rim on an unlit MeshBasicMaterial (the ink body): Basic has no
   normal in its fragment shader, so the vertex shader passes one along. */
export function addInkRim(material) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = RIM;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRimN;\nvarying vec3 vRimV;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvRimN = normalize(normalMatrix * normal);\nvRimV = -mvPosition.xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRim;\nvarying vec3 vRimN;\nvarying vec3 vRimV;")
      .replace("#include <opaque_fragment>", `{
  // thinner and fainter than the clothes': at the clothes' strength the
  // joints' caps showed as rings and the figure read as pipes, not a line
  float rimF = 1.0 - abs(dot(normalize(vRimN), normalize(vRimV)));
  outgoingLight += uRim * 0.6 * pow(rimF, 5.0);
}
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => "ink-rim";
  material.userData.rim = true;
  return material;
}
