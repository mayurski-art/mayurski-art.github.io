// Troll Us web: lighting. Studio lights each room with its own tinted point light under a ceiling; many real lights
// slow every shader on a phone, so here the ship gets one sky light and one sun (decided 2026-10-18). The room
// tints are already in the floor colours and the ceiling panels are Neon, so they glow by themselves.
import * as THREE from 'three';

export function addLights(scene) {
  // Studio: Ambient (110,110,120), OutdoorAmbient (120,120,130), Brightness 2. Tuned by eye against Studio
  // screenshots from the same spots: a bright sky light whose "ground" side lights the ceilings from below,
  // a flat ambient like Roblox's, and a soft sun so walls facing different ways read as different shades.
  const sky = new THREE.HemisphereLight(0xffffff, 0xd8dce8, 1.5);
  sky.name = 'Sky';
  scene.add(sky);
  const ambient = new THREE.AmbientLight(0xffffff, 3.0);
  ambient.name = 'Ambient';
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 0.7);
  sun.name = 'Sun';
  sun.position.set(30, 80, 20); // from high up and a little off-axis, so walls read as different shades
  scene.add(sun);
  scene.background = new THREE.Color(0x05060c); // deep space behind the windows
  return { sky, sun };
}
