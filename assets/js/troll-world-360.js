/* ============================================================================
   360° TROLL WORLD — full-screen photosphere viewer for trollrunner.net/maps.
   A sphere with the equirectangular troll-world map on its inside face,
   camera parked at the center, drag/scroll to look around — the standard
   Three.js "panorama" technique (geometry.scale(-1,1,1) flips the sphere
   inside-out so the inside faces render with the texture the right way
   round, no BackSide material needed).

   TEXTURE_URL below doesn't exist in the repo yet — until the real
   equirectangular troll-world art is dropped in at that path, loadTexture()
   falls back to a procedural placeholder gradient so the viewer still works.
   ========================================================================= */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

(() => {
  'use strict';

  const modal = document.getElementById('world360');
  const closeBtn = document.getElementById('world360-close');
  const openBtn = document.getElementById('enter-world-btn');
  if (!modal || !openBtn || !closeBtn) return;

  const TEXTURE_URL = 'assets/images/world/troll-planet-360.jpg';
  const SPHERE_RADIUS = 500;

  let renderer, scene, camera, sphere;
  let lon = 180, lat = 0, targetLon = 180, targetLat = 0;
  let dragging = false, startX = 0, startY = 0, startLon = 0, startLat = 0;
  let rafId = null;
  let resizeObserver = null;

  function buildPlaceholderTexture() {
    // A simple sky/ground gradient with a horizon line — not final art, just
    // enough to make the viewer feel like "inside a world" before the real
    // troll-planet equirectangular image is in place.
    const w = 2048, h = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    sky.addColorStop(0, '#0b1224');
    sky.addColorStop(1, '#3a6ea5');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.55);
    const ground = ctx.createLinearGradient(0, h * 0.55, 0, h);
    ground.addColorStop(0, '#2f5d34');
    ground.addColorStop(1, '#16210f');
    ctx.fillStyle = ground;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.55);
    ctx.lineTo(w, h * 0.55);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function loadTexture() {
    return new Promise((resolve) => {
      new THREE.TextureLoader().load(
        TEXTURE_URL,
        (tex) => { tex.colorSpace = THREE.SRGBColorSpace; resolve(tex); },
        undefined,
        () => resolve(buildPlaceholderTexture()), // asset not shipped yet
      );
    });
  }

  async function init() {
    if (renderer) return; // already built, reused across opens
    camera = new THREE.PerspectiveCamera(75, modal.clientWidth / modal.clientHeight, 1, SPHERE_RADIUS * 2);
    scene = new THREE.Scene();

    const geometry = new THREE.SphereGeometry(SPHERE_RADIUS, 60, 40);
    geometry.scale(-1, 1, 1);
    const texture = await loadTexture();
    sphere = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
    scene.add(sphere);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(modal.clientWidth, modal.clientHeight);
    modal.appendChild(renderer.domElement);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(modal);

    modal.classList.add('is-ready');
  }

  function onResize() {
    if (!renderer) return;
    const w = modal.clientWidth, h = modal.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function onPointerDown(e) {
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    startLon = lon; startLat = lat;
    modal.classList.add('hint-hidden');
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  }
  function onPointerMove(e) {
    if (!dragging) return;
    targetLon = startLon + (startX - e.clientX) * 0.14;
    targetLat = Math.max(-85, Math.min(85, startLat + (e.clientY - startY) * 0.14));
  }
  function onPointerUp() {
    dragging = false;
    window.removeEventListener('pointermove', onPointerMove);
  }
  function onWheel(e) {
    e.preventDefault();
    camera.fov = Math.max(35, Math.min(90, camera.fov + e.deltaY * 0.04));
    camera.updateProjectionMatrix();
  }

  function animate() {
    rafId = requestAnimationFrame(animate);
    // Ease toward the drag target instead of following 1:1 — reads as
    // smooth momentum rather than jittery on trackpads/touch.
    lon += (targetLon - lon) * 0.12;
    lat += (targetLat - lat) * 0.12;
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    camera.lookAt(
      SPHERE_RADIUS * Math.sin(phi) * Math.cos(theta),
      SPHERE_RADIUS * Math.cos(phi),
      SPHERE_RADIUS * Math.sin(phi) * Math.sin(theta),
    );
    renderer.render(scene, camera);
  }

  async function open() {
    modal.classList.add('is-open');
    // Double rAF so the opacity transition actually runs instead of
    // snapping straight to opaque — same pattern the observatory arrival
    // reveal uses elsewhere on this page.
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-visible')));
    document.body.style.overflow = 'hidden';
    await init();
    onResize();
    if (!rafId) animate();
  }

  function close() {
    modal.classList.remove('is-visible', 'hint-hidden');
    document.body.style.overflow = '';
    setTimeout(() => modal.classList.remove('is-open'), 350);
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
  });
})();
