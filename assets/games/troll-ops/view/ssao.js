// Troll Forces ambient occlusion (High graphics). three's SSAOPass draws the
// scene once more with a plain normal material to find depth and creases,
// and that material ignores a mesh's texture alpha: the trollface board (a
// square with the face cut out by alphaTest), the loot beams and glass all
// counted as solid squares there, so High drew a faint see-through box round
// every face and floor gun (user 2026-10-12). Anything see-through is left
// out of that pass, so only solid geometry casts the shading.
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";

const seeThrough = (m) => Array.isArray(m) ? m.some(seeThrough) : !!m && (m.transparent || m.alphaTest > 0);

export function makeSsao(scene, camera) {
  const ssao = new SSAOPass(scene, camera, 1, 1);
  ssao.kernelRadius = 0.6;
  ssao.minDistance = 0.001;
  ssao.maxDistance = 0.15;
  ssao.output = SSAOPass.OUTPUT.Default;
  ssao.overrideVisibility = function () {
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      cache.set(o, o.visible);
      if (o.isPoints || o.isLine || o.isSprite || (o.isMesh && seeThrough(o.material))) o.visible = false;
    });
  };
  return ssao;
}
