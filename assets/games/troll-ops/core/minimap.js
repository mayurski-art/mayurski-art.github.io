// Troll Forces minimap: the per-map base drawing and the per-frame dots
// (team, enemies on UAV, objectives, streaks). Moved out of game.js (split
// phase 1).

import { royale, drawRoyaleMinimap } from "../modes/royale.js?v=md1-gj1";
import { CarePackage } from "../streak-entities.js?v=vsat2-hk1";
import * as THREE from "three";
import { groundHeightAt } from "../movement.js?v=umb2-sb2-gj1";
import { game } from "./state.js?v=st1";

// Static geometry is drawn once per map into an offscreen canvas and blitted
// each frame, so only the handful of moving dots costs anything.

export const minimapCanvas = document.getElementById("to-minimap");
const minimapCtx = minimapCanvas.getContext("2d");
const minimapBase = document.createElement("canvas");

export function mapToMinimap(x, z) {
  const w = game.ARENA.maxX - game.ARENA.minX;
  const d = game.ARENA.maxZ - game.ARENA.minZ;
  const pad = 6;
  const size = minimapCanvas.width - pad * 2;
  return [
    pad + ((x - game.ARENA.minX) / w) * size,
    pad + ((z - game.ARENA.minZ) / d) * size,
  ];
}

export function buildMinimapBase() {
  const ctx = minimapBase.getContext("2d");
  ctx.clearRect(0, 0, minimapBase.width, minimapBase.height);
  // An island map: its coast and its lake, under the buildings.
  const outline = (poly, fill, stroke) => {
    ctx.beginPath();
    poly.forEach(([x, z], i) => { const [a, b] = mapToMinimap(x, z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
  };
  if (game.ARENA.edge) outline(game.ARENA.edge, "rgba(110,190,95,.28)", "rgba(200,230,190,.5)");
  if (game.ARENA.wade) outline(game.ARENA.wade, "rgba(70,170,255,.35)", "rgba(140,200,255,.5)");
  ctx.fillStyle = "rgba(150,170,140,.16)";
  ctx.strokeStyle = "rgba(190,210,180,.28)";
  ctx.lineWidth = 1;
  for (const c of game.colliders) {
    if (c.min.y > 1.6) continue;           // overhead structures aren't walls
    const [x0, z0] = mapToMinimap(c.min.x, c.min.z);
    const [x1, z1] = mapToMinimap(c.max.x, c.max.z);
    ctx.fillRect(x0, z0, Math.max(1, x1 - x0), Math.max(1, z1 - z0));
    ctx.strokeRect(x0, z0, Math.max(1, x1 - x0), Math.max(1, z1 - z0));
  }
}

export function drawMinimap() {
  const ctx = minimapCtx;
  const size = minimapCanvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(minimapBase, 0, 0);

  if (game.hill) {
    const [hx, hz] = mapToMinimap(game.hill.position.x, game.hill.position.z);
    const r = (game.hill.radius / (game.ARENA.maxX - game.ARENA.minX)) * (size - 12);
    ctx.strokeStyle = "rgba(127,224,102,.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hz, Math.max(4, r), 0, Math.PI * 2);
    ctx.stroke();
  }

  if (royale) drawRoyaleMinimap(ctx, size);

  if (game.isPvp()) {
    // Friendlies always show. Enemies are fogged unless a UAV is up, or
    // they're close enough to hear/see without a radar's help — scaled to
    // the current map's size so small maps don't hand out free radar and
    // huge ones don't demand near-melee range before anything shows.
    const showEnemies = game.enemiesRevealed();
    const vsat = game.vsatUp();
    const arenaSpan = Math.max(game.ARENA.maxX - game.ARENA.minX, game.ARENA.maxZ - game.ARENA.minZ);
    const proximityRadius = Math.min(28, Math.max(14, arenaSpan * 0.16));
    for (const rp of game.remotes.byId.values()) {
      if (!rp.alive) continue;
      // No team of our own (free-for-all, or offline before chooseTeam runs)
      // means nobody is a friendly, so everyone is subject to the fog.
      const friendly = !game.currentMode().ffa && !!game.net.team && rp.team === game.net.team;
      const nearby = Math.hypot(rp.pos.x - game.move.pos.x, rp.pos.z - game.move.pos.z) <= proximityRadius;
      if (!friendly && !showEnemies && !nearby) continue;
      const [x, z] = mapToMinimap(rp.pos.x, rp.pos.z);
      ctx.fillStyle = friendly ? "#7fd1e0" : "#ff6b5a";
      ctx.beginPath();
      if (!friendly && vsat) {
        // The VSAT's edge over a UAV: which way they're facing, too.
        ctx.save();
        ctx.translate(x, z);
        ctx.rotate(-(rp.yaw || 0));
        ctx.moveTo(0, -5);
        ctx.lineTo(3.4, 3.6);
        ctx.lineTo(-3.4, 3.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.arc(x, z, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (showEnemies) {
      // A thin sweep ring, so it reads as "the UAV is why you can see this".
      // The satellite's is doubled and brighter.
      ctx.strokeStyle = vsat ? "rgba(255,150,110,.85)" : "rgba(255,107,90,.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
      if (vsat) ctx.strokeRect(4.5, 4.5, size - 9, size - 9);
    }

    // Care packages beacon their own position by radio the moment they
    // land — that's independent of UAV, so it stays on screen whether or
    // not a UAV is currently up.
    for (const e of game.streakEntities.values()) {
      if (!(e instanceof CarePackage) || e.claimed) continue;
      const [x, z] = mapToMinimap(e.x, e.z);
      ctx.fillStyle = "#f5c542";
      ctx.beginPath();
      ctx.moveTo(x, z - 5);
      ctx.lineTo(x + 5, z + 4);
      ctx.lineTo(x - 5, z + 4);
      ctx.closePath();
      ctx.fill();
    }
  } else if (game.zdir) {
    for (const z of game.zdir.zombies) {
      if (!z.alive || z.dying) continue;
      const [mx, mz] = mapToMinimap(z.mesh.position.x, z.mesh.position.z);
      // only the ones sharing our floor, or the map reads as a swarm
      const sameFloor = Math.abs(z.groundY - game.move.pos.y) < 2.5;
      ctx.fillStyle = sameFloor ? "#8fd15a" : "rgba(143,209,90,.25)";
      ctx.beginPath();
      ctx.arc(mx, mz, sameFloor ? 2.8 : 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (game.spawner) {
    ctx.fillStyle = "#ff6b5a";
    for (const g of game.spawner.grunts) {
      if (!g.alive || g.dying) continue;
      const [x, z] = mapToMinimap(g.mesh.position.x, g.mesh.position.z);
      ctx.beginPath();
      ctx.arc(x, z, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Jammed by an enemy Counter-UAV: static over everything but ourselves.
  if (game.isPvp() && game.minimapJammed()) drawMinimapStatic(ctx, size);

  // us, as an arrow pointing where we're looking
  const [px, pz] = mapToMinimap(game.move.pos.x, game.move.pos.z);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(-game.look.yaw);
  ctx.fillStyle = "#eaf5e4";
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 5);
  ctx.lineTo(0, 2.5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMinimapStatic(ctx, size) {
  ctx.fillStyle = "rgba(8,10,9,.72)";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const v = 90 + ((Math.random() * 150) | 0);
    ctx.fillStyle = `rgba(${v},${v},${v},${0.25 + Math.random() * 0.4})`;
    ctx.fillRect((Math.random() * size) | 0, (Math.random() * size) | 0, 2 + ((Math.random() * 5) | 0), 1 + ((Math.random() * 2) | 0));
  }
  // A rolling tear band, like a dead feed.
  const band = ((performance.now() / 9) % (size + 20)) - 10;
  ctx.fillStyle = "rgba(255,255,255,.12)";
  ctx.fillRect(0, band, size, 6);
  ctx.fillStyle = "#ff6b5a";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.fillText("JAMMED", size / 2, size / 2 + 4);
  ctx.textAlign = "start";
}

// King of the Hill's capture ring — an open cylinder so you can see through it.
let hillMarker = null;
export function setHillMarker(h) {
  if (!hillMarker) {
    hillMarker = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 6, 2.6, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x7fe066, transparent: true, opacity: 0.22,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    hillMarker.userData.noBulletCollide = true;
    game.scene.add(hillMarker);
  }
  hillMarker.visible = !!h;
  if (h) {
    const p = h.position;
    hillMarker.position.set(p.x, 1.3, p.z);
  }
}

// Bomb site rings — a flat disc plus a floating letter, one pair per map,
// built once and repositioned/hidden rather than rebuilt every match.
let bombSiteMarkers = [];
function makeSiteLabel(letter) {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 84px 'DM Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,.85)";
  ctx.strokeText(letter, 64, 68);
  ctx.fillStyle = "#ff8a5a";
  ctx.fillText(letter, 64, 68);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(1.6, 1.6, 1);
  sprite.renderOrder = 20;
  return sprite;
}

export function setBombSiteMarkers(sites) {
  for (const m of bombSiteMarkers) game.scene.remove(m.ring, m.label);
  bombSiteMarkers = [];
  if (!sites) return;
  for (const site of sites) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5, 0.1, 32),
      new THREE.MeshBasicMaterial({ color: 0xff8a5a, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    ring.userData.noBulletCollide = true;
    // Ground-level support only: sites sit on open floor, and a ceiling of
    // 40 used to put the ring on whatever roof or catwalk was overhead.
    const y = groundHeightAt(game.colliders, site.x, site.z, 1) ?? 0;
    ring.position.set(site.x, y + 0.06, site.z);
    game.scene.add(ring);
    const label = makeSiteLabel(site.id);
    label.position.set(site.x, y + 2.4, site.z);
    game.scene.add(label);
    bombSiteMarkers.push({ ring, label, site });
  }
}

/* What used to run at load in game.js: called from game.js where this code was. */
export function initMinimap() {
  minimapBase.width = minimapCanvas.width;
  minimapBase.height = minimapCanvas.height;
}
