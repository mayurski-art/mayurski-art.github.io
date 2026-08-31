import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_BASE = 'assets/games/meme-metro/assets/models/';

// Registry of every loadable GLB, keyed by the same gameplay id used
// elsewhere (character id, obstacle id, powerup id, ...). This is the one
// place that corrects a placeholder model's scale/rotation/position/shadow
// behavior — managers just ask for a key and get a ready-to-add clone.
//
// Entries marked "not yet spawned" ship with the pack but have no gameplay
// hook wired up yet (no OBSTACLE_TYPES/POWERUPS entry references them).
// They still preload and are available via assetLoader.get() for when that
// content ships.
// `position: [0, y, 0]` lifts a model so its lowest vertex sits on y=0 —
// every placeholder's origin is at its geometric center, not its feet/base,
// so without this every model spawns sunk into the track by half its
// height. Values below are each model's own -minY (measured from its GLB
// bounding box); re-measure and update here if a replacement final model
// ships with a different pivot.
const MODELS = {
  // -- characters (ids match data/characters.js) --
  trollface: { file: 'character_trollface_runner.glb', scale: 1, position: [0, 1.13, 0], shadows: true },
  pepe: { file: 'character_pepe_runner.glb', scale: 1, position: [0, 0.52, 0], shadows: true },
  doge: { file: 'character_doge_runner.glb', scale: 1, position: [0, 1.13, 0], shadows: true },
  skyrunner: { file: 'character_tech_billionaire_rocket_runner.glb', scale: 1, position: [0, 0.50, 0], shadows: true },
  laserexec: { file: 'character_business_prophet_laser_runner.glb', scale: 1, position: [0, 1.20, 0], shadows: true },

  // -- obstacles (ids match data/obstacles.js OBSTACLE_TYPES) --
  tollGate: { file: 'obstacle_troll_toll_gate.glb', scale: 1, position: [0, 0.87, 0], shadows: true },
  rugPull: { file: 'obstacle_rug_pull_carpet.glb', scale: 1, position: [0, 1.19, 0], shadows: true },
  redCandle: { file: 'obstacle_red_candle_barrier.glb', scale: 1, position: [0, 0.15, 0], shadows: true },
  laserGate: { file: 'obstacle_laser_gate.glb', scale: 1, position: [0, 0.09, 0], shadows: true },
  bearTrain: { file: 'obstacle_bear_market_train.glb', scale: 1, position: [0, 1.87, 0], shadows: true },
  dogeBone: { file: 'obstacle_doge_bone_barrier.glb', scale: 1, position: [0, 0.57, 0], shadows: true },
  // not yet spawned:
  paperHands: { file: 'obstacle_paper_hands_barricade.glb', scale: 1, position: [0, 0.11, 0], shadows: true },
  fudFog: { file: 'obstacle_fud_fog_cloud.glb', scale: 1, position: [0, 0.45, 0] },
  rocketDebris: { file: 'obstacle_rocket_debris.glb', scale: 1, position: [0, 1.30, 0], shadows: true },
  scamBotDrone: { file: 'obstacle_scam_bot_drone.glb', scale: 1, position: [0, 0.49, 0], shadows: true },
  liquidityPit: { file: 'obstacle_liquidity_pool_pit.glb', scale: 1, position: [0, 0.81, 0] },
  nftFloorCrack: { file: 'obstacle_nft_floor_crack.glb', scale: 1, position: [0, 0.60, 0] },
  captchaDoor: { file: 'obstacle_captcha_door.glb', scale: 1, position: [0, 0.16, 0], shadows: true },
  pepeSwampPuddle: { file: 'obstacle_pepe_swamp_puddle.glb', scale: 1, position: [0, 0.55, 0] },

  // -- collectibles --
  trollCoin: { file: 'collectible_troll_coin.glb', scale: 1, position: [0, 0.11, 0], shadows: true },
  // not yet spawned:
  rareGoldCoin: { file: 'collectible_rare_gold_troll_coin.glb', scale: 1, position: [0, 0.11, 0], shadows: true },
  greenCandleToken: { file: 'collectible_green_candle_token.glb', scale: 1, position: [0, 0.19, 0] },

  // -- powerups (ids match data/powerups.js POWERUPS) --
  magnet: { file: 'powerup_troll_coin_magnet.glb', scale: 1, position: [0, 0.27, 0] },
  shield: { file: 'powerup_diamond_hands_shield.glb', scale: 1, position: [0, 0.15, 0] },
  rocket: { file: 'powerup_rocket_boost.glb', scale: 1, position: [0, 0.16, 0] },
  // not yet spawned:
  dogeDash: { file: 'powerup_doge_dash.glb', scale: 1, position: [0, 0.32, 0] },
  pepeCloak: { file: 'powerup_pepe_cloak.glb', scale: 1, position: [0, 0.31, 0] },
  laserFocus: { file: 'powerup_laser_focus.glb', scale: 1, position: [0, 1.25, 0] },
  hodlHelmet: { file: 'powerup_hodl_helmet.glb', scale: 1, position: [0, 0.38, 0] },

  // -- stage props --
  // Authored much taller (6 units) than the "flat tile" name suggests —
  // treat as an occasional side vignette rather than a lane-blocking prop.
  trackSegment: { file: 'stage_meme_metro_track_segment.glb', scale: 1, position: [0, 3.0, 0] },
  billboard: { file: 'stage_neon_crypto_billboard.glb', scale: 1, position: [0, 0.14, 0] },
};

// Loads, caches and clones GLB models. Gameplay code never touches
// GLTFLoader directly — it asks for a key and gets a decoration-only
// Object3D. Collision always stays on separate boxes/capsules defined in
// the data files, never on the visual mesh.
export class AssetLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.templates = new Map(); // key -> template Object3D (never added to a scene directly)
    this.failed = new Set();
  }

  // Preloads every registered model. Resolves once all keys have either
  // loaded or fallen back to a placeholder box — never rejects.
  async preloadAll(onProgress) {
    const keys = Object.keys(MODELS);
    let done = 0;
    await Promise.all(keys.map((key) => this.load(key).then(() => {
      done += 1;
      if (onProgress) onProgress(done, keys.length);
    })));
  }

  load(key) {
    if (this.templates.has(key)) return Promise.resolve(this.templates.get(key));
    const cfg = MODELS[key];
    if (!cfg) {
      this.failed.add(key);
      const fallback = this.buildFallback(key);
      this.templates.set(key, fallback);
      return Promise.resolve(fallback);
    }
    return new Promise((resolve) => {
      this.loader.load(
        MODEL_BASE + cfg.file,
        (gltf) => resolve(this.registerLoaded(key, cfg, gltf)),
        undefined,
        (err) => {
          console.warn(`[AssetLoader] failed to load "${key}" (${cfg.file}):`, err?.message || err);
          this.failed.add(key);
          const fallback = this.buildFallback(key);
          this.templates.set(key, fallback);
          resolve(fallback);
        },
      );
    });
  }

  registerLoaded(key, cfg, gltf) {
    const wrapper = new THREE.Group();
    const scene = gltf.scene;

    const s = cfg.scale ?? 1;
    scene.scale.set(...(Array.isArray(s) ? s : [s, s, s]));
    if (cfg.rotation) scene.rotation.set(...cfg.rotation);
    if (cfg.position) scene.position.set(...cfg.position);

    if (cfg.shadows) {
      scene.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
    }

    wrapper.add(scene);
    wrapper.userData.modelKey = key;
    this.templates.set(key, wrapper);
    return wrapper;
  }

  buildFallback(key) {
    const wrapper = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xff00ff }),
    );
    box.position.y = 0.5;
    wrapper.add(box);
    wrapper.userData.modelKey = key;
    wrapper.userData.isFallback = true;
    return wrapper;
  }

  // Fresh clone ready to add to the scene. Safe to call before preloadAll()
  // resolves (returns a placeholder box in that case) but callers should
  // preload up front so gameplay never has to swap a model mid-run.
  get(key) {
    const template = this.templates.get(key);
    if (!template) return this.buildFallback(key);
    return template.clone(true);
  }

  // True only when a real GLB loaded for this key (not a fallback box).
  has(key) {
    const template = this.templates.get(key);
    return !!template && !template.userData.isFallback;
  }
}

export const assetLoader = new AssetLoader();
