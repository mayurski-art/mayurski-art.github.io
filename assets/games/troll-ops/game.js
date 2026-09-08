// Troll Ops — main game module.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { WeaponState } from "./weapons.js";
import { buildWeaponMesh } from "./weapon-model.js";
import { Loadout } from "./loadout.js";
import { addXp, xpForRun } from "./progression.js";
import { buildMap, disposeMap } from "./maps.js";
import { Net, makeRoomCode } from "./net.js";
import { RemotePlayers, TEAMS } from "./remote-players.js";
import { MODES, MODE_IDS, weaponForMode, playerWon, matchWinner, Hill } from "./modes.js";
import { BotManager } from "./bots.js";
import { resolveWeapon, defaultLoadoutFor } from "./attachments.js";
import { GameAudio } from "./audio.js";
import { ZombieDirector } from "./zombies.js";
import { zombieWindows } from "./pentagrin.js";
import { ImpactShader, makeMuzzleFlashMaterial, makeImpactSparkMaterial } from "./shaders.js";
import { WaveSpawner } from "./enemies.js";
import { BulletSystem } from "./ballistics.js";
import { MovementController, STANCE } from "./movement.js";

const els = {
  cabinet: document.getElementById("to-cabinet"),
  loading: document.getElementById("to-loading"),
  title: document.getElementById("to-title"),
  startBtn: document.getElementById("to-start-btn"),
  loMode: document.getElementById("to-lo-mode"),
  loModeBlurb: document.getElementById("to-lo-modeblurb"),
  goL1: document.getElementById("to-go-l1"),
  goL2: document.getElementById("to-go-l2"),
  goL3: document.getElementById("to-go-l3"),
  loPvp: document.getElementById("to-lo-pvp"),
  room: document.getElementById("to-room"),
  newRoom: document.getElementById("to-newroom"),
  netStatus: document.getElementById("to-net-status"),
  hudTeams: document.getElementById("to-hud-teams"),
  scorePhantom: document.getElementById("hud-score-phantom"),
  scoreGhost: document.getElementById("hud-score-ghost"),
  scoreboard: document.getElementById("to-scoreboard"),
  respawn: document.getElementById("to-respawn"),
  respawnText: document.getElementById("to-respawn-text"),
  hudWaveBox: document.querySelector(".to-hud-wave"),
  hudHostilesBox: document.querySelector(".to-hud-hostiles"),
  loMaps: document.getElementById("to-lo-maps"),
  loClasses: document.getElementById("to-lo-classes"),
  loList: document.getElementById("to-lo-list"),
  loName: document.getElementById("to-lo-name"),
  loBlurb: document.getElementById("to-lo-blurb"),
  loStats: document.getElementById("to-lo-stats"),
  loAtts: document.getElementById("to-lo-atts"),
  loRank: document.getElementById("to-lo-rank-label"),
  loRankFill: document.getElementById("to-lo-rank-fill"),
  pause: document.getElementById("to-pause"),
  resumeBtn: document.getElementById("to-resume-btn"),
  quitBtn: document.getElementById("to-quit-btn"),
  gameover: document.getElementById("to-gameover"),
  goTitle: document.getElementById("to-go-title"),
  goWave: document.getElementById("to-go-wave"),
  goKills: document.getElementById("to-go-kills"),
  goTime: document.getElementById("to-go-time"),
  goXp: document.getElementById("to-go-xp"),
  goRank: document.getElementById("to-go-rank"),
  retryBtn: document.getElementById("to-retry-btn"),
  hud: document.getElementById("to-hud"),
  hudWave: document.getElementById("hud-wave"),
  hudHostiles: document.getElementById("hud-hostiles"),
  hudKills: document.getElementById("hud-kills"),
  waveBanner: document.getElementById("hud-wave-banner"),
  crosshair: document.getElementById("to-crosshair"),
  hitmarker: document.getElementById("to-hitmarker"),
  hitflash: document.getElementById("to-hitflash"),
  lowhp: document.getElementById("to-lowhp"),
  hpFill: document.getElementById("hud-hp-fill"),
  hpText: document.getElementById("hud-hp-text"),
  ammoCur: document.getElementById("hud-ammo-cur"),
  ammoRes: document.getElementById("hud-ammo-res"),
  reloadTag: document.getElementById("hud-reload-tag"),
  killfeed: document.getElementById("to-killfeed"),
  touch: document.getElementById("to-touch"),
  touchMove: document.getElementById("to-touch-move"),
  touchMoveNub: document.querySelector(".to-touch-stick-nub"),
  touchLook: document.getElementById("to-touch-look"),
  touchFire: document.getElementById("to-touch-fire"),
  touchAds: document.getElementById("to-touch-ads"),
  touchJump: document.getElementById("to-touch-jump"),
  touchReload: document.getElementById("to-touch-reload"),
  touchSlide: document.getElementById("to-touch-slide"),
  touchLeanL: document.getElementById("to-touch-lean-l"),
  touchLeanR: document.getElementById("to-touch-lean-r"),
};

const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
if (isTouch) { els.touch.hidden = false; }

const loadout = new Loadout({
  maps: els.loMaps,
  classes: els.loClasses,
  list: els.loList,
  name: els.loName,
  blurb: els.loBlurb,
  stats: els.loStats,
  atts: els.loAtts,
  rank: els.loRank,
  rankFill: els.loRankFill,
});

// -------------------- mode + networking --------------------

let modeId = "ops";
const teamScores = { phantom: 0, ghost: 0 };
const bots = new BotManager();
const BOT_TARGET = 8;      // participants a PvP room is padded up to
let gunGameProgress = 0;
let hill = null;
let hillAcc = 0;

const audio = new GameAudio();
let suppressT = 0;

// -------------------- settings + escape menu --------------------

const SETTINGS_KEY = "trollops:settings";
const settings = {
  volume: 50, sens: 100, fov: 78, invert: false, minimap: true,
  ...(() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; } })(),
};

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* private mode */ }
}

function applySettings() {
  audio.setVolume(settings.volume / 100);
  baseFov = settings.fov;
  minimapCanvas.hidden = !settings.minimap;

  const set = (id, value, outId, suffix = "") => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!value;
    else el.value = value;
    const out = outId && document.getElementById(outId);
    if (out) out.textContent = `${value}${suffix}`;
  };
  set("to-set-volume", settings.volume, "to-set-volume-out");
  set("to-set-sens", settings.sens, "to-set-sens-out", "%");
  set("to-set-fov", settings.fov, "to-set-fov-out", "°");
  set("to-set-invert", settings.invert);
  set("to-set-minimap", settings.minimap);
}

function initEscapeMenu() {
  const bindRange = (id, key, outId, suffix = "") => {
    const el = document.getElementById(id);
    el?.addEventListener("input", () => {
      settings[key] = Number(el.value);
      const out = document.getElementById(outId);
      if (out) out.textContent = `${el.value}${suffix}`;
      applySettings();
      saveSettings();
    });
  };
  bindRange("to-set-volume", "volume", "to-set-volume-out");
  bindRange("to-set-sens", "sens", "to-set-sens-out", "%");
  bindRange("to-set-fov", "fov", "to-set-fov-out", "°");

  const bindCheck = (id, key) => {
    const el = document.getElementById(id);
    el?.addEventListener("change", () => {
      settings[key] = el.checked;
      applySettings();
      saveSettings();
    });
  };
  bindCheck("to-set-invert", "invert");
  bindCheck("to-set-minimap", "minimap");

  const tabs = document.getElementById("to-menu-tabs");
  tabs?.addEventListener("click", (e) => {
    const btn = e.target.closest(".to-menu-tab");
    if (!btn) return;
    for (const b of tabs.children) {
      const on = b === btn;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    }
    for (const name of ["settings", "controls", "players"]) {
      const panel = document.getElementById(`to-panel-${name}`);
      if (panel) panel.hidden = name !== btn.dataset.tab;
    }
    if (btn.dataset.tab === "players") renderMenuRoster();
  });

  // Touch has no Esc key, so the in-match button opens the same menu.
  document.getElementById("to-gear")?.addEventListener("click", () => {
    if (gameState !== "playing") return;
    if (controls.isLocked) controls.unlock();
    else { gameState = "paused"; els.pause.hidden = false; }
  });
}

function renderMenuRoster() {
  const box = document.getElementById("to-menu-roster");
  if (!box) return;
  if (!isPvp() || !net.connected) {
    box.textContent = "Solo run — no other operators.";
    return;
  }
  renderScoreboard();
  box.innerHTML = els.scoreboard.innerHTML;
}

/* A round cracking past raises suppression — washes the colour out, tightens
   the vignette and jitters the frame, so being shot at actually costs you. */
function nearMiss(strength) {
  suppressT = Math.min(1, suppressT + strength);
  audio.whiz();
}

/* Closest approach of a ray to a point; used to tell a near miss from a
   shot that was never coming near us. */
function rayDistanceTo(origin, dir, point) {
  const toPoint = point.clone().sub(origin);
  const along = toPoint.dot(dir);
  if (along < 0) return Infinity;
  return toPoint.addScaledVector(dir, -along).length();
}

function currentMode() { return MODES[modeId]; }
function isPvp() { return currentMode().pvp; }
function isZombies() { return !!currentMode().zombies; }
let zdir = null;
function isBotPeer(p) { return p.isBot || String(p.id).startsWith("bot-"); }

function buildModeButtons() {
  els.loMode.innerHTML = "";
  for (const id of MODE_IDS) {
    const m = MODES[id];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "to-lo-modebtn";
    b.dataset.mode = id;
    b.textContent = m.short;
    b.title = m.blurb;
    b.addEventListener("click", () => { modeId = id; renderModes(); });
    els.loMode.appendChild(b);
  }
  renderModes();
}

function renderModes() {
  for (const b of els.loMode.children) {
    const on = b.dataset.mode === modeId;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
  }
  els.loModeBlurb.textContent = currentMode().blurb;
  els.loPvp.hidden = !isPvp();
  els.loMaps.hidden = !!currentMode().forceMap;   // Zombies has its own map
  if (isPvp() && !els.room.value) els.room.value = makeRoomCode();
}

function playerName() {
  const profile = window.TrollrunnerAccounts?.getCachedProfile?.();
  return String(profile?.username || "operator").slice(0, 14);
}

function setNetStatus(text, state = "") {
  els.netStatus.textContent = text;
  els.netStatus.classList.toggle("is-live", state === "live");
  els.netStatus.classList.toggle("is-bad", state === "bad");
}

buildModeButtons();

els.newRoom.addEventListener("click", () => { els.room.value = makeRoomCode(); });
els.room.addEventListener("input", () => {
  els.room.value = els.room.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
});

function registerDeath(victimName, killerId, weaponId) {
  const mode = currentMode();
  const iKilled = killerId === net.id;
  const killer = iKilled ? "You" : (net.peers.get(killerId)?.name || bots.byId(killerId)?.name || "Someone");
  const killerTeam = iKilled ? net.team : (net.peers.get(killerId)?.team || bots.byId(killerId)?.team);
  pushKillfeed(`${killer} → ${victimName}`);

  if (iKilled) {
    player.kills++;
    audio.kill();
    els.hudKills.textContent = String(player.kills);

    if (mode.ladder) {
      gunGameProgress++;
      if (playerWon(mode, gunGameProgress)) { endMatch("You cleared the rack"); return; }
      const next = equipFromLoadout();
      setActiveWeaponMesh(next);
      showWaveBanner(`${gunGameProgress + 1} / ${mode.ladder.length} — ${next.name}`, 1400);
    }
    if (mode.oneShot) {
      // landing the shot buys the round back
      const w = currentWeapon();
      w.ammoInMag = Math.min(w.def.magSize, w.ammoInMag + 1);
    }
  }

  if (killerTeam && teamScores[killerTeam] != null) {
    teamScores[killerTeam]++;
    updateTeamHud();
  }
  checkMatchEnd();
}

function checkMatchEnd() {
  const mode = currentMode();
  if (!mode.pvp || gameState !== "playing") return;
  const winner = matchWinner(mode, {
    teamScores,
    selfScore: player.kills,
    selfName: "You",
    peers: [...net.peers.values()],
  });
  if (winner) endMatch(winner);
}

function updateTeamHud() {
  els.scorePhantom.textContent = String(teamScores.phantom);
  els.scoreGhost.textContent = String(teamScores.ghost);
}

const net = new Net({
  // Bots filling the room isn't news; only announce real people.
  onJoin: (p) => { if (!isBotPeer(p)) pushKillfeed(`${p.name} joined`); },
  onLeave: (p) => { if (!isBotPeer(p)) pushKillfeed(`${p.name} left`); },
  onHitTaken: (m) => damagePlayer(m.dmg, m.id, m.w),
  onPeerDied: (p, m) => registerDeath(p.name, m.by, m.w),
  ownsBot: (id) => !!bots.byId(id),
  onBotHit: (m) => {
    const { killed, bot } = bots.applyHit(m.target, m.dmg);
    if (!killed) return;
    net.reportDeathAs(m.target, m.id, m.w);
    registerDeath(bot.name, m.id, m.w);
  },
  onRemoteShot: (p, m) => {
    const origin = new THREE.Vector3(m.ox, m.oy, m.oz);
    spawnImpactBurst(origin, 0xffcf8a, 3);

    const dist = origin.distanceTo(player.pos);
    audio.shot({ damage: 26, pellets: 1 }, Math.max(0, 1 - dist / 55) * 0.8);

    // Was it aimed near our head? If so, suppress.
    const dir = new THREE.Vector3(m.dx, m.dy, m.dz);
    if (dir.lengthSq() > 0.001 && player.alive) {
      const miss = rayDistanceTo(origin, dir.normalize(), player.pos);
      if (miss < 3) nearMiss(0.55 * (1 - miss / 3));
    }
  },
});

// -------------------- renderer / scene --------------------

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
els.cabinet.appendChild(renderer.domElement);
renderer.domElement.style.position = "absolute";
renderer.domElement.style.inset = "0";
renderer.domElement.style.zIndex = "1";

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x3a4a38, 0.01);

const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    uTop: { value: new THREE.Color(0x1a2e4a) },
    uHorizon: { value: new THREE.Color(0x6b8a5e) },
    uBottom: { value: new THREE.Color(0x2a3324) },
  },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 uTop;
    uniform vec3 uHorizon;
    uniform vec3 uBottom;
    varying vec3 vDir;
    void main() {
      float h = vDir.y;
      vec3 color = h > 0.0
        ? mix(uHorizon, uTop, smoothstep(0.0, 0.6, h))
        : mix(uHorizon, uBottom, smoothstep(0.0, -0.3, h));
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  side: THREE.BackSide,
  fog: false,
  depthWrite: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(250, 24, 16), skyMat);
scene.add(sky);

const camera = new THREE.PerspectiveCamera(78, 16 / 9, 0.05, 300);
let baseFov = 78;   // driven by the FOV setting

// Lighting
const hemi = new THREE.HemisphereLight(0xb9d4ff, 0x39432c, 1.1);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
sun.position.set(30, 45, -20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.0015;
scene.add(sun);
scene.add(sun.target);

// -------------------- map --------------------

// Mutated in place by buildMap — the movement controller holds references
// to both, so they must never be reassigned.
const ARENA = { minX: -34, maxX: 34, minZ: -34, maxZ: 34 };
const colliders = [];

let builtMap = null;
let spawnPoints = [];

function applyEnvironment(map) {
  skyMat.uniforms.uTop.value.set(map.sky.top);
  skyMat.uniforms.uHorizon.value.set(map.sky.horizon);
  skyMat.uniforms.uBottom.value.set(map.sky.bottom);

  scene.fog.color.set(map.fog.color);
  scene.fog.density = map.fog.density;

  sun.color.set(map.sun.color);
  sun.intensity = map.sun.intensity;
  sun.position.set(...map.sun.pos);

  // Keep the shadow frustum tight around whatever this map actually spans.
  const span = Math.max(map.bounds.maxX - map.bounds.minX, map.bounds.maxZ - map.bounds.minZ) * 0.62;
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  sun.shadow.camera.updateProjectionMatrix();

  hemi.color.set(map.hemi.sky);
  hemi.groundColor.set(map.hemi.ground);
  hemi.intensity = map.hemi.intensity;

  ambient.color.set(map.ambient.color);
  ambient.intensity = map.ambient.intensity;
}

function loadMap(id) {
  disposeMap(builtMap, scene);
  builtMap = buildMap(id, { colliders, arena: ARENA });
  scene.add(builtMap.root);
  spawnPoints = builtMap.spawnPoints;
  applyEnvironment(builtMap.map);
  buildMinimapBase();
}

// -------------------- minimap --------------------
// Static geometry is drawn once per map into an offscreen canvas and blitted
// each frame, so only the handful of moving dots costs anything.

const minimapCanvas = document.getElementById("to-minimap");
const minimapCtx = minimapCanvas.getContext("2d");
const minimapBase = document.createElement("canvas");
minimapBase.width = minimapCanvas.width;
minimapBase.height = minimapCanvas.height;

function mapToMinimap(x, z) {
  const w = ARENA.maxX - ARENA.minX;
  const d = ARENA.maxZ - ARENA.minZ;
  const pad = 6;
  const size = minimapCanvas.width - pad * 2;
  return [
    pad + ((x - ARENA.minX) / w) * size,
    pad + ((z - ARENA.minZ) / d) * size,
  ];
}

function buildMinimapBase() {
  const ctx = minimapBase.getContext("2d");
  ctx.clearRect(0, 0, minimapBase.width, minimapBase.height);
  ctx.fillStyle = "rgba(150,170,140,.16)";
  ctx.strokeStyle = "rgba(190,210,180,.28)";
  ctx.lineWidth = 1;
  for (const c of colliders) {
    if (c.min.y > 1.6) continue;           // overhead structures aren't walls
    const [x0, z0] = mapToMinimap(c.min.x, c.min.z);
    const [x1, z1] = mapToMinimap(c.max.x, c.max.z);
    ctx.fillRect(x0, z0, Math.max(1, x1 - x0), Math.max(1, z1 - z0));
    ctx.strokeRect(x0, z0, Math.max(1, x1 - x0), Math.max(1, z1 - z0));
  }
}

function drawMinimap() {
  const ctx = minimapCtx;
  const size = minimapCanvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(minimapBase, 0, 0);

  if (hill) {
    const [hx, hz] = mapToMinimap(hill.position.x, hill.position.z);
    const r = (hill.radius / (ARENA.maxX - ARENA.minX)) * (size - 12);
    ctx.strokeStyle = "rgba(127,224,102,.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hz, Math.max(4, r), 0, Math.PI * 2);
    ctx.stroke();
  }

  if (isPvp()) {
    for (const rp of remotes.byId.values()) {
      if (!rp.alive) continue;
      const [x, z] = mapToMinimap(rp.pos.x, rp.pos.z);
      ctx.fillStyle = rp.team === net.team ? "#7fd1e0" : "#ff6b5a";
      ctx.beginPath();
      ctx.arc(x, z, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (zdir) {
    for (const z of zdir.zombies) {
      if (!z.alive || z.dying) continue;
      const [mx, mz] = mapToMinimap(z.mesh.position.x, z.mesh.position.z);
      // only the ones sharing our floor, or the map reads as a swarm
      const sameFloor = Math.abs(z.groundY - move.pos.y) < 2.5;
      ctx.fillStyle = sameFloor ? "#8fd15a" : "rgba(143,209,90,.25)";
      ctx.beginPath();
      ctx.arc(mx, mz, sameFloor ? 2.8 : 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (spawner) {
    ctx.fillStyle = "#ff6b5a";
    for (const g of spawner.grunts) {
      if (!g.alive || g.dying) continue;
      const [x, z] = mapToMinimap(g.mesh.position.x, g.mesh.position.z);
      ctx.beginPath();
      ctx.arc(x, z, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // us, as an arrow pointing where we're looking
  const [px, pz] = mapToMinimap(move.pos.x, move.pos.z);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(-look.yaw);
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

// King of the Hill's capture ring — an open cylinder so you can see through it.
let hillMarker = null;
function setHillMarker(h) {
  if (!hillMarker) {
    hillMarker = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 6, 2.6, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x7fe066, transparent: true, opacity: 0.22,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    hillMarker.userData.noBulletCollide = true;
    scene.add(hillMarker);
  }
  hillMarker.visible = !!h;
  if (h) {
    const p = h.position;
    hillMarker.position.set(p.x, 1.3, p.z);
  }
}

// -------------------- postprocessing --------------------

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.5, 0.82);
composer.addPass(bloom);
const impactPass = new ShaderPass(ImpactShader);
composer.addPass(impactPass);
composer.addPass(new OutputPass());

// -------------------- weapon view models --------------------
// Rendered in a separate scene/camera overlay so the tiny gun mesh never
// suffers near-plane distortion or scale mismatch with the world FOV.

const weaponScene = new THREE.Scene();
const weaponCamera = new THREE.PerspectiveCamera(58, 16 / 9, 0.01, 10);
const weaponRig = new THREE.Group();
weaponScene.add(weaponRig);

const weaponKeyLight = new THREE.DirectionalLight(0xfff2d8, 3.2);
weaponKeyLight.position.set(0.5, 1.2, 1);
weaponScene.add(weaponKeyLight);
const weaponRimLight = new THREE.DirectionalLight(0x8fb0ff, 1.8);
weaponRimLight.position.set(-0.6, 0.4, -1);
weaponScene.add(weaponRimLight);
const weaponFillLight = new THREE.AmbientLight(0xaab8ff, 1.1);
weaponScene.add(weaponFillLight);

scene.add(camera);


// Only the equipped weapon is built, and it's rebuilt whenever the loadout
// changes, because attachments alter the geometry.
let activeWeaponMesh = null;

function setActiveWeaponMesh(def) {
  if (activeWeaponMesh) {
    weaponRig.remove(activeWeaponMesh);
    activeWeaponMesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose?.();
    });
  }
  activeWeaponMesh = buildWeaponMesh(def);
  weaponRig.add(activeWeaponMesh);
}

// muzzle flash sprite
const muzzleMat = makeMuzzleFlashMaterial();
const muzzleFlash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), muzzleMat);
muzzleFlash.rotation.z = Math.random() * Math.PI;
weaponRig.add(muzzleFlash);
let muzzleFlashT = 0;

// muzzle point light for dynamic illumination on each shot
const muzzleLight = new THREE.PointLight(0xffcf8a, 0, 4, 2);
weaponRig.add(muzzleLight);

// -------------------- tracers / impact sparks pools --------------------

const sparkGeo = new THREE.BufferGeometry();
const SPARK_MAX = 400;
const sparkPositions = new Float32Array(SPARK_MAX * 3);
const sparkLife = new Float32Array(SPARK_MAX);
sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
sparkGeo.setAttribute("aLife", new THREE.BufferAttribute(sparkLife, 1));
const sparkMat = makeImpactSparkMaterial();
const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
sparkPoints.frustumCulled = false;
scene.add(sparkPoints);

const sparks = []; // {idx, vel, life, maxLife}
let sparkCursor = 0;
function spawnImpactBurst(pos, color, count = 10) {
  sparkMat.uniforms.uColor.value.set(color);
  for (let i = 0; i < count; i++) {
    const idx = sparkCursor % SPARK_MAX;
    sparkCursor++;
    const vel = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4);
    sparks[idx] = { pos: pos.clone(), vel, life: 0.4, maxLife: 0.4 };
  }
}

function updateSparks(dt) {
  for (let i = 0; i < SPARK_MAX; i++) {
    const s = sparks[i];
    if (!s) { sparkPositions[i * 3 + 1] = -1000; sparkLife[i] = 0; continue; }
    s.life -= dt;
    if (s.life <= 0) { sparks[i] = null; sparkPositions[i * 3 + 1] = -1000; sparkLife[i] = 0; continue; }
    s.vel.y -= 9.8 * dt;
    s.pos.addScaledVector(s.vel, dt);
    sparkPositions[i * 3] = s.pos.x;
    sparkPositions[i * 3 + 1] = s.pos.y;
    sparkPositions[i * 3 + 2] = s.pos.z;
    sparkLife[i] = s.life / s.maxLife;
  }
  sparkGeo.attributes.position.needsUpdate = true;
  sparkGeo.attributes.aLife.needsUpdate = true;
}

// -------------------- player state --------------------

const player = {
  pos: new THREE.Vector3(0, 1.7, 8), // eye position, mirrored from `move` each frame
  hp: 100,
  maxHp: 100,
  weaponId: "problem416",
  weapons: {},
  kills: 0,
  deaths: 0,
  wave: 0,
  alive: true,
};

const move = new MovementController({ colliders, arena: ARENA });
const bullets = new BulletSystem(scene);
const remotes = new RemotePlayers(scene);

// Look is composed by hand rather than by PointerLockControls: recoil, lean
// roll and the touch stick all need to write into the same orientation, and
// letting PLC own the camera quaternion made them fight each other.
const look = { yaw: 0, pitch: 0 };
const BASE_MOUSE_SENS = 0.0022;
const PITCH_LIMIT = 1.5;

const controls = new EventTarget();
controls.isLocked = false;
// requestPointerLock rejects (not throws) when the document isn't focused,
// so swallow it rather than surfacing an unhandled rejection.
controls.lock = () => { try { renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); } catch { /* unsupported */ } };
controls.unlock = () => { try { document.exitPointerLock?.(); } catch { /* not locked */ } };

document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === renderer.domElement;
  controls.isLocked = locked;
  controls.dispatchEvent(new Event(locked ? "lock" : "unlock"));
});
document.addEventListener("mousemove", (e) => {
  if (!controls.isLocked) return;
  const sens = BASE_MOUSE_SENS * (settings.sens / 100);
  look.yaw -= e.movementX * sens;
  look.pitch += (settings.invert ? 1 : -1) * e.movementY * sens;
  look.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, look.pitch));
});

let spawner = null;

const keys = new Set();
window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "KeyR") tryReload();
  if (e.code === "Space" && gameState === "playing") e.preventDefault();
  if (e.code === "Tab" && gameState === "playing" && isPvp()) {
    e.preventDefault();
    renderScoreboard();
    els.scoreboard.hidden = false;
  }
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "Tab") els.scoreboard.hidden = true;
});

function renderScoreboard() {
  const rows = [{ name: `${playerName()} (you)`, team: net.team, kills: player.kills, you: true }];
  for (const p of net.peers.values()) {
    rows.push({ name: p.name, team: p.team, kills: p.kills | 0, you: false });
  }
  let html = "";
  for (const teamId of ["phantom", "ghost"]) {
    const team = TEAMS[teamId];
    const members = rows.filter((r) => r.team === teamId).sort((a, b) => b.kills - a.kills);
    html += `<div class="to-sb-team"><div class="to-sb-head">`
      + `<span style="color:${team.ui}">${team.name}</span><span>${teamScores[teamId]}</span></div>`;
    html += members.length
      ? members.map((r) => `<div class="to-sb-row${r.you ? " is-you" : ""}">`
          + `<span>${escapeHtml(r.name)}</span><span>${r.kills} kills</span></div>`).join("")
      : `<div class="to-sb-row"><span>—</span><span></span></div>`;
    html += `</div>`;
  }
  els.scoreboard.innerHTML = html;
}

// Peer names come off the wire, so they are never trusted as markup.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let mouseDown = false, adsHeld = false;
renderer.domElement.addEventListener("mousedown", (e) => {
  if (!controls.isLocked) return;
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) adsHeld = true;   // PF parity: right mouse aims
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) adsHeld = false;
});
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

// -------------------- touch controls --------------------

const touchState = {
  moveX: 0, moveY: 0, lookDX: 0, lookDY: 0,
  firing: false, ads: false, jump: false,
  crouch: false, dive: false, lean: 0,
};

function bindStick(el, nub) {
  let active = false, startX = 0, startY = 0, id = null;
  el.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    active = true; id = t.identifier; startX = t.clientX; startY = t.clientY;
  }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    if (!active) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      let dx = t.clientX - startX, dy = t.clientY - startY;
      const max = 40;
      dx = Math.max(-max, Math.min(max, dx));
      dy = Math.max(-max, Math.min(max, dy));
      touchState.moveX = dx / max;
      touchState.moveY = dy / max;
      if (nub) nub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
  }, { passive: true });
  const end = (e) => {
    for (const t of e.changedTouches) if (t.identifier === id) { active = false; touchState.moveX = 0; touchState.moveY = 0; if (nub) nub.style.transform = "translate(-50%,-50%)"; }
  };
  el.addEventListener("touchend", end);
  el.addEventListener("touchcancel", end);
}
bindStick(els.touchMove, els.touchMoveNub);

(function bindLook() {
  let id = null, lastX = 0, lastY = 0;
  els.touchLook.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    id = t.identifier; lastX = t.clientX; lastY = t.clientY;
  }, { passive: true });
  els.touchLook.addEventListener("touchmove", (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      touchState.lookDX += (t.clientX - lastX) * 0.0028;
      touchState.lookDY += (t.clientY - lastY) * 0.0028;
      lastX = t.clientX; lastY = t.clientY;
    }
  }, { passive: true });
  const end = (e) => { for (const t of e.changedTouches) if (t.identifier === id) id = null; };
  els.touchLook.addEventListener("touchend", end);
  els.touchLook.addEventListener("touchcancel", end);
})();

function bindHold(el, onDown, onUp) {
  el.addEventListener("touchstart", (e) => { e.preventDefault(); el.classList.add("is-held"); onDown(); }, { passive: false });
  el.addEventListener("touchend", (e) => { e.preventDefault(); el.classList.remove("is-held"); onUp(); });
  el.addEventListener("touchcancel", () => { el.classList.remove("is-held"); onUp(); });
}
bindHold(els.touchFire, () => touchState.firing = true, () => touchState.firing = false);
bindHold(els.touchAds, () => touchState.ads = true, () => touchState.ads = false);
bindHold(els.touchJump, () => touchState.jump = true, () => touchState.jump = false);
bindHold(els.touchSlide, () => touchState.crouch = true, () => touchState.crouch = false);
bindHold(els.touchLeanL, () => touchState.lean = -1, () => touchState.lean = 0);
bindHold(els.touchLeanR, () => touchState.lean = 1, () => touchState.lean = 0);
els.touchReload.addEventListener("touchstart", (e) => { e.preventDefault(); tryReload(); });

// -------------------- HUD helpers --------------------

function pushKillfeed(text) {
  const div = document.createElement("div");
  div.className = "to-kf-item";
  div.textContent = text;
  els.killfeed.appendChild(div);
  setTimeout(() => div.remove(), 2700);
}

function showHitmarker(isCrit) {
  audio.hitmarker(isCrit);
  els.hitmarker.classList.remove("pop");
  els.hitmarker.classList.toggle("is-crit", isCrit);
  void els.hitmarker.offsetWidth;
  els.hitmarker.classList.add("pop");
}

let hitFlashT = 0;
function flashHit() {
  hitFlashT = 1;
}

function showWaveBanner(text, ms = 1800) {
  els.waveBanner.textContent = text;
  els.waveBanner.classList.add("is-visible");
  clearTimeout(showWaveBanner._t);
  showWaveBanner._t = setTimeout(() => els.waveBanner.classList.remove("is-visible"), ms);
}

// -------------------- weapon actions --------------------

function currentWeapon() { return player.weapons[player.weaponId]; }

function tryReload() {
  if (!controls.isLocked && !isTouch) return;
  if (currentWeapon().startReload()) audio.reload();
}

function fireOnce() {
  const w = currentWeapon();
  const def = w.def;
  if (!w.canFire()) {
    if (w.ammoInMag <= 0 && !w.reloading) tryReload();
    return;
  }
  w.fire();
  audio.shot(def);
  muzzleFlashT = 0.045;
  muzzleLight.intensity = 3.2;

  // Part of the kick is permanent climb the player has to pull back down —
  // that's what makes recoil control a skill rather than a wait.
  look.pitch = Math.min(PITCH_LIMIT, look.pitch + def.recoilKickPitch * 0.35);

  const pellets = def.pellets || 1;
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);

  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const muzzle = origin.clone().addScaledVector(forward, 0.35);
  if (isPvp()) net.reportShot(muzzle, forward, player.weaponId);

  for (let i = 0; i < pellets; i++) {
    const spread = def.pelletSpread != null ? def.pelletSpread : w.spread;
    // Uniform disc around the aim axis — an even cone, unlike the old
    // world-axis rotation which skewed badly when looking up or down.
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * spread * 0.5;
    const dir = forward.clone()
      .addScaledVector(right, Math.cos(a) * r)
      .addScaledVector(up, Math.sin(a) * r)
      .normalize();
    bullets.spawn({ origin: muzzle.clone(), dir, def, ownerId: "player" });
  }
}

function resolveBulletTarget(object) {
  return remotes.resolve(object) || zdir?.resolve(object) || findGruntFromObject(object);
}

function onBulletActorHit(actor, info) {
  if (actor.isZombie) {
    const { killed, points } = actor.takeDamage(info.damage, info.isHead);
    zdir.award(points);
    showHitmarker(info.isHead);
    spawnImpactBurst(info.point, info.isHead ? 0xffe27a : 0x8fd15a, info.isHead ? 16 : 8);
    if (killed) {
      zdir.kills++;
      player.kills++;
      audio.kill();
      pushKillfeed(`${info.isHead ? "Headshot — " : ""}+${points}`);
    }
    return;
  }

  // Remote players own their own health: we report the hit and they apply it.
  if (actor.netId) {
    // Our own bots never hear our broadcasts, so resolve those locally.
    if (bots.byId(actor.netId)) {
      const { killed, bot } = bots.applyHit(actor.netId, info.damage);
      if (killed) {
        net.reportDeathAs(actor.netId, net.id, player.weaponId);
        registerDeath(bot.name, net.id, player.weaponId);
      }
    } else {
      net.reportHit(actor.netId, info.damage, info.isHead, player.weaponId);
    }
    showHitmarker(info.isHead);
    spawnImpactBurst(info.point, info.isHead ? 0xffe27a : 0xff8a5a, info.isHead ? 16 : 8);
    return;
  }
  onGruntBulletHit(actor, info);
}

function onGruntBulletHit(grunt, { damage, isHead, point, dir }) {
  const knockDir = dir.clone(); knockDir.y = 0; knockDir.normalize();
  const result = grunt.takeDamage(damage, isHead, knockDir);
  showHitmarker(isHead);
  spawnImpactBurst(point, isHead ? 0xffe27a : 0xff8a5a, isHead ? 16 : 8);
  if (result.killed) {
    player.kills++;
    els.hudKills.textContent = String(player.kills);
    pushKillfeed(`${isHead ? "Headshot — " : ""}Grunt down`);
  }
}

function findGruntFromObject(obj) {
  let o = obj;
  while (o) {
    if (o.userData && o.userData.dissolveMat) {
      const grunt = spawner.grunts.find((g) => g.mesh === o);
      if (grunt) return grunt;
    }
    o = o.parent;
  }
  return null;
}

// -------------------- game flow --------------------

let gameState = "menu"; // menu | playing | paused | gameover
let elapsedRun = 0;

/* Team spawns are the map's spawn ring split in half — no map needs bespoke
   team zones yet, and opposite halves are naturally far apart. */
function spawnForTeam(team) {
  const pts = builtMap.spawnPoints;
  const half = Math.ceil(pts.length / 2);
  const pool = team === "ghost" ? pts.slice(half) : pts.slice(0, half);
  return pool[Math.floor(Math.random() * pool.length)] || pts[0];
}

function teamSpawn() { return spawnForTeam(net.team); }

/* Everything a bot could shoot at: us, other humans, and other bots. */
function botTargets() {
  const list = [];
  if (player.alive) {
    list.push({ id: net.id, team: net.team, alive: true, pos: move.pos, groundY: move.pos.y });
  }
  for (const rp of remotes.byId.values()) {
    if (!rp.alive) continue;
    list.push({ id: rp.netId, team: rp.team, alive: true, pos: rp.pos, groundY: rp.pos.y });
  }
  return list;
}

function onBotShoot(bot, target, dmg, isHead, hit, range = 30) {
  audio.shot({ damage: 24, pellets: 1 }, Math.max(0, 1 - range / 55) * 0.7);

  if (!hit) {
    if (target.id === net.id) nearMiss(0.45);
    return;
  }
  if (target.id === net.id) { damagePlayer(dmg, bot.id, "problem416"); return; }

  if (bots.byId(target.id)) {
    const { killed, bot: victim } = bots.applyHit(target.id, dmg);
    if (killed) {
      bot.kills++;
      net.reportDeathAs(target.id, bot.id, "problem416");
      registerDeath(victim.name, bot.id, "problem416");
    }
    return;
  }
  net.reportHitAs(bot.id, target.id, dmg, isHead, "problem416");
}

function scoreHill() {
  let phantom = 0, ghost = 0;
  const tally = (team) => { if (team === "ghost") ghost++; else phantom++; };
  if (player.alive && hill.contains(move.pos.x, move.pos.z)) tally(net.team);
  for (const rp of remotes.byId.values()) {
    if (rp.alive && hill.contains(rp.pos.x, rp.pos.z)) tally(rp.team);
  }
  if (phantom > ghost) teamScores.phantom += phantom;
  else if (ghost > phantom) teamScores.ghost += ghost;
  if (phantom || ghost) { updateTeamHud(); checkMatchEnd(); }
}

/* Gun Game and One in the Chamber decide what you're holding; every other
   mode uses whatever the loadout screen has equipped. */
function equipFromLoadout() {
  const mode = currentMode();
  const forcedId = weaponForMode(mode, gunGameProgress);
  let def = forcedId ? resolveWeapon(forcedId, defaultLoadoutFor(forcedId)) : loadout.resolved;
  if (mode.tuneWeapon) def = mode.tuneWeapon(def);
  player.weaponId = def.id;
  player.weapons = { [def.id]: new WeaponState(def) };
  return def;
}

async function startGame() {
  audio.resume();   // the click that got us here is the gesture Web Audio needs
  suppressT = 0;
  if (isPvp()) {
    const code = els.room.value || makeRoomCode();
    els.room.value = code;
    els.startBtn.disabled = true;
    setNetStatus("Connecting…");
    const kind = await net.start(code, { name: playerName(), mapId: loadout.mapId });
    els.startBtn.disabled = false;
    if (!kind) { setNetStatus("Couldn't reach the room. Try another code.", "bad"); return; }
    net.chooseTeam();
    setNetStatus(`Live · ${kind} · room ${code} · ${TEAMS[net.team].name}`, "live");
  } else {
    net.stop();
  }

  player.hp = player.maxHp;
  player.kills = 0;
  player.deaths = 0;
  player.wave = 0;
  player.alive = true;
  elapsedRun = 0;
  respawnT = 0;
  teamScores.phantom = 0;
  teamScores.ghost = 0;
  updateTeamHud();

  gunGameProgress = 0;
  hillAcc = 0;

  loadMap(currentMode().forceMap || loadout.mapId);
  const sp = isPvp() ? teamSpawn() : builtMap.playerSpawn;
  move.reset(sp.x, sp.z, sp.y || 0);
  look.yaw = yawTowardCentre(sp);
  look.pitch = 0;
  bullets.clear();
  remotes.clear();
  bots.clear();

  hill = currentMode().hill ? new Hill(builtMap.spawnPoints) : null;
  setHillMarker(hill);

  setActiveWeaponMesh(equipFromLoadout());

  if (spawner) {
    for (const g of spawner.grunts) g.dispose(scene);
    spawner = null;
  }
  if (zdir) { zdir.clear(); zdir = null; }

  if (isZombies()) {
    zdir = new ZombieDirector(scene, ARENA, colliders, zombieWindows());
  } else if (!isPvp()) {
    spawner = new WaveSpawner(scene, ARENA, spawnPoints, colliders);
  }

  const pvp = isPvp();
  els.hudTeams.hidden = !pvp;
  els.hudWaveBox.hidden = pvp;
  els.hudHostilesBox.hidden = pvp;
  document.getElementById("hud-l-wave").textContent = isZombies() ? "Round" : "Wave";
  document.getElementById("hud-l-hostiles").textContent = isZombies() ? "Zombies" : "Hostiles";
  document.getElementById("hud-l-kills").textContent = isZombies() ? "Points" : "Kills";
  els.respawn.hidden = true;
  els.scoreboard.hidden = true;

  els.title.hidden = true;
  els.gameover.hidden = true;
  els.pause.hidden = true;
  els.hud.hidden = false;
  gameState = "playing";

  if (isZombies()) nextZombieRound();
  else if (!isPvp()) nextWave();
  else showWaveBanner(`${TEAMS[net.team].name.toUpperCase()} — ${builtMap.map.name}`, 2400);

  if (!isTouch) controls.lock();
}

function nextZombieRound() {
  player.wave = zdir.round + 1;
  zdir.startRound(player.wave);
  els.hudWave.textContent = String(player.wave);
  showWaveBanner(`ROUND ${player.wave}`);
  audio.wave();
}

function onZombieAttack(zombie, dmg) {
  damagePlayer(dmg, null, null);
}

function nextWave() {
  player.wave++;
  els.hudWave.textContent = String(player.wave);
  showWaveBanner(`WAVE ${player.wave}`);
  audio.wave();
  spawner.startWave(player.wave);
}

function finishRun(title, headline, headlineLabel, secondLabel, thirdLabel) {
  gameState = "gameover";
  player.alive = false;
  if (controls.isLocked) controls.unlock();
  els.hud.hidden = true;
  els.gameover.hidden = false;
  els.goTitle.textContent = title;
  els.goWave.textContent = headline;
  els.goL1.textContent = headlineLabel;
  els.goKills.textContent = String(player.kills);
  els.goL2.textContent = secondLabel;
  const mins = Math.floor(elapsedRun / 60), secs = Math.floor(elapsedRun % 60);
  els.goTime.textContent = `${mins}:${String(secs).padStart(2, "0")}`;
  els.goL3.textContent = thirdLabel;

  const gained = xpForRun({ kills: player.kills, wave: player.wave });
  const { rankedUp, rank } = addXp(gained);
  els.goXp.textContent = `+${gained.toLocaleString()} XP`;
  els.goRank.textContent = rankedUp ? `Rank up — now rank ${rank}` : "";
  els.goRank.hidden = !rankedUp;
  loadout.render();

  // Weapon rank stays local — it's a per-game unlock track, and the account's
  // XP is server-guarded with its own cooldowns and caps. Filing the run is
  // what the account API is actually for; it no-ops for guests.
  window.TrollrunnerAccounts?.reportGameResult?.("troll-ops", player.wave * 10000 + player.kills * 10, {
    mode: modeId,
    kills: player.kills,
    deaths: player.deaths,
    wave: player.wave,
    map: loadout.mapId,
  });
}

function endGame(reason) {
  const zombies = isZombies();
  finishRun(
    reason === "quit" ? "Extracted" : (zombies ? "They got you" : "You went down"),
    String(player.wave),
    zombies ? "Round reached" : "Wave reached",
    zombies ? "Zombies killed" : "Kills",
    "Time survived",
  );
  window.TrollLeaderboard?.report?.("troll-ops", { pvp: false, wave: player.wave, kills: player.kills });
}

function endMatch(title) {
  const mode = currentMode();
  const headline = mode.ffa ? String(player.kills) : String(teamScores[net.team] ?? 0);
  const won = mode.ffa
    ? title.startsWith("You")
    : title === `${TEAMS[net.team]?.name} win`;
  finishRun(title, headline, mode.ffa ? "Your score" : "Your side", "Your kills", "Match length");

  window.TrollLeaderboard?.report?.("troll-ops", {
    pvp: true, kills: player.kills, deaths: player.deaths, won,
  });

  net.stop();
  remotes.clear();
  bots.clear();
  setHillMarker(null);
  setNetStatus("Match over. Pick a mode to drop in again.");
}

els.startBtn.addEventListener("click", startGame);
els.retryBtn.addEventListener("click", startGame);
els.resumeBtn.addEventListener("click", () => { if (!isTouch) controls.lock(); });
els.quitBtn.addEventListener("click", () => {
  gameState = "menu";
  net.stop();
  remotes.clear();
  setNetStatus("Share the code with whoever you want in the match.");
  els.pause.hidden = true;
  els.hud.hidden = true;
  els.title.hidden = false;
});

controls.addEventListener("lock", () => { if (gameState === "paused") gameState = "playing"; els.pause.hidden = true; });
controls.addEventListener("unlock", () => {
  if (gameState === "playing") { gameState = "paused"; els.pause.hidden = false; }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && gameState === "playing") { gameState = "paused"; els.pause.hidden = false; }
});

// -------------------- damage to player --------------------

let respawnT = 0;

function damagePlayer(amount, fromId, weaponId) {
  if (!player.alive) return;
  player.hp = Math.max(0, player.hp - amount);
  flashHit();
  audio.hurt();
  if (player.hp > 0) return;
  audio.died();

  if (isPvp()) {
    // In PvP dying is a respawn, not the end of the run.
    player.alive = false;
    player.deaths++;
    respawnT = 4;
    net.reportDeath(fromId, weaponId);
    registerDeath("You", fromId, weaponId);
    els.respawn.hidden = false;
  } else {
    endGame("dead");
  }
}

/* Spawns ring the map edge, so face inward — otherwise you open your eyes
   looking at the perimeter wall. */
function yawTowardCentre(sp) {
  return Math.atan2(sp.x, sp.z);
}

function respawnPlayer() {
  const sp = teamSpawn();
  move.reset(sp.x, sp.z, sp.y || 0);
  look.yaw = yawTowardCentre(sp);
  look.pitch = 0;
  player.hp = player.maxHp;
  player.alive = true;
  setActiveWeaponMesh(equipFromLoadout());
  els.respawn.hidden = true;
}

function onGruntAttack(grunt, dmg, ranged) {
  if (ranged) {
    const dist = grunt.mesh.position.distanceTo(player.pos);
    if (dist < 14) damagePlayer(dmg * 0.8);
  } else {
    damagePlayer(dmg);
  }
}

// -------------------- main loop --------------------

const clock = new THREE.Clock();

function resize() {
  const w = els.cabinet.clientWidth, h = els.cabinet.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  weaponCamera.aspect = w / h;
  weaponCamera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  if (gameState === "playing") {
    elapsedRun += dt;
    updatePlayer(dt);
    updateWeaponView(dt);

    let targetMeshes = [];
    if (isZombies()) {
      const roundOver = zdir.update(dt, player.pos, onZombieAttack);
      if (roundOver) nextZombieRound();
      els.hudHostiles.textContent = String(zdir.remaining);
      els.hudKills.textContent = zdir.points.toLocaleString();
      targetMeshes = zdir.hitMeshes();
    } else if (!isPvp()) {
      spawner.update(dt, player.pos, onGruntAttack);
      els.hudHostiles.textContent = String(spawner.aliveCount + spawner.toSpawn);
      if (spawner.isWaveClear()) nextWave();
      for (const g of spawner.grunts) if (g.alive && !g.dying) targetMeshes.push(g.mesh);
    } else {
      const ffa = !!currentMode().ffa;

      // Exactly one client simulates the bots and publishes them as peers, so
      // everyone else needs no bot-specific code at all.
      if (net.isBotHost()) {
        const humans = 1 + [...net.peers.values()].filter((p) => !isBotPeer(p)).length;
        bots.fill(BOT_TARGET, humans, spawnForTeam, ffa);
        bots.update(dt, {
          colliders, arena: ARENA, ffa,
          targets: botTargets(),
          onShoot: onBotShoot,
          spawnFor: spawnForTeam,
        });
        for (const b of bots.bots) net.publishBot(b);
      } else if (bots.count) {
        for (const b of bots.bots) net.dropBot(b.id);
        bots.clear();
      }

      net.update(dt, {
        x: move.pos.x, y: move.pos.y, z: move.pos.z,
        yaw: look.yaw, pitch: look.pitch,
        stance: move.stance, moving: move.moving,
        hp: player.hp, alive: player.alive, weapon: player.weaponId, kills: player.kills,
      });
      remotes.sync(net.peers);
      remotes.update(dt);
      targetMeshes = remotes.hitMeshes(ffa ? null : net.team);

      if (hill) {
        if (hill.update(dt)) { setHillMarker(hill); showWaveBanner("Hill moved", 1300); }
        hillAcc += dt;
        if (hillAcc >= 1) { hillAcc = 0; scoreHill(); }
      }

      if (!player.alive) {
        respawnT -= dt;
        els.respawnText.textContent = `Down — back in ${Math.max(1, Math.ceil(respawnT))}`;
        if (respawnT <= 0) respawnPlayer();
      }
    }

    bullets.update(dt, {
      colliders,
      targetMeshes,
      resolveTarget: resolveBulletTarget,
      onActorHit: onBulletActorHit,
      onWorldHit: (point) => { spawnImpactBurst(point, 0xbfc4b8, 5); audio.impact(); },
    });
    updateSparks(dt);

    // HUD updates
    const w = currentWeapon();
    els.hpFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
    els.hpFill.classList.toggle("is-low", player.hp < 30);
    els.hpText.textContent = Math.ceil(player.hp);
    els.ammoCur.textContent = w.ammoInMag;
    els.ammoRes.textContent = w.ammoReserve;
    els.reloadTag.hidden = !w.reloading;
    els.crosshair.classList.toggle("is-ads", w.ads);
    els.lowhp.classList.toggle("is-low", player.hp < 25);

    hitFlashT = Math.max(0, hitFlashT - dt * 4);
    els.hitflash.classList.toggle("is-hit", hitFlashT > 0.05);
    impactPass.uniforms.uHitFlash.value = hitFlashT;
    impactPass.uniforms.uLowHp.value = player.hp < 25 ? 1 : 0;
    impactPass.uniforms.uAberration.value = Math.min(1, w.viewKickKnockback * 6);
    impactPass.uniforms.uTime.value = t;
    suppressT = Math.max(0, suppressT - dt * 1.1);
    impactPass.uniforms.uSuppress.value = suppressT;
    drawMinimap();

    // fov kick based on sprint/ads
    const def = w.def;
    let targetFov = baseFov;
    if (w.ads) targetFov = baseFov * def.adsFovMult;
    if (move.sprinting && !w.ads) targetFov = baseFov * 1.06;
    if (move.stance === STANCE.SLIDE) targetFov = baseFov * 1.12;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10);
    camera.updateProjectionMatrix();

    const targetWeaponFov = 58 - w.adsT * 8;
    weaponCamera.fov += (targetWeaponFov - weaponCamera.fov) * Math.min(1, dt * 10);
    weaponCamera.updateProjectionMatrix();
  }

  composer.render();

  if (gameState === "playing") {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(weaponScene, weaponCamera);
    renderer.autoClear = true;
  }
}

const _euler = new THREE.Euler(0, 0, 0, "YXZ");
let stepPhase = 0;

function updatePlayer(dt) {
  const w = currentWeapon();

  if (isTouch && (touchState.lookDX || touchState.lookDY)) {
    look.yaw -= touchState.lookDX;
    look.pitch -= touchState.lookDY;
    look.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, look.pitch));
    touchState.lookDX = 0; touchState.lookDY = 0;
  }

  let ix = 0, iz = 0;
  if (isTouch) {
    ix = touchState.moveX;
    iz = -touchState.moveY;
  } else {
    if (keys.has("KeyW")) iz += 1;
    if (keys.has("KeyS")) iz -= 1;
    if (keys.has("KeyA")) ix -= 1;
    if (keys.has("KeyD")) ix += 1;
  }

  // Dead players keep their camera but stop driving anything.
  if (!player.alive) { ix = 0; iz = 0; }

  const leanDir = isTouch
    ? touchState.lean
    : (keys.has("KeyZ") ? -1 : 0) + (keys.has("KeyX") ? 1 : 0);

  // Q aims as well as right mouse; lean moved to Z/X to free it up.
  const wantAds = isTouch ? touchState.ads : (adsHeld || keys.has("KeyQ"));
  const wantFire = isTouch ? touchState.firing : mouseDown;

  move.update(dt, {
    forward: iz,
    strafe: ix,
    sprint: isTouch ? iz > 0.82 : keys.has("ShiftLeft"),
    jump: isTouch ? touchState.jump : keys.has("Space"),
    crouch: isTouch ? touchState.crouch : keys.has("KeyC"),
    dive: isTouch ? touchState.dive : keys.has("ControlLeft") || keys.has("ControlRight"),
    leanDir,
    yaw: look.yaw,
    adsHeld: wantAds,
    speedMult: w.moveSpeedMult,
    sprintMult: w.def.sprintMult,
    inertia: w.def.inertia,
  });

  if (move.moving && move.grounded && player.alive) {
    stepPhase += dt * (move.sprinting ? 13 : 9);
    if (stepPhase > Math.PI) { stepPhase -= Math.PI; audio.step(); }
  } else {
    stepPhase = 0;
  }

  move.eyePosition(player.pos);
  camera.position.copy(player.pos);

  // One place composes the camera: aim + weapon recoil + lean roll.
  _euler.set(look.pitch + w.recoilPitch, look.yaw + w.recoilYaw, move.leanRoll);
  camera.quaternion.setFromEuler(_euler);

  const canAct = !move.busy && player.alive;
  w.update(dt, {
    moving: move.moving,
    sprinting: move.sprinting,
    grounded: move.grounded,
    jumping: move.jumping,
    adsHeld: wantAds && canAct,
    canAds: canAct,
  });

  if (wantFire && canAct) {
    if (w.def.fireMode === "auto") {
      if (w.canFire()) fireOnce();
    } else if (w.def.fireMode === "burst") {
      if (fireEdgeTrigger && w.burstLeft <= 0 && w.canFire()) w.burstLeft = w.def.burst || 2;
    } else if (fireEdgeTrigger && w.canFire()) {
      fireOnce();
    }
  }

  // A burst finishes on its own cadence even if the trigger is released.
  if (w.burstLeft > 0 && canAct && w.canFire()) {
    fireOnce();
    w.burstLeft--;
  }
}

let fireEdgeTrigger = false;
window.addEventListener("mousedown", (e) => {
  if (e.button === 0) { fireEdgeTrigger = true; setTimeout(() => fireEdgeTrigger = false, 16); }
});
els.touchFire.addEventListener("touchstart", () => { fireEdgeTrigger = true; setTimeout(() => fireEdgeTrigger = false, 16); });

let weaponLowerT = 0;

function updateWeaponView(dt) {
  const w = currentWeapon();
  const mesh = activeWeaponMesh;
  if (!mesh) return;

  const bobX = Math.sin(w.bobPhase) * w.def.bobAmp * 0.5;
  const bobY = Math.abs(Math.cos(w.bobPhase)) * w.def.bobAmp;
  const swayX = Math.sin(clock.elapsedTime * w.def.swaySpeed) * w.def.swayAmp;
  const swayY = Math.cos(clock.elapsedTime * w.def.swaySpeed * 0.8) * w.def.swayAmp * 0.6;

  const adsOffset = w.adsT;
  const hipPos = new THREE.Vector3(0.22, -0.2, -0.55);
  const aimPoint = mesh.userData.aimPoint || new THREE.Vector3(0, 0, -0.4);
  const adsViewDistance = -0.46; // where the sight should sit in front of the weapon camera
  const adsPos = new THREE.Vector3(-aimPoint.x, -aimPoint.y, adsViewDistance - aimPoint.z);
  const basePos = hipPos.clone().lerp(adsPos, adsOffset);

  // Gun drops out of the way while sprinting, sliding or vaulting.
  const wantLower = (move.sprinting || move.stance === STANCE.SLIDE || move.busy) ? 1 : 0;
  weaponLowerT += (wantLower - weaponLowerT) * Math.min(1, dt * 9);

  mesh.position.set(
    basePos.x + bobX + swayX - w.viewKickKnockback * 0.4 + weaponLowerT * 0.05,
    basePos.y + bobY + swayY - weaponLowerT * 0.17,
    basePos.z + w.viewKickKnockback * 0.6 + weaponLowerT * 0.08
  );
  mesh.rotation.set(
    -w.viewKickPitch * 0.8 + weaponLowerT * 0.55,
    w.viewKickYaw * 0.6 + (1 - adsOffset) * 0.05,
    (1 - adsOffset) * 0.08 + weaponLowerT * 0.38
  );

  if (mesh.userData.sight) mesh.userData.sight.visible = true;

  if (muzzleFlashT > 0) {
    muzzleFlashT -= dt;
    muzzleMat.uniforms.uIntensity.value = Math.max(0, muzzleFlashT / 0.045) * w.def.muzzleFlashScale;
    muzzleFlash.rotation.z += 20 * dt;
  } else {
    muzzleMat.uniforms.uIntensity.value = 0;
  }
  muzzleLight.intensity *= Math.max(0, 1 - dt * 30);
  const barrelTipLocal = new THREE.Vector3(0, 0.02, mesh.userData.muzzleZ ?? -0.62);
  muzzleFlash.position.copy(basePos).add(barrelTipLocal);
  muzzleLight.position.copy(muzzleFlash.position);
}

// -------------------- boot --------------------

resize();
applySettings();
initEscapeMenu();
els.loading.hidden = true;
animate();

