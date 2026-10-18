// Troll Us web: you, walking in first person. The numbers are Studio's: eye 0.8 above a root that sits at y 2.8,
// a 2.6-wide root (radius 1.3 on the floor plan), walkSpeed from the rules, looking up or down at most 75°.
// The camera turns like Studio's CFrame.new(eye) * Angles(0, yaw, 0) * Angles(pitch, 0, 0).
import * as THREE from 'three';
import { resolve } from './collide.js?v=tu-4c1';

export const EYE_HEIGHT = 3.6;
export const BEAN_RADIUS = 1.3;
const PITCH_MAX = 75 * Math.PI / 180;
const SUBSTEP = 0.4; // studs per collision step, well under the thinnest wall, so a slow frame can't skip one

const euler = new THREE.Euler(0, 0, 0, 'YXZ');

export function createPlayer({ x = 0, z = 0, yaw = 0, speed = 14 } = {}) {
  return { x, z, yaw, pitch: 0, speed, moving: false };
}

export function updatePlayer(p, dt, move, look, shapes) {
  p.yaw -= look[0];
  p.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, p.pitch - look[1]));

  // stick or keys in the camera's flat frame: forward is -Z turned by yaw
  const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
  const mx = move.moveX, my = move.moveY;
  const vx = (mx * c + my * s) * p.speed, vz = (-mx * s + my * c) * p.speed;
  p.moving = mx !== 0 || my !== 0;
  if (!p.moving) return p;
  const dist = Math.hypot(vx, vz) * dt;
  const n = Math.max(1, Math.ceil(dist / SUBSTEP));
  for (let i = 0; i < n; i++) {
    p.x += vx * dt / n; p.z += vz * dt / n;
    resolve(shapes, p, BEAN_RADIUS);
  }
  return p;
}

export function placeCamera(p, camera) {
  camera.position.set(p.x, EYE_HEIGHT, p.z);
  euler.set(p.pitch, p.yaw, 0);
  camera.quaternion.setFromEuler(euler);
}
