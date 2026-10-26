// The world reflection map (stylised realism, REALISM.md): the map's own sky
// drawn into a PMREM, so wet puddles, metal and car paint reflect the sky
// they sit under. Only materials that ask for it get it (useWorldEnv): set
// on scene.environment it would also add sky light to every diffuse surface,
// brightening every map at once, indoors too. Remade once per map load
// (refreshWorldEnv, inside the load screen); the new texture has the same
// size and format, so a material switching to it keeps its compiled program.

import * as THREE from "three";
import { SKY_UNIFORMS, SKY_VERTEX, SKY_FRAGMENT, skyMat } from "./sky.js?v=sr1-ss1";

let pmrem = null, envMat = null, envScene = null, envRT = null;
let worldEnv = null;
const users = new Set();   // WeakRefs to the materials using worldEnv

export function initWorldEnv(renderer) {
  pmrem = new THREE.PMREMGenerator(renderer);
  envMat = new THREE.ShaderMaterial({
    uniforms: SKY_UNIFORMS(), vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide, fog: false, depthWrite: false,
  });
  envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), envMat));
  refreshWorldEnv();
}

/* Redraws the reflection from the sky as it stands now (call after applySky).
   Clouds at the cheap quality and frozen: a reflection never needs more. */
export function refreshWorldEnv() {
  if (!pmrem) return;
  for (const [k, u] of Object.entries(skyMat.uniforms)) {
    const dst = envMat.uniforms[k];
    if (u.value?.copy) dst.value.copy(u.value); else dst.value = u.value;
  }
  envMat.uniforms.uCloudQ.value = Math.min(1, skyMat.uniforms.uCloudQ.value);
  envMat.uniforms.uTime.value = 0;
  const old = envRT;
  envRT = pmrem.fromScene(envScene, 0, 0.1, 100);
  worldEnv = envRT.texture;
  for (const ref of users) {
    const m = ref.deref();
    if (!m) users.delete(ref);
    else m.envMap = worldEnv;
  }
  old?.dispose();
}

/* Gives a material the world's reflection. Ask for it at map build time,
   after initWorldEnv, so the material compiles with it the first time. */
export function useWorldEnv(material, intensity = 1) {
  material.envMap = worldEnv;
  material.envMapIntensity = intensity;
  users.add(new WeakRef(material));
  return material;
}
