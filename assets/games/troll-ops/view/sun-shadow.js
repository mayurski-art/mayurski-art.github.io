// Troll Forces sun shadows. An arena map's shadow covers the whole map, as
// before. A big map (Troll City, Trollface Island, Kabukigrin) spread one
// 2048 map over ~300 m: 15 cm a texel, so poles, rails and people cast
// smudges or nothing. There the shadow is a box FOLLOW m a side round the
// camera instead, moved in whole texels so its edges don't crawl as you walk.
//
// three r186 removed PCFSoftShadowMap (it falls back to PCFShadowMap with a
// warning); PCF reads shadow.radius for its softness now.

import * as THREE from "three";

const FOLLOW_ABOVE = 60;   // a map whose shadow half-span is over this follows the camera
const FOLLOW = 45;         // the follow box's half-size, m
const LIFT = 90;           // the sun this far back along its direction from the box's centre

let sun = null, follow = false;
const dir = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
const _v = new THREE.Vector3();

export function initSunShadow(renderer, scene) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.position.set(30, 45, -20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 2;
  sun.shadow.bias = -0.0015;
  setBox(40, 120);
  scene.add(sun);
  scene.add(sun.target);
  return sun;
}

function setBox(half, far) {
  const c = sun.shadow.camera;
  c.left = -half; c.right = half; c.top = half; c.bottom = -half;
  c.near = 0.5; c.far = far;
  c.updateProjectionMatrix();
}

/* Per map load: its sun, and the whole map or the follow box. */
export function fitSunShadow(map) {
  sun.color.set(map.sun.color);
  sun.intensity = map.sun.intensity;
  const span = Math.max(map.bounds.maxX - map.bounds.minX, map.bounds.maxZ - map.bounds.minZ) * 0.62;
  follow = span > FOLLOW_ABOVE;
  dir.set(...map.sun.pos).normalize();
  right.crossVectors(THREE.Object3D.DEFAULT_UP, dir).normalize();
  up.crossVectors(dir, right);
  if (follow) setBox(FOLLOW, LIFT * 2);
  else {
    // as before: a fixed sun over the map's centre, the box round all of it
    sun.position.set(...map.sun.pos);
    sun.target.position.set(0, 0, 0);
    setBox(span, 120);
  }
}

/* Each frame, before rendering: centre the follow box on the camera. */
export function updateSunShadow(focus) {
  if (!follow) return;
  // snap the centre to the shadow map's texel grid, in the light's own axes
  const texel = (2 * FOLLOW) / sun.shadow.mapSize.x;
  const x = Math.round(focus.dot(right) / texel) * texel;
  const y = Math.round(focus.dot(up) / texel) * texel;
  const z = focus.dot(dir);
  _v.copy(right).multiplyScalar(x).addScaledVector(up, y).addScaledVector(dir, z);
  sun.target.position.copy(_v);
  sun.position.copy(_v).addScaledVector(dir, LIFT);
  sun.target.updateMatrixWorld();
}
