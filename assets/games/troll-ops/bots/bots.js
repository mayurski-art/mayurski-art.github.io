// Troll Forces — PvP bots.
//
// Lobbies will often have one or two real people, and an empty match is a
// mode nobody plays. Bots fill the room out.
//
// Exactly one client simulates them: the lowest peer id in the room is the
// bot host. It writes bot state into its own peer map (so its renderer treats
// them like anyone else) and broadcasts the same `state` messages everyone
// else already understands, so remote clients need no bot-specific code.

import * as THREE from "three";
import { groundHeightAt, resolveCircle } from "../core/movement.js?v=umb2-sb2-gj1b7-or1-gf1-tg1-rfx1";
import { segmentBlocked } from "../weapons/ballistics.js?v=cg1-wst-hf1-fu1b7-wb1-ar1-ar2-cl1-fj1-zr10-zc1-zc2-or1-gf1-tg1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416";
import { FlowField } from "./nav.js?v=ti1-bs1b7d-fl1-or1-gf1-tg1-tfb8";
import { clampInsidePolygon, insidePolygon } from "../maps/edge.js?v=or1";
import { botPerks, perkBits, PERK_TUNE } from "../progression/perks.js?v=pk1-cl1-bp1-fj1-zc1-zc2-nf1-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416";

// Every bot is just "bot" (user, 2026-10-30), so nobody takes one for a person.
const BOT_NAME = "bot";

const BOT_HP = 100;
const BOT_SPEED = 4.2;
const BOT_RADIUS = 0.36;
const BOT_HEIGHT = 1.8;
const CLIMB_HEADROOM = 1.2;       // on a stair (see update's resolveCircle)
const UPPER_NAV_CELL = 0.55;      // flow-field cell above the ground floor (BotManager navFor)
/* The ground floor's chase grid (BotManager baseFor "doors"): cells shut by
   their centre (nav.js blockBy "centre") with the bot's own radius as the
   margin, so an open cell is one a bot can stand in. A gap W is open for
   sure once W - 2 * radius >= the cell: a 1.2 m door at 0.4 m cells. Any
   less margin and the grid opens gaps a bot can't fit, and it stands
   pushing into one (Trolling Loud's back lot). A big map with its own
   coarse cell (arena.navCell >= 1, Troll Royale's island) keeps its one
   grid, so its fields stay the size they were. */
const GROUND_NAV_CELL = 0.4;
const NAV_PAD = BOT_RADIUS;
const NO_ROUTE_TIME = 4;          // seconds a bot leaves a goal it's walled off from
const SAME_LEVEL = 0.9;           // a goal this much higher or lower is on another floor: stairs
const RESPAWN = 5;

const SIGHT_RANGE = 45;
const FIRE_RANGE = 38;

/* Accuracy. A flat coin-flip regardless of range made bots equally lethal at
   3m and 38m, which reads as random rather than skilled. Instead they have to
   *acquire* a target: chance climbs the longer they hold someone in view and
   falls off with distance, so pushing them punishes and sniping them rewards
   the same way it would against a person. */
const ACQUIRE_TIME = 0.9;         // seconds of continuous sight to be fully on target
// Line-of-sight raycasts are the bots' biggest cost (every bot against every
// target), so each bot re-checks who it can see this often and keeps its
// pick in between. Well under a human's reaction time.
const SIGHT_RECHECK = 0.15;
const NEAR_RANGE = 8;             // at or under this, accuracy is at its best
const HEADSHOT_CHANCE = 0.12;

/* Aiming down sights. Bots used to shoot everything from the hip at the
   same accuracy. Now they scope in on anyone past arm's length (it takes
   diff.adsTime to come up), shoot better and walk slower while in, and come
   back out to reload, when someone's in their face (hip-fire is faster
   there), or a beat after losing sight (they check the corner first). */
const ADS_MIN_RANGE = 6;          // closer than this: hip-fire
const ADS_LINGER = [0.4, 0.9];    // seconds scoped after losing sight
const ADS_MOVE = 0.5;             // move speed while fully scoped
const HIP_AT_RANGE = 0.7;         // hip-fire accuracy past NEAR_RANGE
const ADS_AT_RANGE = 1.1;         // scoped accuracy past NEAR_RANGE

/* Magazines. Firing forever with no reload gave the fight no rhythm and no
   reason to push. */
const MAG_SIZE = 26;
const RELOAD_TIME = 2.3;
/* One in the Chamber (rules.oneShot, user 2026-10-14: the bots were firing
   over and over): a bot plays it like a player. One round and it's lethal;
   a hit buys it back (everyone dies to one, so a hit is a kill); dry, it's
   the knife until then, no reload and no sidearm. */
const ONE_SHOT_DAMAGE = 500;
const magFor = (rules) => (rules?.oneShot ? 1 : MAG_SIZE);

/* `hit`: the ceiling on hitChance below (fully acquired, close, standing
   still). `missSpread`: how far off the target a missed round goes, in
   metres [min, max] to one side, so a recruit's misses chew the wall a body
   width away while a veteran's crack past your ear (combat/bot-fire.js).
   `nade`: how keen a bot is to throw when it has a reason (chance per
   chance it gets), how far off its throws land (metres of scatter at 20 m),
   and whether it cooks frags so they go off on landing. */
const DIFFICULTY = {
  recruit:  { label: "Recruit",  hit: 0.28, missSpread: [0.9, 2.4], damage: 14, interval: 1.0, reaction: 0.45, strafe: 0.55, lead: 0.15, readsGuard: false, adsTime: 0.42,
    nade: { chance: 0.3, scatter: 3.2, cook: false }, jump: 0.05, slide: 0.05, knife: 0.35 },
  regular:  { label: "Regular",  hit: 0.37, missSpread: [0.6, 1.6], damage: 17, interval: 0.72, reaction: 0.28, strafe: 0.75, lead: 0.4, readsGuard: true, adsTime: 0.3,
    nade: { chance: 0.55, scatter: 1.9, cook: false }, jump: 0.12, slide: 0.12, knife: 0.45 },
  veteran:  { label: "Veteran",  hit: 0.55, missSpread: [0.4, 1.0], damage: 20, interval: 0.53, reaction: 0.16, strafe: 1.0, lead: 0.75, readsGuard: true, adsTime: 0.22,
    nade: { chance: 0.85, scatter: 1.0, cook: true }, jump: 0.2, slide: 0.2, knife: 0.6 },
};

/* Moving like a player (user: bots never jumped or slid). In a fight a bot
   rolls every MOVE_ROLL seconds for a hop or a slide (`jump` / `slide`
   above); a bot pinned against something low hops over it. */
const MOVE_ROLL = 0.5;
const HOP_SPEED = 5.4;            // m/s up, the player's jump
const HOP_GRAVITY = 16;
const SLIDE_TIME = 0.75;
const SLIDE_BOOST = 1.75;         // speed at the start of a slide, easing to 1
const STUCK_HOP = 0.6;            // seconds pushing into something before hopping it
const UNSTICK_AFTER = 3;          // the 3rd stuck in a row side-steps instead of hopping
const UNSTICK_TIME = 0.9;
const PROGRESS_WINDOW = 2.5;      // out of a fight, a bot that wanted to move this long...
const PROGRESS_MIN = 1.0;         // ...and got less than this far is stuck too
const DRIFT_WINDOW = 6;           // out of a fight, wanting to move and never this far from one spot
const DRIFT_MIN = 1.5;            // in that long: stuck too
const MOVE_COOLDOWN = 1.2;

/* Grenades. One lethal and one tactical a life, like a player's kit, rolled
   per life (lethal: frag; tactical: flash, smoke or EMP), and
   a cooldown between throws so a bot that keeps its reason (a camper
   behind the same wall) doesn't empty its pockets at it at once. */
const BOT_LETHALS = ["frag"];
const BOT_TACTICALS = ["flash", "smoke", "emp"];
const NADE_FIRST = [5, 10];       // seconds after spawning before the first throw
const NADE_COOLDOWN = [9, 15];
const BOT_WINDUP = 0.3;           // grenade up and the pin out before it goes (throw-anim THROW.PIN)
const NADE_RECHECK = 0.6;         // how often a bot looks for a reason
const NADE_MIN = 7;               // no closer: it would be standing in the blast
const NADE_MAX = 26;
const CLUSTER = 4.5;              // enemies this close together count as a group
const SEEN_MEMORY = 4;            // seconds a hidden target's last position stays useful
const CAMP_TIME = 4;              // seconds someone in sight holds one spot before they count as dug in
const CAMP_RADIUS = 2.5;          // metres: "one spot"
const between = ([a, b]) => a + Math.random() * (b - a);

/* Melee-only bots (Infection's infected): they run the target down and
   swing when they're in reach. */
const MELEE_REACH = 1.9;   // keyboard reach (gear.js range 2.0 from the eye), centre to centre
const MELEE_INTERVAL = 0.95;      // seconds between swings, scaled by skill below
const KNIFE_DAMAGE = 0.65;        // a gunner's swing: this share of the board's damage (DIFFICULTY `knife`: how often it lands)
export const DIFFICULTY_IDS = Object.keys(DIFFICULTY);

/* Taking the high ground (Bot.updatePerch): with nobody in sight, every
   PERCH_EVERY seconds a bot may (PERCH_CHANCE) head up a stair within
   PERCH_RANGE and hold the top for PERCH_HOLD seconds before hunting again. */
const PERCH_FIRST = [6, 14];
const PERCH_EVERY = [10, 20];
const PERCH_CHANCE = 0.35;
const PERCH_RANGE = 45;
const PERCH_HOLD = [4, 8];
const PERCH_GIVE_UP = 45;          // seconds to get there before it's dropped
const PERCH_NO_GAIN = 5;           // seconds without getting a metre closer before it's dropped

/* Posts (BotManager placesFor): with only stair tops to perch on and the
   nearest enemy to run at otherwise, bots spent 0-4% of a match off the
   ground floor and left whole districts empty (Hollowgrin's park, chapel,
   creek: HANDOFF "Small known gaps"). So each map gets a list of posts:
   spots across every upper floor a stair or rope reaches, and spots spread
   over the whole ground. With nobody in sight a bot takes a post now and
   then (POST_UP / POST_GROUND of its picks, the rest are hunts), favouring
   districts nobody's in, holds it (longer up high, where it fights from
   the edge rather than walking off it), then hunts or moves on. */
const POST_FIRST = [2, 7];
const POST_EVERY = [6, 12];        // seconds of hunting between posts
const POST_UP = 0.32;
const POST_GROUND = 0.28;
const POST_HOLD_UP = [4, 9];
const POST_HOLD_GROUND = [2, 5];
const POST_SPACING = 18;           // metres between ground posts (about)
const DISTRICT = 20;               // metres: the squares crowding is counted in
/* Bot-seconds spent in a district lately (fading by half a minute or so):
   a district this many bot-seconds warm counts half as much, so
   the ones nobody's been to come up. */
const POST_HEAT = 5;
const POST_HEAT_KEEP = 0.99;       // per half second: about a minute's half-life
const UPPER_Y = 1.5;               // feet this high: off the ground floor
const REST_HOLD = [5, 9];          // seconds sat in a pew or knelt at a rail (arena.botRests); longer cost Troll City a fifth of its kills
const POST_STILL = 4;              // holding a post, got under 1.5 m in this long: the hold ends

/* Anything tall standing at body height on this spot? */
/* A climb up or down a rope floor link (s.rope): the spot it hangs at is
   half a metre off the rope on the side its foot is. */
const BOT_ROPE_UP = 3.6, BOT_ROPE_DOWN = 5;
/* The height to read a bot's chase fields at. navFor rounds it to a 0.5 m
   level, and a level's field only has cells on floors within 0.45 of it;
   a bot on a stair's treads (or held there by navY) can round to a level
   that misses the floor it's actually on. Undergrin's 0.95 platforms: from
   a tread at 1.3 the 1.5 field has no platform, so no route, and the bot
   wandered off (the bot-stairs flake). So: the floor round here (the
   highest big surface at or under its feet within a metre or so: not a
   tread or a crate) wins when the rounded level would miss it. Anywhere
   the rounding already reaches that floor, nothing changes. */
const NAV_FLOOR_AREA = 3;            // m²: a stair tread or a crate is less
const NAV_FLOOR_REACH = 1.2;         // m round the bot
function navLevelAt(colliders, x, z, y) {
  const level = Math.round(y * 2) / 2;
  let floor = -Infinity;
  for (const c of colliders) {
    const top = c.max.y;
    if (top > y + 0.1 || top < y - 1 || top <= floor) continue;
    if (x < c.min.x - NAV_FLOOR_REACH || x > c.max.x + NAV_FLOOR_REACH || z < c.min.z - NAV_FLOOR_REACH || z > c.max.z + NAV_FLOOR_REACH) continue;
    if ((c.max.x - c.min.x) * (c.max.z - c.min.z) < NAV_FLOOR_AREA) continue;
    floor = top;
  }
  return floor > -Infinity && Math.abs(floor - level) > 0.45 ? floor : y;
}

function ropeClimb(s, entry, exit) {
  const len = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z) || 1;
  const dx = (s.b.x - s.a.x) / len, dz = (s.b.z - s.a.z) / len;
  return { entry, exit, rope: s, t: 0, limit: Math.abs(exit.y - entry.y) / BOT_ROPE_UP + 6,
    hx: s.rx - dx * 0.5, hz: s.rz - dz * 0.5, on: false };
}

function resolveBlocked(colliders, x, z, feetY) {
  for (const c of colliders) {
    if (c.max.y <= feetY + 0.45 || c.min.y >= feetY + 1.7) continue;
    if (x > c.min.x - BOT_RADIUS && x < c.max.x + BOT_RADIUS && z > c.min.z - BOT_RADIUS && z < c.max.z + BOT_RADIUS) return true;
  }
  return false;
}

/* Is target `t` holding a saber guard that faces `from`? Targets carry
   `blocking` (bool), `yaw` and `blockCone` (the saber's deflect.cone,
   a dot product against their facing). Forward at yaw 0 is -Z. */
function isGuarding(t, from) {
  if (!t.blocking) return false;
  const dx = from.x - t.pos.x, dz = from.z - t.pos.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-3) return true;
  const yaw = t.yaw || 0;
  return (dx * -Math.sin(yaw) + dz * -Math.cos(yaw)) / len >= (t.blockCone ?? 0.26);
}

/* Bots carry real guns from the roster rather than all reporting problem416,
   so the killfeed says something true about how you died. */
const BOT_WEAPONS = ["problem416", "snubgrin", "snicker", "kek", "trollboy", "sneer", "mald", "cackle"];

// Everyone also carries a sidearm and draws it the instant the primary runs
// dry rather than standing there reloading in a firefight - the same reason
// a player reaches for 2 instead of holding R with someone shooting at them.
const BOT_SIDEARMS = ["sixtynine", "true69", "peacemakers"];
// About one bot in five carries the FHJ-18 AA instead (FHJ18.md): it's for
// enemy air only (combat/bot-fire.js updateBotAntiAir), six missiles a life,
// and a dry rifle in a firefight is reloaded, not swapped for it.
export const BOT_AA_MISSILES = 6;
const SIDEARM_MAG_SIZE = 12;
const SIDEARM_RELOAD_TIME = 1.5;
// Drawing it takes a beat, as yours does: no shot the instant it comes out.
const SIDEARM_DRAW = 0.3;
// Caught mid-reload by someone this close (user, 2026-10-29), with more than
// SWAP_MIN_LEFT of the reload still to go: the sidearm, not the rest of the
// reload. The reload is lost, as yours is when you swap.
const SWAP_RANGE = 14;
const SWAP_MIN_LEFT = 0.6;

let counter = 0;

class Bot {
  /* Its secondary is the FHJ-18 (Troll Royale and the like swap it out). */
  get launcher() { return this.secondaryId === "fhj18"; }

  /* Rounds left to load into the primary / the sidearm. */
  get canReload() { return this.reserve == null || this.reserve > 0; }
  get sidearmCanReload() { return this.sidearmReserve == null || this.sidearmReserve > 0; }
  /* A sidearm with a shot in it or one to load (the FHJ-18 is for aircraft). */
  get sidearmLive() { return !this.launcher && (this.sidearmAmmo > 0 || this.sidearmCanReload); }
  /* Nothing in either gun and nothing to load: the knife, and a gun off the
     floor (royale.js botWants). Never in a bottomless mode. */
  get dry() { return this.ammo <= 0 && !this.canReload && !this.sidearmLive; }
  /* The primary's rounds, magazine and reserve (Infinity when bottomless). */
  get primaryRounds() { return this.reserve == null ? Infinity : this.ammo + this.reserve; }

  /* A gun picked up with `total` rounds in it, magazine first. */
  loadGun(total) {
    this.reloadT = 0;
    this.ammo = Math.min(magFor(this.rules), Math.max(0, total | 0));
    this.reserve = Math.max(0, (total | 0) - this.ammo);
  }
  loadSidearm(total) {
    this.sidearmReloadT = 0;
    this.sidearmAmmo = Math.min(SIDEARM_MAG_SIZE, Math.max(0, total | 0));
    this.sidearmReserve = Math.max(0, (total | 0) - this.sidearmAmmo);
  }
  /* A reload done: the magazine filled from the reserve, if it's counted. */
  finishReload() {
    const mag = magFor(this.rules);
    if (this.reserve == null) { this.ammo = mag; return; }
    const take = Math.min(this.reserve, mag - this.ammo);
    this.ammo += take;
    this.reserve -= take;
  }
  finishSidearmReload() {
    if (this.sidearmReserve == null) { this.sidearmAmmo = SIDEARM_MAG_SIZE; return; }
    const take = Math.min(this.sidearmReserve, SIDEARM_MAG_SIZE - this.sidearmAmmo);
    this.sidearmAmmo += take;
    this.sidearmReserve -= take;
  }

  constructor(team, spawn, difficulty = "regular", rules = {}) {
    this.rules = rules;   // the BotManager's, shared: the match's mode rules
    this.id = `bot-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    this.name = BOT_NAME;
    this.team = team;
    this.isBot = true;
    // A mode can fix the tier (Troll Royale: rules.skill, match-start.js beginMatch).
    this.skill = DIFFICULTY[rules.skill] ? rules.skill : DIFFICULTY[difficulty] ? difficulty : "regular";
    this.diff = DIFFICULTY[this.skill];
    this.weaponId = BOT_WEAPONS[counter % BOT_WEAPONS.length];
    this.secondaryId = counter % 5 === 0 ? "fhj18" : BOT_SIDEARMS[counter % BOT_SIDEARMS.length];
    this.aaMissiles = BOT_AA_MISSILES;
    this.holdingSecondary = false;
    this.sidearmAmmo = SIDEARM_MAG_SIZE;
    this.sidearmReloadT = 0;
    // Rounds left to reload from: null = bottomless, as every mode but Troll
    // Royale has it (royale.js loads them from what's picked up: loadGun).
    this.reserve = null;
    this.sidearmReserve = null;
    this.hp = BOT_HP;
    this.alive = true;
    this.kills = 0;
    this.deaths = 0;
    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.pitch = 0;
    this.groundY = 0;
    this.fireT = Math.random() * this.diff.interval;
    this.respawnT = 0;
    this.wander = new THREE.Vector3();
    this.wanderT = 0;
    this.moving = false;   // real ground speed, not "has steering input" — see update()
    this.ammo = magFor(rules);
    this.reloadT = 0;
    this.ads = 0;             // 0 = hip, 1 = fully scoped (see ADS_* above)
    this.adsLingerT = 0;
    this.acquireT = 0;        // how long the current target has been in view
    this.lastTargetId = null;
    this.roam = null;         // a point to head for when nobody is visible
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 1 + Math.random() * 1.5;
    this.flinchT = 0;         // briefly turns/steps off-line after taking a hit
    this.prevTargetPos = null;    // for velocity-based lead
    this.targetVel = new THREE.Vector3();
    this.resetNades();
    // Infection: set by game.js when the bot turns. Speed and health scale
    // with it; the sword is all it has.
    this.meleeOnly = false;
    this.speedMult = 1;
    this.maxHp = BOT_HP;
    // Its class perks, for the whole match (perks.js botPerks).
    this.perks = botPerks(this.id);
    this.perkBits = perkBits(this.perks);
    this.perkSpeed = (this.perks.has("lightweight") ? PERK_TUNE.lightweightSpeed : 1)
      * (this.perks.has("extremeconditioning") ? PERK_TUNE.extremeSprint : 1);
    this.meleeT = 0;
    this.resetMoves();
  }

  resetMoves() {
    this.hopY = 0;            // height of a hop above groundY
    this.hopV = 0;
    this.slideT = 0;
    this.slideDir = new THREE.Vector3();
    this.moveRollT = MOVE_ROLL;
    this.moveCd = 0;
    this.stuckT = 0;
    this.stuckHops = 0;       // stuck hops in a row that got nowhere
    this.progress = null;     // { x, z, t }: where the current progress window started
    this.unstickT = 0;        // side-stepping off something a hop can't clear
    this.unstickDir = new THREE.Vector3();
    this.wantSlide = false;
    this.stance = "stand";    // on the wire (net.js publishBot)
  }

  startHop() {
    if (this.hopY > 0 || this.hopV > 0 || this.slideT > 0 || this.climb?.on) return;
    this.hopV = HOP_SPEED;
    this.moveCd = MOVE_COOLDOWN;
  }

  startSlide(dir) {
    if (this.hopY > 0 || this.slideT > 0 || dir.lengthSq() < 0.01 || this.climb?.on) return;
    this.slideT = SLIDE_TIME;
    this.slideDir.set(dir.x, 0, dir.z).normalize();
    this.moveCd = MOVE_COOLDOWN;
  }

  resetNades() {
    // `frags` / `flashes` count the lethal / tactical, whatever kind it is.
    this.lethalKind = BOT_LETHALS[Math.floor(Math.random() * BOT_LETHALS.length)];
    this.tacticalKind = BOT_TACTICALS[Math.floor(Math.random() * BOT_TACTICALS.length)];
    this.frags = 1;
    this.flashes = 1;
    this.nadeT = between(NADE_FIRST);
    this.lastSeen = null;     // { id, x, y, z, age } of the last enemy in sight
    this.camp = null;         // { id, x, z, t }: how long the one in sight has held one spot
  }

  respawn(spawn) {
    this.rest = null;
    this.pos.set(spawn.x, 0, spawn.z);
    this.climb = null;
    this.windup = null;   // a throw cut short by dying
    this.throwCk = null;
    this.vel.set(0, 0, 0);
    this.hp = this.maxHp || BOT_HP;
    this.alive = true;
    this.groundY = 0;
    this.ammo = magFor(this.rules);
    if (this.rules.oneShot) this.meleeOnly = false;
    this.reloadT = 0;
    this.holdingSecondary = false;
    this.aaMissiles = BOT_AA_MISSILES;
    this.aaUp = false;
    this.sidearmAmmo = SIDEARM_MAG_SIZE;
    this.sidearmReloadT = 0;
    this.reserve = null;
    this.sidearmReserve = null;
    this.ads = 0;
    this.adsLingerT = 0;
    this.acquireT = 0;
    this.lastTargetId = null;
    this.roam = null;
    this.perch = null;
    this.perchT = between(POST_FIRST);
    this.stairPlan = null;
    this.noRoute = null;
    this.navY = null;
    this.navLevel = null;
    this.stuckTotal = 0;
    this.flinchT = 0;
    this.stunT = 0;
    this.prevTargetPos = null;
    this.resetNades();
    this.resetMoves();
  }

  /* Called when a shot connects on this bot. Real players flinch off-line
     immediately — that's the difference between a bot that eats a flank in
     silence and one that reacts like it's actually being shot at. */
  onDamaged() {
    this.standUp();
    this.hurtAt = performance.now();
    this.flinchT = 0.35 + Math.random() * 0.25;
    this.strafeDir = -this.strafeDir;
    // Sometimes the answer to being shot is to drop into a slide.
    if (Math.random() < this.diff.slide * 1.5) this.wantSlide = true;
  }

  /* Flashbanged or scrambled. Bots were handed to flashPlayer/empPlayer as
     their RemotePlayer render proxy, which has no stun(), so a flash at a
     bot's feet did nothing at all. Blinded bots lose their target, can't
     fire, and stumble instead of strafing. */
  stun(seconds) {
    if (this.perks.has("tacticalmask")) seconds *= PERK_TUNE.tacticalMask;
    this.stunT = Math.max(this.stunT || 0, seconds);
    this.acquireT = 0;
    this.adsLingerT = 0;      // blinded: out of the scope
    this.lastTargetId = null;
  }

  /* Chance to land a shot right now: better the closer they are and the
     longer they've been tracked, with the difficulty tier setting the ceiling.
     A target strafing hard is genuinely harder to hit — how much harder
     depends on the bot's `lead` skill, so a veteran tracks a juking player
     far better than a recruit does, the same gap a real skill difference
     would produce. */
  hitChance(range) {
    const acquired = Math.min(1, this.acquireT / ACQUIRE_TIME);
    const falloff = range <= NEAR_RANGE
      ? 1
      : Math.max(0.25, 1 - (range - NEAR_RANGE) / (FIRE_RANGE - NEAR_RANGE) * 0.75);
    const targetSpeed = this.targetVel ? this.targetVel.length() : 0;
    const evasion = Math.min(1, targetSpeed / 6) * (1 - this.diff.lead) * 0.5;
    // Past close range, the scope is the difference: hip-fire sprays.
    const sights = range <= NEAR_RANGE ? 1 : HIP_AT_RANGE + (ADS_AT_RANGE - HIP_AT_RANGE) * this.ads;
    return this.diff.hit * falloff * (0.35 + 0.65 * acquired) * (1 - evasion) * sights;
  }

  update(dt, ctx) {
    const { colliders, arena, targets, onShoot, ffa, navFor, sightBlocked } = ctx;

    if (!this.alive) {
      this.respawnT -= dt;
      return;
    }
    // Troll Royale's sky lobby, bus and drop move this bot (royale-drop.js
    // via game.js): no AI, no physics until it lands.
    if (this.airborne) return;
    this.clock = (this.clock || 0) + dt;

    // Mode objective (a hill, a bomb site) and whether the mode has this bot
    // pinned in place mid-plant/defuse. Both optional — TDM passes neither.
    const objective = ctx.objectiveFor?.(this) || null;
    const busy = !!ctx.isBusy?.(this);
    const stunned = this.stunT > 0;
    if (stunned) this.stunT -= dt;

    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload();
    }
    if (this.rules.oneShot) {
      // any kill buys the round back, the knife's too
      if ((this.kills | 0) > (this.oneShotKills | 0)) this.ammo = 1;
      this.oneShotKills = this.kills | 0;
      this.meleeOnly = this.ammo <= 0;
    }

    // --- pick the nearest visible enemy, and the nearest enemy overall
    const eye = new THREE.Vector3(this.pos.x, this.groundY + 1.5, this.pos.z);
    const sightRange = ctx.sightRange ? ctx.sightRange(this) : SIGHT_RANGE;
    let best = null, bestD = Infinity;         // visible
    let lead = null, leadD = Infinity;         // visible or not — who to walk toward
    this.sightT = (this.sightT ?? Math.random() * SIGHT_RECHECK) - dt;
    const rescan = this.sightT <= 0;
    if (rescan) this.sightT = SIGHT_RECHECK * (0.8 + Math.random() * 0.4);
    for (const t of targets) {
      if (!t.alive) continue;
      if (t.id === this.id) continue;
      if (!ffa && t.team === this.team) continue;
      const d = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
      // One it's walled off from (steerTo) isn't worth walking toward for a bit.
      const walledOff = this.noRoute && this.noRoute.id === t.id && this.clock < this.noRoute.until;
      if (d < leadD && !walledOff) { lead = t; leadD = d; }
      if (stunned) continue;     // blind: knows roughly where people are, sees nobody
      if (d > sightRange || d >= bestD) continue;
      // Between checks: stay on whoever the last one found.
      if (!rescan) { if (t.id === this.seenId) { best = t; bestD = d; } continue; }
      const theirEye = new THREE.Vector3(t.pos.x, (t.groundY ?? t.pos.y ?? 0) + 1.4, t.pos.z);
      if (segmentBlocked(colliders, eye, theirEye)) continue;
      // Smoke and the like: opaque to bots exactly as it is to players.
      if (sightBlocked?.(eye, theirEye)) continue;
      best = t; bestD = d;
    }

    if (rescan) this.seenId = best?.id ?? null;

    // Sight has to be held to be worth anything; losing it resets the aim.
    if (best && best.id === this.lastTargetId) this.acquireT += dt;
    else this.acquireT = 0;
    this.lastTargetId = best?.id ?? null;

    // Track target velocity for lead-aim, and let a flinch from a recent hit
    // fade out over time.
    if (best) {
      if (this.prevTargetPos) {
        this.targetVel.set(
          (best.pos.x - this.prevTargetPos.x) / Math.max(dt, 1e-3),
          0,
          (best.pos.z - this.prevTargetPos.z) / Math.max(dt, 1e-3),
        );
        this.prevTargetPos.copy(best.pos);
      } else {
        this.prevTargetPos = best.pos.clone();
      }
    } else {
      this.prevTargetPos = null;
      this.targetVel.set(0, 0, 0);
    }
    if (this.flinchT > 0) this.flinchT -= dt;
    if (this.retreatT > 0) this.retreatT -= dt;

    if (best) this.lastSeen = { id: best.id, x: best.pos.x, y: best.groundY ?? best.pos.y ?? 0, z: best.pos.z, age: 0 };
    else if (this.lastSeen) this.lastSeen.age += dt;
    if (best) {
      const c = this.camp;
      if (c && c.id === best.id && Math.hypot(best.pos.x - c.x, best.pos.z - c.z) < CAMP_RADIUS) c.t += dt;
      else this.camp = { id: best.id, x: best.pos.x, z: best.pos.z, t: 0 };
    } else this.camp = null;

    // A Trollsaber guard turned on us bats every round away: shooting into
    // it only drains their meter a little. Smarter bots stop feeding it and
    // work round the side or throw something the blade can't stop.
    const guarded = !!best && isGuarding(best, this.pos);
    if (guarded && !this.guarded) {
      this.guardT = 0;
      this.strafeDir = Math.random() < 0.5 ? 1 : -1;
      // Reach for a grenade soon, unless one just went.
      if (this.lastThrowAt == null || performance.now() - this.lastThrowAt > 6000) this.nadeT = Math.min(this.nadeT, 0.35 + this.diff.reaction * 2);
    }
    this.guarded = guarded;
    if (guarded) this.guardT += dt;
    // Recruits never catch on; the others after a round or two bounces off.
    const respectGuard = guarded && this.diff.readsGuard && this.guardT > this.diff.reaction * 2;

    // --- grenades
    // A throw winds up first: the arm comes up and the pin comes out (its
    // `ck` on the wire, combat/throw-anim.js), then the grenade goes.
    if (this.windup) {
      const w = this.windup;
      w.t += dt;
      this.throwCk = `${w.t < 0.12 ? 1 : w.t < BOT_WINDUP ? 2 : 3}:${Math.round(w.t * 10)}:${w.kind}`;
      this.fireT = Math.max(this.fireT, 0.2);
      if (w.t >= BOT_WINDUP || !this.alive || stunned) {
        this.windup = null;
        this.throwCk = null;
        if (this.alive && !stunned && ctx.onThrow?.(this, w.kind, w.at, w.lob)) {
          if (w.kind === this.lethalKind) this.frags--; else this.flashes--;
          this.nadeT = between(NADE_COOLDOWN);
          if (w.kind === "smoke") this.retreatT = 3;
          this.lastThrowAt = performance.now();
          // A beat with the hand busy: no shot goes off mid-throw.
          this.fireT = Math.max(this.fireT, 0.45);
        } else this.nadeT = NADE_RECHECK;
      }
    } else if (ctx.onThrow && !this.meleeOnly && !busy && !stunned && (this.frags > 0 || this.flashes > 0)) {
      this.nadeT -= dt;
      if (this.nadeT <= 0) {
        const plan = this.planThrow(targets, ffa, colliders, eye, best, objective);
        if (!plan) this.nadeT = NADE_RECHECK;
        else if (Math.random() > this.diff.nade.chance) this.nadeT = 2 + Math.random() * 2;   // let it go this time
        else {
          const s = this.diff.nade.scatter * Math.min(1.5, plan.dist / 20);
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * s;
          const at = { x: plan.x + Math.cos(a) * r, y: plan.y, z: plan.z + Math.sin(a) * r };
          this.windup = { t: 0, kind: plan.kind, at, lob: plan.lob };
        }
      }
    }

    // Up out of the pew (or off its knees) the moment there's anything
    // else to do: someone in sight, the mode wants it, the post's gone.
    if (this.rest && (best || busy || objective || this.perch?.rest !== this.rest)) this.standUp();

    // --- steer
    let desired;
    const objD = objective ? Math.hypot(objective.x - this.pos.x, objective.z - this.pos.z) : Infinity;
    if (busy) {
      // Planting or defusing: rooted to the spot, eyes on whoever's coming.
      desired = new THREE.Vector3();
      if (best) this.yaw = Math.atan2(-(best.pos.x - this.pos.x), -(best.pos.z - this.pos.z));
    } else if (stunned) {
      // Staggering: a slow drift, no juke — the window a flash is meant to buy.
      desired = this.wanderStep(dt).multiplyScalar(0.3);
    } else if (best && this.meleeOnly && (this.climb || Math.abs((best.groundY ?? best.pos.y ?? 0) - this.groundY) >= SAME_LEVEL)) {
      // Up on a floor above (or below) us: a sword can't reach from here,
      // so take the stairs to them.
      desired = this.steerTo(best.id, best, ctx);
      this.yaw = Math.atan2(-desired.x, -desired.z);
    } else if (best && this.meleeOnly) {
      // Straight at them with a slight weave, all the way in: a sword has
      // no comfortable range to hold.
      this.yaw = Math.atan2(-(best.pos.x - this.pos.x), -(best.pos.z - this.pos.z));
      const toTarget = new THREE.Vector3(best.pos.x - this.pos.x, 0, best.pos.z - this.pos.z).normalize();
      const weave = Math.sin(performance.now() * 0.004 + this.strafeDir) * 0.35;
      desired = bestD < MELEE_REACH * 0.7
        ? new THREE.Vector3()
        : toTarget.addScaledVector(new THREE.Vector3(-toTarget.z, 0, toTarget.x), weave).normalize();
    } else if (best) {
      this.yaw = Math.atan2(-(best.pos.x - this.pos.x), -(best.pos.z - this.pos.z));
      // The next post comes round in a fight too: on a small busy map
      // (Depot: someone in sight nine tenths of the time) a bot that only
      // picked one out of contact never went anywhere but where it met them.
      // At half the pace, so most fights are still fought where they start.
      if (!this.perch && !objective && ctx.places?.all.length) this.updatePerch(dt * 0.5, ctx);
      // Close to a comfortable range rather than walking into their face,
      // and strafe laterally the whole time — a bot that holds still while
      // trading shots reads as scripted, not skilled. Flip strafe direction
      // periodically (and instantly on taking a hit) so it isn't a metronome.
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeT = 0.6 + Math.random() * 1.2;
        if (Math.random() < 0.5) this.strafeDir = -this.strafeDir;
      }
      const toTarget = new THREE.Vector3(best.pos.x - this.pos.x, 0, best.pos.z - this.pos.z);
      // Dropped on the same spawn point as who it's fighting (a busy FFA on
      // an 8-spawn map like Dust Bowl): the offset is zero, so are both
      // vectors built from it, and the two stood on one spot all match.
      // Any heading of their own gets them apart, and they back off from there.
      if (toTarget.lengthSq() < 0.01) {
        this.splitA ??= Math.random() * Math.PI * 2;
        toTarget.set(Math.cos(this.splitA), 0, Math.sin(this.splitA));
      }
      toTarget.normalize();
      const lateral = new THREE.Vector3(-toTarget.z, 0, toTarget.x).multiplyScalar(this.strafeDir);
      // Someone coming in with a sword gets kited: back off while shooting,
      // since standing to trade is exactly what they want.
      // Just smoked themselves: back off in it.
      let closeSign = this.retreatT > 0 ? -1 : best.melee ? (bestD < 14 ? -1 : 0) : bestD > 12 ? 1 : (bestD < 6 ? -1 : 0);
      // Nothing left to shoot: in for the keyboard (unless the mode's
      // objective, a gun on the floor, wants it elsewhere: below).
      if (this.dry) closeSign = 1;
      // Up on a floor over them: hold the high ground, don't walk off it
      // to close the range.
      if (this.groundY >= UPPER_Y && this.groundY - (best.groundY ?? best.pos.y ?? 0) > 1.2) closeSign = Math.min(closeSign, 0);
      desired = toTarget.multiplyScalar(closeSign * 0.6)
        .addScaledVector(lateral, this.diff.strafe)
        .normalize();
      // An objective that can't wait (Troll Royale: the Cringe burning them,
      // or a gun an unarmed bot needs): keep shooting, but keep moving there,
      // by the flow field so walls don't pin them.
      if (objective?.urgent) {
        const toward = this.steerTo(objective.id, objective, ctx);
        desired = toward.addScaledVector(lateral, 0.35).normalize();
      } else if (this.climb) {
        // Halfway up a stair: keep going while shooting, rather than strafe
        // off the side of it.
        const dir = this.climbStep(ctx);
        if (dir) desired = dir.addScaledVector(lateral, 0.15).normalize();
      } else if (this.perch && !this.perch.arrived && ctx.places?.all.length && !this.arrivePerch()) {
        // On its way to a post (a balcony, a far district): it keeps going
        // while it shoots, or a busy map's fights hold everyone on the
        // ground where they met.
        const toward = this.steerTo(this.perch.id, this.perch, ctx);
        desired = toward.multiplyScalar(0.85).addScaledVector(lateral, 0.4).normalize();
        if (this.noRoute?.id === this.perch.id) { this.perchFail = this.perch.id; this.perch = null; }
      } else if (this.flinchT > 0.15) {
        // A fresh flinch briefly overrides strafing with a hard juke off-line —
        // the instinctive first move a real player makes under fire.
        desired = lateral.clone().normalize();
      } else if (respectGuard) {
        // Flank: all-out sideways, one way (no strafe flips), backing off a
        // touch if they're close enough to lunge.
        desired = lateral.clone().normalize();
        if (bestD < 8) {
          const away = new THREE.Vector3(this.pos.x - best.pos.x, 0, this.pos.z - best.pos.z).normalize();
          desired.addScaledVector(away, 0.5).normalize();
        }
        this.strafeT = Math.max(this.strafeT, 0.5);
      }
      if (!objective?.urgent) desired = this.keepFooting(desired, ctx);
    } else if (objective && objD > objective.radius) {
      // Nobody in sight and the mode wants us somewhere — go there before
      // hunting. Without this KotH bots never stood on the hill and S&D
      // bots never went near a site.
      desired = this.steerTo(objective.id, objective, ctx);
      this.yaw = Math.atan2(-desired.x, -desired.z);
    } else if (objective) {
      // On the objective: hold it, shuffling a little and scanning the
      // approaches rather than staring at one wall.
      desired = this.wanderStep(dt).multiplyScalar(objective.radius > 2 ? 0.35 : 0);
      this.yaw += dt * 0.9 * this.strafeDir;
    } else if (!this.meleeOnly && this.updatePerch(dt, ctx)) {
      // Taking the high ground for a while (updatePerch): up there, then
      // hold it, turning to watch the approaches.
      const p = this.perch;
      if (p.rest && this.arrivePerch()) {
        // A pew or the rail (arena.botRests): sat or knelt there, still,
        // facing the altar, till the hold's up (pinned below, by the physics).
        if (!this.rest) { this.rest = p.rest; p.hold = between(REST_HOLD); }
        desired = new THREE.Vector3();
        this.yaw = p.rest.yaw;
        if ((p.hold -= dt) <= 0) { this.standUp(); this.perch = null; }
      } else if (this.arrivePerch()) {
        // Holding it: shuffling about the spot, looking round, the way a
        // KotH bot holds a hill (stood dead still it read as a frozen bot,
        // the gate's bots step among them), never off the edge up high.
        const back = Math.hypot(p.x - this.pos.x, p.z - this.pos.z) > 3;
        if (back) { this.wander.set(p.x - this.pos.x, 0, p.z - this.pos.z).normalize(); this.wanderT = Math.max(this.wanderT, 0.5); }
        desired = this.keepFooting(this.wanderStep(dt).multiplyScalar(0.35), ctx);
        p.hold -= dt;
        // Boxed in where the shuffle can only rub a wall (a cramped landing
        // in Hollowgrin's manor): too slow for the jam check below, so the
        // hold ends early rather than read as a frozen bot.
        const still = p.still || (p.still = { x: this.pos.x, z: this.pos.z, t: 0 });
        if ((still.t += dt) > POST_STILL) {
          if (Math.hypot(this.pos.x - still.x, this.pos.z - still.z) < 1.5) p.hold = 0;
          p.still = null;
        }
        if (p.hold <= 0) this.perch = null;
      } else {
        desired = this.steerTo(p.id, p, ctx);
        this.yaw = Math.atan2(-desired.x, -desired.z);
        if (this.noRoute?.id === p.id) { this.perch = null; this.perchFail = p.id; }   // can't get there from here
      }
    } else if (lead) {
      // Nobody in sight: walk the flow field toward the nearest enemy rather
      // than straight at them. Straight-line steering is fine on an open
      // arena and useless the moment a map has interior walls — the bot
      // grinds against one until the target happens to come round it.
      const step = this.steerTo(lead.id, lead.pos, ctx, true);
      if (step) {
        desired = step;
        this.yaw = Math.atan2(-desired.x, -desired.z);
      } else {
        desired = this.wanderStep(dt);
      }
    } else {
      desired = this.wanderStep(dt);
    }

    // --- hop and slide, like a player. In a fight a few rolls a second;
    // taking a hit can queue a slide; pinned on something low, hop it.
    const grounded = this.hopY <= 0 && this.hopV <= 0;
    this.moveCd = Math.max(0, this.moveCd - dt);
    if (best && !busy && !stunned && grounded && this.slideT <= 0 && this.moveCd <= 0) {
      this.moveRollT -= dt;
      if (this.wantSlide && this.moving) { this.wantSlide = false; this.startSlide(this.vel); }
      else if (this.moveRollT <= 0) {
        // Troll Royale (rules.calm): a hundred bots in fights all over the
        // island hopping and sliding every couple of seconds read as heads
        // bobbing nonstop (user, 2026-10-18), so a roll there is every 2.5 s.
        this.moveRollT = this.rules.calm ? MOVE_ROLL * 5 : MOVE_ROLL;
        const r = Math.random();
        if (r < this.diff.jump) this.startHop();
        else if (r < this.diff.jump + this.diff.slide && this.moving) this.startSlide(this.vel);
      }
    }
    if (this.unstickT > 0 && !busy) {
      this.unstickT -= dt;
      desired = this.unstickDir.clone();
    }
    if (this.slideT > 0) {
      this.slideT -= dt;
      desired = this.slideDir.clone();
      if (this.slideT <= 0) this.slideT = 0;
    }
    this.stance = this.rest ? this.rest.act : this.climb?.on ? "rope" : this.slideT > 0 ? "slide" : "stand";

    // Wading (a map's shallow water, arena.wade) slows them like it slows you.
    const wading = arena.wade && this.pos.y < 0.5 && insidePolygon(arena.wade, this.pos.x, this.pos.z);
    const slideBoost = this.slideT > 0 ? 1 + (SLIDE_BOOST - 1) * (this.slideT / SLIDE_TIME) : 1;
    const speed = BOT_SPEED * (this.speedMult || 1) * this.perkSpeed * (wading ? 0.6 : 1) * slideBoost
      * (this.slideT > 0 ? 1 : 1 - (1 - ADS_MOVE) * this.ads);
    const turn = this.slideT > 0 || !grounded ? 1.5 : 5;   // committed in a slide or a hop
    this.vel.x += (desired.x * speed - this.vel.x) * Math.min(1, dt * turn);
    this.vel.z += (desired.z * speed - this.vel.z) * Math.min(1, dt * turn);
    const wasX = this.pos.x, wasZ = this.pos.z;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    this.pos.x = Math.max(arena.minX + BOT_RADIUS, Math.min(arena.maxX - BOT_RADIUS, this.pos.x));
    this.pos.z = Math.max(arena.minZ + BOT_RADIUS, Math.min(arena.maxZ - BOT_RADIUS, this.pos.z));
    const edge = arena.botEdge || arena.edge;   // (maps.js: the bots' own edge, if the map has one)
    if (edge) clampInsidePolygon(this.pos, edge, BOT_RADIUS);
    // On a stair, ducking under the floor above where the flight passes
    // through its stairwell: the slab's edge is lower than head height
    // part of the way (the U Mad Mansion's), and caught the bots there.
    resolveCircle(colliders, this.pos, BOT_RADIUS, this.groundY + this.hopY, this.climb ? CLIMB_HEADROOM : BOT_HEIGHT, 0.5);

    // Pushing into something and getting nowhere: hop it. Something a hop
    // doesn't clear (a 1.2 m bank, a stair's side) got hopped at forever, so
    // after a couple of hops that went nowhere the bot side-steps along it
    // for a moment instead, and drops whatever plan walked it there.
    const wantMove = desired.lengthSq() > 0.25;
    const got = Math.hypot(this.pos.x - wasX, this.pos.z - wasZ) / Math.max(dt, 1e-3);
    this.stuckT = wantMove && got < 0.6 && grounded ? this.stuckT + dt : 0;
    // And over a longer stretch: jittering in a corner moves every frame and
    // gets nowhere. Only out of a fight, where strafing on the spot is fine.
    let jammed = false;
    if (wantMove && !best && !busy && this.unstickT <= 0) {
      const p = this.progress || (this.progress = { x: this.pos.x, z: this.pos.z, t: 0 });
      p.t += dt;
      if (p.t > PROGRESS_WINDOW) {
        const moved = Math.hypot(this.pos.x - p.x, this.pos.z - p.z);
        jammed = moved < PROGRESS_MIN;
        if (moved > PROGRESS_MIN * 2) this.stuckHops = 0;
        this.progress = null;
      }
      // And over a few windows: back and forth a metre each way passes
      // every window above and still goes nowhere (a bot on Hollowgrin's
      // railed park deck, 9 m up, did it till the bots step flagged it).
      const q = this.drift || (this.drift = { x: this.pos.x, z: this.pos.z, t: 0 });
      q.t += dt;
      if (Math.hypot(this.pos.x - q.x, this.pos.z - q.z) > DRIFT_MIN) this.drift = null;
      else if (q.t > DRIFT_WINDOW && !this.climb) {
        // a hop won't end a loop: side-step and plan afresh
        jammed = true; this.drift = null;
        this.stuckHops = Math.max(this.stuckHops || 0, UNSTICK_AFTER - 1);
      }
    } else {
      this.progress = null;
      this.drift = null;
      if (grounded && got > 1.5 && this.unstickT <= 0) this.stuckHops = 0;
    }
    if (this.stuckT > STUCK_HOP || jammed) {
      this.stuckT = 0;
      this.stuckHops = (this.stuckHops || 0) + 1;
      this.stuckTotal = (this.stuckTotal || 0) + 1;   // for the life; the doors test reads it
      if (this.stuckHops < UNSTICK_AFTER) this.startHop();
      else {
        // Along the obstacle, alternating sides; a few tries in, back off too.
        this.unstickSide = -(this.unstickSide || 1);
        const back = this.stuckHops > UNSTICK_AFTER + 1 ? 0.7 : 0;
        this.unstickDir.set(-desired.z * this.unstickSide - desired.x * back, 0, desired.x * this.unstickSide - desired.z * back).normalize();
        this.unstickT = UNSTICK_TIME;
        // jammed on the way to its post: the post goes too (in a fight,
        // pinned while strafing, it keeps it for after)
        if (!best) { if (this.perch && !this.perch.arrived) this.perchFail = this.perch.id; this.perch = null; }
        this.climb = null;
        this.stairPlan = null;
        if (this.stuckHops > UNSTICK_AFTER + 3) this.stuckHops = 0;
      }
    }

    if (this.hopY > 0 || this.hopV > 0) {
      this.hopV -= HOP_GRAVITY * dt;
      this.hopY += this.hopV * dt;
      // Landing on whatever is under the feet (a crate hopped onto counts).
      const feet = this.groundY + this.hopY;
      const under = groundHeightAt(colliders, this.pos.x, this.pos.z, feet + 0.3, BOT_RADIUS * 0.8);
      if (this.hopV < 0 && feet <= under) { this.groundY = under; this.hopY = 0; this.hopV = 0; }
      else if (under > this.groundY && feet > under) { this.hopY = feet - under; this.groundY = under; }
    } else if (this.climb?.on) {
      // on a rope (ropeStep moves groundY): pinned beside it
      this.pos.x = this.climb.hx;
      this.pos.z = this.climb.hz;
    } else {
      const support = groundHeightAt(colliders, this.pos.x, this.pos.z, this.groundY + 0.5, BOT_RADIUS * 0.8);
      this.groundY += (support - this.groundY) * Math.min(1, dt * 9);
    }
    this.pos.y = this.groundY + this.hopY;
    // Sat in a pew or knelt at the rail: pinned to the spot (a pew row is
    // one solid box, and the push above would have it out in the aisle).
    if (this.rest) {
      this.pos.x = this.rest.at.x; this.pos.z = this.rest.at.z;
      this.groundY = this.pos.y = this.rest.y;
      this.vel.set(0, 0, 0);
    }

    // Real ground speed, not "had steering input" — a bot holding its strafe
    // dance to trade shots was reporting `moving: true` every tick (see the
    // old hardcoded flag this replaced in net.js's publishBot), so remote
    // viewers saw it play a full forward jog while it barely drifted.
    this.moving = Math.hypot(this.vel.x, this.vel.z) > 0.4;

    // --- melee (infected): swing once they've been in reach a beat
    if (this.meleeOnly) {
      this.meleeT -= dt;
      if (best && !stunned && bestD <= MELEE_REACH && this.acquireT >= this.diff.reaction && this.meleeT <= 0) {
        this.meleeT = MELEE_INTERVAL * (0.7 + this.diff.interval * 0.35) * (0.9 + Math.random() * 0.2);
        ctx.onMelee?.(this, best);
      }
      return;
    }

    // --- shoot
    this.fireT -= dt;
    if (this.sidearmReloadT > 0) {
      this.sidearmReloadT -= dt;
      if (this.sidearmReloadT <= 0) this.finishSidearmReload();
    }
    // Hands full with the bomb means no trigger, same as for a player.
    const canSee = !busy && best && bestD < FIRE_RANGE;
    // They keep firing into a guard (user, 2026-10-03: "enemies don't shoot at
    // me when I have my trollsaber shielded"): standing there not shooting
    // read as broken. The rounds still bounce off the blade and drain its
    // meter; smarter bots shoot while they work round the side.
    const canShoot = canSee;
    // A short reaction delay before the first shot, so they don't snap onto
    // someone the instant they round a corner.
    const reacted = this.acquireT >= this.diff.reaction;

    // The keyboard (user, 2026-10-29): someone right in its face on its own
    // level gets swung at, not shot, as a player would; so does anyone in
    // reach of a bot with nothing left to shoot. `knife` is how often a swing
    // lands, KNIFE_DAMAGE its share of the board's 120, so it isn't a
    // one-swing kill the way yours is.
    this.meleeT -= dt;
    if (ctx.onMelee && best && !busy && !stunned && !this.windup && reacted && bestD <= MELEE_REACH
      && Math.abs((best.groundY ?? best.pos.y ?? 0) - this.groundY) < SAME_LEVEL) {
      if (this.meleeT <= 0) {
        this.meleeT = MELEE_INTERVAL * (0.7 + this.diff.interval * 0.35) * (0.9 + Math.random() * 0.2);
        this.fireT = Math.max(this.fireT, 0.45);
        ctx.onMelee(this, best, Math.random() < this.diff.knife ? KNIFE_DAMAGE : 0);
      }
      return;   // the gun waits while the board's out
    }

    // Dry primary with someone still in sight draws the sidearm instead of
    // reloading into a firefight; holstering it again (back to the rifle)
    // waits for a clear moment, same as the primary's own out-of-contact
    // reload just below.
    if (this.rules.oneShot) {
      // One in the Chamber: no sidearm, no reload; dry is the knife.
      this.holdingSecondary = false;
      if (this.ammo > 0 && canShoot && reacted && this.fireT <= 0) {
        this.ammo--;
        this.fireT = this.diff.interval * (0.75 + Math.random() * 0.6);
        const hit = Math.random() < this.hitChance(bestD);
        const head = hit && Math.random() < HEADSHOT_CHANCE;
        if (hit) this.ammo = 1;   // the kill buys the round back
        else this.meleeOnly = true;   // missed: the knife
        onShoot(this, best, hit ? ONE_SHOT_DAMAGE : 0, head, hit, bestD);
      }
      return;
    }
    // With the reserve counted (Troll Royale), a primary with nothing left to
    // load swaps for the sidearm in or out of a fight, and the sidearm only
    // goes back for a primary that has something in it.
    const primaryLive = this.ammo > 0 || this.canReload;
    const wasHolding = this.holdingSecondary;
    // Caught mid-reload with someone close: the sidearm (with a round in it),
    // not the rest of the reload.
    if (!this.holdingSecondary && this.reloadT > SWAP_MIN_LEFT && canSee && bestD < SWAP_RANGE && this.sidearmAmmo > 0 && this.sidearmLive) {
      this.reloadT = 0;
      this.holdingSecondary = true;
    } else if (!this.holdingSecondary && this.ammo <= 0 && (canSee || !primaryLive) && this.sidearmLive) this.holdingSecondary = true;
    else if (this.holdingSecondary && primaryLive && ((!canSee && this.reloadT <= 0) || !this.sidearmLive)) this.holdingSecondary = false;
    if (this.holdingSecondary !== wasHolding) this.fireT = Math.max(this.fireT, SIDEARM_DRAW);
    this.updateAds(dt, { canShoot, reacted, range: bestD, objective });
    if (this.slideT > 0 || this.hopY > 0) this.ads = Math.max(0, this.ads - dt * 6);   // no scope mid-slide or mid-air

    if (this.holdingSecondary) {
      if (reacted && canShoot && this.sidearmReloadT <= 0 && this.fireT <= 0) {
        if (this.sidearmAmmo <= 0) {
          if (this.sidearmCanReload) this.sidearmReloadT = SIDEARM_RELOAD_TIME;
        } else {
          this.sidearmAmmo--;
          this.fireT = this.diff.interval * (0.9 + Math.random() * 0.6);
          const hit = Math.random() < this.hitChance(bestD) * 0.85; // pistols are less accurate at range
          const head = hit && Math.random() < HEADSHOT_CHANCE;
          onShoot(this, best, hit ? this.diff.damage * 0.8 * (head ? 2 : 1) : 0, head, hit, bestD, true);
        }
      }
      if (!canSee && this.ammo < MAG_SIZE && this.reloadT <= 0 && this.canReload) this.reloadT = RELOAD_TIME;
      // Staying on it (the primary's empty): top it up out of contact.
      else if (!canSee && !primaryLive && this.sidearmAmmo < SIDEARM_MAG_SIZE && this.sidearmReloadT <= 0 && this.sidearmCanReload) this.sidearmReloadT = SIDEARM_RELOAD_TIME;
      return;
    }

    if (canShoot && reacted && this.reloadT <= 0 && this.fireT <= 0) {
      if (this.ammo <= 0) {
        if (this.canReload) this.reloadT = RELOAD_TIME;
      } else {
        this.ammo--;
        this.fireT = this.diff.interval * (0.75 + Math.random() * 0.6);
        // Misses are reported too, so the target hears the round go past.
        const hit = Math.random() < this.hitChance(bestD);
        const head = hit && Math.random() < HEADSHOT_CHANCE;
        onShoot(this, best, hit ? this.diff.damage * (head ? 2 : 1) : 0, head, hit, bestD);
      }
    } else if (!canSee && this.ammo < MAG_SIZE && this.reloadT <= 0 && this.canReload) {
      // Top up while out of contact rather than mid-firefight.
      this.reloadT = RELOAD_TIME;
    }
  }

  /* 0..1 through the current reload (0 = not reloading), for the body's
     third-person reload (net.js sends it as `rl`). */
  reloadProgress() {
    if (this.holdingSecondary) return this.sidearmReloadT > 0 ? 1 - this.sidearmReloadT / SIDEARM_RELOAD_TIME : 0;
    return this.reloadT > 0 ? 1 - this.reloadT / RELOAD_TIME : 0;
  }

  /* Scope in or out this frame. Moves `ads` toward the goal at the
     difficulty's scope-in speed (out is quicker, as for a player). */
  updateAds(dt, { canShoot, reacted, range, objective }) {
    const reloading = this.holdingSecondary ? this.sidearmReloadT > 0 : this.reloadT > 0;
    const engaged = canShoot && reacted && range >= ADS_MIN_RANGE;
    if (engaged) this.adsLingerT = between(ADS_LINGER);
    else this.adsLingerT = Math.max(0, this.adsLingerT - dt);
    // An objective that can't wait means running, not scoping.
    const want = !this.meleeOnly && !this.dry && !reloading && !objective?.urgent && !(this.stunT > 0)
      && (engaged || (this.adsLingerT > 0 && !(canShoot && range < ADS_MIN_RANGE)));
    const rate = want ? 1 / ((this.diff.adsTime || 0.3) * (this.perks.has("dexterity") ? PERK_TUNE.dexterityAds : 1)) : 1 / 0.15;
    this.ads = want ? Math.min(1, this.ads + dt * rate) : Math.max(0, this.ads - dt * rate);
  }

  /* A reason to throw, or null. In order of how good a reason it is:
       - enemies bunched up (2+ within CLUSTER of each other): a frag;
       - the one in sight dug in (CAMP_TIME in one spot): a frag;
       - enemies holding the objective we want (hill, bomb site): frag, or a
         flash if the frag is gone;
       - someone we just lost behind cover, still near where we saw them:
         lob it over — a flash when it's close enough to push, else a frag.
     A target we can see and shoot on its own isn't a reason, unless it's
     dug in: the gun is. */
  planThrow(targets, ffa, colliders, eye, best, objective) {
    const enemies = [];
    for (const t of targets) {
      if (!t.alive || t.id === this.id || (!ffa && t.team === this.team)) continue;
      enemies.push(t);
    }
    if (!enemies.length) return null;
    const distTo = (x, z) => Math.hypot(x - this.pos.x, z - this.pos.z);
    const inRange = (d) => d >= NADE_MIN && d <= NADE_MAX;
    const hidden = (x, y, z) => segmentBlocked(colliders, eye, new THREE.Vector3(x, y + 1, z));
    // What's in the pockets: the lethal, and the tactical (smoke is cover,
    // not something to throw at someone, so it has its own use below).
    const L = this.frags > 0 ? this.lethalKind : null;
    const T = this.flashes > 0 ? this.tacticalKind : null;
    const Tat = T && T !== "smoke" ? T : null;

    // Hurt and in a gunfight: smoke between us and them, then back off in it.
    if (T === "smoke" && best && this.hp < (this.maxHp || BOT_HP) * 0.5) {
      const d = distTo(best.pos.x, best.pos.z);
      if (d >= 6) {
        const k = Math.min(0.45, 9 / d);
        const x = this.pos.x + (best.pos.x - this.pos.x) * k, z = this.pos.z + (best.pos.z - this.pos.z) * k;
        return { kind: T, x, y: this.groundY, z, dist: distTo(x, z), lob: false };
      }
    }

    // Saber guard up at us: the blade stops rounds, not blasts or flashes.
    if (best && this.guarded) {
      const d = distTo(best.pos.x, best.pos.z);
      const kind = L || Tat;
      const y = best.groundY ?? best.pos.y ?? 0;
      if (kind && inRange(d)) return { kind, x: best.pos.x, y, z: best.pos.z, dist: d, lob: false };
    }

    if (L) {
      let bestGroup = null;
      for (const e of enemies) {
        const d = distTo(e.pos.x, e.pos.z);
        if (!inRange(d)) continue;
        let n = 0, cx = 0, cz = 0;
        for (const o of enemies) {
          if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) > CLUSTER) continue;
          n++; cx += o.pos.x; cz += o.pos.z;
        }
        if (n >= 2 && (!bestGroup || n > bestGroup.n)) bestGroup = { n, x: cx / n, z: cz / n, y: e.groundY ?? e.pos.y ?? 0 };
      }
      if (bestGroup) {
        return { kind: L, x: bestGroup.x, y: bestGroup.y, z: bestGroup.z,
          dist: distTo(bestGroup.x, bestGroup.z), lob: hidden(bestGroup.x, bestGroup.y, bestGroup.z) };
      }
      // Dug in (user, 2026-10-29): the one it's trading with has held one
      // spot a while (a window, a corner, behind a crate). The gun isn't
      // moving them; a frag will.
      const c = this.camp;
      if (best && c?.id === best.id && c.t >= CAMP_TIME) {
        const d = distTo(best.pos.x, best.pos.z), y = best.groundY ?? best.pos.y ?? 0;
        if (inRange(d)) return { kind: L, x: best.pos.x, y, z: best.pos.z, dist: d, lob: false };
      }
    }

    if (objective) {
      const d = distTo(objective.x, objective.z);
      const held = enemies.some((e) => Math.hypot(e.pos.x - objective.x, e.pos.z - objective.z) <= (objective.radius || 4) + 2);
      if (held && inRange(d)) {
        // Smoke on a held objective is cover for the push onto it.
        const kind = L || T;
        const y = objective.y ?? this.groundY;
        return { kind, x: objective.x, y, z: objective.z, dist: d, lob: hidden(objective.x, y, objective.z) };
      }
    }

    const seen = this.lastSeen;
    if (!best && seen && seen.age < SEEN_MEMORY) {
      const still = enemies.find((e) => e.id === seen.id && Math.hypot(e.pos.x - seen.x, e.pos.z - seen.z) < 5);
      const d = distTo(seen.x, seen.z);
      if (still && inRange(d)) {
        const kind = d < 15 && Tat ? Tat : L || Tat;
        if (kind) return { kind, x: seen.x, y: seen.y, z: seen.z, dist: d, lob: true };
      }
    }
    return null;
  }

  /* Which way to walk to reach `goal` ({ x, z } and, if it has one, a
     height `y` / `groundY`), stairs included (user, 2026-10-03: "bots
     should also be smart in being able to walk up and down stairs").
     Same level (or no height given, or no stairs on the map): the flow
     field on this bot's level. Another level: the foot of the stair that
     best leads there (ctx.stairs: maps.js api.stairs + findStairs, and a
     zombies map's links), then up or down it, then on from the top.
     `orNull`: null instead of a straight line when there's no route, so the
     caller can wander. `goal.static`: a fixed spot (a perch), whose fields
     are kept for the match rather than pooled. */
  steerTo(id, goal, ctx, orNull = false) {
    const stairs = ctx.stairs || [];
    const here = this.groundY;
    // The level its chase fields are read on, held through a step of a few
    // tens of cm: on a shop's 0.3 m threshold groundY flips between 0 and
    // 0.3, the level between 0 and 0.5, and two fields that disagreed about
    // the way (one through the door, one round the block) had it dither in
    // the doorway for good (Trolling Loud's back door).
    if (this.navY == null || Math.abs(here - this.navY) > 0.4) this.navY = here;
    // ...and read on the floor it's really on (navLevelAt). Worked out again
    // only when navY moves or the bot has walked a metre.
    const nl = this.navLevel;
    if (!nl || nl.y !== this.navY || Math.abs(nl.x - this.pos.x) + Math.abs(nl.z - this.pos.z) > 1) {
      this.navLevel = { y: this.navY, x: this.pos.x, z: this.pos.z, at: ctx.colliders ? navLevelAt(ctx.colliders, this.pos.x, this.pos.z, this.navY) : this.navY };
    }
    const navY = this.navLevel.at;
    const gy = goal.groundY ?? goal.y;
    if (this.climb) {
      const dir = this.climbStep(ctx);
      if (dir) return dir;
    }
    // Caught on the treads without a climb on (strafed onto them in a fight,
    // or knocked off course): finish the flight, whichever way the goal is,
    // rather than read the field of a "level" that's only a stair.
    if (stairs.length && this.hopY <= 0) {
      const on = this.onStair(stairs);
      if (on) {
        const { s, len } = on;
        const lo = s.a.y < s.b.y ? s.a : s.b, hi = lo === s.a ? s.b : s.a;
        let exit;
        if (gy == null) exit = Math.hypot(s.a.x - goal.x, s.a.z - goal.z) < Math.hypot(s.b.x - goal.x, s.b.z - goal.z) ? s.a : s.b;
        else exit = gy > here + 0.3 ? hi : gy < here - 0.3 ? lo : (Math.abs(hi.y - gy) < Math.abs(lo.y - gy) ? hi : lo);
        this.climb = { entry: exit === s.a ? s.b : s.a, exit, t: 0, limit: len / 2 + 3 };
        const dir = this.climbStep(ctx);
        if (dir) return dir;
      }
    }
    // `doors`: a fixed spot's field on the ground floor's finer chase grid
    // instead of the old one (navFor), for a stair foot behind a doorway
    // the old grid seals (Troll City's saloon stair).
    const field = (key, x, z, level, isStatic, doors = false) => ctx.navFor?.({ id: key, pos: { x, z }, static: isStatic, doors }, level);
    // The field's own target cell (a goal in a gap too tight for the grid
    // snaps to the nearest open cell, which can be the one we're in): the
    // last few metres are a straight walk.
    const arrived = (f) => {
      const k = f?.openIndex(this.pos.x, this.pos.z);
      return k >= 0 && f.dist[k] === 1 && Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z) < 4;
    };
    const straight = () => {
      const v = new THREE.Vector3(goal.x - this.pos.x, 0, goal.z - this.pos.z);
      return v.lengthSq() > 1e-6 ? v.normalize() : new THREE.Vector3();
    };
    let step = null, tried = false;
    if (gy == null || !stairs.length || Math.abs(gy - here) < SAME_LEVEL) {
      // a fixed spot's field is read on its own floor: a bot up on a
      // 0.8 m cart rounds to the 1 m level, which has no grid round it
      let f = field(id, goal.x, goal.z, goal.static ? gy ?? here : navY, goal.static);
      step = f?.steer(this.pos.x, this.pos.z);
      tried = true;
      if (step) return step;
      // A fixed spot on the ground the old grid can't reach (a post in
      // Hollowgrin's chapel, past a door it seals): the chase grid's.
      if (goal.static && here < 1.2 && (gy ?? 0) < 0.75) {
        const d = field(id, goal.x, goal.z, 0, true, true);
        step = d?.steer(this.pos.x, this.pos.z);
        if (step) return step;
        if (d) f = d;
      }
      if (arrived(f) && (gy == null || Math.abs(gy - here) < 0.6)) return straight();
      // The doors grid has no way from here: a stair's foot, say, in a
      // notch the finer grid seals off. A second opinion from the old grid,
      // whose cells snap out of such corners.
      const old = navY < 0.75 && !goal.static && !(ctx.arena?.navCell >= 1) ? ctx.navFor?.({ id, pos: { x: goal.x, z: goal.z }, coarse: true }, navY) : null;
      step = old?.steer(this.pos.x, this.pos.z);
      if (step) return step;
      // No route on this level, and a wall between here and there: the goal
      // is walled off from this spot, so leave it for a while (the lead pick
      // skips it, a perch is dropped) and drift, rather than grind at the
      // wall. Off the grid (a stair's treads) the bot trusts its own line,
      // as it always did; so does a goal on another floor, whose ground
      // field says nothing about the way there.
      // Just stepped off a stair (its foot in a notch the grid seals, like
      // Hollowgrin's manor stair): on off it a beat, rather than give up on
      // the goal there and wander back up the stair.
      if (this.offStair && (this.clock || 0) < this.offStair.until) return new THREE.Vector3(this.offStair.x, 0, this.offStair.z);
      if (f && f.knows(this.pos.x, this.pos.z) && !f.lineClear(this.pos.x, this.pos.z, goal.x, goal.z)) {
        this.noRoute = { id, until: this.clock + NO_ROUTE_TIME };
        return orNull ? null : this.wanderStep(ctx.dtNow || 0.016);
      }
    }
    // Another floor (or no way there on this one: a landing half a floor
    // short of the goal's): the stair that leads there.
    if (gy != null && stairs.length && Math.abs(gy - here) >= 0.5) {
      const plan = this.planStair(id, goal, gy, ctx, field);
      if (plan) {
        const { entry, exit, key, rope } = plan;
        if (Math.hypot(entry.x - this.pos.x, entry.z - this.pos.z) < 1.1) {
          const len = Math.hypot(exit.x - entry.x, exit.z - entry.z);
          this.climb = rope ? ropeClimb(rope, entry, exit) : { entry, exit, t: 0, limit: len / 2 + 3 };
          this.stairPlan = null;
          const dir = this.climbStep(ctx);
          if (dir) return dir;
        }
        step = field(key, entry.x, entry.z, here, true)?.steer(this.pos.x, this.pos.z);
        if (step) return step;
        if (here < 0.75) step = field(key, entry.x, entry.z, here, true, true)?.steer(this.pos.x, this.pos.z);
        if (step) return step;
        const v = new THREE.Vector3(entry.x - this.pos.x, 0, entry.z - this.pos.z);
        if (v.lengthSq() > 1e-6) return v.normalize();
      }
    }
    if (!tried) step = field(id, goal.x, goal.z, goal.static ? gy ?? here : navY, goal.static)?.steer(this.pos.x, this.pos.z);
    if (step) return step;
    if (orNull) return null;
    const v = new THREE.Vector3(goal.x - this.pos.x, 0, goal.z - this.pos.z);
    return v.lengthSq() > 1e-6 ? v.normalize() : new THREE.Vector3(0, 0, -1);
  }

  /* Up (or down) the flight in this.climb: along its centre line, a little
     ahead of where the bot is on it, so one that stepped on off-centre
     straightens up instead of walking off the side of a narrow stair.
     Null (and the climb over) once it's at the end, or it's taking far too
     long, or it's been knocked off the side. */
  climbStep(ctx) {
    if (this.climb.rope) return this.ropeStep(ctx);
    const c = this.climb, e = c.exit, a = c.entry || e;
    c.t += ctx.dtNow || 0.016;
    const dx = e.x - a.x, dz = e.z - a.z, len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len;
    const t = (this.pos.x - a.x) * ux + (this.pos.z - a.z) * uz;
    const done = (Math.abs(this.groundY - e.y) < 0.45 && Math.hypot(e.x - this.pos.x, e.z - this.pos.z) < 0.9) || t > len + 0.3;
    const side = Math.abs((this.pos.x - a.x) * uz - (this.pos.z - a.z) * ux);
    if (done || c.t > (c.limit || 8) || side > 2.2) {
      // Just off the end of a flight: a beat more the same way (below).
      if (done) this.offStair = { until: (this.clock || 0) + 1.2, x: ux, z: uz };
      this.climb = null;
      return null;
    }
    const aim = Math.min(len, Math.max(0, t) + 1.4);
    const v = new THREE.Vector3(a.x + ux * aim - this.pos.x, 0, a.z + uz * aim - this.pos.z);
    if (v.lengthSq() < 0.04) v.set(ux, 0, uz);
    return v.normalize();
  }

  /* A rope (maps.js api.rope) in this.climb: walk to the spot beside it,
     then up (or down) it like a player, pinned there (update reads `on`),
     and step off at the far end. A zero vector while climbing; null once
     it's done or given up (ground follow then drops it to the floor). */
  ropeStep(ctx) {
    const c = this.climb, e = c.exit, dt = ctx.dtNow || 0.016;
    c.t += dt;
    if (c.t > c.limit) { this.climb = null; return null; }
    if (!c.on) {
      const v = new THREE.Vector3(c.hx - this.pos.x, 0, c.hz - this.pos.z);
      if (v.length() > 0.7 || this.hopY > 0 || this.hopV > 0) return v.lengthSq() > 1e-6 ? v.normalize() : null;
      c.on = true;
      this.slideT = 0;
    }
    this.vel.set(0, 0, 0);
    this.groundY = e.y > this.groundY ? Math.min(e.y, this.groundY + BOT_ROPE_UP * dt) : Math.max(e.y, this.groundY - BOT_ROPE_DOWN * dt);
    if (Math.abs(this.groundY - e.y) < 1e-3) {
      this.pos.x = e.x;
      this.pos.z = e.z;
      this.climb = null;
      return null;
    }
    return new THREE.Vector3();
  }

  /* The flight this bot is standing on, partway up: { s, t, len }, or null. */
  onStair(stairs) {
    for (const s of stairs) {
      if (s.rope) continue;
      const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, len = Math.hypot(dx, dz);
      if (len < 1 || Math.abs(s.b.y - s.a.y) < 1) continue;
      const t = ((this.pos.x - s.a.x) * dx + (this.pos.z - s.a.z) * dz) / len;
      if (t < 0.8 || t > len - 0.8) continue;
      if (Math.abs((this.pos.x - s.a.x) * dz - (this.pos.z - s.a.z) * dx) / len > 1.0) continue;
      const y = s.a.y + (s.b.y - s.a.y) * (t / len);
      if (Math.abs(this.groundY - y) > 0.45) continue;
      // properly off the floor at either end, not walking past its foot
      if (this.groundY < Math.min(s.a.y, s.b.y) + 0.6 || this.groundY > Math.max(s.a.y, s.b.y) - 0.6) continue;
      return { s, t, len };
    }
    return null;
  }

  /* Which stair to take toward `goal` on another level: { entry, exit, key }
     or null. Ranked by real walking distance along this level's field to
     its foot (a stair round the far side of a wall isn't "near") and on from
     its top to the goal along that level's field (one that tops out on some
     other roof doesn't lead there). Kept for a moment: it's a few field
     lookups, and a bot dithering between two stairs reaches neither. */
  planStair(id, goal, gy, ctx, field) {
    const now = this.clock || 0;
    const p = this.stairPlan;
    if (p && p.id === id && now < p.until && Math.abs(p.here - this.groundY) < 0.5) return p.none ? null : p;
    const stairs = ctx.stairs, here = this.groundY, up = gy > here;
    const cand = [];
    for (let i = 0; i < stairs.length; i++) {
      const s = stairs[i];
      for (const [entry, exit, end] of [[s.a, s.b, "a"], [s.b, s.a, "b"]]) {
        if (Math.abs(entry.y - here) > 0.9 || Math.abs(exit.y - entry.y) < 0.5 || (exit.y > entry.y) !== up) continue;
        // and not on past the goal's floor (up the Ferris wheel to reach a
        // platform a metre off the ground)
        if (up ? exit.y > gy + 0.6 : exit.y < gy - 0.6) continue;
        const rough = Math.hypot(entry.x - this.pos.x, entry.z - this.pos.z)
          + Math.hypot(exit.x - goal.x, exit.z - goal.z) + Math.abs(exit.y - gy) * 4;
        cand.push({ i, end, entry, exit, rough });
      }
    }
    cand.sort((m, n) => m.rough - n.rough);
    const fdist = (f, x, z) => {
      if (!f) return Infinity;
      const k = f.openIndex(x, z);
      return k >= 0 && f.dist[k] ? f.dist[k] * f.cell : Infinity;
    };
    let best = null, bestCost = Infinity;
    // the nearest few, and the flight a post was found from (placesFor:
    // `via`), which surely reaches it; a nearer one may top out on a
    // walkway of its own (the Grinleria's escalators)
    for (const c of cand.filter((c, k) => k < 5 || c.i === goal.via)) {
      const key = `stair${c.i}${c.end}`;
      let toFoot = Math.hypot(c.entry.x - this.pos.x, c.entry.z - this.pos.z) < 1.5
        ? 0 : fdist(field(key, c.entry.x, c.entry.z, here, true), this.pos.x, this.pos.z);
      // walled off on the old grid: the finer one may find the doorway
      if (!isFinite(toFoot) && here < 0.75) toFoot = fdist(field(key, c.entry.x, c.entry.z, here, true, true), this.pos.x, this.pos.z);
      if (!isFinite(toFoot)) continue;
      let onward;
      if (Math.abs(c.exit.y - gy) < 0.6) {
        onward = fdist(field(id, goal.x, goal.z, c.exit.y, goal.static), c.exit.x, c.exit.z);
        if (!isFinite(onward)) onward = 200 + Math.hypot(c.exit.x - goal.x, c.exit.z - goal.z);   // a last resort
      } else {
        // A landing short of the goal's floor: only worth it if another
        // flight goes on from there (a funbox's top is a dead end).
        let next = Infinity;
        for (const s of stairs) {
          for (const [en, ex] of [[s.a, s.b], [s.b, s.a]]) {
            if (Math.abs(en.y - c.exit.y) > 0.9 || (ex.y > en.y) !== up || Math.abs(ex.y - en.y) < 0.5) continue;
            if (up ? ex.y > gy + 0.6 : ex.y < gy - 0.6) continue;
            next = Math.min(next, Math.hypot(en.x - c.exit.x, en.z - c.exit.z) * 1.3
              + Math.hypot(ex.x - goal.x, ex.z - goal.z) * 1.3 + Math.abs(ex.y - gy) * 4);
          }
        }
        if (!isFinite(next)) continue;
        onward = next;
      }
      const cost = toFoot + onward;
      if (cost < bestCost) { bestCost = cost; best = { id, key, entry: c.entry, exit: c.exit, rope: stairs[c.i].rope ? stairs[c.i] : null }; }
    }
    this.stairPlan = best ? { ...best, here, until: now + 1.2 } : { id, here, until: now + 0.6, none: true };
    return best;
  }

  /* Sometimes, with nobody in sight, a bot heads up a stair to hold the
     high ground for a few seconds instead of always running at whoever's
     nearest (user: bots should go upstairs on their own, not only when
     chasing). True while it has a perch to go to or hold. */
  updatePerch(dt, ctx) {
    const stairs = ctx.stairs || [];
    if (this.perch) {
      const p = this.perch;
      p.t += dt;
      // Not getting any closer (no route the field knows, a stair it keeps
      // missing): drop it after a few seconds, not the whole give-up time.
      if (!p.arrived) {
        const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z) + Math.abs(p.y - this.groundY) * 3;
        if (p.bestD == null || d < p.bestD - 1) { p.bestD = d; p.gainT = p.t; }
        // On its way round to the stair (walking away from the post to
        // get up to it) is progress too: only standing still for it isn't.
        if (!p.from || Math.hypot(this.pos.x - p.from.x, this.pos.z - p.from.z) > 2) { p.from = { x: this.pos.x, z: this.pos.z }; p.gainT = p.t; }
        if (p.t - p.gainT > PERCH_NO_GAIN) { this.perch = null; this.perchFail = p.id; }
      }
      if (this.perch && p.t > PERCH_GIVE_UP && !p.arrived) this.perch = null;
      return !!this.perch;
    }
    const places = ctx.places;
    if (places?.all.length) {
      this.perchT = (this.perchT ?? between(POST_FIRST)) - dt;
      if (this.perchT > 0) return false;
      this.perchT = between(POST_EVERY);
      // Never two high posts running: down from one, it hunts or takes
      // a post on the ground, so it comes back down to the fight.
      const r = Math.random();
      const k = places.postOdds ?? 1;
      const post = r < POST_UP * k ? (this.lastPostUp ? null : this.pickPost(places, places.upper, ctx))
        : r < (POST_UP + POST_GROUND) * k ? this.pickPost(places, places.ground, ctx) : null;
      if (!post) { this.lastPostUp = false; return false; }     // a hunt this time
      places.claims.set(post.id, (places.claims.get(post.id) || 0) + 1);
      this.lastPostUp = post.y >= UPPER_Y;
      this.perch = { id: post.id, x: post.x, y: post.y, z: post.z, via: post.via, rest: post.rest, t: 0, arrived: false, static: true,
        hold: between(post.y >= UPPER_Y ? POST_HOLD_UP : POST_HOLD_GROUND) };
      return true;
    }
    this.perchT = (this.perchT ?? between(PERCH_FIRST)) - dt;
    if (this.perchT > 0 || !stairs.length) return false;
    this.perchT = between(PERCH_EVERY);
    if (Math.random() > PERCH_CHANCE) return false;
    // A stair top within reach; the spot is a step or two past it, so the
    // bot doesn't park in the stairwell.
    const tops = [];
    for (let i = 0; i < stairs.length; i++) {
      const s = stairs[i];
      const [lo, hi, end] = s.a.y < s.b.y ? [s.a, s.b, "b"] : [s.b, s.a, "a"];
      if (hi.y < 1.2 || hi.y - lo.y < 1) continue;
      if (Math.hypot(hi.x - this.pos.x, hi.z - this.pos.z) > PERCH_RANGE) continue;
      tops.push({ i, end, lo, hi });
    }
    if (!tops.length) return false;
    const c = tops[Math.floor(Math.random() * tops.length)];
    const dx = c.hi.x - c.lo.x, dz = c.hi.z - c.lo.z, l = Math.hypot(dx, dz) || 1;
    let x = c.hi.x, z = c.hi.z;
    const fx = x + dx / l * 1.5, fz = z + dz / l * 1.5;
    if (Math.abs(groundHeightAt(ctx.colliders, fx, fz, c.hi.y + 0.3, BOT_RADIUS * 0.8) - c.hi.y) < 0.3
      && !resolveBlocked(ctx.colliders, fx, fz, c.hi.y)) { x = fx; z = fz; }
    this.perch = { id: `perch${c.i}${c.end}`, x, y: c.hi.y, z, t: 0, hold: between(PERCH_HOLD), arrived: false, static: true };
    return true;
  }

  /* Up from a pew or the rail, back where it walked in from (the aisle). */
  standUp() {
    const r = this.rest;
    if (!r) return;
    this.rest = null;
    this.pos.x = r.x; this.pos.z = r.z;
    this.groundY = this.pos.y = r.y;
  }

  /* At its perch or post (marked so from here on)? A post on the ground
     is a patch of it, not a spot: a few metres off counts; a pew's or a
     rail's, the spot it gets in from. */
  arrivePerch() {
    const p = this.perch;
    const r = p.rest ? 0.7 : p.y < UPPER_Y && p.id.startsWith("post-") ? 3 : 1.2;
    if (!p.arrived && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < r && Math.abs(p.y - this.groundY) < 0.6) p.arrived = true;
    return p.arrived;
  }

  /* A post from `list` (places.upper or .ground), drawn at random, weighted
     away from posts another bot holds or is headed to, from crowded
     districts, from the one it's standing in, and a little by distance, so
     the far side of a big map gets its turn. */
  pickPost(places, list, ctx) {
    if (!list.length) return null;
    const here = places.districtOf(this.pos.x, this.pos.z);
    let sum = 0;
    const w = new Float32Array(list.length);
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (this.perchFail === p.id) continue;
      const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
      if (d < 6 && Math.abs(p.y - this.groundY) < 1) continue;   // already there
      if (p.rest && places.claims.get(p.id)) continue;            // a pew seat holds one
      // High ground: the nearest few, not one another bot holds. The
      // ground posts do the spreading out: away from crowds, from
      // districts that have had bots lately, from this one.
      w[i] = 1 / (1 + 3 * (places.claims.get(p.id) || 0)) * (p.y >= UPPER_Y ? 1 / (1 + d / 40)
        : 1 / (1 + 1.2 * (places.crowd.get(p.district) || 0)) / (1 + (places.heat.get(p.district) || 0) / POST_HEAT)
          / (1 + d / 200) * (p.district === here ? 0.5 : 1) / (places.groundIn?.get(p.district) || 1) * (p.rest?.w ?? 1));
      sum += w[i];
    }
    if (sum <= 0) return null;
    // drawn heaviest first: the same odds, and a low roll is the best post
    const order = [...w.keys()].filter((i) => w[i] > 0).sort((m, n) => w[n] - w[m]);
    let r = Math.random() * sum;
    for (const i of order) { r -= w[i]; if (r <= 0) return list[i]; }
    return list[order[0]];
  }

  /* In a fight up on a floor (a balcony, a walkway, a roof): a step that
     would take it off the edge isn't taken. The strafe turns round instead,
     and if that's off an edge too it stands and shoots. */
  keepFooting(desired, ctx) {
    if (this.groundY < UPPER_Y - 0.3 || this.climb || this.hopY > 0 || desired.lengthSq() < 1e-4) return desired;
    const safe = (v) => groundHeightAt(ctx.colliders, this.pos.x + v.x * 0.9, this.pos.z + v.z * 0.9,
      this.groundY + 0.5, BOT_RADIUS * 0.8) > this.groundY - 0.45;
    if (safe(desired)) return desired;
    this.strafeDir = -this.strafeDir;
    this.wanderT = 0;              // a holding shuffle picks another way
    this.strafeT = Math.max(this.strafeT, 0.8);
    return new THREE.Vector3();
  }

  /* No target and no route: drift, so they don't stand still looking broken. */
  wanderStep(dt) {
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = 2 + Math.random() * 3;
      const a = Math.random() * Math.PI * 2;
      this.wander.set(Math.cos(a), 0, Math.sin(a));
    }
    const out = this.wander.clone();
    if (out.lengthSq() > 0) this.yaw = Math.atan2(-out.x, -out.z);
    return out;
  }
}

export class BotManager {
  constructor() {
    this.bots = [];
    this.enabled = false;
    this.difficulty = "regular";
    this.rules = { oneShot: false, calm: false, skill: null };   // the match's mode rules every bot reads (match-start.js beginMatch)
    this.fieldSrc = null;         // geometry the fields are built from
    this.fieldPool = new Map();   // [level|]target id -> FlowField, reused across sweeps
    this.fieldBases = new Map();  // level -> the blocked grid every field there copies
    this.frameFields = new Map(); // fields already swept this tick
    this.staticFields = new Map(); // [level|]fixed spot -> FlowField, for the match
    this.fieldT = 0;
  }

  get count() { return this.bots.length; }

  clear() {
    this.bots.length = 0;
    this.fieldPool.clear();
    this.frameFields.clear();
  }

  /* Point the nav at a map. Fields built against the old geometry are stale
     the moment the map changes, so they're dropped rather than reused. */
  rebuildNav(colliders, arena, floorY = 0) {
    this.fieldSrc = { colliders, arena, floorY };
    // Which cells are blocked depends only on the map: worked out once here
    // and copied into every field (a big map rebuilding it per target was
    // most of the nav cost). arena.navCell: a coarser grid for big maps.
    this.fieldBases.clear();
    this.fieldPool.clear();
    this.frameFields.clear();
    this.staticFields.clear();
    this.places = null;
  }

  /* Which cells are blocked on a level, worked out once and copied into
     every field there. `doors`: the ground floor's chase grid, cells shut
     by their centre so a doorway a bot fits through is open (user,
     2026-10-07: "bots should be smart too and not run into walls"). The
     fixed spots (a stair's foot, a perch) keep the old grid: stair feet
     sit in notches the finer one opens into sealed pockets, and planStair
     read those as no way there. */
  baseFor(level, doors = false) {
    // A big map's coarse grid (arena.navCell >= 1, Troll Royale's island)
    // has no doorways to find at that scale: it keeps the one grid.
    if (this.fieldSrc.arena.navCell >= 1) doors = false;
    const bk = doors && level <= 0.5 ? `${level}|doors` : level;
    let base = this.fieldBases.get(bk);
    if (!base) {
      const src = this.fieldSrc;
      if (level > 0.5) {
        // Upstairs, a finer grid: walkways and landings up there are often
        // only a metre and a half wide (the Grinder's platforms, the top of
        // a stair), narrower than two coarse cells once the rails are
        // padded, so the ground floor's grid sealed them off. It only
        // covers where there's floor at this height, so a fine grid on a
        // big map (Troll Royale's island) stays small.
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const c of src.colliders) {
          if (c.moving || Math.abs(c.max.y - level) > 0.45) continue;
          x0 = Math.min(x0, c.min.x); x1 = Math.max(x1, c.max.x);
          z0 = Math.min(z0, c.min.z); z1 = Math.max(z1, c.max.z);
        }
        const a = src.arena;
        const bounds = x0 > x1 ? { minX: a.minX, maxX: a.minX + 1, minZ: a.minZ, maxZ: a.minZ + 1 }
          : { minX: Math.max(a.minX, x0 - 2), maxX: Math.min(a.maxX, x1 + 2), minZ: Math.max(a.minZ, z0 - 2), maxZ: Math.min(a.maxZ, z1 + 2) };
        const cell = a.navCell ? Math.max(UPPER_NAV_CELL, a.navCell / 2) : UPPER_NAV_CELL;
        base = new FlowField(src.colliders, bounds, level, { cell, needSupport: true });
      } else if (doors) {
        // Cells shut by their centre, not by any touch of a padded wall:
        // the old rule sealed every doorway narrower than a cell plus two
        // pads, and bots ran at the wall beside it.
        base = new FlowField(src.colliders, src.arena, level || src.floorY, { cell: GROUND_NAV_CELL, blockBy: "centre", pad: NAV_PAD, snap: 4.4 });
      } else {
        base = new FlowField(src.colliders, src.arena, level || src.floorY, { ...(src.arena.navCell ? { cell: src.arena.navCell } : {}) });
      }
      this.fieldBases.set(bk, base);
    }
    return base;
  }

  /* At map load (game.js, after rebuildNav): the posts worked out now,
     under the menu, rather than on the match's first bot update, where
     Hollowgrin's took 150 ms. `stairs` must be the list the updates get
     (ctx.stairs), or they work it out again. */
  prepPlaces(stairs) {
    if (this.fieldSrc) this.placesFor(stairs || [], (level, doors) => this.baseFor(level, doors));
  }

  /* The map's posts (see POST_* above), worked out once per map from the
     nav grids: { upper, ground, all, districtOf, crowd, claims }.
     Upper: on each floor a stair or rope tops out on, the part of it that
     top reaches, a few spots spread across it (the far end of a balcony,
     the corners of a roof), never on its lip. Ground: spots about
     POST_SPACING apart over the largest walkable stretch of ground, so
     every district has some. A big map with its own coarse grid (Troll
     Royale's island: loot, the zone and the drop move its bots) gets none,
     and its bots keep the old stair-top perches. */
  placesFor(stairs, baseFor) {
    if (this.places && this.places.stairs === stairs) return this.places;
    const src = this.fieldSrc, a = src.arena;
    const places = { stairs, upper: [], ground: [], all: [], crowd: new Map(), claims: new Map(), heat: new Map(), crowdT: 0,
      postOdds: a.botPostOdds ?? 1,   // (maps.js) the map's share of posts against hunts
      districtOf: (x, z) => {
        // a room the map names (arena.botRooms) is a district of its own
        const r = a.botRooms?.findIndex(([x0, x1, z0, z1]) => x >= x0 && x < x1 && z >= z0 && z < z1) ?? -1;
        return r >= 0 ? -1 - r : Math.floor((x - a.minX) / DISTRICT) + 64 * Math.floor((z - a.minZ) / DISTRICT);
      } };
    this.places = places;
    if (a.navCell >= 1) return places;
    const t0 = performance.now();
    const centre = (f, k) => ({ x: f.minX + (k % f.w + 0.5) * f.cell, z: f.minZ + (((k / f.w) | 0) + 0.5) * f.cell });
    // open, and so are its eight neighbours: not on a lip or in a notch
    const roomy = (f, k, open) => {
      const ix = k % f.w, iz = (k / f.w) | 0;
      if (ix < 1 || iz < 1 || ix >= f.w - 1 || iz >= f.h - 1) return false;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!open(k + dz * f.w + dx)) return false;
      return true;
    };
    // Up to n of these cells spread apart: each the farthest from those
    // already taken (and from `from`), none closer than `gap`.
    const spread = (f, cells, n, from, gap) => {
      const out = [], pts = cells.map((k) => centre(f, k));
      const d = pts.map((p) => (from ? Math.hypot(p.x - from.x, p.z - from.z) : Infinity));
      for (let m = 0; m < n; m++) {
        let bi = -1, bd = gap;
        for (let i = 0; i < pts.length; i++) if (d[i] > bd) { bd = d[i]; bi = i; }
        if (bi < 0) break;
        const q = pts[bi];
        out.push(q);
        for (let i = 0; i < pts.length; i++) d[i] = Math.min(d[i], Math.hypot(pts[i].x - q.x, pts[i].z - q.z));
      }
      return out;
    };
    const cols = src.colliders;
    const fits = (x, y, z) => Math.abs(groundHeightAt(cols, x, z, y + 0.5, BOT_RADIUS * 0.8) - y) < 0.35 && !resolveBlocked(cols, x, z, y);
    // Upper floors: from every top, the floor it reaches on its level;
    // only the tops a bot can get to from the ground, a flight at a time
    // (Pentagrin's top floor is up a stair whose foot is on a landing the
    // ground's stair doesn't reach).
    const tops = [];
    for (let i = 0; i < stairs.length; i++) {
      const s = stairs[i];
      const [lo, hi] = s.a.y < s.b.y ? [s.a, s.b] : [s.b, s.a];
      if (hi.y - lo.y < 1) continue;
      const level = Math.max(0, Math.round(hi.y * 2) / 2);
      const f = new FlowField(null, null, 0, { template: baseFor(level) });
      if (!f.compute(hi.x, hi.z)) continue;
      tops.push({ i, lo, hi, level, f, grounded: lo.y < 0.5 });
    }
    for (let more = true; more;) {
      more = false;
      for (const t of tops) {
        if (t.grounded) continue;
        const from = tops.find((u) => u.grounded && Math.abs(u.hi.y - t.lo.y) < 0.5 && u.f.dist[u.f.openIndex(t.lo.x, t.lo.z)] > 0);
        if (from) { t.grounded = true; more = true; }
      }
    }
    const reached = new Map();   // level -> cells some top already claimed
    for (const { i, lo, hi, level, f, grounded } of tops) {
      if (!grounded || hi.y < UPPER_Y) continue;
      let seen = reached.get(level);
      if (!seen) reached.set(level, (seen = new Uint8Array(f.w * f.h)));
      let cells = [];
      const any = [];
      for (let k = 0; k < f.dist.length; k++) {
        if (!f.dist[k] || seen[k]) continue;
        seen[k] = 1;
        any.push(k);
        if (roomy(f, k, (j) => !!f.dist[j])) cells.push(k);
      }
      // a floor too tight for a roomy spot (Pentagrin's landings): any of it
      if (!cells.length) cells = any;
      // about one spot per 25 m² of floor, two to five a floor
      const n = Math.max(2, Math.min(5, Math.round(cells.length * f.cell * f.cell / 25)));
      for (const q of spread(f, cells, n, hi, 3)) {
        const y = groundHeightAt(cols, q.x, q.z, hi.y + 0.5, BOT_RADIUS * 0.8);
        if (Math.abs(y - hi.y) > 0.5 || !fits(q.x, y, q.z)) continue;
        places.upper.push({ id: `post-u${places.upper.length}`, x: q.x, y, z: q.z, via: i, district: places.districtOf(q.x, q.z) });
      }
    }
    // The ground: its largest connected stretch on the chase grid, whose
    // doorways are open (the old grid seals Hollowgrin's chapel). A post
    // in there is walked to on that grid too (steerTo's `doors`).
    const g = baseFor(0, true);
    const label = new Int32Array(g.w * g.h), queue = new Int32Array(g.w * g.h);
    let bestLabel = 0, bestSize = 0;
    for (let k0 = 0, n = 0; k0 < label.length; k0++) {
      if (g.blocked[k0] || label[k0]) continue;
      n++;
      let head = 0, tail = 0;
      queue[tail++] = k0; label[k0] = n;
      while (head < tail) {
        const k = queue[head++], ix = k % g.w, iz = (k / g.w) | 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const jx = ix + dx, jz = iz + dz;
          if (jx < 0 || jz < 0 || jx >= g.w || jz >= g.h) continue;
          const j = jz * g.w + jx;
          if (g.blocked[j] || label[j]) continue;
          label[j] = n; queue[tail++] = j;
        }
      }
      if (tail > bestSize) { bestSize = tail; bestLabel = n; }
    }
    const cells = [];
    for (let k = 0; k < label.length; k += 2) {
      if (label[k] !== bestLabel || !roomy(g, k, (j) => label[j] === bestLabel)) continue;
      const c = centre(g, k);
      if ((a.botEdge || a.edge) && !insidePolygon(a.botEdge || a.edge, c.x, c.z)) continue;
      if (a.wade && insidePolygon(a.wade, c.x, c.z)) continue;
      cells.push(k);
    }
    // One a POST_SPACING square: the open spot nearest its middle, so a
    // room in a corner (the chapel) gets one, and edges don't get them all.
    // A spot the old grid has open all round counts as nearer (bots walk
    // there by the old grid's fields: one it only snaps to, they stop
    // short of); one only the chase grid reaches is the last pick.
    const S = POST_SPACING, sq = new Map(), old = baseFor(0);
    const oldOpen = (x, z) => {
      const i = old.index(x, z);
      if (i < 0) return false;
      const ix = i % old.w, iz = (i / old.w) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const jx = ix + dx, jz = iz + dz;
        if (jx < 0 || jz < 0 || jx >= old.w || jz >= old.h || old.blocked[jz * old.w + jx]) return false;
      }
      return true;
    };
    for (const k of cells) {
      const q = centre(g, k);
      const sx = Math.floor((q.x - a.minX) / S), sz = Math.floor((q.z - a.minZ) / S);
      const d = Math.hypot(q.x - (a.minX + (sx + 0.5) * S), q.z - (a.minZ + (sz + 0.5) * S)) + (oldOpen(q.x, q.z) ? 0 : 2);
      const key = sx + 1000 * sz, had = sq.get(key);
      if (had && had.d <= d) continue;
      if (!fits(q.x, 0, q.z) || groundHeightAt(cols, q.x, q.z, 0.5, BOT_RADIUS * 0.8) > 0.3) continue;
      sq.set(key, { d, q });
    }
    // Spots a bot sits or kneels at (arena.botRests: Troll City's pews and
    // communion rail), each a post of its own.
    const rests = (typeof a.botRests === "function" ? a.botRests() : a.botRests) || [];
    // A named room (arena.botRooms) the squares missed, or whose spot lost
    // to the street outside: its open spot nearest its middle.
    for (const [x0, x1, z0, z1] of a.botRooms || []) {
      const inRoom = (q) => q.x >= x0 && q.x < x1 && q.z >= z0 && q.z < z1;
      if ([...sq.values()].some(({ q }) => inRoom(q)) || rests.some(inRoom)) continue;
      let best = null, bd = Infinity;
      for (const k of cells) {
        const q = centre(g, k);
        if (!inRoom(q)) continue;
        const d = Math.hypot(q.x - (x0 + x1) / 2, q.z - (z0 + z1) / 2) + (oldOpen(q.x, q.z) ? 0 : 2);
        if (d >= bd || !fits(q.x, 0, q.z) || groundHeightAt(cols, q.x, q.z, 0.5, BOT_RADIUS * 0.8) > 0.3) continue;
        bd = d; best = q;
      }
      if (best) sq.set(`room${x0},${z0}`, { d: bd, q: best });
    }
    for (const { q } of sq.values()) {
      places.ground.push({ id: `post-g${places.ground.length}`, x: q.x, y: 0, z: q.z, district: places.districtOf(q.x, q.z) });
    }
    for (const r of rests) places.ground.push({ id: `post-r${places.ground.length}`, x: r.x, y: r.y, z: r.z, district: places.districtOf(r.x, r.z), rest: r });
    // ground posts a district has: pickPost shares a district's odds out
    // among them, so a corner with one post comes up as often as a street
    // block with six
    places.groundIn = new Map();
    for (const p of places.ground) places.groundIn.set(p.district, (places.groundIn.get(p.district) || 0) + 1);
    places.all = [...places.upper, ...places.ground];
    places.buildMs = performance.now() - t0;
    return places;
  }

  /* Fill the room up to `target` participants, splitting bots across sides. */
  /* `humanTeams` ({ phantom, ghost }) pads each side rather than the room:
     bots go where the humans aren't. Without it a lone human always stood
     with four bots against three — the bots split evenly among themselves
     and the human made it 5v3. */
  fill(target, humanCount, spawnFor, ffa, humanTeams = null) {
    if (!ffa && humanTeams && target > 0) {
      const want = {
        phantom: Math.max(0, Math.floor(target / 2) - (humanTeams.phantom | 0)),
        ghost: Math.max(0, Math.ceil(target / 2) - (humanTeams.ghost | 0)),
      };
      // Lopsided humans would otherwise let bots + people pass `target`:
      // trim the bigger bot side until the room fits.
      const room = Math.max(0, target - humanCount);
      while (want.phantom + want.ghost > room) {
        if (want.phantom >= want.ghost) want.phantom--; else want.ghost--;
      }
      for (const team of ["phantom", "ghost"]) {
        let have = this.bots.filter((b) => b.team === team).length;
        for (let i = this.bots.length - 1; i >= 0 && have > want[team]; i--) {
          if (this.bots[i].team === team) { this.bots.splice(i, 1); have--; }
        }
        for (; have < want[team]; have++) this.bots.push(new Bot(team, spawnFor(team), this.difficulty, this.rules));
      }
      return;
    }
    const want = Math.max(0, target - humanCount);
    while (this.bots.length > want) this.bots.pop();
    while (this.bots.length < want) {
      const team = ffa
        ? (Math.random() < 0.5 ? "phantom" : "ghost")
        : (this.bots.filter((b) => b.team === "phantom").length <= this.bots.filter((b) => b.team === "ghost").length ? "phantom" : "ghost");
      this.bots.push(new Bot(team, spawnFor(team), this.difficulty, this.rules));
    }
  }

  byId(id) { return this.bots.find((b) => b.id === id) || null; }

  update(dt, ctx) {
    // A Tactical Nuke went off (streaks/nuke.js): nobody moves again this match.
    if (this.frozen) return;
    // One field per *pursued target*, re-swept a few times a second. Keyed by
    // target id and cached for the frame: several bots chasing one person
    // share a single BFS, and bots chasing different people don't thrash a
    // shared field by recomputing it on every lookup.
    this.fieldT -= dt;
    if (this.fieldT <= 0) { this.fieldT = 0.3; this.frameFields?.clear(); }
    if (!this.frameFields) this.frameFields = new Map();
    // A big room: at most this many sweeps a frame. Past it a field already
    // swept for that target is reused a few frames stale rather than 100
    // bots re-sweeping 100 different island-sized fields every 0.3 s.
    let budget = this.bots.length > 24 ? 6 : Infinity;

    const baseFor = (level, doors) => this.baseFor(level, doors);
    const navFor = (target, levelY = 0) => {
      if (!target || !this.fieldSrc) return null;
      // A field per floor level: an upstairs walker needs the upstairs
      // walls, and only cells with floor under them (not the ground plan).
      const level = Math.max(0, Math.round(levelY * 2) / 2);
      // `target.coarse`: a chase on the old grid (steerTo's second opinion
      // when the doors grid has no way from where the bot stands).
      const key = (level ? `${level}|${target.id}` : target.id) + (target.coarse ? "|old" : "") + (target.static && target.doors ? "|doors" : "");
      // A fixed spot (a stair's foot, a perch): swept once and kept for the
      // match, outside the pool, so lots of them can't evict the chases.
      if (target.static) {
        let f = this.staticFields.get(key);
        if (!f) {
          f = new FlowField(null, null, 0, { template: baseFor(level, !!target.doors) });
          f.compute(target.pos.x, target.pos.z);
          this.staticFields.set(key, f);
        }
        return f;
      }
      let f = this.frameFields.get(key);
      if (!f) {
        f = this.fieldPool.get(key);
        if (f?.swept && budget <= 0) return f;
        if (!f) {
          // Ids churn as people join, leave and bots recycle; keep the pool
          // from growing for the length of a match. Room for two targets a
          // bot (a Royale bot chases its own loot), or they evict each other
          // and every lookup is a fresh sweep.
          if (this.fieldPool.size >= Math.max(12, this.bots.length * 2)) {
            this.fieldPool.delete(this.fieldPool.keys().next().value);
          }
          f = new FlowField(null, null, 0, { template: baseFor(level, !target.coarse) });
          this.fieldPool.set(key, f);
        }
        f.compute(target.pos.x, target.pos.z);
        f.swept = true;
        budget--;
        this.frameFields.set(key, f);
      }
      return f;
    };

    // A big room (Troll Royale's 100): a bot nowhere near a real player
    // thinks every 2nd frame (4th past 150 m), staggered, with the skipped
    // time handed over in one go, so it still covers the same ground.
    // `ctx.lodNear`: where the real players are (null = every bot, every frame).
    const lod = ctx.lodNear && this.bots.length > 24 ? ctx.lodNear : null;
    this.lodFrame = (this.lodFrame || 0) + 1;
    // Where everyone is, by district, and which posts are taken: a couple
    // of times a second is plenty for picking the next post.
    const places = this.fieldSrc ? this.placesFor(ctx.stairs || [], baseFor) : null;
    if (places?.all.length && (places.crowdT -= dt) <= 0) {
      places.crowdT = 0.5;
      places.crowd.clear();
      places.claims.clear();
      for (const [k, v] of places.heat) places.heat.set(k, v * POST_HEAT_KEEP);
      for (const b of this.bots) {
        if (!b.alive) continue;
        const k = places.districtOf(b.pos.x, b.pos.z);
        places.crowd.set(k, (places.crowd.get(k) || 0) + 1);
        places.heat.set(k, (places.heat.get(k) || 0) + 0.5);
        if (b.perch) places.claims.set(b.perch.id, (places.claims.get(b.perch.id) || 0) + 1);
      }
    }
    const sub = { ...ctx, navFor, dtNow: dt, places };
    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];
      let step = dt;
      if (lod && bot.alive) {
        let d2 = Infinity;
        for (const p of lod) d2 = Math.min(d2, (p.x - bot.pos.x) ** 2 + (p.z - bot.pos.z) ** 2);
        const every = d2 > 150 * 150 ? 4 : d2 > 70 * 70 ? 2 : 1;
        bot.lodDt = (bot.lodDt || 0) + dt;
        if ((this.lodFrame + i) % every) continue;
        step = Math.min(0.1, bot.lodDt);
        bot.lodDt = 0;
      }
      bot.update(step, sub);
      // One-life modes (Search & Destroy) bring bots back at the round
      // boundary via reviveAll, never on the respawn clock — respawning here
      // meant the attacking side could never be eliminated.
      if (!bot.alive && bot.respawnT <= 0 && !ctx.noRespawn) bot.respawn(ctx.spawnFor(bot.team, bot.id));
    }
  }

  /* Everyone back on their feet at a fresh spawn — a new S&D round. */
  reviveAll(spawnFor) {
    for (const bot of this.bots) bot.respawn(spawnFor(bot.team, bot.id));
  }

  /* Returns { killed, bot } so the caller can award the kill. */
  /* `pierce`: ignores armour (Troll Royale's Cringe). Bots only carry
     armour in Troll Royale (`bot.armor`, set by game.js). `explosive`:
     a blast (combat/damage.js isExplosive), cut by Flak Jacket. */
  applyHit(botId, dmg, { pierce = false, explosive = false } = {}) {
    const bot = this.byId(botId);
    if (!bot || !bot.alive) return { killed: false, bot: null };
    if (explosive && bot.perks.has("flakjacket")) dmg *= PERK_TUNE.flakJacket;
    if (!pierce && bot.armor > 0) {
      const soak = Math.min(bot.armor, dmg);
      bot.armor -= soak;
      dmg -= soak;
      if (dmg <= 0) { bot.onDamaged(); return { killed: false, bot }; }
    }
    bot.hp -= dmg;
    bot.onDamaged();
    if (bot.hp > 0) return { killed: false, bot };
    bot.alive = false;
    bot.deaths++;
    bot.respawnT = RESPAWN;
    return { killed: true, bot };
  }
}
