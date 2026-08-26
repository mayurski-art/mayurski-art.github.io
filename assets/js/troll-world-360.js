/* ============================================================================
   360° TROLL WORLD — full-screen photosphere viewer for trollrunner.net/maps.
   A sphere with the equirectangular troll-world map on its inside face,
   camera parked at the center, drag/scroll to look around — the standard
   Three.js "panorama" technique (geometry.scale(-1,1,1) flips the sphere
   inside-out so the inside faces render with the texture the right way
   round, no BackSide material needed).

   TEXTURE_URL points at the real troll-planet equirectangular art
   (assets/images/world/trollrunner maps.png). If that ever goes missing —
   renamed, moved — loadTexture() falls back to a procedural placeholder
   gradient rather than breaking the viewer outright.
   ========================================================================= */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

(() => {
  'use strict';

  const modal = document.getElementById('world360');
  const closeBtn = document.getElementById('world360-close');
  const openBtn = document.getElementById('enter-world-btn');
  if (!modal || !openBtn || !closeBtn) return;

  const TEXTURE_URL = 'assets/images/world/trollrunner%20maps.png';
  const SPHERE_RADIUS = 500;

  let renderer, scene, camera, sphere;
  // Pitched down on entry rather than level with the horizon, so the first
  // thing you see is the terrain itself — recognizable as "the map" right
  // away instead of mostly sky until you drag.
  const START_LAT = -35;
  let lon = 180, lat = START_LAT, targetLon = 180, targetLat = START_LAT;
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
    // Reset the view every time — without this, reopening after a previous
    // visit's drag would resume wherever that drag left off instead of
    // greeting the visitor with the ground again.
    lon = targetLon = 180;
    lat = targetLat = START_LAT;
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

  /* ── "Fall into the grin" entrance ────────────────────────────────────
     The world IS a giant trollface, so entering it means diving through
     its own grin: a cropped, grin-framed copy of the map image rushes the
     camera toward the teeth-island coastline and darkens to black, then
     the actual photosphere (already fading in underneath, via open())
     is revealed as the drop overlay fades away. See #world360-drop in
     maps.html for the crop framing. */
  const dropOverlay = document.getElementById('world360-drop');
  function enterWorld() {
    if (!dropOverlay || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      open();
      return;
    }
    dropOverlay.classList.remove('is-fading', 'is-diving');
    dropOverlay.classList.add('is-active');
    // A real pause (not just a double-rAF) before the rush starts — long
    // enough for the freshly-fetched map image to actually finish decoding
    // and for the grin to register as "the world" before it goes anywhere.
    // The 800ms scale-up plus its 350ms filter delay + 500ms darken (see
    // the CSS) puts full black at ~250+350+500=1100ms; the timers below
    // are paced off that.
    setTimeout(() => { dropOverlay.classList.add('is-diving'); }, 250);
    // Kick off the modal's own fade-in a bit before the dive finishes —
    // by the time the drop overlay is fully black and starts fading away,
    // the photosphere underneath is already lit and ready to be revealed
    // instead of the reveal exposing a still-loading blank frame.
    setTimeout(() => { open(); }, 1000);
    setTimeout(() => { dropOverlay.classList.add('is-fading'); }, 1150);
    setTimeout(() => {
      dropOverlay.classList.remove('is-active', 'is-diving', 'is-fading');
    }, 1600);
  }

  openBtn.addEventListener('click', enterWorld);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
  });
})();
