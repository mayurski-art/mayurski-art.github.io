// Troll Forces — the texture budget on phones and iPads. iOS Safari kills a
// tab whose GPU memory runs past a few hundred MB, and Kabukigrin alone
// uploaded ~530 MB of textures on a phone (2026-10-25: the crash). On a touch
// device every texture is drawn down to MAX_SIDE at upload (three resizes an
// image, canvas or bitmap bigger than capabilities.maxTextureSize itself),
// and the tiling photo surfaces (surface-textures.js) to SURFACE_SIDE when
// they load. A desktop keeps everything at full size.
// tools/troll-ops-phone-mem-test.mjs measures it.

export const TOUCH = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
export const MAX_SIDE = 1024;
export const SURFACE_SIDE = 512;

/* The renderer's upload cap. three makes a new capabilities object when a
   lost context comes back, so the cap goes on again after that. */
export function capTextures(renderer) {
  if (!TOUCH) return;
  const cap = () => { renderer.capabilities.maxTextureSize = Math.min(renderer.capabilities.maxTextureSize, MAX_SIDE); };
  cap();
  renderer.domElement.addEventListener("webglcontextrestored", cap);
}

/* A loaded image texture drawn down to `side` on its long edge (touch only).
   Call it from the loader's onLoad, before the first upload. */
export function shrinkTexture(texture, side = SURFACE_SIDE) {
  const im = texture.image;
  if (!TOUCH || !im) return texture;
  const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
  if (Math.max(w, h) <= side) return texture;
  const k = side / Math.max(w, h);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
  texture.image = c;
  texture.needsUpdate = true;
  return texture;
}
